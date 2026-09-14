// A configuração é lida uma vez, no boot. Se ela aceitar valor errado em silêncio, o app
// sobe apontando para o projeto errado, ou, no pior caso, com uma chave que ignora RLS.

import { describe, expect, it } from 'vitest';
import { ConfiguracaoAusente, lerConfiguracaoDoSupabase } from './configuracaoDoSupabase';

/** Monta um JWT com o `role` pedido. Assinatura falsa: só o payload importa aqui. */
function chaveComPapel(role: string): string {
  const base64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'HS256' })}.${base64url({ role })}.assinatura-falsa`;
}

const URL_VALIDA = 'https://exemplo.supabase.co';

describe('leitura da configuração', () => {
  it('devolve url e chave quando as duas existem', () => {
    expect(
      lerConfiguracaoDoSupabase({
        VITE_SUPABASE_URL: URL_VALIDA,
        VITE_SUPABASE_ANON_KEY: chaveComPapel('anon'),
      }),
    ).toMatchObject({ url: URL_VALIDA });
  });

  it('apara espaço em volta, copiar do painel costuma trazer', () => {
    expect(
      lerConfiguracaoDoSupabase({
        VITE_SUPABASE_URL: `  ${URL_VALIDA}  `,
        VITE_SUPABASE_ANON_KEY: `  ${chaveComPapel('anon')}  `,
      }).url,
    ).toBe(URL_VALIDA);
  });

  it('lista TODAS as variáveis que faltam, não só a primeira', () => {
    // Reportar uma de cada vez faria quem está configurando descobrir o problema em duas
    // rodadas de tentativa e erro.
    try {
      lerConfiguracaoDoSupabase({});
      expect.unreachable('deveria ter lançado');
    } catch (falha) {
      expect(falha).toBeInstanceOf(ConfiguracaoAusente);
      expect((falha as ConfiguracaoAusente).variaveis).toEqual([
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
      ]);
    }
  });

  it('string vazia conta como ausente', () => {
    expect(() =>
      lerConfiguracaoDoSupabase({ VITE_SUPABASE_URL: '   ', VITE_SUPABASE_ANON_KEY: '' }),
    ).toThrow(ConfiguracaoAusente);
  });

  it('a mensagem diz o arquivo a criar e as variáveis', () => {
    expect(() => lerConfiguracaoDoSupabase({})).toThrow(/\.env\.local/);
    expect(() => lerConfiguracaoDoSupabase({})).toThrow(/VITE_SUPABASE_ANON_KEY/);
  });

  it('RECUSA uma service_role no lugar da anon', () => {
    // O erro mais caro possível deste arquivo: service_role ignora RLS, e no bundle do
    // navegador entregaria os dados de todos os tenants a qualquer visitante.
    expect(() =>
      lerConfiguracaoDoSupabase({
        VITE_SUPABASE_URL: URL_VALIDA,
        VITE_SUPABASE_ANON_KEY: chaveComPapel('service_role'),
      }),
    ).toThrow(/service_role/);
  });

  it('chave que não é JWT não é confundida com service_role', () => {
    // Chave publishable nova (`sb_publishable_...`) não é JWT: recusá-la seria barrar o
    // formato certo. Quem valida a chave de verdade é o servidor do Supabase.
    expect(() =>
      lerConfiguracaoDoSupabase({
        VITE_SUPABASE_URL: URL_VALIDA,
        VITE_SUPABASE_ANON_KEY: 'sb_publishable_abc123',
      }),
    ).not.toThrow();
  });
});
