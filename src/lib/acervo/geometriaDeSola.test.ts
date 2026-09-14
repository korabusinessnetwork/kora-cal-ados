import { describe, expect, it } from 'vitest';

import { contornoDoPe, dentroDoContorno } from './contornoDoPe';
import { geometriaDeSola } from './geometriaDeSola';
import { arredondarParaFloat32, type MalhaDePeca } from './malhaDePeca';

const MEDIDAS_DA_PLANA = { comprimento: 0.28, largura: 0.1, altura: 0.018 };
const MEDIDAS_DA_TRATORADA = { comprimento: 0.28, largura: 0.108, altura: 0.03, alturaDoCravo: 0.007 };

const PLANA = geometriaDeSola(MEDIDAS_DA_PLANA);
const TRATORADA = geometriaDeSola(MEDIDAS_DA_TRATORADA);

const SOLAS: ReadonlyArray<[string, MalhaDePeca]> = [
  ['sola plana', PLANA],
  ['sola tratorada', TRATORADA],
];

function vertice(malha: MalhaDePeca, indice: number): [number, number, number] {
  return [
    malha.posicoes[indice * 3] ?? 0,
    malha.posicoes[indice * 3 + 1] ?? 0,
    malha.posicoes[indice * 3 + 2] ?? 0,
  ];
}

/** A normal do triângulo, pelo produto vetorial de dois lados. Comprimento zero é área zero. */
function normalDoTriangulo(
  malha: MalhaDePeca,
  triangulo: number,
): { x: number; y: number; z: number; area: number } {
  const [a, b, c] = [0, 1, 2].map((canto) => malha.indices[triangulo * 3 + canto] ?? 0);
  const inicio = vertice(malha, a ?? 0);
  const primeiro = vertice(malha, b ?? 0).map((valor, eixo) => valor - (inicio[eixo] ?? 0));
  const segundo = vertice(malha, c ?? 0).map((valor, eixo) => valor - (inicio[eixo] ?? 0));

  const x = (primeiro[1] ?? 0) * (segundo[2] ?? 0) - (primeiro[2] ?? 0) * (segundo[1] ?? 0);
  const y = (primeiro[2] ?? 0) * (segundo[0] ?? 0) - (primeiro[0] ?? 0) * (segundo[2] ?? 0);
  const z = (primeiro[0] ?? 0) * (segundo[1] ?? 0) - (primeiro[1] ?? 0) * (segundo[0] ?? 0);

  return { x, y, z, area: Math.hypot(x, y, z) / 2 };
}

/** O endereço de uma posição, para casar vértices que coincidem no espaço mas não no índice. */
function enderecoDoPonto(ponto: readonly number[]): string {
  return ponto.join(',');
}

