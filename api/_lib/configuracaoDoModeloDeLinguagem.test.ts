// Cliente Supabase falso, com uma "tabela" em memória. Sem rede e sem banco.

import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  apagarConfiguracao,
  carregarConfiguracaoParaUso,
  carregarConfiguracaoVisivel,
  gravarConfiguracao,
} from './configuracaoDoModeloDeLinguagem';
import { cifrarChaveDoFornecedor } from './cifraDaChaveDoFornecedor';
import { FalhaDaApi } from './tiposDaApi';

const CIFRA = randomBytes(32);
const TENANT = 'tenant-1';
const USUARIO = 'usuario-1';
const CHAVE = 'gsk_chave-do-fornecedor-1234';

type Linha = Record<string, unknown>;

function bancoFalso(linhas: Linha[] = []) {
  const observado = { campos: '', tabela: '', apagou: false };

  function consulta(filtros: Array<[string, unknown]> = []) {
    const encadeador = {
      eq(coluna: string, valor: unknown) {
        filtros.push([coluna, valor]);
        return encadeador;
      },
      maybeSingle() {
        const linha = linhas.find((l) => filtros.every(([coluna, valor]) => l[coluna] === valor));
        if (!linha) return Promise.resolve({ data: null, error: null });
        // Devolve SÓ os campos pedidos: um falso que devolvesse a linha inteira esconderia um
        // `select` que esqueceu de listar a coluna, ou que pediu uma que não devia.
        const pedidos = observado.campos.split(',').map((campo) => campo.trim());
        return Promise.resolve({ data: Object.fromEntries(pedidos.map((campo) => [campo, linha[campo]])), error: null });
      },
      then: undefined,
    };
    return encadeador;
  }

  const cliente = {
    from(tabela: string) {
      observado.tabela = tabela;
      return {
        select(campos: string) {
          observado.campos = campos;
          return consulta();
        },
        upsert(linha: Linha) {
          // Como o Postgres: o `not null` vale para a linha a inserir mesmo quando há conflito.
          if (linha.chave_cifrada === undefined || linha.chave_cifrada === null) {
            return Promise.resolve({ error: { message: 'null value in column "chave_cifrada" violates not-null constraint' } });
          }
          const existente = linhas.find((l) => l.tenant_id === linha.tenant_id);
          if (existente) Object.assign(existente, linha);
          else linhas.push({ ...linha, created_at: '2026-09-14T00:00:00.000Z' });
          return Promise.resolve({ error: null });
        },
        update(campos: Linha) {
          return {
            eq(coluna: string, valor: unknown) {
              const existente = linhas.find((l) => l[coluna] === valor);
              if (existente) Object.assign(existente, campos);
              return Promise.resolve({ error: null });
            },
          };
        },
        delete() {
          return {
            eq(coluna: string, valor: unknown) {
              observado.apagou = true;
              const indice = linhas.findIndex((l) => l[coluna] === valor);
              if (indice >= 0) linhas.splice(indice, 1);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  return { cliente: cliente as unknown as SupabaseClient, linhas, observado };
}

const pedidaDeGroq = {
  fornecedor: 'groq' as const,
  modelo: 'llama-3.3-70b-versatile',
  chave: CHAVE,
  endereco: null,
  precoEntradaPorMilhao: 0,
  precoSaidaPorMilhao: 0,
  tetoMensalUsd: null,
};

describe('gravar e ler a configuração', () => {
  it('grava a chave cifrada, e o que volta para a tela traz só o final dela', async () => {
    const { cliente, linhas } = bancoFalso();

    const visivel = await gravarConfiguracao(cliente, TENANT, USUARIO, pedidaDeGroq, CIFRA);

    expect(visivel.fornecedor).toBe('groq');
    expect(visivel.final_da_chave).toBe('1234');
    // A chave não está no que volta, em campo nenhum.
    expect(JSON.stringify(visivel)).not.toContain(CHAVE);
    // E no banco ela está cifrada.
    expect(String(linhas[0]?.chave_cifrada)).toMatch(/^v1\./);
    expect(String(linhas[0]?.chave_cifrada)).not.toContain(CHAVE);
    expect(linhas[0]?.updated_by).toBe(USUARIO);
  });

  it('gravar sem chave mantém a chave que já estava, e só troca o resto', async () => {
    const { cliente, linhas } = bancoFalso();
    await gravarConfiguracao(cliente, TENANT, USUARIO, pedidaDeGroq, CIFRA);
    const cifradaAntes = linhas[0]?.chave_cifrada;

    const visivel = await gravarConfiguracao(
      cliente,
      TENANT,
      USUARIO,
      { ...pedidaDeGroq, modelo: 'llama-3.1-8b-instant', chave: null },
      CIFRA,
    );

    expect(visivel.modelo).toBe('llama-3.1-8b-instant');
    expect(visivel.final_da_chave).toBe('1234');
    expect(linhas[0]?.chave_cifrada).toBe(cifradaAntes);
  });

  it('primeira configuração sem chave é recusada, e não grava linha nenhuma', async () => {
    const { cliente, linhas } = bancoFalso();

    await expect(gravarConfiguracao(cliente, TENANT, USUARIO, { ...pedidaDeGroq, chave: null }, CIFRA)).rejects.toThrow(
      /Cole a chave do fornecedor/,
    );
    expect(linhas).toHaveLength(0);
  });

  it('sem configuração, a leitura visível devolve null', async () => {
    const { cliente } = bancoFalso();
    expect(await carregarConfiguracaoVisivel(cliente, TENANT)).toBeNull();
  });

  it('a leitura visível não pede a coluna da chave cifrada', async () => {
    const { cliente, observado } = bancoFalso();
    await carregarConfiguracaoVisivel(cliente, TENANT);

    expect(observado.tabela).toBe('tenant_modelos_de_linguagem');
    expect(observado.campos).not.toContain('chave_cifrada');
    // Campos explícitos, nunca `select *` (CLAUDE.md).
    expect(observado.campos).not.toContain('*');
  });
});

describe('a configuração para uso, com a chave decifrada', () => {
  it('devolve a chave em claro e o endereço fixo do fornecedor da lista', async () => {
    const { cliente } = bancoFalso();
    await gravarConfiguracao(cliente, TENANT, USUARIO, pedidaDeGroq, CIFRA);

    const uso = await carregarConfiguracaoParaUso(cliente, TENANT, CIFRA);

    expect(uso.chave).toBe(CHAVE);
    expect(uso.enderecoBase).toBe('https://api.groq.com/openai/v1');
    expect(uso.nomeDoFornecedor).toBe('Groq');
    expect(uso.preco).toEqual({ entrada: 0, saida: 0 });
  });

  it('na API própria, o endereço é o gravado, e o preço vem junto', async () => {
    const { cliente } = bancoFalso();
    await gravarConfiguracao(
      cliente,
      TENANT,
      USUARIO,
      {
        ...pedidaDeGroq,
        fornecedor: 'api_propria',
        endereco: 'https://api.minhamarca.com/v1',
        precoEntradaPorMilhao: 0.4,
        precoSaidaPorMilhao: 1.6,
        tetoMensalUsd: 25,
      },
      CIFRA,
    );

    const uso = await carregarConfiguracaoParaUso(cliente, TENANT, CIFRA);

    expect(uso.enderecoBase).toBe('https://api.minhamarca.com/v1');
    expect(uso.preco).toEqual({ entrada: 0.4, saida: 1.6 });
    expect(uso.tetoMensalUsd).toBe(25);
  });

  it('sem configuração, recusa com FORNECEDOR_NAO_CONFIGURADO', async () => {
    const { cliente } = bancoFalso();

    await expect(carregarConfiguracaoParaUso(cliente, TENANT, CIFRA)).rejects.toMatchObject({
      codigo: 'FORNECEDOR_NAO_CONFIGURADO',
    });
  });

  it('fornecedor gravado que saiu da lista manda reconfigurar, em vez de chamar endereço nenhum', async () => {
    const { cliente } = bancoFalso([
      {
        tenant_id: TENANT,
        fornecedor: 'fornecedor_aposentado',
        modelo: 'm',
        endereco: null,
        preco_entrada_por_milhao: 0,
        preco_saida_por_milhao: 0,
        teto_mensal_usd: null,
        final_da_chave: '1234',
        updated_at: '2026-09-14T00:00:00.000Z',
        chave_cifrada: cifrarChaveDoFornecedor(CHAVE, CIFRA),
      },
    ]);

    const erro = await carregarConfiguracaoParaUso(cliente, TENANT, CIFRA).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(FalhaDaApi);
    expect((erro as FalhaDaApi).codigo).toBe('FORNECEDOR_NAO_CONFIGURADO');
    expect((erro as FalhaDaApi).message).toMatch(/Escolha um fornecedor de novo/);
  });

  it('chave gravada ilegível (cifra trocada) falha alto, e sem dizer o motivo', async () => {
    const { cliente } = bancoFalso();
    await gravarConfiguracao(cliente, TENANT, USUARIO, pedidaDeGroq, CIFRA);

    await expect(carregarConfiguracaoParaUso(cliente, TENANT, randomBytes(32))).rejects.toThrow(/Grave a chave de novo/);
  });
});

describe('apagar a configuração', () => {
  it('apaga a linha do tenant', async () => {
    const { cliente, linhas } = bancoFalso();
    await gravarConfiguracao(cliente, TENANT, USUARIO, pedidaDeGroq, CIFRA);

    await apagarConfiguracao(cliente, TENANT);

    expect(linhas).toHaveLength(0);
  });
});
