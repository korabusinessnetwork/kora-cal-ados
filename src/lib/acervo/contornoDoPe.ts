// A pegada do pé vista de cima, que é de onde saem a sola e o cabedal.
//
// Uma função só para as duas peças (decisão D1 da spec `acervo-com-cara-de-tenis`). Duas pegadas
// escritas à mão divergiriam, e a primeira coisa que um olho nota num calçado errado é o cabedal
// passando da borda da sola. Aqui não há como passar: o cabedal é a mesma pegada, menor.
//
// Eixos, os mesmos do resto do acervo: X do calcanhar (negativo) à biqueira (positiva), Y para
// cima, Z de um lado ao outro do pé. Metros, que é a unidade que o glTF 2.0 fixa.
//
// **Lado de fora e lado de dentro não são iguais**, e é isso que faz a pegada parecer pé em vez
// de elipse. O lado de dentro (Z negativo, o lado do dedão) recua na cintura: é o arco plantar.
// O lado de fora (Z positivo) segue quase reto do calcanhar à cabeça do quinto metatarso.

import { arredondarParaFloat32 } from './malhaDePeca';
import { interpolacaoMonotona } from './interpolacaoMonotona';

/** Um corte transversal da pegada: onde ele está em X e até onde ele vai para cada lado. */
export interface EstacaoDoContorno {
  /** Metros, eixo X. */
  x: number;
  /** Meia largura do lado de fora do pé, em metros. Z positivo. */
  fora: number;
  /** Meia largura do lado de dentro do pé, em metros. Z negativo, e é onde fica o arco. */
  dentro: number;
}

export interface MedidasDoContorno {
  /** Metros, eixo X, da ponta do calcanhar à ponta da biqueira. */
  comprimento: number;
  /** Metros, eixo Z, a largura total da pegada no ponto mais largo dela. */
  largura: number;
  /**
   * Quantos cortes transversais. Mais estações deixam a curva mais lisa e a malha mais pesada;
   * abaixo de 7 o bico vira um bico de verdade, em vez de arredondado.
   */
  estacoes: number;
}

/**
 * Os pontos de controle do perfil, em fração da largura total, do calcanhar (0) à biqueira (1).
 *
 * São números de proporção de pé, não de estilo: o calcanhar tem cerca de 3/4 da largura da
 * planta, a cintura afina para perto de 3/4 também mas **só do lado de dentro**, e o ponto mais
 * largo fica a cerca de 3/4 do comprimento, na cabeça dos metatarsos. Mexer nestes números muda
 * a silhueta do calçado inteiro, sola e cabedal juntos, que é exatamente a intenção.
 */
const PERFIL_DO_LADO_DE_FORA: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.36],
  [0.13, 0.37],
  [0.28, 0.39],
  [0.42, 0.43],
  [0.55, 0.47],
  [0.68, 0.5],
  [0.78, 0.5],
  [0.87, 0.48],
  [1.0, 0.42],
];

const PERFIL_DO_LADO_DE_DENTRO: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.36],
  [0.13, 0.36],
  [0.28, 0.34],
  [0.42, 0.31],
  [0.55, 0.33],
  [0.68, 0.42],
  [0.78, 0.46],
  [0.87, 0.45],
  [1.0, 0.4],
];

/**
 * O trecho e a forma do arredondamento de cada ponta, em fração do comprimento.
 *
 * O expoente é o de uma superelipse: 2 é circunferência, mais que 2 é mais cheio (a curva segura
 * a largura por mais tempo antes de fechar). O calcanhar é redondo; a biqueira é mais cheia, que
 * é a silhueta de um tênis e não a de um sapato de bico fino.
 */
const CALCANHAR = { trecho: 0.13, expoente: 2 } as const;
const BIQUEIRA = { trecho: 0.16, expoente: 2.4 } as const;

/**
 * A pegada, estação por estação, do calcanhar para a biqueira.
 *
 * **As estações são mais densas nas pontas** (espaçamento em cosseno). É onde a curva muda
 * depressa: com espaçamento uniforme, ou o meio da sola carrega cortes que ninguém precisa, ou o
 * bico vira um chanfro. O cosseno resolve os dois com a mesma contagem.
 *
 * As duas pontas têm largura exatamente zero, dos dois lados. É o que faz a ponta ser um ponto
 * só na malha, sem o par de vértices coincidentes que produziria triângulo de área zero.
 */
export function contornoDoPe(medidas: MedidasDoContorno): EstacaoDoContorno[] {
  if (medidas.estacoes < 3) {
    throw new Error(`O contorno do pé precisa de pelo menos 3 estações, e foram pedidas ${medidas.estacoes}.`);
  }

  const larguraDoLadoDeFora = interpolacaoMonotona(PERFIL_DO_LADO_DE_FORA);
  const larguraDoLadoDeDentro = interpolacaoMonotona(PERFIL_DO_LADO_DE_DENTRO);

  const cruas = passosEmCosseno(medidas.estacoes).map((t) => {
    const arredondamento = arredondamentoDaPonta(t);

    return { t, fora: larguraDoLadoDeFora(t) * arredondamento, dentro: larguraDoLadoDeDentro(t) * arredondamento };
  });

  // A largura pedida é a da **caixa** que a pegada ocupa, e não a do corte mais largo: é a
  // medida que o resto do projeto usa (`medidaDoModelo3d` mede caixa) e a única que dá para
  // conferir olhando o modelo pronto. Os dois máximos caem quase na mesma estação, então a
  // diferença entre as duas leituras é de décimos de milímetro.
  const maiorFora = cruas.reduce((maior, { fora }) => Math.max(maior, fora), 0);
  const maiorDentro = cruas.reduce((maior, { dentro }) => Math.max(maior, dentro), 0);
  const fator = medidas.largura / (maiorFora + maiorDentro);

  return cruas.map(({ t, fora, dentro }) => ({
    x: arredondarParaFloat32(-medidas.comprimento / 2 + t * medidas.comprimento),
    fora: arredondarParaFloat32(fora * fator),
    dentro: arredondarParaFloat32(dentro * fator),
  }));
}

