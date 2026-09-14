// A forma do pedido importa tanto quanto o resultado: é ela que decide se um usuário de
// duas marcas vê as duas listas misturadas. O isolamento de verdade é provado contra o
// banco real em `supabase/tests/isolamento.test.ts`.

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listarProdutos } from './listarProdutos';
import { baixarAssetBase } from './baixarAssetBase';

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

describe('listar produtos', () => {
  it('pede campos explícitos e filtra pelo tenant ativo', async () => {
    // Sem o `eq`, quem pertence a duas marcas veria as duas listas juntas: a RLS permite
    // as duas, e é justamente esse usuário que a sessão passou a existir para servir.
    const { cliente, pedido } = clienteFalso({ data: [] });
    await listarProdutos(cliente, 'tenant-1');

    expect(pedido.tabela).toBe('products');
    expect(pedido.campos).toBe('id, nome, base_asset_path, created_at');
    expect(pedido.campos).not.toContain('*');
    expect(pedido.filtro).toEqual(['tenant_id', 'tenant-1']);
  });

  it('ordena explicitamente, sem isso a lista troca de posição sozinha', async () => {
    // Postgres não promete ordem sem `order by`. Lista instável faz clicar no modelo
    // errado por memória muscular.
    const { cliente, pedido } = clienteFalso({ data: [] });
    await listarProdutos(cliente, 'tenant-1');

    expect(pedido.ordem).toEqual(['created_at', { ascending: true }]);
  });

  it('erro do banco sobe, não vira lista vazia', async () => {
    // "Nenhum modelo cadastrado" é uma afirmação sobre o catálogo do cliente. Dizer isso
    // quando o que houve foi falha de rede é mentir na tela.
    const { cliente } = clienteFalso({ error: new Error('timeout') });

    await expect(listarProdutos(cliente, 'tenant-1')).rejects.toThrow('timeout');
  });
});

describe('baixar asset-base', () => {
  function clienteDeStorage(resposta: { data?: unknown; error?: unknown }) {
    const pedido: { bucket: string; caminho: string; validade: number } = {
      bucket: '',
      caminho: '',
      validade: 0,
    };

    const cliente = {
      storage: {
        from(bucket: string) {
          pedido.bucket = bucket;
          return {
            createSignedUrl(caminho: string, validade: number) {
              pedido.caminho = caminho;
              pedido.validade = validade;
              return Promise.resolve({ data: resposta.data ?? null, error: resposta.error ?? null });
            },
          };
        },
      },
    } as unknown as SupabaseClient;

    return { cliente, pedido };
  }

  it('usa o caminho gravado, sem remontar nada', async () => {
    // Remontar `tenants/{id}/products/{id}/base.svg` no front parece equivalente: basta o
    // formato mudar uma vez para pedir objeto inexistente, ou o de outro produto.
    const gravado = 'tenants/abc/products/def/base.svg';
    const { cliente, pedido } = clienteDeStorage({ error: new Error('sem permissão') });

    await expect(baixarAssetBase(cliente, gravado)).rejects.toThrow();
    expect(pedido.caminho).toBe(gravado);
    expect(pedido.bucket).toBe('assets-base');
  });

  it('a URL assinada é curta, ela não é para ser guardada', async () => {
    const { cliente, pedido } = clienteDeStorage({ error: new Error('x') });
    await expect(baixarAssetBase(cliente, 'tenants/a/products/b/base.svg')).rejects.toThrow();

    expect(pedido.validade).toBe(300);
  });

  it('produto sem asset gravado falha com motivo, antes de chamar a rede', async () => {
    const { cliente, pedido } = clienteDeStorage({ data: { signedUrl: 'http://x' } });

    await expect(baixarAssetBase(cliente, '   ')).rejects.toThrow(/asset-base/);
    expect(pedido.bucket).toBe('');
  });

  it('resposta sem URL não vira string vazia', async () => {
    // SVG vazio no palco pareceria "produto sem desenho" em vez de falha de acesso.
    const { cliente } = clienteDeStorage({ data: {} });

    await expect(baixarAssetBase(cliente, 'tenants/a/products/b/base.svg')).rejects.toThrow(
      /não devolveu URL/,
    );
  });
});
