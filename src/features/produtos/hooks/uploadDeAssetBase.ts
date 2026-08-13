// Upload do SVG-base. Duas etapas separadas de propósito: `analisarArquivo` roda assim
// que o time escolhe o arquivo e mostra o que mudou (ou por que foi recusado) ANTES de
// existir produto — prevenção de erro vale mais que mensagem de erro (CLAUDE.md).
//
// O que sobe para o Storage é sempre o CANÔNICO, nunca o arquivo cru do cliente:
// `normalizarSvg` antes de `gerarVarianteDeCor` é ordem obrigatória do ADR-004, e gerar
// variante do arquivo cru é exatamente o bug que reprovou o protótipo (BUG-001).

import { supabase } from '../../../lib/supabase/cliente';
import { ErroDeVariante } from '../../../lib/render/erros';
import {
  normalizarSvg,
  type RelatorioDeNormalizacao,
} from '../../../lib/render/normalizarSvg';

/** Normalizar é síncrono e trava a aba; acima disso recusa em vez de congelar. */
const TAMANHO_MAXIMO_EM_BYTES = 2 * 1024 * 1024;

export const BUCKET_DE_ASSETS = 'assets-base';

export interface ArquivoAnalisado {
  svgCanonico: string;
  relatorio: RelatorioDeNormalizacao;
}

/** Lê, valida e normaliza o arquivo escolhido. Lança com mensagem pronta para a tela. */
export async function analisarArquivo(arquivo: File): Promise<ArquivoAnalisado> {
  if (arquivo.size > TAMANHO_MAXIMO_EM_BYTES) {
    throw new Error(
      `O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB e o limite é 2 MB. Simplifique o SVG antes de subir.`,
    );
  }

  const texto = await arquivo.text();

  try {
    const { svg, relatorio } = normalizarSvg(texto);
    return { svgCanonico: svg, relatorio };
  } catch (falha) {
    if (falha instanceof ErroDeVariante) throw new Error(falha.message);
    throw new Error('Não foi possível ler este arquivo como SVG.');
  }
}

/**
 * Sobe o canônico e devolve o path gravado.
 * O upload vem ANTES do insert do produto de propósito: `products.base_asset_path` é NOT
 * NULL, e uma linha apontando para arquivo inexistente vira erro na API (rodada 3). Um
 * arquivo sem linha, ao contrário, é invisível e inofensivo.
 */
export async function enviarAssetBase(
  svgCanonico: string,
  tenantId: string,
  produtoId: string,
): Promise<string> {
  const caminho = `tenants/${tenantId}/products/${produtoId}/base.svg`;

  const { error } = await supabase.storage
    .from(BUCKET_DE_ASSETS)
    .upload(caminho, new Blob([svgCanonico], { type: 'image/svg+xml' }), {
      contentType: 'image/svg+xml',
      upsert: false,
    });

  if (error) {
    throw new Error('Não foi possível enviar o arquivo. Verifique a conexão e tente de novo.');
  }

  return caminho;
}
