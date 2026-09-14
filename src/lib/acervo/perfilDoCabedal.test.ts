import { describe, expect, it } from 'vitest';

import { CANO_ALTO, CANO_BAIXO, cristasDoCabedal, TRANSICAO_DA_BOCA, type EntradaDaCrista } from './perfilDoCabedal';

/** 201 posições igualmente espaçadas, todas fechadas em cima. */
const POSICOES = Array.from({ length: 201 }, (_, indice) => indice / 200);
const FECHADAS = POSICOES.map(() => 1);

function entrada(sobrescrever: Partial<EntradaDaCrista>): EntradaDaCrista {
  return { posicoes: POSICOES, alcance: FECHADAS, altura: 0.075, alturaDoPeito: 0.064, cano: CANO_BAIXO, ...sobrescrever };
}

describe('cristasDoCabedal', () => {
  it('a crista mais alta, vezes o alcance da estação, é exatamente a altura pedida', () => {
    const alcance = POSICOES.map((t) => (t < TRANSICAO_DA_BOCA.inicio ? 0.85 : 1));

    for (const [cano, altura] of [[CANO_BAIXO, 0.075], [CANO_ALTO, 0.14]] as const) {
      const cristas = cristasDoCabedal(entrada({ cano, altura, alcance }));
      const maisAlta = Math.max(...cristas.map((crista, estacao) => crista * (alcance[estacao] ?? 1)));

      expect(maisAlta).toBeCloseTo(altura, 12);
    }
  });

  it('do começo do peito do pé em diante, a crista não depende do cano nem da altura', () => {
    const baixo = cristasDoCabedal(entrada({ cano: CANO_BAIXO, altura: 0.075 }));
    const alto = cristasDoCabedal(entrada({ cano: CANO_ALTO, altura: 0.14 }));

    POSICOES.forEach((t, estacao) => {
      if (t >= TRANSICAO_DA_BOCA.fim) expect(alto[estacao]).toBe(baixo[estacao]);
    });
  });

  it('a transição entre o cano e o peito do pé não tem degrau', () => {
    // Com 201 posições o passo é de 0,5% do comprimento (1,3 mm num cabedal de 0,26 m). O maior
    // salto de verdade é a borda da boca do cano alto descendo para a frente da boca, uns 3 mm por
    // passo; sem a transição suave, a troca de curva seria um degrau de mais de 1 cm num passo só.
    const cristas = cristasDoCabedal(entrada({ cano: CANO_ALTO, altura: 0.14 }));

    for (let estacao = 1; estacao < cristas.length; estacao += 1) {
      expect(Math.abs((cristas[estacao] ?? 0) - (cristas[estacao - 1] ?? 0))).toBeLessThan(0.005);
    }
  });

  it('recusa altura abaixo do peito do pé, que é igual em todo cabedal da forma', () => {
    expect(() => cristasDoCabedal(entrada({ altura: 0.05 }))).toThrow(/peito do pé/);
  });
});
