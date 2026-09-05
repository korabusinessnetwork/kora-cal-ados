// Baixa o asset-base canônico de um produto para o navegador.
//
// O bucket é PRIVADO: não existe URL pública, e é assim que o SVG de um lançamento não
// vaza para a concorrência. O acesso é por URL assinada, curta, emitida pelo Supabase
// só se a RLS reconhecer o usuário como membro do tenant dono do path.
//
// O caminho vem de `products.base_asset_path` — o que foi gravado de fato. Remontá-lo a
// partir dos ids parece equivalente e não é: bastaria o formato mudar uma vez para o
// front pedir um objeto que não existe, ou pior, o objeto de outro produto.

import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'assets-base';

/** Curto de propósito: a URL não é para ser guardada, é para ser usada agora. */
const VALIDADE_EM_SEGUNDOS = 300;

/**
 * Devolve o texto do SVG canônico.
 *
 * Texto, e não `<img src>`: o editor precisa do SVG no DOM para clicar em elemento, e o
 * motor de render recebe string. Um `<img>` seria um desenho que ninguém consegue
 * endereçar.
 */
export async function baixarAssetBase(
  cliente: SupabaseClient,
  baseAssetPath: string,
): Promise<string> {
  if (!baseAssetPath.trim()) {
    throw new Error('Este produto não tem asset-base gravado.');
  }

  const { data, error } = await cliente.storage
    .from(BUCKET)
    .createSignedUrl(baseAssetPath, VALIDADE_EM_SEGUNDOS);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('O Supabase não devolveu URL para o asset-base.');

  const resposta = await fetch(data.signedUrl);

  if (!resposta.ok) {
    // Falha de rede aqui vira tela sem desenho. Melhor um erro que nomeia o arquivo do
    // que um palco vazio que parece produto sem imagem.
    throw new Error(`Não foi possível baixar o asset-base (${resposta.status}).`);
  }

  return await resposta.text();
}
