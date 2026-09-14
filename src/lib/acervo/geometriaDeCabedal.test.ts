import { describe, expect, it } from 'vitest';

import { geometriaDeCabedal, type MedidasDoCabedal } from './geometriaDeCabedal';
import { arredondarParaFloat32, type MalhaDePeca } from './malhaDePeca';
import { CANO_ALTO, CANO_BAIXO, TRANSICAO_DA_BOCA } from './perfilDoCabedal';

const COMUM = { comprimento: 0.26, largura: 0.09, alturaDoPeito: 0.064 };
const MEDIDAS_DO_BAIXO: MedidasDoCabedal = { ...COMUM, altura: 0.075, cano: CANO_BAIXO };
const MEDIDAS_DO_ALTO: MedidasDoCabedal = { ...COMUM, altura: 0.14, cano: CANO_ALTO };

const BAIXO = geometriaDeCabedal(MEDIDAS_DO_BAIXO);
const ALTO = geometriaDeCabedal(MEDIDAS_DO_ALTO);

const CABEDAIS: ReadonlyArray<[string, MalhaDePeca, MedidasDoCabedal]> = [
  ['cabedal baixo', BAIXO, MEDIDAS_DO_BAIXO],
  ['cano alto', ALTO, MEDIDAS_DO_ALTO],
];

/** O X, a partir do calcanhar, em que a boca termina e em que o peito do pé começa. */
const X_DA_FRENTE_DA_BOCA = -COMUM.comprimento / 2 + TRANSICAO_DA_BOCA.inicio * COMUM.comprimento;
const X_DO_PEITO = -COMUM.comprimento / 2 + TRANSICAO_DA_BOCA.fim * COMUM.comprimento;

type Ponto = [number, number, number];

function vertice(malha: MalhaDePeca, indice: number): Ponto {
  return [malha.posicoes[indice * 3] ?? 0, malha.posicoes[indice * 3 + 1] ?? 0, malha.posicoes[indice * 3 + 2] ?? 0];
}

function cantos(malha: MalhaDePeca, triangulo: number): [number, number, number] {
  return [malha.indices[triangulo * 3] ?? 0, malha.indices[triangulo * 3 + 1] ?? 0, malha.indices[triangulo * 3 + 2] ?? 0];
}

/** O produto vetorial de dois lados do triângulo: aponta para onde ele está virado, e mede o dobro da área. */
function normalDoTriangulo(malha: MalhaDePeca, triangulo: number): Ponto {
  const [a, b, c] = cantos(malha, triangulo).map((indice) => vertice(malha, indice)) as [Ponto, Ponto, Ponto];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];

  return [
    (u[1] ?? 0) * (v[2] ?? 0) - (u[2] ?? 0) * (v[1] ?? 0),
    (u[2] ?? 0) * (v[0] ?? 0) - (u[0] ?? 0) * (v[2] ?? 0),
    (u[0] ?? 0) * (v[1] ?? 0) - (u[1] ?? 0) * (v[0] ?? 0),
  ];
}

function quantidadeDeTriangulos(malha: MalhaDePeca): number {
  return malha.indices.length / 3;
}

function quantidadeDeVertices(malha: MalhaDePeca): number {
  return malha.posicoes.length / 3;
}

/**
 * Se o ponto `x, z` cai dentro da sombra do triângulo vista de cima.
 *
 * Triângulo em pé (sombra de área zero) não conta: parede não é teto, e sem esta exclusão qualquer
 * ponto alinhado com a sombra dele passaria por coberto.
 */
