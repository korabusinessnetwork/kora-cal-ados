// A consulta que decide o que o app pode mostrar. Testada com um cliente falso: o que
// importa aqui é a FORMA do pedido (campos explícitos, filtro por usuário) e a forma da
// resposta, o isolamento de verdade é provado contra o banco real em
// `supabase/tests/isolamento.test.ts`.

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { carregarTenantsDoUsuario } from './carregarTenantsDoUsuario';

interface Pedido {
  tabela: string;
  campos: string;
  filtro: [string, string] | null;
}

function clienteFalso(resposta: { data?: unknown; error?: unknown }) {
  const pedido: Pedido = { tabela: '', campos: '', filtro: null };

  const cliente = {
    from(tabela: string) {
      pedido.tabela = tabela;
      return {
        select(campos: string) {
          pedido.campos = campos;
          return {
            eq(coluna: string, valor: string) {
              pedido.filtro = [coluna, valor];
              return Promise.resolve({ data: resposta.data ?? null, error: resposta.error ?? null });
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { cliente, pedido };
}

const vinculo = (nome: string, papel: string, id = nome) => ({
  papel,
  tenants: { id, nome, slug: nome.toLowerCase(), tema: { cor_primaria: '#000000' } },
});

describe('tenants do usuário', () => {
  it('pede campos explícitos e filtra pelo usuário', async () => {
    // `select('*')` em tabela de tenant baixaria coluna que o front não usa e vazaria
    // schema para o DevTools de qualquer um (regra de segurança do CLAUDE.md).
    const { cliente, pedido } = clienteFalso({ data: [] });
    await carregarTenantsDoUsuario(cliente, 'user-1');

    expect(pedido.tabela).toBe('tenant_members');
    expect(pedido.campos).not.toContain('*');
    expect(pedido.campos).toBe('papel, tenants!inner(id, nome, slug, tema)');
    expect(pedido.filtro).toEqual(['user_id', 'user-1']);
  });

  it('devolve nome, slug, tema e papel de cada tenant', async () => {
    const { cliente } = clienteFalso({ data: [vinculo('Alfa', 'owner')] });

    expect(await carregarTenantsDoUsuario(cliente, 'user-1')).toEqual([
      { id: 'Alfa', nome: 'Alfa', slug: 'alfa', tema: { cor_primaria: '#000000' }, papel: 'owner' },
    ]);
  });

  it('ordena por nome, a lista não pode mudar de ordem a cada carregamento', async () => {
    // Ordem instável faria a pessoa clicar na marca errada por memória muscular.
    const { cliente } = clienteFalso({
      data: [vinculo('Zeta', 'membro'), vinculo('Alfa', 'owner'), vinculo('Meia', 'membro')],
    });

    expect((await carregarTenantsDoUsuario(cliente, 'u')).map((t) => t.nome)).toEqual([
      'Alfa',
      'Meia',
      'Zeta',
    ]);
  });

  it('papel desconhecido cai para membro, nunca para owner', async () => {
    // Falha para o lado seguro: papel estranho não pode virar permissão de apagar.
    const { cliente } = clienteFalso({ data: [vinculo('Alfa', 'admin')] });

    expect((await carregarTenantsDoUsuario(cliente, 'u'))[0]?.papel).toBe('membro');
  });

  it('vínculo órfão é pulado em vez de derrubar a tela', async () => {
    const { cliente } = clienteFalso({ data: [{ papel: 'owner', tenants: null }, vinculo('Alfa', 'owner')] });

    expect(await carregarTenantsDoUsuario(cliente, 'u')).toHaveLength(1);
  });

  it('erro do banco sobe, não vira lista vazia', async () => {
    // Lista vazia por engano seria lida como "você não pertence a marca nenhuma": a
    // pessoa acharia que perdeu acesso quando o problema é de rede.
    const { cliente } = clienteFalso({ error: new Error('rede caiu') });

    await expect(carregarTenantsDoUsuario(cliente, 'u')).rejects.toThrow('rede caiu');
  });
});
