// O cadarço conferido contra o cabedal **como os dois saem do acervo**, lidos do glTF gravado.
//
// O critério 13 da spec `acervo-com-cara-de-tenis` não se prova olhando o cadarço sozinho: deitar
// sobre o peito do pé é uma relação entre duas peças, e ela só é verdade se valer para as posições
// que o arquivo carrega, com o assento de cada uma somado.

import { describe, expect, it } from 'vitest';

import { catalogoDeProva, gltfDaPecaDeProva } from './acervoDeProva';
import { alturaDaSuperficie } from './alturaDaSuperficie';
import { FILEIRAS_DO_CADARCO, FOLGA_DO_APOIO } from './geometriaDeCadarco';
import { malhaNaForma, type MalhaLida } from './malhaNaForma';
import { montarComposicao } from '../composicao/montarComposicao';
import { validarComposicao } from '../composicao/validarComposicao';

type Ponto = [number, number, number];

const CADARCO = 'prova-cadarco-reto';

function pontos({ posicoes }: MalhaLida): Ponto[] {
  return Array.from({ length: posicoes.length / 3 }, (_, vertice): Ponto => [
    posicoes[vertice * 3] ?? 0,
    posicoes[vertice * 3 + 1] ?? 0,
    posicoes[vertice * 3 + 2] ?? 0,
  ]);
}

function superficieEm(malha: MalhaLida, x: number, z: number): number {
  const altura = alturaDaSuperficie(malha, x, z);
  if (altura === undefined) throw new Error(`nada do cabedal embaixo de x = ${x}, z = ${z}`);

  return altura;
}

/**
 * Para cada ponto (x, z) do cadarço, o vértice mais baixo que cai nele. São os pontos de apoio: a
 * face de baixo da fita, onde ela encosta no cabedal.
 */
function pontosDeApoio(cadarco: readonly Ponto[]): Ponto[] {
  const porColuna = new Map<string, Ponto>();

  for (const ponto of cadarco) {
    const chave = `${ponto[0].toFixed(6)}|${ponto[2].toFixed(6)}`;
    const atual = porColuna.get(chave);
    if (atual === undefined || ponto[1] < atual[1]) porColuna.set(chave, ponto);
  }

  return [...porColuna.values()];
}

const CABEDAL_BAIXO = malhaNaForma(gltfDaPecaDeProva('prova-cabedal-baixo'), 'prova-cabedal-baixo');
const CANO_ALTO = malhaNaForma(gltfDaPecaDeProva('prova-cabedal-cano-alto'), 'prova-cabedal-cano-alto');
const DO_CADARCO = malhaNaForma(gltfDaPecaDeProva(CADARCO), CADARCO);
const VERTICES_DO_CADARCO = pontos(DO_CADARCO);
const APOIOS = pontosDeApoio(VERTICES_DO_CADARCO);