function sombraCobre(malha: MalhaDePeca, triangulo: number, x: number, z: number): boolean {
  const [a, b, c] = cantos(malha, triangulo).map((indice) => vertice(malha, indice)) as [Ponto, Ponto, Ponto];
  const lado = (p: Ponto, q: Ponto): number => (q[0] - p[0]) * (z - p[2]) - (q[2] - p[2]) * (x - p[0]);
  const areaDaSombra = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
  if (areaDaSombra === 0) return false;

  const s1 = lado(a, b);
  const s2 = lado(b, c);
  const s3 = lado(c, a);

  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

describe.each(CABEDAIS)('%s', (_nome, cabedal, medidas) => {
  it('assenta com a base em Y = 0, que é o plano do topo da sola na forma', () => {
    expect(cabedal.minimo[1]).toBe(0);
  });

  it('o ponto mais alto é exatamente a altura modelada, que é o padrão do parâmetro', () => {
    // Critério 8. O fator de escala do cano é resolvido para isto; sem ele a estação mais alta
    // cairia entre dois pontos de controle e ficaria alguns décimos de milímetro abaixo.
    expect(cabedal.maximo[1]).toBe(arredondarParaFloat32(medidas.altura));
  });

  it('ocupa o comprimento e a largura pedidos', () => {
    expect(cabedal.maximo[0] - cabedal.minimo[0]).toBeCloseTo(medidas.comprimento, 6);
    expect(cabedal.maximo[2] - cabedal.minimo[2]).toBeCloseTo(medidas.largura, 6);
  });

  it('toda normal é unitária', () => {
    for (let ponto = 0; ponto < quantidadeDeVertices(cabedal); ponto += 1) {
      const [x, y, z] = [0, 1, 2].map((eixo) => cabedal.normais[ponto * 3 + eixo] ?? 0);

      expect(Math.hypot(x ?? 0, y ?? 0, z ?? 0)).toBeCloseTo(1, 5);
    }
  });

  it('nenhum triângulo tem área zero, nem nas pontas onde as colunas se dobram', () => {
    for (let triangulo = 0; triangulo < quantidadeDeTriangulos(cabedal); triangulo += 1) {
      expect(Math.hypot(...normalDoTriangulo(cabedal, triangulo))).toBeGreaterThan(0);
    }
  });

  it('todo triângulo está virado para o mesmo lado das normais dos seus vértices', () => {
    for (let triangulo = 0; triangulo < quantidadeDeTriangulos(cabedal); triangulo += 1) {
      const face = normalDoTriangulo(cabedal, triangulo);
      const tamanho = Math.hypot(...face);

      for (const ponto of cantos(cabedal, triangulo)) {
        const produto = face.reduce((soma, valor, eixo) => soma + valor * (cabedal.normais[ponto * 3 + eixo] ?? 0), 0);

        expect(produto / tamanho).toBeGreaterThan(0);
      }
    }
  });

  it('a casca é coerente: nenhuma aresta é percorrida duas vezes no mesmo sentido', () => {
    // Numa casca aberta a aresta da borda aparece uma vez só, então o teste de sólido fechado da
    // sola não serve aqui. O que continua valendo é o sentido: duas faces vizinhas percorrendo a
    // aresta comum no mesmo sentido significam uma delas do avesso, e com material de dupla face
    // o avesso não some da tela, ele só fica com a luz errada.
    const arestas = new Set<string>();
    const repetidas: string[] = [];

    for (let triangulo = 0; triangulo < quantidadeDeTriangulos(cabedal); triangulo += 1) {
      const [a, b, c] = cantos(cabedal, triangulo);

      for (const [de, para] of [[a, b], [b, c], [c, a]] as const) {
        const aresta = `${de}>${para}`;
        if (arestas.has(aresta)) repetidas.push(aresta);
        arestas.add(aresta);
      }
    }

    expect(repetidas).toEqual([]);
  });

  it('as normais apontam para fora do pé: para cima na crista e para os lados nas paredes', () => {
    let naCrista = 0;

    for (let ponto = 0; ponto < quantidadeDeVertices(cabedal); ponto += 1) {
      const [x, y, z] = vertice(cabedal, ponto);
      const normalY = cabedal.normais[ponto * 3 + 1] ?? 0;
      const normalZ = cabedal.normais[ponto * 3 + 2] ?? 0;

      // Só longe das pontas, onde a parede vira para a frente ou para trás.
      if (Math.abs(x) > 0.08) continue;

      if (z === 0 && y > 0) {
        naCrista += 1;
        expect(normalY).toBeGreaterThan(0.5);
      }
      if (y === 0) expect(Math.sign(normalZ)).toBe(Math.sign(z));
    }

    expect(naCrista).toBeGreaterThan(0);
  });

  it('não existe teto sobre o calcanhar: a boca é um buraco de verdade', () => {
    // Critério 11. Olhando de cima para o eixo do pé, entre o calcanhar e a frente da boca, nenhum
    // triângulo pode estar no caminho. As paredes das pontas ficam de fora da conferência porque
    // encostam no eixo por construção.
    for (let x = -0.1; x < X_DA_FRENTE_DA_BOCA - 0.01; x += 0.005) {
      for (let triangulo = 0; triangulo < quantidadeDeTriangulos(cabedal); triangulo += 1) {
        expect({ x, cobre: sombraCobre(cabedal, triangulo, x, 0) }).toEqual({ x, cobre: false });
      }
    }
  });

  it('o peito do pé é fechado em cima, que é onde o cadarço vai deitar', () => {
    for (let x = X_DO_PEITO; x < 0.1; x += 0.01) {
      let coberto = false;

      for (let triangulo = 0; triangulo < quantidadeDeTriangulos(cabedal); triangulo += 1) {
        if (sombraCobre(cabedal, triangulo, x, 0)) coberto = true;
      }

      expect({ x, coberto }).toEqual({ x, coberto: true });
    }
  });
});

describe('o cano é o que muda, o peito do pé não (D6)', () => {
  it('no cabedal baixo o ponto mais alto é a frente da boca, no eixo do pé', () => {
    const maisAlto = maisAltoDe(BAIXO);

    expect(maisAlto[2]).toBe(0);
    expect(maisAlto[0]).toBeGreaterThanOrEqual(X_DA_FRENTE_DA_BOCA - 0.001);
    expect(maisAlto[0]).toBeLessThan(X_DO_PEITO);
  });

  it('no cano alto o ponto mais alto é a borda da boca, atrás da frente dela', () => {
    expect(maisAltoDe(ALTO)[0]).toBeLessThan(X_DA_FRENTE_DA_BOCA);
  });

  it('a frente da boca do cano alto é mais alta que a do cabedal baixo', () => {
    expect(alturaNaCristaEm(ALTO, X_DA_FRENTE_DA_BOCA)).toBeGreaterThan(alturaNaCristaEm(BAIXO, X_DA_FRENTE_DA_BOCA));
  });

  it('do começo do peito do pé até a biqueira, os dois cabedais têm exatamente os mesmos vértices', () => {
    // Critério 12. Exatamente, e não "perto": é esta igualdade que deixa um cadarço só servir nos
    // dois cabedais sem se mexer.
    const doPeito = (malha: MalhaDePeca): string[] =>
      Array.from({ length: quantidadeDeVertices(malha) }, (_, ponto) => vertice(malha, ponto))
        .filter(([x]) => x >= X_DO_PEITO)
        .map((ponto) => ponto.join(','))
        .sort();

    expect(doPeito(BAIXO).length).toBeGreaterThan(50);
    expect(doPeito(ALTO)).toEqual(doPeito(BAIXO));
  });

  it('recusa cabedal mais baixo que o peito do pé, em vez de achatar o peito calado', () => {
    expect(() => geometriaDeCabedal({ ...MEDIDAS_DO_BAIXO, altura: 0.05 })).toThrow(/peito do pé/);
  });
});

function maisAltoDe(malha: MalhaDePeca): Ponto {
  let maisAlto = vertice(malha, 0);

  for (let ponto = 1; ponto < quantidadeDeVertices(malha); ponto += 1) {
    const candidato = vertice(malha, ponto);
    if (candidato[1] > maisAlto[1]) maisAlto = candidato;
  }

  return maisAlto;
}

/** A altura da crista na estação mais próxima de `x`. */
function alturaNaCristaEm(malha: MalhaDePeca, x: number): number {
  let melhor: Ponto | undefined;

  for (let ponto = 0; ponto < quantidadeDeVertices(malha); ponto += 1) {
    const candidato = vertice(malha, ponto);
    if (candidato[2] !== 0 || candidato[0] < x) continue;
    if (melhor === undefined || candidato[0] < melhor[0] || (candidato[0] === melhor[0] && candidato[1] > melhor[1])) {
      melhor = candidato;
    }
  }

  return melhor?.[1] ?? 0;
}
