import { describe, expect, it } from 'vitest';

import { contornoDoPe } from './contornoDoPe';
import { anelDoContorno, extrusaoDoContorno } from './extrusaoDoContorno';

const ESTACOES = contornoDoPe({ comprimento: 0.28, largura: 0.1, estacoes: 15 });

describe('anelDoContorno', () => {
  it('as pontas entram uma vez só, e as estações do meio duas', () => {
    // Duas vezes na ponta seria dois vértices na MESMA posição, ou seja, um triângulo de área
    // zero em cada extremidade da peça.
    expect(anelDoContorno(ESTACOES)).toHaveLength(2 * ESTACOES.length - 2);
  });

  it('dá a volta: começa no calcanhar, passa pela biqueira e volta pelo outro lado', () => {
    const anel = anelDoContorno(ESTACOES);
    const primeira = ESTACOES[0];
    const ultima = ESTACOES[ESTACOES.length - 1];

    expect(anel[0]).toEqual([primeira?.x, 0]);
    expect(anel[ESTACOES.length - 1]).toEqual([ultima?.x, 0]);
  });

  it('a ida é pelo lado de dentro e a volta pelo lado de fora', () => {
    // A ordem é o que faz a parede ficar virada para fora. Invertê-la viraria o sólido do avesso.
    const anel = anelDoContorno(ESTACOES);
    const naIda = anel[1] ?? [0, 0];
    const naVolta = anel[anel.length - 1] ?? [0, 0];

    expect(naIda[1]).toBeLessThan(0);
    expect(naVolta[1]).toBeGreaterThan(0);
    expect(naIda[0]).toBe(naVolta[0]);
  });

  it('nenhum ponto do anel repete o vizinho', () => {
    const anel = anelDoContorno(ESTACOES);

    for (let ponto = 0; ponto < anel.length; ponto += 1) {
      const atual = anel[ponto] ?? [0, 0];
      const adiante = anel[(ponto + 1) % anel.length] ?? [0, 0];

      expect(atual).not.toEqual(adiante);
    }
  });
});

describe('extrusaoDoContorno', () => {
  const duasAlturas = [
    { y: 0, estacoes: ESTACOES },
    { y: 0.02, estacoes: ESTACOES },
  ];

  it('recusa menos de 2 níveis, porque com um só não há sólido', () => {
    expect(() => extrusaoDoContorno([{ y: 0, estacoes: ESTACOES }])).toThrow(/pelo menos 2 níveis/);
  });

  it('recusa níveis com contagens diferentes de estação', () => {
    // A parede liga a estação `i` de um nível à estação `i` do nível de cima. Contagens
    // diferentes ligariam o bico de um ao meio do outro, e a peça sairia torcida em vez de
    // reprovar.
    const outro = contornoDoPe({ comprimento: 0.28, largura: 0.1, estacoes: 9 });

    expect(() => extrusaoDoContorno([{ y: 0, estacoes: ESTACOES }, { y: 0.02, estacoes: outro }])).toThrow(
      /mesma contagem de estações/,
    );
  });

  it('o sólido ocupa a altura entre o primeiro e o último nível', () => {
    const { posicoes } = extrusaoDoContorno(duasAlturas);
    const alturas = posicoes.filter((_, indice) => indice % 3 === 1);

    expect(Math.min(...alturas)).toBe(0);
    expect(Math.max(...alturas)).toBeCloseTo(0.02, 6);
  });

  it('a tampa de cima e a de baixo têm vértices próprios, separados dos da parede', () => {
    // Quina se faz separando vértices. Compartilhá-los faria a normal do topo se misturar com a
    // da lateral, e a borda da sola sairia derretida.
    const { posicoes } = extrusaoDoContorno(duasAlturas);
    const noTopo = posicoes.filter((_, indice) => indice % 3 === 1).filter((y) => y > 0.019).length;

    // A tampa de cima usa `2n - 2` vértices e o anel do topo da parede outros tantos.
    expect(noTopo).toBe(2 * (2 * ESTACOES.length - 2));
  });
});
