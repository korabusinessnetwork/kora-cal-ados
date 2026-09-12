// A leitura do banco para a saída de um tenant (ADR-009).
//
// Mora separado de `exportarTenant.ts` por um motivo prático: aquele arquivo é um script de linha
// de comando e roda `principal()` ao ser importado, então um teste não consegue chamá-lo sem
// disparar o programa inteiro. Este módulo é uma função normal, e é por ela que
// `supabase/tests/exportarTenant.test.ts` prova contra o banco de verdade o que o ADR-009 pede em
// letra: "o zip contém uma zona que foi marcada".
//
// Todo `select` daqui lista os campos um por um. Nunca `select *`, pela regra do CLAUDE.md, e
// nesta tarefa a regra tem dente: `select *` faria uma coluna nova, criada meses depois por outra
// razão, entrar sozinha num arquivo que sai da empresa para a mão do cliente.

import type { SupabaseClient } from '@supabase/supabase-js';

import { BUCKET_DO_ASSET_BASE } from './caminhoDoAssetBase';
import type {
  ProdutoParaSaida,
  SaidaDoTenant,
  TenantParaSaida,
  VarianteParaSaida,
  ZonaParaSaida,
} from './montarPacoteDeSaida';

/** O tenant não existe, e quem chamou precisa distinguir isso de "existe e está vazio". */
export class TenantNaoEncontrado extends Error {
  constructor(slug: string) {
    super(`Não existe tenant com o slug "${slug}".`);
    this.name = 'TenantNaoEncontrado';
  }
}

/**
 * Lê tudo que é da marca, na ordem em que o ADR-009 D1 lista.
 *
 * Faz quatro consultas e não uma com junções aninhadas. A razão é a lista de campos: com junção,
 * a seleção de colunas das tabelas filhas fica embutida numa string, e é bem mais fácil alguém
 * acrescentar um campo ali sem perceber que acabou de mudar o que sai da empresa.
 */
export async function lerSaidaDoTenant(
  admin: SupabaseClient,
  slug: string,
): Promise<SaidaDoTenant> {
  const tenant = await lerTenant(admin, slug);
  const produtos = await lerProdutos(admin, tenant.id);

  if (produtos.length === 0) return { tenant, produtos: [] };

  const ids = produtos.map(({ id }) => id);
  const zonas = await lerZonas(admin, ids);
  const variantes = await lerVariantes(admin, ids);

  const montados = await Promise.all(
    produtos.map(async ({ id, nome, created_at, base_asset_path }): Promise<ProdutoParaSaida> => ({
      id,
      nome,
      created_at,
      assetBase: await baixarAssetBase(admin, base_asset_path),
      zonas: zonas.get(id) ?? [],
      variantes: variantes.get(id) ?? [],
    })),
  );

  return { tenant, produtos: montados };
}

async function lerTenant(admin: SupabaseClient, slug: string): Promise<TenantParaSaida> {
  const { data, error } = await admin
    .from('tenants')
    .select('id, nome, slug, tema, plano, created_at')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  if (data === null) throw new TenantNaoEncontrado(slug);

  return data as TenantParaSaida;
}

interface LinhaDeProduto {
  id: string;
  nome: string;
  created_at: string;
  base_asset_path: string | null;
}

async function lerProdutos(admin: SupabaseClient, tenantId: string): Promise<LinhaDeProduto[]> {
  const { data, error } = await admin
    .from('products')
    .select('id, nome, base_asset_path, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []) as LinhaDeProduto[];
}

/**
 * As zonas de todos os produtos de uma vez, agrupadas por produto.
 *
 * Ordenadas por `created_at`, que o `schema.sql` anota como "a única ordenação estável desta
 * tabela". Sem ordenar, duas exportações do mesmo tenant sairiam com as zonas em ordens
 * diferentes, e ninguém conseguiria comparar dois pacotes para ver se mudou alguma coisa.
 */
async function lerZonas(
  admin: SupabaseClient,
  produtoIds: string[],
): Promise<Map<string, ZonaParaSaida[]>> {
  const { data, error } = await admin
    .from('product_zones')
    .select('product_id, zone_key, label, svg_selector, cor_default, created_at')
    .in('product_id', produtoIds)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return agrupar((data ?? []) as (ZonaParaSaida & { product_id: string })[]);
}

async function lerVariantes(
  admin: SupabaseClient,
  produtoIds: string[],
): Promise<Map<string, VarianteParaSaida[]>> {
  const { data, error } = await admin
    .from('variants')
    // `rendered_path` fica de fora de propósito (ADR-009 D3): ele aponta para o Storage da Kora e
    // não significa nada fora daqui. Exportá-lo entregaria ao cliente um endereço que ele não
    // consegue abrir, o que é pior do que omitir.
    .select('id, product_id, zone_colors, created_at')
    .in('product_id', produtoIds)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return agrupar((data ?? []) as (VarianteParaSaida & { product_id: string })[]);
}

/**
 * Baixa o asset-base canônico do Storage.
 *
 * Usa `products.base_asset_path`, o caminho que foi GRAVADO, e não remonta o path com
 * `caminhoDoAssetBase`. O comentário daquele módulo diz isso em letra: quem lê usa o que está no
 * banco. Remontar aqui faria a exportação procurar o arquivo onde ele deveria estar, em vez de
 * onde ele está, e um produto migrado sairia sem asset nenhum.
 *
 * Falha no download NÃO derruba a exportação. Quem está exportando está cancelando um contrato, e
 * entregar o pacote sem um arquivo, com o aviso na tela, vale mais do que não entregar pacote.
 */
async function baixarAssetBase(
  admin: SupabaseClient,
  caminho: string | null,
): Promise<ProdutoParaSaida['assetBase']> {
  if (caminho === null || caminho.trim() === '') return null;

  const { data, error } = await admin.storage.from(BUCKET_DO_ASSET_BASE).download(caminho);

  if (error !== null || data === null) {
    console.warn(`Aviso: não consegui baixar "${caminho}". O pacote sai sem este asset-base.`);

    return null;
  }

  return {
    nomeDoArquivo: caminho.split('/').pop() ?? 'base.svg',
    conteudo: Buffer.from(await data.arrayBuffer()),
  };
}

function agrupar<T extends { product_id: string }>(
  linhas: T[],
): Map<string, Omit<T, 'product_id'>[]> {
  const mapa = new Map<string, Omit<T, 'product_id'>[]>();

  for (const { product_id, ...resto } of linhas) {
    mapa.set(product_id, [...(mapa.get(product_id) ?? []), resto]);
  }

  return mapa;
}
