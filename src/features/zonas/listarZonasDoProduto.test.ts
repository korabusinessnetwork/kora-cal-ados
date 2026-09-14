// Era o único módulo de `src/features/zonas/` sem teste ao lado, com três comportamentos escritos
// em comentário e presos por ninguém (R2-A09). Os três custam caro se sumirem numa edição futura:
// a lista embaralhada faz clicar na zona errada, o erro engolido faz remarcar por cima de um
// mapeamento inteiro, e o id vazio transforma um engano de chamada numa afirmação falsa.
//
// Cliente falso no formato do vizinho `produtos/listarProdutos.test.ts`: o que interessa aqui é a
// FORMA do pedido, e ela é conferida contra o banco real em `supabase/tests/`.

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listarZonasDoProduto } from './listarZonasDoProduto';

interface Pedido {
  tabela: string;
  campos: string;
  filtro: [string, string] | null;
  ordem: [string, { ascending: boolean }] | null;
}

function clienteFalso(resposta: { data?: unknown; error?: unknown }) {
  const pedido: Pedido = { tabela: '', campos: '', filtro: null, ordem: null };
  const resultado = { data: resposta.data ?? null, error: resposta.error ?? null };

  const cliente = {
    from(tabela: string) {
      pedido.tabela = tabela;
      return {
        select(campos: string) {
          pedido.campos = campos;
          return {
            eq(coluna: string, valor: string) {
              pedido.filtro = [coluna, valor];
              return {
                order(coluna2: string, opcoes: { ascending: boolean }) {
                  pedido.ordem = [coluna2, opcoes];
                  return Promise.resolve(resultado);
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { cliente, pedido };
}

describe('listar zonas do produto', () => {
  it('pede campos explícitos e filtra pelo produto', async () => {
    const { cliente, pedido } = clienteFalso({ data: [] });
    await listarZonasDoProduto(cliente, 'produto-1');

    expect(pedido.tabela).toBe('product_zones');
    expect(pedido.campos).toBe(
      'id, product_id, tenant_id, zone_key, svg_selector, label, cor_default',
    );
    // `select *` é proibido pelo CLAUDE.md: coluna nova chegaria à tela sem revisão.
    expect(pedido.campos).not.toContain('*');
    expect(pedido.filtro).toEqual(['product_id', 'produto-1']);
  });

  it('ordena por created_at, porque quem marca zona clica por memória de posição', async () => {
    // Postgres não promete ordem nenhuma sem `order by`. Sem isto a lista de zonas troca de
    // posição entre uma carga e outra, e o clique cai na zona vizinha.
    const { cliente, pedido } = clienteFalso({ data: [] });
    await listarZonasDoProduto(cliente, 'produto-1');

    expect(pedido.ordem).toEqual(['created_at', { ascending: true }]);
  });

  it('recusa id vazio ANTES da rede', async () => {
    // `eq('product_id', '')` volta lista vazia, e lista vazia aqui significa "este produto não
    // tem zona nenhuma", uma afirmação sobre o produto, não um engano de chamada. O editor
    // mostraria "nenhuma zona mapeada" sobre um modelo inteiro mapeado.
    const { cliente, pedido } = clienteFalso({ data: [] });

    await expect(listarZonasDoProduto(cliente, '   ')).rejects.toThrow(
      'Não dá para listar zonas sem o id do produto.',
    );
    expect(pedido.tabela).toBe('');
  });

  it('deixa o erro subir em vez de devolver lista vazia', async () => {
    // Este é o caso que mais custa: falha de rede virando "nenhuma zona marcada" faz a pessoa
    // remarcar por cima de um mapeamento que já existe, e a gravação esbarra na unicidade
    // depois de todo o trabalho refeito.
    const { cliente } = clienteFalso({ error: new Error('rede caiu') });

    await expect(listarZonasDoProduto(cliente, 'produto-1')).rejects.toThrow('rede caiu');
  });

  it('devolve as zonas como vieram, sem reordenar nem completar', async () => {
    const zonas = [
      {
        id: 'z1',
        product_id: 'produto-1',
        tenant_id: 't1',
        zone_key: 'sola',
        svg_selector: '#a',
        label: 'Sola',
        cor_default: null,
      },
    ];
    const { cliente } = clienteFalso({ data: zonas });

    expect(await listarZonasDoProduto(cliente, 'produto-1')).toEqual(zonas);
  });

  it('data nula vira lista vazia, e não explode na tela', async () => {
    // O supabase-js devolve `data: null` com `error: null` em resposta sem linha. A tela que
    // recebe isso precisa de uma lista para iterar, não de um `null`.
    const { cliente } = clienteFalso({});

    expect(await listarZonasDoProduto(cliente, 'produto-1')).toEqual([]);
  });
});