describe('o cadarço deita sobre o cabedal baixo (critério 13)', () => {
  it('todo ponto de apoio fica a menos de 1 mm da superfície do cabedal, e nenhum abaixo dela', () => {
    const distancias = APOIOS.map(([x, y, z]) => y - superficieEm(CABEDAL_BAIXO, x, z));

    expect(APOIOS.length).toBeGreaterThan(100);
    expect(Math.min(...distancias)).toBeGreaterThan(FOLGA_DO_APOIO - 1e-6);
    expect(Math.max(...distancias)).toBeLessThan(0.001);
  });

  it('nenhum ponto do cadarço fica mais de 1 cm acima da superfície do cabedal', () => {
    const acima = VERTICES_DO_CADARCO.map(([x, y, z]) => y - superficieEm(CABEDAL_BAIXO, x, z));

    expect(Math.max(...acima)).toBeLessThan(0.01);
  });

  it('entre dois pontos de apoio a fita não afunda no cabedal', () => {
    // A face de baixo é reta entre dois pontos e o peito do pé é uma malha que dobra nas arestas.
    // Se a dobra caísse no meio de um pedaço, a reta passaria por baixo dela. A folga só esconderia
    // isso (a queda medida sem a correção é de 0,15 mm, menor que a folga), então a conferência é
    // contra a própria folga, e não contra zero.
    const porFaixa = new Map<string, Ponto[]>();
    for (const ponto of APOIOS) {
      const chave = ponto[0].toFixed(6);
      porFaixa.set(chave, [...(porFaixa.get(chave) ?? []), ponto]);
    }

    let menorFolga = Number.POSITIVE_INFINITY;
    for (const faixa of porFaixa.values()) {
      const ordenada = [...faixa].sort((a, b) => a[2] - b[2]);

      for (let indice = 1; indice < ordenada.length; indice += 1) {
        const [xa, ya, za] = ordenada[indice - 1] ?? [0, 0, 0];
        const [xb, yb, zb] = ordenada[indice] ?? [0, 0, 0];
        for (const fracao of [0.25, 0.5, 0.75]) {
          const [x, y, z] = [xa + (xb - xa) * fracao, ya + (yb - ya) * fracao, za + (zb - za) * fracao];

          menorFolga = Math.min(menorFolga, y - superficieEm(CABEDAL_BAIXO, x, z));
        }
      }
    }

    expect(menorFolga).toBeGreaterThan(FOLGA_DO_APOIO - 1e-6);
  });

  it('o cano alto tem, embaixo do cadarço, exatamente a mesma superfície (critério 12, D6)', () => {
    for (const [x, , z] of APOIOS) {
      expect(superficieEm(CANO_ALTO, x, z)).toBeCloseTo(superficieEm(CABEDAL_BAIXO, x, z), 7);
    }
  });
});

describe('o cadarço tem fileiras cruzando o peito do pé (critério 14)', () => {
  // Uma fileira é uma fita: duas bordas em X (trás e frente), cada uma com vértices do lado de
  // dentro ao lado de fora do pé. Agrupar pelos X distintos conta as bordas sem depender da ordem
  // em que a geometria gravou os vértices.
  const bordas = new Map<string, number[]>();
  for (const [x, , z] of VERTICES_DO_CADARCO) {
    const chave = x.toFixed(5);
    bordas.set(chave, [...(bordas.get(chave) ?? []), z]);
  }

  it('pelo menos 4 fileiras', () => {
    expect(FILEIRAS_DO_CADARCO).toBeGreaterThanOrEqual(4);
    expect(bordas.size).toBe(FILEIRAS_DO_CADARCO * 2);
  });

  it('toda fileira vai de um lado do pé ao outro, passando pelo meio', () => {
    for (const zs of bordas.values()) {
      expect(Math.min(...zs)).toBeLessThan(-0.02);
      expect(Math.max(...zs)).toBeGreaterThan(0.02);
    }
  });
});

describe('a fita é um sólido fechado, virado para fora', () => {
  it('toda aresta é usada exatamente uma vez em cada sentido', () => {
    // Faces com vértices próprios não compartilham índice, então a conferência é por posição.
    const chaveDo = (indice: number): string =>
      [0, 1, 2].map((eixo) => (DO_CADARCO.posicoes[indice * 3 + eixo] ?? 0).toFixed(7)).join(',');
    const arestas = new Map<string, number>();

    for (let triangulo = 0; triangulo < DO_CADARCO.indices.length; triangulo += 3) {
      const cantos = [0, 1, 2].map((canto) => chaveDo(DO_CADARCO.indices[triangulo + canto] ?? 0));

      for (let lado = 0; lado < 3; lado += 1) {
        const aresta = `${cantos[lado]}>${cantos[(lado + 1) % 3]}`;
        arestas.set(aresta, (arestas.get(aresta) ?? 0) + 1);
      }
    }

    const semPar = [...arestas].filter(([aresta, vezes]) => {
      const [de, para] = aresta.split('>');
      return vezes !== 1 || arestas.get(`${para}>${de}`) !== 1;
    });

    expect(semPar).toEqual([]);
  });

  it('o volume com sinal é positivo, ou seja, as faces olham para fora', () => {
    // Pelo teorema da divergência, a soma de a · (b × c) / 6 sobre um sólido fechado é o volume, com
    // sinal positivo só se todo triângulo estiver virado para fora.
    let volume = 0;
    const { posicoes, indices } = DO_CADARCO;
    const ponto = (indice: number): Ponto => [
      posicoes[indice * 3] ?? 0,
      posicoes[indice * 3 + 1] ?? 0,
      posicoes[indice * 3 + 2] ?? 0,
    ];

    for (let triangulo = 0; triangulo < indices.length; triangulo += 3) {
      const [ax, ay, az] = ponto(indices[triangulo] ?? 0);
      const [bx, by, bz] = ponto(indices[triangulo + 1] ?? 0);
      const [cx, cy, cz] = ponto(indices[triangulo + 2] ?? 0);

      volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    }

    // Cinco fitas de 54 x 6 x 6 mm, menos o que as pontas da largura descem: da ordem de 1 cm³.
    expect(volume).toBeGreaterThan(5e-7);
  });
});

