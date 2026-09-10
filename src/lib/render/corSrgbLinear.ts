// A conversão entre o hex que a pessoa digita e o float que o glTF guarda (ADR-007, decisão 3).
//
// Este é o arquivo de maior risco do rumo 3D, e o risco é invisível. O hex é **sRGB**; o
// `baseColorFactor` do glTF é **linear**. Escrever `0xC0 / 255` direto no `baseColorFactor`
// produz uma cor errada de um jeito plausível, alguns tons mais clara, do tipo que passa numa
// conferência a olho e só aparece quando o cliente compara com o Pantone. Num sistema cujo
// princípio nº1 é "cor no editor = cor na API", esse defeito não quebra nada, ele fabrica o
// calçado errado.
//
// Por isso a conversão mora em UM lugar, e a regra é verificada por teste, não por disciplina:
// `soUmLugarEscreveCorNoGltf.test.ts` falha se a curva do sRGB aparecer em qualquer outro
// arquivo de produção.
//
// A curva tem duas partes, e é a segunda que a implementação apressada esquece: perto do preto
// o sRGB é uma reta (divisão por 12.92), não uma potência. Uma conversão que só use `** 2.4`
// erra justamente nos tons escuros, que é onde mora meia paleta de calçado.

import { ErroDeVariante } from './erros';

/** Ponto em que a curva do sRGB deixa de ser reta, no lado sRGB. */
const LIMITE_SRGB = 0.04045;
/** O mesmo ponto, do lado linear. */
const LIMITE_LINEAR = 0.0031308;
const INCLINACAO = 12.92;
const DESLOCAMENTO = 0.055;
const ESCALA = 1.055;
const GAMA = 2.4;

const HEX_LONGO = /^#[0-9a-fA-F]{6}$/;

/** Cor em RGB linear, cada canal de 0 a 1, na ordem em que o glTF os guarda. */
export type CorLinear = readonly [number, number, number];

/**
 * `#C0392B` → RGB linear.
 *
 * Espera hex já validado (`validarCor`); a checagem aqui é rede de segurança, não a validação
 * do pedido, e por isso a mensagem não fala em zona.
 */
export function hexParaLinear(hex: string): CorLinear {
  if (!HEX_LONGO.test(hex)) {
    throw new ErroDeVariante(
      'COR_INVALIDA',
      `Cor "${hex}" não está no formato #RRGGBB e não pode ser convertida para o modelo 3D.`,
    );
  }

  return [
    canalParaLinear(Number.parseInt(hex.slice(1, 3), 16)),
    canalParaLinear(Number.parseInt(hex.slice(3, 5), 16)),
    canalParaLinear(Number.parseInt(hex.slice(5, 7), 16)),
  ];
}

/** RGB linear → `#RRGGBB` maiúsculo. A volta exata de `hexParaLinear`, provada por teste. */
export function linearParaHex(cor: CorLinear): string {
  const canais = cor.map((canal) => {
    const byte = Math.round(canalParaSrgb(limitar(canal)) * 255);
    return byte.toString(16).padStart(2, '0');
  });

  return `#${canais.join('')}`.toUpperCase();
}

/** Um canal de 0 a 255 em sRGB para o mesmo canal de 0 a 1 em linear. */
function canalParaLinear(byte: number): number {
  const srgb = byte / 255;

  return srgb <= LIMITE_SRGB ? srgb / INCLINACAO : ((srgb + DESLOCAMENTO) / ESCALA) ** GAMA;
}

/** O caminho de volta. Os dois limites são o mesmo ponto da curva, expresso em cada lado. */
function canalParaSrgb(linear: number): number {
  return linear <= LIMITE_LINEAR
    ? linear * INCLINACAO
    : ESCALA * linear ** (1 / GAMA) - DESLOCAMENTO;
}

/**
 * Prende o canal em 0..1 antes de voltar para hex.
 *
 * Não é paranoia: o `baseColorFactor` de um glTF vindo de fora pode trazer valor fora da faixa
 * (alguns exportadores escrevem HDR ali), e `(-0.2) ** (1/2.4)` é `NaN`, que viraria `#NANNAN`
 * numa mensagem de erro em vez de uma cor.
 */
function limitar(canal: number): number {
  if (!Number.isFinite(canal)) return 0;

  return Math.min(1, Math.max(0, canal));
}
