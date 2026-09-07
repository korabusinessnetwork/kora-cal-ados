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

  if (error) {
    // As duas falhas possíveis aqui se distinguem pela ESTRUTURA, não pelo texto: a do
    // servidor traz `status` (403, 404…); a de rede não traz nada além da mensagem que o
    // navegador escreveu, em inglês. Classificar por texto quebraria com a locale, e é
    // como `Failed to fetch` continuava chegando à tela mesmo depois da primeira correção
    // do BUG-016 — a rede caía ANTES do `fetch` deste arquivo, aqui dentro do supabase-js.
    const status = (error as { status?: number }).status;

    throw new Error(
      status === undefined
        ? 'Não foi possível pedir acesso ao asset-base: a rede não respondeu. Confira a conexão e tente de novo.'
        : `Não foi possível pedir acesso ao asset-base (${status}: ${error.message}). Se o modelo continuar sem abrir, avise quem administra a marca.`,
    );
  }
  if (!data?.signedUrl) throw new Error('O Supabase não devolveu URL para o asset-base.');

  let resposta: Response;

  try {
    resposta = await fetch(data.signedUrl);
  } catch {
    // `fetch` REJEITA — não devolve `!ok` — quando a rede cai, o DNS falha ou o pedido é
    // bloqueado. O tratamento abaixo nunca cobriu esse caminho, e o `TypeError: Failed to
    // fetch` do navegador ia inteiro para a tela, em inglês, sem dizer o que fazer
    // (BUG-016). É justamente o caso mais provável dos dois.
    throw new Error(
      'Não foi possível baixar o asset-base: a rede não respondeu. Confira a conexão e tente de novo.',
    );
  }

  if (!resposta.ok) {
    // Tela sem desenho precisa de um erro que nomeie o arquivo; palco vazio pareceria
    // produto sem imagem.
    throw new Error(`Não foi possível baixar o asset-base (${resposta.status}).`);
  }

  return await resposta.text();
}
