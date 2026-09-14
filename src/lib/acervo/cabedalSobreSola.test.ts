// O cabedal conferido contra a sola **como elas saem do acervo**, lidas do glTF gravado.
//
// Os testes de cada geometria conferem a peça sozinha. O defeito que mais se nota num calçado, o
// cabedal passando da borda da sola ou flutuando acima dela, só existe entre duas peças, e só
// aparece se a conferência usar as medidas que o acervo realmente usa. Por isso aqui nada é
// digitado: as posições vêm do buffer de cada peça, somadas ao assento do nó.

import { describe, expect, it } from 'vitest';

import { gltfDaPecaDeProva } from './acervoDeProva';
import { meiaLarguraEm, type EstacaoDoContorno } from './contornoDoPe';
import { malhaNaForma } from './malhaNaForma';

type Ponto = [number, number, number];

interface DocumentoDaPeca {
  materials: Array<{ doubleSided?: boolean }>;
}

/** As posições da peça no espaço da forma: o vértice gravado mais o assento do nó. */
function posicoesNaForma(pecaId: string): Ponto[] {
  const { posicoes } = malhaNaForma(gltfDaPecaDeProva(pecaId), pecaId);

  return Array.from({ length: posicoes.length / 3 }, (_, ponto): Ponto => [
    posicoes[ponto * 3] ?? 0,
    posicoes[ponto * 3 + 1] ?? 0,
    posicoes[ponto * 3 + 2] ?? 0,
  ]);
}

/**
 * O contorno de uma camada horizontal da peça, estação por estação, lido dos próprios vértices.
 *
 * Em cada X que tem vértice na altura pedida, a meia largura de cada lado é o vértice mais afastado
 * do eixo. É o contorno da **malha**, não o da curva que a gerou, que é o que decide se uma peça
 * encosta na outra.
 */
function contornoNaAltura(pontos: readonly Ponto[], y: number): EstacaoDoContorno[] {
  const porX = new Map<number, EstacaoDoContorno>();

  for (const [x, altura, z] of pontos) {
    if (Math.abs(altura - y) > 1e-7) continue;

    const estacao = porX.get(x) ?? { x, fora: 0, dentro: 0 };
    estacao.fora = Math.max(estacao.fora, z);
    estacao.dentro = Math.max(estacao.dentro, -z);
    porX.set(x, estacao);
  }

  return [...porX.values()].sort((a, b) => a.x - b.x);
}

const SOLA_PLANA = posicoesNaForma('prova-sola-plana');
const TOPO_DA_SOLA = Math.max(...SOLA_PLANA.map(([, y]) => y));
const CONTORNO_DO_TOPO_DA_SOLA = contornoNaAltura(SOLA_PLANA, TOPO_DA_SOLA);

describe.each(['prova-cabedal-baixo', 'prova-cabedal-cano-alto'])('%s sobre a sola plana', (cabedalId) => {
  const cabedal = posicoesNaForma(cabedalId);
  const baseDoCabedal = Math.min(...cabedal.map(([, y]) => y));
  const contornoDaBase = contornoNaAltura(cabedal, baseDoCabedal);

  it('a base do cabedal está no plano do topo da sola: nem vão, nem cabedal enterrado', () => {
    // Critério 10.
    expect(baseDoCabedal).toBeCloseTo(TOPO_DA_SOLA, 7);
  });

  it('o contorno da base do cabedal cabe inteiro dentro do topo da sola, em toda estação', () => {
    // Critério 9. As duas meias larguras são retas entre estações, então conferir nos X das
    // estações das DUAS peças confere o contorno inteiro, sem amostragem que deixe buraco.
    const xs = [...contornoDaBase, ...CONTORNO_DO_TOPO_DA_SOLA].map(({ x }) => x);
    const primeiroX = contornoDaBase[0]?.x ?? 0;
    const ultimoX = contornoDaBase[contornoDaBase.length - 1]?.x ?? 0;
    const passaDaBorda: Array<{ x: number; lado: string; folga: number }> = [];

    for (const x of xs) {
      if (x < primeiroX || x > ultimoX) continue;

      const doCabedal = meiaLarguraEm(contornoDaBase, x);
      const daSola = meiaLarguraEm(CONTORNO_DO_TOPO_DA_SOLA, x);

      if (doCabedal.fora > daSola.fora) passaDaBorda.push({ x, lado: 'fora', folga: daSola.fora - doCabedal.fora });
      if (doCabedal.dentro > daSola.dentro) passaDaBorda.push({ x, lado: 'dentro', folga: daSola.dentro - doCabedal.dentro });
    }

    expect(contornoDaBase.length).toBeGreaterThan(20);
    expect(passaDaBorda).toEqual([]);
  });

  it('nas pontas o cabedal também fica para dentro da sola', () => {
    const ultimaDaSola = CONTORNO_DO_TOPO_DA_SOLA[CONTORNO_DO_TOPO_DA_SOLA.length - 1]?.x ?? 0;

    expect(contornoDaBase[0]?.x ?? 0).toBeGreaterThan(CONTORNO_DO_TOPO_DA_SOLA[0]?.x ?? 0);
    expect(contornoDaBase[contornoDaBase.length - 1]?.x ?? 0).toBeLessThan(ultimaDaSola);
  });
});

describe('dupla face só onde a peça é aberta (D4)', () => {
  it.each([
    ['prova-sola-plana', undefined],
    ['prova-sola-tratorada', undefined],
    ['prova-cabedal-baixo', true],
    ['prova-cabedal-cano-alto', true],
    ['prova-cadarco-reto', undefined],
  ])('%s: doubleSided é %s', (pecaId, esperado) => {
    const documento = JSON.parse(gltfDaPecaDeProva(pecaId)) as DocumentoDaPeca;

    expect(documento.materials[0]?.doubleSided).toBe(esperado);
  });
});