describe.each(SOLAS)('%s', (_nome, sola) => {
  it('assenta com a base em Y = 0, porque o parâmetro escala em volta da origem', () => {
    // Sola com o volume centrado na origem afundaria meio milímetro no chão a cada milímetro de
    // espessura, e a montagem de T14 teria que compensar isso peça a peça.
    expect(sola.minimo[1]).toBe(0);
  });

  it('toda normal é unitária, como o glTF 2.0 exige', () => {
    for (let ponto = 0; ponto * 3 < sola.normais.length; ponto += 1) {
      const comprimento = Math.hypot(
        sola.normais[ponto * 3] ?? 0,
        sola.normais[ponto * 3 + 1] ?? 0,
        sola.normais[ponto * 3 + 2] ?? 0,
      );

      expect(comprimento).toBeCloseTo(1, 5);
    }
  });

  it('nenhum triângulo tem área zero', () => {
    // Triângulo de área zero não tem normal, não aparece na tela e não reprova em lugar nenhum:
    // é o defeito perfeito para passar despercebido até alguém calcular normais sobre ele.
    for (let triangulo = 0; triangulo * 3 < sola.indices.length; triangulo += 1) {
      expect(normalDoTriangulo(sola, triangulo).area).toBeGreaterThan(0);
    }
  });

  it('todo triângulo está virado para o mesmo lado das normais dos seus vértices', () => {
    // O teste que pega a face do avesso. No navegador ela simplesmente some, porque o
    // renderizador descarta a face de trás, e nada no console diz por quê.
    for (let triangulo = 0; triangulo * 3 < sola.indices.length; triangulo += 1) {
      const { x, y, z, area } = normalDoTriangulo(sola, triangulo);

      for (const canto of [0, 1, 2]) {
        const ponto = sola.indices[triangulo * 3 + canto] ?? 0;
        const produto =
          x * (sola.normais[ponto * 3] ?? 0) +
          y * (sola.normais[ponto * 3 + 1] ?? 0) +
          z * (sola.normais[ponto * 3 + 2] ?? 0);

        expect(produto / (2 * area)).toBeGreaterThan(0);
      }
    }
  });

  it('é um sólido fechado: toda aresta é usada por duas faces, uma em cada sentido', () => {
    // Pela posição e não pelo índice, porque a tampa e a parede se encostam com vértices
    // separados de propósito. Um buraco na malha (tampa faltando, faixa de parede pulada) aparece
    // aqui como aresta usada uma vez só.
    const arestas = new Map<string, number>();

    for (let triangulo = 0; triangulo * 3 < sola.indices.length; triangulo += 1) {
      const cantos = [0, 1, 2].map((canto) =>
        enderecoDoPonto(vertice(sola, sola.indices[triangulo * 3 + canto] ?? 0)),
      );

      for (const lado of [0, 1, 2]) {
        const aresta = `${cantos[lado] ?? ''}>${cantos[(lado + 1) % 3] ?? ''}`;

        arestas.set(aresta, (arestas.get(aresta) ?? 0) + 1);
      }
    }

    const semPar = [...arestas.keys()].filter((aresta) => {
      const [ida = '', volta = ''] = aresta.split('>');

      return arestas.get(aresta) !== 1 || arestas.get(`${volta}>${ida}`) !== 1;
    });

    expect(semPar).toEqual([]);
  });

  it('a lateral é mais barriguda no meio da altura que no topo e na base', () => {
    // É o perfil que separa uma sola de uma caixa: o bisel de baixo, a barriga e a leve caída do
    // topo. Sem isso, a peça continuaria sendo um prisma com a planta bonita.
    const larguraPorAltura = new Map<number, { menor: number; maior: number }>();

    for (let ponto = 0; ponto * 3 < sola.posicoes.length; ponto += 1) {
      const [, y, z] = vertice(sola, ponto);
      const faixa = larguraPorAltura.get(y) ?? { menor: z, maior: z };

      larguraPorAltura.set(y, { menor: Math.min(faixa.menor, z), maior: Math.max(faixa.maior, z) });
    }

    const alturas = [...larguraPorAltura.entries()].map(([altura, { menor, maior }]) => ({
      altura,
      largura: maior - menor,
    }));
    const maisLarga = alturas.reduce((maior, atual) => (atual.largura > maior.largura ? atual : maior));
    const naBase = alturas.find(({ altura }) => altura === sola.minimo[1])?.largura ?? 0;
    const noTopo = alturas.find(({ altura }) => altura === sola.maximo[1])?.largura ?? 0;

    expect(maisLarga.altura).toBeGreaterThan(sola.minimo[1]);
    expect(maisLarga.altura).toBeLessThan(sola.maximo[1]);
    expect(maisLarga.largura).toBeGreaterThan(naBase);
    expect(maisLarga.largura).toBeGreaterThan(noTopo);
  });
});

