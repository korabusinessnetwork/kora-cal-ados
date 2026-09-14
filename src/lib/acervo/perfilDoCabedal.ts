// A crista do cabedal: a altura da linha de cima dele, estação por estação, do calcanhar à biqueira.
//
// A crista tem duas partes, e a separação entre elas é o que a decisão D6 da spec
// `acervo-com-cara-de-tenis` pede:
//
// - o **cano**, do calcanhar até a frente da boca, que é o que distingue um cabedal baixo de um
//   cano alto, e é descrito em fração da altura da peça;
// - o **peito do pé**, da frente da boca até a biqueira, que é **o mesmo** em todo cabedal da
//   forma, e é descrito em metros. É onde o cadarço deita, e é por ser o mesmo que um cadarço só
//   serve nos dois cabedais.
//
// Entre as duas há um trecho curto de transição suave. Sem ele a crista teria um degrau na frente
// da boca, e a luz do palco marcaria o degrau como uma dobra que ninguém modelou.

import { interpolacaoMonotona } from './interpolacaoMonotona';

/** O desenho do cano, em pontos `[t, fração]`: `t` de 0 (calcanhar) até a frente da boca. */
export interface PerfilDoCano {
  pontos: ReadonlyArray<readonly [number, number]>;
}

/**
 * Onde a boca termina e onde o peito do pé começa, em fração do comprimento a partir do calcanhar.
 *
 * `inicio` é a frente da boca: toda estação antes dele é aberta em cima. `fim` é o primeiro ponto
 * do peito do pé, onde a crista já é igual nos dois cabedais. Numa forma de verdade a boca termina
 * a pouco menos da metade do comprimento, e é aí que o cadarço começa.
 */
export const TRANSICAO_DA_BOCA = { inicio: 0.4, fim: 0.48 } as const;

/**
 * Cabedal baixo: calcanhar alto (o puxador), cai na altura do tornozelo e sobe para a frente da boca,
 * que é o ponto mais alto dele. Os números são a silhueta de um tênis de corrida visto de lado.
 */
export const CANO_BAIXO: PerfilDoCano = {
  pontos: [
    [0, 0.95],
    [0.12, 0.93],
    [0.26, 0.8],
    [0.36, 0.92],
    [0.4, 1],
  ],
};

/**
 * Cano alto: sobe atrás, cobre o tornozelo e desce para a frente da boca. O ponto mais alto é a
 * borda de trás da boca, e a frente da boca fica mais alta que a do cabedal baixo, como numa bota de
 * basquete.
 */
export const CANO_ALTO: PerfilDoCano = {
  pontos: [
    [0, 1],
    [0.14, 1],
    [0.26, 0.93],
    [0.34, 0.75],
    [0.4, 0.5],
  ],
};

/**
 * O peito do pé, em fração de `alturaDoPeito`. Cai para a biqueira sem chegar a zero: a frente do
 * cabedal tem altura de verdade, e zerar ali achataria a biqueira contra a sola.
 */
const PEITO_DO_PE: ReadonlyArray<readonly [number, number]> = [
  [TRANSICAO_DA_BOCA.fim, 1],
  [0.6, 0.93],
  [0.72, 0.8],
  [0.85, 0.62],
  [0.95, 0.45],
  [1, 0.32],
];

export interface EntradaDaCrista {
  /** O `t` de cada estação, de 0 (calcanhar) a 1 (biqueira). */
  posicoes: readonly number[];
  /**
   * Para cada estação, a fração da crista que o cabedal realmente alcança. É 1 onde o cabedal é
   * fechado em cima e menos que 1 na boca, onde ele para na borda da abertura.
   */
  alcance: readonly number[];
  /** Metros. O ponto mais alto do cabedal inteiro, que é o `padrao` do parâmetro. */
  altura: number;
  /** Metros. A altura do peito do pé no começo dele, igual em todo cabedal da forma. */
  alturaDoPeito: number;
  cano: PerfilDoCano;
}

/**
 * A crista em metros, uma por estação.
 *
 * **O ponto mais alto sai igual à altura pedida, exato.** O cano é escalado por um fator `k`
 * resolvido aqui, e não confiado aos pontos de controle: a estação mais alta quase nunca cai em
 * cima de um ponto de controle, e a curva entre dois pontos fica abaixo deles. Sem o fator, o
 * cabedal sairia alguns décimos de milímetro mais baixo que o parâmetro, e altura modelada igual ao
 * padrão é critério de aceite.
 *
 * A conta é direta porque cada vértice é linear em `k`: altura = (k · cano + peito) · alcance. O
 * maior `k` que não passa da altura em nenhuma estação é o menor dos `k` que igualam cada uma.
 */
export function cristasDoCabedal(entrada: EntradaDaCrista): number[] {
  const cano = interpolacaoMonotona(entrada.cano.pontos);
  const peito = interpolacaoMonotona(PEITO_DO_PE);

  const partes = entrada.posicoes.map((t) => {
    const pesoDoPeito = suavizar(
      (t - TRANSICAO_DA_BOCA.inicio) / (TRANSICAO_DA_BOCA.fim - TRANSICAO_DA_BOCA.inicio),
    );

    return {
      doCano: (1 - pesoDoPeito) * entrada.altura * cano(t),
      doPeito: pesoDoPeito * entrada.alturaDoPeito * peito(t),
    };
  });

  let fator = Number.POSITIVE_INFINITY;

  partes.forEach(({ doCano, doPeito }, estacao) => {
    const alcance = entrada.alcance[estacao] ?? 1;

    if (doPeito * alcance > entrada.altura) {
      throw new Error(
        `O cabedal de ${entrada.altura} m é mais baixo que o peito do pé de ${entrada.alturaDoPeito} m, e o peito do pé é igual em todo cabedal da forma.`,
      );
    }

    if (doCano > 0) fator = Math.min(fator, (entrada.altura / alcance - doPeito) / doCano);
  });

  if (!Number.isFinite(fator) || fator <= 0) {
    throw new Error('O perfil do cano não tem altura nenhuma para escalar.');
  }

  return partes.map(({ doCano, doPeito }) => fator * doCano + doPeito);
}

/** A rampa de 0 a 1 com chegada horizontal nas duas pontas, travada fora de [0, 1]. */
function suavizar(valor: number): number {
  const u = Math.min(1, Math.max(0, valor));

  return u * u * (3 - 2 * u);
}
