// O que estes testes protegem: que a função recuse ambiente errado ANTES de devolver um
// cliente, e que a recusa nunca imprima a chave.
//
// Os dois defeitos que eles impedem são de custo muito diferente. O primeiro só custa
// tempo: sem a recusa, o erro aparece na primeira consulta, disfarçado de falha de rede.
// O segundo é o defeito nº 1 desta etapa, mensagem de erro vai para log, e log de função
// serverless é lido por gente e guardado por plataforma. A service_role em log é a chave
// que ignora a RLS solta num lugar que ninguém trata como cofre.

import { describe, expect, it } from 'vitest';
import {
  ChaveDeServicoIncorreta,
  ConfiguracaoDeServicoAusente,
  criarClienteDeServico,
} from './clienteDeServico';

/** JWT de mentira com um `role` dentro: só o corpo importa, ninguém valida assinatura. */
function chaveComPapel(papel: string): string {
  const corpo = Buffer.from(JSON.stringify({ role: papel })).toString('base64url');
  return `cabecalho.${corpo}.assinatura-que-nao-confere`;
}

const URL_VALIDA = 'https://projeto-de-mentira.supabase.co';
const CHAVE_DE_SERVICO = chaveComPapel('service_role');
const CHAVE_ANON = chaveComPapel('anon');

describe('criarClienteDeServico com ambiente completo', () => {
  it('devolve um cliente utilizável', () => {
    const cliente = criarClienteDeServico({
      SUPABASE_URL: URL_VALIDA,
      SUPABASE_SERVICE_ROLE_KEY: CHAVE_DE_SERVICO,
    });

    expect(typeof cliente.from).toBe('function');
    expect(typeof cliente.storage.from).toBe('function');
  });

  it('devolve um cliente NOVO a cada chamada', () => {
    // Em serverless o processo é reaproveitado entre invocações de tenants concorrentes.
    // Um cliente memoizado seria objeto mutável compartilhado entre eles.
    const ambiente = { SUPABASE_URL: URL_VALIDA, SUPABASE_SERVICE_ROLE_KEY: CHAVE_DE_SERVICO };

    expect(criarClienteDeServico(ambiente)).not.toBe(criarClienteDeServico(ambiente));
  });

  it('aceita chave opaca de formato novo (`sb_secret_`), que não é JWT', () => {
    const cliente = criarClienteDeServico({
      SUPABASE_URL: URL_VALIDA,
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_naoehjwtnenhum',
    });

    expect(typeof cliente.from).toBe('function');
  });
});

describe('criarClienteDeServico recusa ambiente incompleto', () => {
  it('sem a URL, o erro nomeia SUPABASE_URL', () => {
    const chamada = () =>
      criarClienteDeServico({ SUPABASE_SERVICE_ROLE_KEY: CHAVE_DE_SERVICO });

    expect(chamada).toThrow(ConfiguracaoDeServicoAusente);
    expect(chamada).toThrow(/SUPABASE_URL/);
  });

  it('sem a chave, o erro nomeia SUPABASE_SERVICE_ROLE_KEY', () => {
    const chamada = () => criarClienteDeServico({ SUPABASE_URL: URL_VALIDA });

    expect(chamada).toThrow(ConfiguracaoDeServicoAusente);
    expect(chamada).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('sem as duas, lista as duas de uma vez', () => {
    // Uma por vez faria quem configura descobrir o segundo problema só depois de corrigir
    // o primeiro, com um deploy no meio.
    try {
      criarClienteDeServico({});
      expect.unreachable('deveria ter recusado o ambiente vazio');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ConfiguracaoDeServicoAusente);
      expect((erro as ConfiguracaoDeServicoAusente).variaveis).toEqual([
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
      ]);
    }
  });

  it('variável presente mas em branco conta como ausente', () => {
    // Variável vazia na Vercel é o jeito mais comum de "existir e não valer nada".
    const chamada = () =>
      criarClienteDeServico({ SUPABASE_URL: '   ', SUPABASE_SERVICE_ROLE_KEY: CHAVE_DE_SERVICO });

    expect(chamada).toThrow(ConfiguracaoDeServicoAusente);
  });
});

describe('criarClienteDeServico recusa a chave errada no lugar da service_role', () => {
  it('a chave `anon` no lugar da service_role é erro específico', () => {
    // Sem esta recusa o cliente é criado, a RLS recusa tudo (não há usuário autenticado) e
    // a API responde 404 para produto que existe. O rastro apontaria para o lugar errado.
    const chamada = () =>
      criarClienteDeServico({ SUPABASE_URL: URL_VALIDA, SUPABASE_SERVICE_ROLE_KEY: CHAVE_ANON });

    expect(chamada).toThrow(ChaveDeServicoIncorreta);
    expect(chamada).toThrow(/anon/);
  });

  it('a chave publishable de formato novo também é recusada', () => {
    const chamada = () =>
      criarClienteDeServico({
        SUPABASE_URL: URL_VALIDA,
        SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_naoehjwtnenhum',
      });

    expect(chamada).toThrow(ChaveDeServicoIncorreta);
  });

  it('qualquer papel legível que não seja service_role é recusado', () => {
    const chamada = () =>
      criarClienteDeServico({
        SUPABASE_URL: URL_VALIDA,
        SUPABASE_SERVICE_ROLE_KEY: chaveComPapel('authenticated'),
      });

    expect(chamada).toThrow(ChaveDeServicoIncorreta);
  });
});

describe('nenhuma mensagem de erro carrega a chave', () => {
  // Mensagem de erro vai para log, e log de função serverless é lido por gente e guardado
  // pela plataforma. A service_role em log é a chave que ignora a RLS solta fora do cofre.
  //
  // `segredos` é o que a mensagem NÃO pode conter: a chave inteira e cada pedaço dela que
  // sozinho já a identificaria numa busca de log. O prefixo público (`sb_publishable_`) e o
  // nome do papel ficam de fora de propósito, a mensagem precisa nomear o papel para ser
  // útil, e nomear o papel não entrega chave nenhuma.
  const casos: Array<{ nome: string; ambiente: Record<string, string>; segredos: string[] }> = [
    {
      nome: 'anon no lugar da service_role',
      ambiente: { SUPABASE_URL: URL_VALIDA, SUPABASE_SERVICE_ROLE_KEY: CHAVE_ANON },
      segredos: CHAVE_ANON.split('.'),
    },
    {
      nome: 'publishable opaca no lugar da service_role',
      ambiente: {
        SUPABASE_URL: URL_VALIDA,
        SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_zzsegredoopaco',
      },
      segredos: ['zzsegredoopaco'],
    },
    {
      nome: 'chave certa, mas faltando a URL',
      ambiente: { SUPABASE_SERVICE_ROLE_KEY: CHAVE_DE_SERVICO },
      segredos: CHAVE_DE_SERVICO.split('.'),
    },
  ];

  for (const { nome, ambiente, segredos } of casos) {
    it(`não vaza a chave: ${nome}`, () => {
      const chave = ambiente['SUPABASE_SERVICE_ROLE_KEY'] as string;

      try {
        criarClienteDeServico(ambiente);
        expect.unreachable('deveria ter recusado este ambiente');
      } catch (erro) {
        // `stack` junto porque é ele que costuma ir inteiro para o log da plataforma.
        const mensagem = `${(erro as Error).message} ${(erro as Error).stack ?? ''}`;

        expect(mensagem).not.toContain(chave);
        for (const segredo of segredos) {
          expect(mensagem, `vazou o pedaço "${segredo}" da chave`).not.toContain(segredo);
        }
      }
    });
  }
});