describe('geometriaDeSola', () => {
  it('ocupa exatamente as medidas pedidas', () => {
    // As três medidas são o contrato com o resto do projeto: `medidaDoModelo3d` mede a caixa da
    // peça, e o teste de dimensão do palco confere a altura contra o padrão do parâmetro.
    const tamanho = PLANA.maximo.map((maior, eixo) => maior - (PLANA.minimo[eixo] ?? 0));

    expect(tamanho[0]).toBeCloseTo(MEDIDAS_DA_PLANA.comprimento, 6);
    expect(tamanho[1]).toBeCloseTo(MEDIDAS_DA_PLANA.altura, 6);
    expect(tamanho[2]).toBeCloseTo(MEDIDAS_DA_PLANA.largura, 6);
  });

  it('o topo fica exatamente na altura pedida, que é o padrão do parâmetro', () => {
    expect(PLANA.maximo[1]).toBe(arredondarParaFloat32(MEDIDAS_DA_PLANA.altura));
    expect(TRATORADA.maximo[1]).toBe(arredondarParaFloat32(MEDIDAS_DA_TRATORADA.altura));
  });

  it('tem pegada de pé: a planta é mais larga que o calcanhar', () => {
    const larguraEm = (de: number, ate: number): number => {
      const zs = PLANA.posicoes.filter((_, indice) => {
        const x = PLANA.posicoes[indice - (indice % 3)] ?? 0;

        return indice % 3 === 2 && x >= de && x <= ate;
      });

      return Math.max(...zs) - Math.min(...zs);
    };

    expect(larguraEm(0.05, 0.09)).toBeGreaterThan(larguraEm(-0.11, -0.07) * 1.15);
  });

  it('as pontas fecham: nos milímetros finais a sola já quase não tem largura', () => {
    // Ponta que não fecha é ponta em bico, ou pior, ponta cortada reta. As duas aparecem de longe
    // no palco, e nenhuma delas parece um tênis.
    const zsNaPonta = (de: number, ate: number): number[] =>
      PLANA.posicoes.filter((_, indice) => {
        const x = PLANA.posicoes[indice - (indice % 3)] ?? 0;

        return indice % 3 === 2 && x >= de && x <= ate;
      });

    for (const [de, ate] of [
      [-0.14, -0.138],
      [0.138, 0.14],
    ]) {
      const zs = zsNaPonta(de ?? 0, ate ?? 0);

      expect(zs.length).toBeGreaterThan(0);
      expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(MEDIDAS_DA_PLANA.largura * 0.25);
    }
  });

  describe('os cravos da sola tratorada', () => {
    it('põem material abaixo da laje', () => {
      const abaixoDaLaje = TRATORADA.posicoes.filter(
        (_, indice) => indice % 3 === 1 && (TRATORADA.posicoes[indice] ?? 0) < 0.007,
      );

      expect(abaixoDaLaje.length).toBeGreaterThan(0);
    });

    it('não mudam a altura total da sola, que continua sendo a do parâmetro', () => {
      // Sola tratorada não é sola comum com pedaços colados embaixo. Somar mudaria a altura do
      // calçado ao trocar de sola sem ninguém ter pedido.
      const semCravo = geometriaDeSola({ ...MEDIDAS_DA_TRATORADA, alturaDoCravo: 0 });

      expect(TRATORADA.maximo[1]).toBe(semCravo.maximo[1]);
      expect(TRATORADA.minimo[1]).toBe(semCravo.minimo[1]);
    });

    it('ficam todos para dentro da borda da pegada', () => {
      // Cravo aceito pelo centro apareceria pela metade para fora da sola na cintura do pé, que é
      // justamente onde a pegada é mais estreita.
      const pegada = contornoDoPe({
        comprimento: MEDIDAS_DA_TRATORADA.comprimento,
        largura: MEDIDAS_DA_TRATORADA.largura,
        estacoes: 29,
      });

      for (let ponto = 0; ponto * 3 < TRATORADA.posicoes.length; ponto += 1) {
        const [x, y, z] = vertice(TRATORADA, ponto);

        if (y >= 0.007) continue;

        expect({ x, z, dentro: dentroDoContorno(pegada, x, z) }).toEqual({ x, z, dentro: true });
      }
    });

    it('tiram a sola do chão: a área que toca o piso cai para menos da metade', () => {
      // É a diferença entre relevo e desenho: uma sola tratorada apoia em cravos, não na planta
      // inteira. Sem esta medida, "tem cravos" poderia ser satisfeito por cravos de altura zero.
      const areaNoChao = (malha: MalhaDePeca): number => {
        let area = 0;

        for (let triangulo = 0; triangulo * 3 < malha.indices.length; triangulo += 1) {
          const cantos = [0, 1, 2].map((canto) => vertice(malha, malha.indices[triangulo * 3 + canto] ?? 0));

          if (cantos.some((canto) => canto[1] !== 0)) continue;

          area += normalDoTriangulo(malha, triangulo).area;
        }

        return area;
      };

      const lisa = areaNoChao(geometriaDeSola({ ...MEDIDAS_DA_TRATORADA, alturaDoCravo: 0 }));

      expect(areaNoChao(TRATORADA)).toBeGreaterThan(0);
      expect(areaNoChao(TRATORADA)).toBeLessThan(lisa / 2);
    });

    it('recusa cravo mais alto que a sola, que não deixaria laje nenhuma', () => {
      expect(() => geometriaDeSola({ ...MEDIDAS_DA_TRATORADA, alturaDoCravo: 0.05 })).toThrow(
        /não comporta cravos/,
      );
    });
  });
});
