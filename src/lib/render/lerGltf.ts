// Onde o texto vira documento glTF, para os dois lados do motor 3D.
//
// Existe pela mesma razão que `dom.ts` existe no caminho do SVG: a normalização e o recolor
// precisam da mesma leitura, e duas cópias de "parse, e recuse se não for objeto" divergem em
// silêncio. Quando divergissem, o normalizador aceitaria um arquivo que o motor recusa, ou pior,
// o contrário, e o defeito só apareceria na geração de uma variante.
//
// É de propósito que este arquivo NÃO valide glTF. Ele responde uma pergunta só: isto é um
// objeto JSON? As regras de "é um glTF 2.0 que dá para tornar canônico" moram em
// `normalizarModelo3d`, porque são dela.

import { ErroDeVariante } from './erros';
import type { DocumentoGltf } from './tiposDoGltf';

/** JSON malformado, ou JSON que não é um objeto, é `MODELO_3D_INVALIDO`, nunca exceção crua. */
export function analisarGltf(gltfTexto: string): DocumentoGltf {
  let analisado: unknown;
  try {
    analisado = JSON.parse(gltfTexto);
  } catch {
    throw new ErroDeVariante('MODELO_3D_INVALIDO', 'Arquivo não é um glTF válido: JSON malformado.');
  }

  if (analisado === null || typeof analisado !== 'object' || Array.isArray(analisado)) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      'Arquivo não é um glTF válido: o conteúdo não é um objeto JSON.',
    );
  }

  return analisado as DocumentoGltf;
}

/**
 * O documento de volta em texto, no formato do canônico.
 *
 * Dois espaços e quebra de linha no fim, iguais aos de `normalizarModelo3d`, para que
 * `normalizar(recolorir(x))` e `recolorir(normalizar(x))` não difiram por espaço em branco. O
 * canário de integração do SVG (`normalizarSvg(baixado) === baixado`) só funciona porque o
 * formato de saída é estável, e a mesma propriedade precisa valer aqui.
 */
export function escreverGltf(documento: DocumentoGltf): string {
  return `${JSON.stringify(documento, null, 2)}\n`;
}
