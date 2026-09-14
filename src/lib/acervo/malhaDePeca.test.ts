import { describe, expect, it } from 'vitest';

import {
  arredondarParaFloat32,
  juntarMalhas,
  malhaDePeca,
  normaisPorArea,
  transladarMalha,
  type MalhaCrua,
} from './malhaDePeca';

/** Um triângulo no plano XZ, virado para cima. */
const TRIANGULO: MalhaCrua = {
  posicoes: [0, 0, 0, 1, 0, 0, 0, 0, -1],
  indices: [0, 1, 2],
};

describe('normaisPorArea', () => {
  it('a normal de um triângulo sai do sentido em que ele foi enrolado', () => {
    expect(normaisPorArea(TRIANGULO)).toEqual([0, 1, 0, 0, 1, 0, 0, 1, 0]);
  });

  it('inverter o sentido do triângulo inverte a normal', () => {
    // É o sintoma mais confuso que uma malha pode ter: a peça some no navegador, porque o
    // renderizador descarta a face de trás, e nada no console diz por quê.
    const virado = normaisPorArea({ ...TRIANGULO, indices: [0, 2, 1] });

    expect(virado.slice(0, 3)).toEqual([0, -1, 0]);
  });

  it('toda normal é unitária', () => {
    const normais = normaisPorArea({
      posicoes: [0, 0, 0, 3, 0, 0, 0, 0, -7, 2, 5, -1],
      indices: [0, 1, 2, 0, 2, 3, 0, 3, 1],
    });

    for (let vertice = 0; vertice < normais.length; vertice += 3) {
      const comprimento = Math.hypot(
        normais[vertice] ?? 0,
        normais[vertice + 1] ?? 0,
        normais[vertice + 2] ?? 0,
      );

      expect(comprimento).toBeCloseTo(1, 6);
    }
  });

  it('a média é ponderada pela área: o triângulo grande manda mais que o pequeno', () => {
    // Sem a ponderação, um canto onde se encontram um triângulo enorme e uma fatia fina teria a
    // normal decidida pela fatia, e a superfície ganharia um vinco onde não há vinco.
    //
    // O vértice 0 pertence a uma face grande virada para cima e a uma face pequena virada para o
    // lado. A normal dele tem que pender bastante para cima.
    const canto: MalhaCrua = {
      posicoes: [0, 0, 0, 10, 0, 0, 0, 0, -10, 0, 0.3, 0, 10, 0.3, 0],
      indices: [0, 1, 2, 0, 3, 4],
    };
    const normais = normaisPorArea(canto);

    expect(normais[1] ?? 0).toBeGreaterThan(0.9);
  });

  it('vértice sem triângulo aponta para cima em vez de virar vetor nulo', () => {
    // O glTF 2.0 exige NORMAL unitária e o validador recusa o vetor nulo, que é o que a conta
    // devolveria. Um vértice assim é invisível de qualquer jeito.
    const comOrfao: MalhaCrua = { posicoes: [...TRIANGULO.posicoes, 5, 5, 5], indices: [0, 1, 2] };

    expect(normaisPorArea(comOrfao).slice(9)).toEqual([0, 1, 0]);
  });
});

describe('juntarMalhas', () => {
  it('soma em cada índice o deslocamento da parte, para ninguém apontar para o vértice errado', () => {
    const juntas = juntarMalhas([TRIANGULO, TRIANGULO]);

    expect(juntas.posicoes).toHaveLength(18);
    expect(juntas.indices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('não solda vértice nenhum: partes que se encostam continuam com vértices próprios', () => {
    // Soldar faria a normal atravessar a quina entre a tampa e a lateral da sola, e a borda
    // sairia derretida. Quina se faz separando vértices, e é por isso que juntar não solda.
    const juntas = juntarMalhas([TRIANGULO, TRIANGULO]);

    expect(juntas.posicoes.slice(0, 9)).toEqual(juntas.posicoes.slice(9));
  });

  it('juntar nada devolve nada', () => {
    expect(juntarMalhas([])).toEqual({ posicoes: [], indices: [] });
  });
});

describe('transladarMalha', () => {
  it('move as posições e deixa os índices em paz', () => {
    const movida = transladarMalha(TRIANGULO, [1, 2, 3]);

    expect(movida.posicoes.slice(0, 3)).toEqual([1, 2, 3]);
    expect(movida.posicoes.slice(3, 6)).toEqual([2, 2, 3]);
    expect(movida.indices).toEqual(TRIANGULO.indices);
  });

  it('as posições voltam arredondadas para float32, porque a soma sai de float64', () => {
    const movida = transladarMalha({ posicoes: [0, 0, 0], indices: [] }, [0.018, 0, 0]);

    expect(movida.posicoes[0]).toBe(arredondarParaFloat32(0.018));
  });
});

describe('malhaDePeca', () => {
  it('tira min e max das posições gravadas, e não de medida nenhuma', () => {
    // `max` derivado do parâmetro em vez do vértice reprova no validador da Khronos com
    // ACCESSOR_MAX_MISMATCH assim que uma conta de meio-extente arredondar diferente.
    const pronta = malhaDePeca({ posicoes: [-1, 0, 4, 2, 7, -3], indices: [] });

    expect(pronta.minimo).toEqual([-1, 0, -3]);
    expect(pronta.maximo).toEqual([2, 7, 4]);
  });

  it('leva as posições e os índices sem mexer, e acrescenta as normais', () => {
    const pronta = malhaDePeca(TRIANGULO);

    expect(pronta.posicoes).toEqual(TRIANGULO.posicoes);
    expect(pronta.indices).toEqual(TRIANGULO.indices);
    expect(pronta.normais).toHaveLength(TRIANGULO.posicoes.length);
  });
});