describe('o limite conhecido: cadarço rígido com espessura fora do padrão', () => {
  const CATALOGO = catalogoDeProva();

  /** A distância de cada ponto de apoio à superfície do cabedal, com o calçado montado. */
  function desencontroMontado(cabedalId: string, parametrosDoCadarco = {}): number[] {
    const { modelo } = montarComposicao(
      validarComposicao(
        {
          forma_id: CATALOGO.formas[0]?.id,
          pecas: [
            { peca_id: 'prova-sola-plana' },
            { peca_id: cabedalId },
            { peca_id: CADARCO, parametros: parametrosDoCadarco },
          ],
        },
        CATALOGO,
      ),
      (peca, parametros) => gltfDaPecaDeProva(peca.id, parametros),
    );
    const cabedal = malhaNaForma(modelo, cabedalId);

    return pontosDeApoio(pontos(malhaNaForma(modelo, CADARCO))).map(
      ([x, y, z]) => y - superficieEm(cabedal, x, z),
    );
  }

  it('nos tamanhos padrão, montado, o cadarço continua deitado: o limite só existe fora do padrão', () => {
    const desencontro = desencontroMontado('prova-cabedal-baixo');

    expect(Math.min(...desencontro)).toBeGreaterThan(0);
    expect(Math.max(...desencontro)).toBeLessThan(0.001);
  });

  it('no cano alto montado o cadarço deita igual: o peito do pé é o mesmo e nada estica', () => {
    // Antes, cano no máximo era parâmetro e deixava o cadarço até 6,5 mm no ar.
    const desencontro = desencontroMontado('prova-cabedal-cano-alto');

    expect(Math.min(...desencontro)).toBeGreaterThan(0);
    expect(Math.max(...desencontro)).toBeLessThan(0.001);
  });

  // Os números medidos em 2026-09-14, com uma folga de meio milímetro para o teste não ficar
  // vermelho por arredondamento. Negativo é o cadarço entrando no cabedal, positivo é flutuando.
  //
  // O cano não entra mais aqui: cano alto é outra peça e nenhum cabedal estica (decisão do dono de
  // 2026-09-14). A espessura continua errando, e é de propósito que o teste diga isso:
  // a espessura escala em Y em volta da base do próprio cadarço, e a fileira mais alta (a de trás,
  // 1,5 cm acima da base por causa da descida do peito do pé) sobe junto com a fita. O conserto é
  // parâmetro que remodela malha, que o ADR-008 D7 recusa; fica como pendência, medida aqui.
  it.each([
    ['cadarço mais fino', { espessura: 0.003 }, -0.0073, 0.001],
    ['cadarço mais grosso', { espessura: 0.012 }, 0, 0.015],
  ])('%s: o desencontro fica dentro da faixa medida', (_, doCadarco, menor, maior) => {
    const desencontro = desencontroMontado('prova-cabedal-baixo', doCadarco);

    expect(Math.min(...desencontro)).toBeGreaterThan(menor);
    expect(Math.max(...desencontro)).toBeLessThan(maior);
  });
});