/**
 * A meia largura da pegada num X qualquer, por interpolação reta entre as estações vizinhas.
 *
 * Reta e não curva de propósito: quem pergunta isto está conferindo se alguma coisa cabe dentro
 * do contorno (um cravo, uma estação do cabedal), e a resposta precisa ser a da **malha**, que é
 * feita de segmentos entre estações, não a da curva ideal que passou por elas.
 *
 * Fora do comprimento da pegada a resposta é zero, que é a largura de verdade lá fora.
 */
export function meiaLarguraEm(
  estacoes: readonly EstacaoDoContorno[],
  x: number,
): { fora: number; dentro: number } {
  const primeira = estacoes[0];
  const ultima = estacoes[estacoes.length - 1];

  if (primeira === undefined || ultima === undefined) return { fora: 0, dentro: 0 };
  if (x < primeira.x || x > ultima.x) return { fora: 0, dentro: 0 };

  for (let indice = 1; indice < estacoes.length; indice += 1) {
    const anterior = estacoes[indice - 1];
    const seguinte = estacoes[indice];

    if (anterior === undefined || seguinte === undefined) continue;
    if (x > seguinte.x) continue;

    const vao = seguinte.x - anterior.x;
    const fracao = vao === 0 ? 0 : (x - anterior.x) / vao;

    return {
      fora: anterior.fora + (seguinte.fora - anterior.fora) * fracao,
      dentro: anterior.dentro + (seguinte.dentro - anterior.dentro) * fracao,
    };
  }

  return { fora: ultima.fora, dentro: ultima.dentro };
}

/** Se o ponto `x, z` está sobre a pegada. É como um cravo decide se cabe onde ia ser posto. */
export function dentroDoContorno(
  estacoes: readonly EstacaoDoContorno[],
  x: number,
  z: number,
): boolean {
  const { fora, dentro } = meiaLarguraEm(estacoes, x);

  if (fora === 0 && dentro === 0) return false;

  return z <= fora && z >= -dentro;
}

/**
 * Os valores de `t` das estações, de 0 a 1, mais juntos perto das pontas.
 *
 * É a projeção de pontos igualmente espaçados numa semicircunferência sobre o diâmetro dela, o
 * mesmo espaçamento que a interpolação de Chebyshev usa, e pela mesma razão: erro distribuído
 * em vez de concentrado onde a curva é mais fechada.
 */
function passosEmCosseno(quantidade: number): number[] {
  const passos: number[] = [];

  for (let indice = 0; indice < quantidade; indice += 1) {
    passos.push((1 - Math.cos((Math.PI * indice) / (quantidade - 1))) / 2);
  }

  return passos;
}

/**
 * Quanto a largura da pegada é reduzida perto das pontas, de 1 (nada) a 0 (a ponta em si).
 *
 * `(1 - u^n)^(1/n)` é o quarto de superelipse: em `u = 0` vale 1 e chega horizontal, em `u = 1`
 * vale exatamente 0 e chega vertical. É essa chegada vertical que faz a ponta ser redonda em vez
 * de triangular, e o zero exato é o que garante que a ponta seja um ponto só.
 */
function arredondamentoDaPonta(t: number): number {
  // As duas pontas em zero **exato**, escrito antes de qualquer conta. A conta chegaria a
  // 0,0000014 em vez de 0 por erro de arredondamento de `1 - 0,16`, e esse resto viraria um
  // segundo vértice a 70 nanômetros do primeiro na ponta da biqueira, ou seja, um triângulo de
  // área praticamente zero, sem normal que se possa calcular.
  if (t <= 0 || t >= 1) return 0;

  if (t < CALCANHAR.trecho) {
    return arredondamentoDeSuperelipse((CALCANHAR.trecho - t) / CALCANHAR.trecho, CALCANHAR.expoente);
  }

  if (t > 1 - BIQUEIRA.trecho) {
    return arredondamentoDeSuperelipse((t - (1 - BIQUEIRA.trecho)) / BIQUEIRA.trecho, BIQUEIRA.expoente);
  }

  return 1;
}

function arredondamentoDeSuperelipse(u: number, expoente: number): number {
  // A base do expoente fracionário travada em zero: `1 - u^n` passa alguns bilionésimos abaixo
  // de zero quando `u` chega a 1, e potência fracionária de número negativo é NaN, que se
  // espalharia calada por toda a malha.
  return Math.max(0, 1 - Math.min(1, u) ** expoente) ** (1 / expoente);
}
