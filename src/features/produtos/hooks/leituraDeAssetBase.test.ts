// Estes testes existem porque a validação de caminho é a ÚNICA barreira que sobrevive à
// rodada 3: a função serverless vai ler com service_role, que ignora a policy de Storage.
// Se o validador deixar passar caminho de outro tenant, a API cruza marcas concorrentes —
// que é exatamente a promessa comercial que o produto não pode quebrar (ADR-002).

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  obterUrlDoAssetBase,
  validarCaminhoDeAssetBase,
  VALIDADE_DA_URL_EM_SEGUNDOS,
  type ClienteDeStorage,
} from './leituraDeAssetBase';

const TENANT = '11111111-1111-1111-1111-111111111111';
const OUTRO_TENANT = '22222222-2222-2222-2222-222222222222';
const PRODUTO = '33333333-3333-3333-3333-333333333333';
const CAMINHO_VALIDO = `tenants/${TENANT}/products/${PRODUTO}/base.svg`;

/** Cliente de mentira: registra o que foi pedido e devolve o que o teste mandar. */
function clienteFalso(resposta: {
  data?: { signedUrl: string } | null;
  error?: { message: string } | null;
}) {
  const chamadas: Array<{ bucket: string; caminho: string; validade: number }> = [];

  const cliente: ClienteDeStorage = {
    storage: {
      from: (bucket) => ({
        createSignedUrl: async (caminho, validade) => {
          chamadas.push({ bucket, caminho, validade });
          return { data: resposta.data ?? null, error: resposta.error ?? null };
        },
      }),
    },
  };

  return { cliente, chamadas };
}

describe('validarCaminhoDeAssetBase', () => {
  it('aceita o caminho canônico do próprio tenant', () => {
    expect(() => validarCaminhoDeAssetBase(CAMINHO_VALIDO, TENANT)).not.toThrow();
  });

  it('recusa caminho de outro tenant', () => {
    expect(() => validarCaminhoDeAssetBase(CAMINHO_VALIDO, OUTRO_TENANT)).toThrow(
      /pertence a outra marca/i,
    );
  });

  it('recusa caminho sem a raiz tenants/', () => {
    expect(() => validarCaminhoDeAssetBase(`x/${TENANT}/products/${PRODUTO}/base.svg`, TENANT)).toThrow(
      /fora do padrão/i,
    );
  });

  it('recusa travessia de diretório', () => {
    expect(() =>
      validarCaminhoDeAssetBase(`tenants/${TENANT}/products/../../${OUTRO_TENANT}/base.svg`, TENANT),
    ).toThrow(/fora do padrão/i);
  });

  it('recusa profundidade diferente da canônica', () => {
    expect(() => validarCaminhoDeAssetBase(`tenants/${TENANT}/products/${PRODUTO}`, TENANT)).toThrow(
      /fora do padrão/i,
    );
  });

  it('recusa segmento vazio', () => {
    expect(() => validarCaminhoDeAssetBase(`tenants//products/${PRODUTO}/base.svg`, TENANT)).toThrow(
      /fora do padrão/i,
    );
  });

  it('recusa travessia com profundidade canônica, que só a guarda de ".." reprova', () => {
    // O caso acima tem 7 segmentos e é reprovado pela profundidade sozinha — ou seja, não
    // prova nada sobre a guarda de `..`. Este tem os 5 segmentos canônicos, prefixos e
    // tenant certos, e `..` casa o whitelist de forma (ponto é permitido): sem a guarda,
    // passa inteiro. Provado por mutação — removendo a guarda, só este caso fica vermelho.
    expect(() => validarCaminhoDeAssetBase(`tenants/${TENANT}/products/../base.svg`, TENANT)).toThrow(
      /fora do padrão/i,
    );
  });

  it('recusa travessia percent-encoded, que não tem ".." literal', () => {
    // Sem o whitelist de forma, este caminho passa: 5 segmentos, prefixos certos, sem
    // barra e sem `..`. Bastaria uma camada HTTP decodificar para a assinatura sair da
    // pasta do tenant.
    expect(() =>
      validarCaminhoDeAssetBase(`tenants/${TENANT}/products/p/%2e%2e%2f%2e%2e%2fbase.svg`, TENANT),
    ).toThrow(/fora do padrão/i);
  });

  it('recusa barra codificada montando caminho de outro tenant', () => {
    expect(() =>
      validarCaminhoDeAssetBase(`tenants/${TENANT}%2f..%2f${OUTRO_TENANT}/products/p/base.svg`, TENANT),
    ).toThrow(/fora do padrão/i);
  });

  it('distingue arquivo ausente de marca ausente', () => {
    // As duas mensagens são diferentes de propósito: na rodada 3 não existe o guarda da
    // tela, e mandar quem perdeu a sessão investigar o produto custa suporte.
    expect(() => validarCaminhoDeAssetBase('', TENANT)).toThrow(/sem arquivo base/i);
    expect(() => validarCaminhoDeAssetBase(CAMINHO_VALIDO, '')).toThrow(/identificar a marca/i);
  });
});

