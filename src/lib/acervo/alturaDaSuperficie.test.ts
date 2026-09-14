import { describe, expect, it } from 'vitest';

import { alturaDaSuperficie } from './alturaDaSuperficie';
import type { MalhaCrua } from './malhaDePeca';

/** Um quadrado de 1 x 1 em XZ, dividido em dois triângulos, com a altura de cada canto escolhida. */
function quadrado(alturas: [number, number, number, number], deslocamentoY = 0): MalhaCrua {
  const [a, b, c, d] = alturas.map((altura) => altura + deslocamentoY);

  return {
    posicoes: [0, a ?? 0, 0, 1, b ?? 0, 0, 1, c ?? 0, 1, 0, d ?? 0, 1],
    indices: [0, 1, 2, 0, 2, 3],
  };
}

describe('alturaDaSuperficie', () => {
  it('num plano inclinado, interpola a altura dentro do triângulo', () => {
    // Altura = x: 0 em x = 0 e 1 em x = 1, dos dois lados da diagonal.
    const rampa = quadrado([0, 1, 1, 0]);

    expect(alturaDaSuperficie(rampa, 0.25, 0.75)).toBeCloseTo(0.25, 12);
    expect(alturaDaSuperficie(rampa, 0.8, 0.1)).toBeCloseTo(0.8, 12);
  });

  it('responde em cima da aresta compartilhada, sem cair entre os dois triângulos', () => {
    expect(alturaDaSuperficie(quadrado([0, 1, 1, 0]), 0.5, 0.5)).toBeCloseTo(0.5, 12);
  });

  it('fora da malha não inventa altura', () => {
    expect(alturaDaSuperficie(quadrado([0, 0, 0, 0]), 1.5, 0.5)).toBeUndefined();
  });

  it('com duas camadas, devolve a de cima', () => {
    // A casca do cabedal: parede de fora e parede de dentro sob a mesma vertical.
    const baixa = quadrado([0, 0, 0, 0]);
    const alta = quadrado([0, 0, 0, 0], 0.3);
    const duas: MalhaCrua = {
      posicoes: [...baixa.posicoes, ...alta.posicoes],
      indices: [...baixa.indices, ...alta.indices.map((indice) => indice + 4)],
    };

    expect(alturaDaSuperficie(duas, 0.5, 0.2)).toBeCloseTo(0.3, 12);
  });

  it('ignora triângulo de pé, que visto de cima não tem área', () => {
    const parede: MalhaCrua = { posicoes: [0, 0, 0, 1, 0, 0, 1, 5, 0], indices: [0, 1, 2] };

    expect(alturaDaSuperficie(parede, 0.5, 0)).toBeUndefined();
  });
});
