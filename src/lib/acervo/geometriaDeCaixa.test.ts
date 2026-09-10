import { describe, expect, it } from 'vitest';

import { arredondarParaFloat32, geometriaDeCaixa } from './geometriaDeCaixa';

const CAIXA = { comprimento: 0.28, altura: 0.018, largura: 0.1 };

/** Produto vetorial. Usado só para descobrir para onde um triângulo está virado. */
function produtoVetorial(a: number[], b: number[]): [number, number, number] {
  const [ax = 0, ay = 0, az = 0] = a;
  const [bx = 0, by = 0, bz = 0] = b;

  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function verticeEm(posicoes: number[], indice: number): [number, number, number] {
  return [posicoes[indice * 3] ?? 0, posicoes[indice * 3 + 1] ?? 0, posicoes[indice * 3 + 2] ?? 0];
}

describe('geometriaDeCaixa', () => {
  it('tem 24 vértices, uma normal por vértice e 36 índices', () => {
    const { posicoes, normais, indices } = geometriaDeCaixa(CAIXA);

    expect(posicoes).toHaveLength(24 * 3);
    expect(normais).toHaveLength(24 * 3);
    expect(indices).toHaveLength(6 * 2 * 3);
  });

  it('cada face tem os próprios 4 vértices, senão o canto teria uma normal só', () => {
    const { normais } = geometriaDeCaixa(CAIXA);

    // 6 normais distintas, cada uma repetida 4 vezes. Se as faces compartilhassem vértice,
    // haveria menos de 24 normais e as arestas sairiam arredondadas no navegador.
    const distintas = new Set<string>();
    for (let vertice = 0; vertice < 24; vertice += 1) {
      distintas.add(normais.slice(vertice * 3, vertice * 3 + 3).join(','));
    }

    expect(distintas.size).toBe(6);
  });

  it('a caixa tem exatamente as dimensões pedidas', () => {
    // Igualdade exata, e não `toBeCloseTo`, porque aqui dá para exigir exatidão: a dimensão é
    // arredondada para float32 ANTES de ser partida ao meio, e dividir por 2 é exato em ponto
    // flutuante binário. A primeira versão deste teste pedia 9 casas decimais e reprovava por
    // 1,2e-9, que é só a precisão do float32 em 0,28, não defeito nenhum.
    const { minimo, maximo } = geometriaDeCaixa(CAIXA);

    expect(maximo[0] - minimo[0]).toBe(arredondarParaFloat32(CAIXA.comprimento));
    expect(maximo[1] - minimo[1]).toBe(arredondarParaFloat32(CAIXA.altura));
    expect(maximo[2] - minimo[2]).toBe(arredondarParaFloat32(CAIXA.largura));
  });

  it('a base fica na origem e a peça cresce para cima, nunca para baixo', () => {
    const { minimo, maximo } = geometriaDeCaixa(CAIXA);

    // É o que faz o parâmetro de espessura engrossar a sola sem afundá-la no chão. Se o centro
    // do volume estivesse na origem, `minimo[1]` seria negativo.
    expect(minimo[1]).toBe(0);
    expect(maximo[1]).toBe(arredondarParaFloat32(CAIXA.altura));
  });

  it('a peça é centrada nos eixos horizontais', () => {
    const { minimo, maximo } = geometriaDeCaixa(CAIXA);

    expect(minimo[0]).toBe(-maximo[0]);
    expect(minimo[2]).toBe(-maximo[2]);
  });

  it('max é maior que min nos três eixos, ou seja, nenhuma dimensão degenerada', () => {
    const { minimo, maximo } = geometriaDeCaixa({ comprimento: 0.13, altura: 0.003, largura: 0.05 });

    for (const eixo of [0, 1, 2] as const) {
      expect(maximo[eixo]).toBeGreaterThan(minimo[eixo]);
    }
  });

  it('min e max saem das posições de verdade, não das dimensões pedidas', () => {
    const { posicoes, minimo, maximo } = geometriaDeCaixa(CAIXA);

    for (const eixo of [0, 1, 2] as const) {
      const doEixo = posicoes.filter((_, indice) => indice % 3 === eixo);
      expect(minimo[eixo]).toBe(Math.min(...doEixo));
      expect(maximo[eixo]).toBe(Math.max(...doEixo));
    }
  });

  it('toda posição já está na precisão de float32 em que vai ser gravada', () => {
    // Sem isto, o `min`/`max` calculado em float64 discordaria do vértice gravado em float32 e
    // o validador da Khronos reprovaria com ACCESSOR_MAX_MISMATCH.
    const { posicoes, minimo, maximo } = geometriaDeCaixa(CAIXA);

    for (const valor of [...posicoes, ...minimo, ...maximo]) {
      expect(Math.fround(valor)).toBe(valor);
    }
  });

  it('toda normal é unitária e alinhada a um eixo', () => {
    const { normais } = geometriaDeCaixa(CAIXA);

    for (let vertice = 0; vertice < 24; vertice += 1) {
      const normal = normais.slice(vertice * 3, vertice * 3 + 3);
      const modulo = Math.hypot(...normal);

      expect(modulo).toBeCloseTo(1, 12);
      expect(normal.filter((componente) => componente !== 0)).toHaveLength(1);
    }
  });

  it('todo triângulo está virado para fora, que é o que o impede de sumir na tela', () => {
    // O renderizador descarta a face de trás. Um triângulo com o sentido de enrolamento
    // invertido não dá erro nenhum: ele simplesmente fica invisível, e a caixa aparece com um
    // buraco. Este teste compara a normal geométrica do triângulo (produto vetorial dos dois
    // lados) com a normal declarada nos vértices dele.
    const { posicoes, normais, indices } = geometriaDeCaixa(CAIXA);

    for (let triangulo = 0; triangulo < indices.length / 3; triangulo += 1) {
      const [a = 0, b = 0, c = 0] = indices.slice(triangulo * 3, triangulo * 3 + 3);
      const pa = verticeEm(posicoes, a);
      const pb = verticeEm(posicoes, b);
      const pc = verticeEm(posicoes, c);

      const geometrica = produtoVetorial(
        [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]],
        [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]],
      );
      const modulo = Math.hypot(...geometrica);
      const declarada = verticeEm(normais, a);

      expect(modulo).toBeGreaterThan(0);
      for (const eixo of [0, 1, 2] as const) {
        expect(geometrica[eixo] / modulo).toBeCloseTo(declarada[eixo], 6);
      }
    }
  });

  it('todo índice aponta para um vértice que existe', () => {
    const { posicoes, indices } = geometriaDeCaixa(CAIXA);
    const vertices = posicoes.length / 3;

    for (const indice of indices) {
      expect(Number.isInteger(indice)).toBe(true);
      expect(indice).toBeGreaterThanOrEqual(0);
      expect(indice).toBeLessThan(vertices);
    }
  });

  it('uma peça fina continua fechada, sem face colapsada', () => {
    // O cadarço tem 6 mm de altura. É o caso que mais convida a um arredondamento colapsar duas
    // faces uma na outra.
    const { posicoes } = geometriaDeCaixa({ comprimento: 0.13, altura: 0.006, largura: 0.05 });
    const alturas = new Set(posicoes.filter((_, indice) => indice % 3 === 1));

    expect(alturas.size).toBe(2);
  });
});
