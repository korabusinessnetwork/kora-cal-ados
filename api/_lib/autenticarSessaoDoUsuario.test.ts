// Sem rede: cliente Supabase falso montado à mão, como em `carregarProdutoDoTenant.test.ts`.
//
// O que estes testes protegem é a ORDEM e a presença das duas checagens. Um `getUser` sem a consulta
// a `tenant_members` deixaria qualquer pessoa logada configurar o fornecedor de qualquer marca, e o
// código continuaria parecendo correto, porque `service_role` não é recusado por RLS nenhuma.

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { autenticarSessaoDoUsuario, ehUuid, lerTokenDaSessao } from './autenticarSessaoDoUsuario';
import { FalhaDaApi } from './tiposDaApi';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OUTRO_TENANT = '22222222-2222-4222-8222-222222222222';
const USUARIO = '33333333-3333-4333-8333-333333333333';

interface Observado {
  tokenConferido: string | null;
  tabela: string;
  campos: string;
  filtros: Array<[string, unknown]>;
}

function clienteFalso(membros: Array<{ tenant_id: string; user_id: string; papel: string }>, tokenValido = 'token-bom') {
  const observado: Observado = { tokenConferido: null, tabela: '', campos: '', filtros: [] };

  const encadeador = {
    eq(coluna: string, valor: unknown) {
      observado.filtros.push([coluna, valor]);
      return encadeador;
    },
    maybeSingle() {
      const linha = membros.find((membro) =>
        observado.filtros.every(([coluna, valor]) => (membro as Record<string, unknown>)[coluna] === valor),
      );
      return Promise.resolve({ data: linha ? { papel: linha.papel } : null, error: null });
    },
  };

  const cliente = {
    auth: {
      getUser(token: string) {
        observado.tokenConferido = token;
        return Promise.resolve(
          token === tokenValido
            ? { data: { user: { id: USUARIO } }, error: null }
            : { data: { user: null }, error: { message: 'invalid token' } },
        );
      },
    },
    from(tabela: string) {
      observado.tabela = tabela;
      return {
        select(campos: string) {
          observado.campos = campos;
          return encadeador;
        },
      };
    },
  };

  return { cliente: cliente as unknown as SupabaseClient, observado };
}

const pedidoCom = (autorizacao?: string) =>
  new Request('https://kora.test/api/v1/modelo-de-linguagem/configuracao', {
    headers: autorizacao === undefined ? {} : { Authorization: autorizacao },
  });

async function codigoAoAutenticar(...argumentos: Parameters<typeof autenticarSessaoDoUsuario>): Promise<string | null> {
  try {
    await autenticarSessaoDoUsuario(...argumentos);
    return null;
  } catch (erro) {
    if (erro instanceof FalhaDaApi) return erro.codigo;
    throw erro;
  }
}

describe('lerTokenDaSessao', () => {
  it('lê o token do Bearer, tolera espaço e caixa, e recusa o que não é Bearer', () => {
    expect(lerTokenDaSessao(pedidoCom('Bearer abc.def'))).toBe('abc.def');
    expect(lerTokenDaSessao(pedidoCom('  bearer   abc.def  '))).toBe('abc.def');
    expect(lerTokenDaSessao(pedidoCom('Basic abc'))).toBeNull();
    expect(lerTokenDaSessao(pedidoCom('Bearer '))).toBeNull();
    expect(lerTokenDaSessao(pedidoCom())).toBeNull();
  });
});

describe('autenticarSessaoDoUsuario', () => {
  it('devolve o papel de quem é membro, e confere o token no Supabase', async () => {
    const { cliente, observado } = clienteFalso([{ tenant_id: TENANT, user_id: USUARIO, papel: 'owner' }]);

    const sessao = await autenticarSessaoDoUsuario(cliente, pedidoCom('Bearer token-bom'), TENANT, 'owner');

    expect(sessao).toEqual({ usuarioId: USUARIO, tenantId: TENANT, papel: 'owner' });
    expect(observado.tokenConferido).toBe('token-bom');
    expect(observado.tabela).toBe('tenant_members');
    // Campos explícitos, nunca `select *` (CLAUDE.md).
    expect(observado.campos).toBe('papel');
    // Os DOIS filtros: sem o de usuário, bastaria o tenant existir.
    expect(observado.filtros).toEqual([
      ['tenant_id', TENANT],
      ['user_id', USUARIO],
    ]);
  });

  it('membro passa onde membro basta, e é recusado onde a ação é de owner', async () => {
    const { cliente } = clienteFalso([{ tenant_id: TENANT, user_id: USUARIO, papel: 'membro' }]);

    expect((await autenticarSessaoDoUsuario(cliente, pedidoCom('Bearer token-bom'), TENANT, 'membro')).papel).toBe('membro');
    expect(await codigoAoAutenticar(cliente, pedidoCom('Bearer token-bom'), TENANT, 'owner')).toBe('SEM_PERMISSAO');
  });

  it('quem não é membro do tenant é recusado, mesmo com sessão válida', async () => {
    // O caso que o `service_role` não recusaria sozinho: pessoa logada pedindo outra marca.
    const { cliente } = clienteFalso([{ tenant_id: OUTRO_TENANT, user_id: USUARIO, papel: 'owner' }]);

    expect(await codigoAoAutenticar(cliente, pedidoCom('Bearer token-bom'), TENANT, 'membro')).toBe('SEM_PERMISSAO');
  });

  it('sem token é SESSAO_AUSENTE, e token inválido é SESSAO_INVALIDA', async () => {
    const { cliente } = clienteFalso([{ tenant_id: TENANT, user_id: USUARIO, papel: 'owner' }]);

    expect(await codigoAoAutenticar(cliente, pedidoCom(), TENANT, 'membro')).toBe('SESSAO_AUSENTE');
    expect(await codigoAoAutenticar(cliente, pedidoCom('Bearer token-velho'), TENANT, 'membro')).toBe('SESSAO_INVALIDA');
  });

  it('tenant que não é uuid é recusado antes de qualquer consulta', async () => {
    const { cliente, observado } = clienteFalso([{ tenant_id: TENANT, user_id: USUARIO, papel: 'owner' }]);

    expect(await codigoAoAutenticar(cliente, pedidoCom('Bearer token-bom'), "' or 1=1 --", 'membro')).toBe('SEM_PERMISSAO');
    expect(observado.tokenConferido).toBeNull();
  });
});

describe('ehUuid', () => {
  it('aceita uuid e recusa o resto', () => {
    expect(ehUuid(TENANT)).toBe(true);
    for (const valor of ['', 'abc', '11111111-1111-4111-8111-11111111111', null, 42]) {
      expect(ehUuid(valor), String(valor)).toBe(false);
    }
  });
});