// Esta é a trava que a suíte comum não consegue dar: `vitest.config.ts` injeta o
// .env.local em todo teste, então o cliente anon-key carrega sem throw e um acoplamento
// transitivo com ele passa despercebido — foi assim que a primeira versão deste módulo
// ficou impossível de importar em Node sem ninguém ver. Por isso a verificação é estática:
// lê o grafo de imports no disco em vez de carregar o módulo.
describe('grafo de imports de leituraDeAssetBase', () => {
  const AQUI = dirname(fileURLToPath(import.meta.url));

  function lerEspecificadores(arquivo: string): string[] {
    return [...readFileSync(arquivo, 'utf8').matchAll(/from\s+'([^']+)'/g)].map((achado) =>
      String(achado[1]),
    );
  }

  function fecharGrafo(arquivo: string, vistos = new Map<string, string[]>()) {
    if (vistos.has(arquivo)) return vistos;

    const especificadores = lerEspecificadores(arquivo);
    vistos.set(arquivo, especificadores);

    for (const especificador of especificadores) {
      if (!especificador.startsWith('.')) continue;
      const base = resolve(dirname(arquivo), especificador);
      const alvo = [`${base}.ts`, `${base}.tsx`].find((candidato) => existsSync(candidato));
      if (alvo) fecharGrafo(alvo, vistos);
    }

    return vistos;
  }

  it('não alcança o cliente do navegador nem o SDK, direta ou transitivamente', () => {
    const grafo = fecharGrafo(resolve(AQUI, 'leituraDeAssetBase.ts'));
    const todos = [...grafo.values()].flat();

    expect(todos.some((especificador) => especificador.includes('lib/supabase/cliente'))).toBe(
      false,
    );
    expect(todos).not.toContain('@supabase/supabase-js');
  });
});

describe('obterUrlDoAssetBase', () => {
  it('assina o caminho no bucket certo, com a validade decidida', async () => {
    const { cliente, chamadas } = clienteFalso({ data: { signedUrl: 'https://exemplo/assinada' } });

    const url = await obterUrlDoAssetBase(cliente, CAMINHO_VALIDO, TENANT);

    expect(url).toBe('https://exemplo/assinada');
    expect(chamadas).toEqual([
      { bucket: 'assets-base', caminho: CAMINHO_VALIDO, validade: VALIDADE_DA_URL_EM_SEGUNDOS },
    ]);
  });

  it('nem chega ao Storage quando o caminho é de outro tenant', async () => {
    const { cliente, chamadas } = clienteFalso({ data: { signedUrl: 'https://exemplo/assinada' } });

    await expect(obterUrlDoAssetBase(cliente, CAMINHO_VALIDO, OUTRO_TENANT)).rejects.toThrow(
      /pertence a outra marca/i,
    );
    expect(chamadas).toHaveLength(0);
  });

  it('traduz erro do Storage sem repassar a mensagem original', async () => {
    // A mensagem crua pode conter caminho de outro tenant: vira vazamento na tela e no log.
    const { cliente } = clienteFalso({ error: { message: `Object not found: ${CAMINHO_VALIDO}` } });

    await expect(obterUrlDoAssetBase(cliente, CAMINHO_VALIDO, TENANT)).rejects.toThrow(
      'Não foi possível abrir o arquivo deste modelo. Tente de novo.',
    );
  });

  it('trata resposta sem erro e sem dado como falha', async () => {
    const { cliente } = clienteFalso({});

    await expect(obterUrlDoAssetBase(cliente, CAMINHO_VALIDO, TENANT)).rejects.toThrow(
      /não foi possível abrir/i,
    );
  });
});
