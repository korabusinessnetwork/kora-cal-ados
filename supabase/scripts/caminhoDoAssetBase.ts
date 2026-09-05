// A ÚNICA definição do caminho do asset-base no Storage.
//
// O path não é decoração: as policies do bucket leem `storage.foldername(name)` e exigem
// `tenants/<tenant_id>/…` para decidir quem pode ler o arquivo
// (`20260812_correcao_rls_e_storage.sql`). Um path montado de outro jeito em outro arquivo
// não daria erro — daria um objeto que a RLS considera de ninguém, invisível para o dono
// e para todo mundo.
//
// Quem lê o asset depois NÃO remonta este caminho: usa `products.base_asset_path`, que é
// o que foi gravado de fato. Esta função só existe para o lado que ESCREVE.

export const BUCKET_DO_ASSET_BASE = 'assets-base';

/**
 * `tenants/{tenant_id}/products/{product_id}/base.svg`
 *
 * Recusa id vazio: um path com segmento vazio (`tenants//products/…`) muda o índice que
 * a policy lê e o arquivo cairia fora do alcance do próprio tenant.
 */
export function caminhoDoAssetBase(tenantId: string, productId: string): string {
  exigirId(tenantId, 'tenant_id');
  exigirId(productId, 'product_id');

  return `tenants/${tenantId}/products/${productId}/base.svg`;
}

function exigirId(valor: string, nome: string): void {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new Error(`caminhoDoAssetBase: ${nome} vazio — o path resultante ficaria inválido.`);
  }

  if (valor.includes('/')) {
    throw new Error(`caminhoDoAssetBase: ${nome} contém "/" e criaria uma pasta a mais no path.`);
  }
}
