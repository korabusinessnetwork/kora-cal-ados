import { describe, expect, it } from 'vitest';

import { interpolacaoMonotona } from './interpolacaoMonotona';

/** Amostra a curva em passos finos, para perguntar sobre o percurso e não só sobre os nós. */
function amostrar(curva: (x: number) => number, de: number, ate: number, quantidade = 400): number[] {
  const valores: number[] = [];

  for (let passo = 0; passo <= quantidade; passo += 1) {
    valores.push(curva(de + ((ate - de) * passo) / quantidade));
  }

  return valores;
}

describe('interpolacaoMonotona', () => {
  it('passa exatamente pelos pontos de controle', () => {
    const pontos: Array<[number, number]> = [
      [0, 2],
      [1, 5],
      [3, 4],
      [4, 9],
    ];
    const curva = interpolacaoMonotona(pontos);

    for (const [x, y] of pontos) expect(curva(x)).toBeCloseTo(y, 12);
  });

  it('não passa do valor dos pontos quando a sequência vira', () => {
    // Este é o motivo de o arquivo existir. Uma spline cúbica comum faria uma barriga acima de 1
    // entre os dois pontos do meio, e no perfil do cabedal essa barriga seria o calçado passando
    // do parâmetro de altura do cano que o dono pediu.
    const curva = interpolacaoMonotona([
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 0],
    ]);

    for (const valor of amostrar(curva, 0, 3)) {
      expect(valor).toBeLessThanOrEqual(1);
      expect(valor).toBeGreaterThanOrEqual(0);
    }
  });

  it('em trecho que sobe, a curva só sobe', () => {
    const curva = interpolacaoMonotona([
      [0, 0],
      [1, 0.1],
      [2, 0.9],
      [3, 1],
    ]);
    const valores = amostrar(curva, 0, 3);

    for (let passo = 1; passo < valores.length; passo += 1) {
      expect(valores[passo] ?? 0).toBeGreaterThanOrEqual((valores[passo - 1] ?? 0) - 1e-12);
    }
  });

  it('é mais lisa que a interpolação reta: no meio do trecho ela sai da reta', () => {
    // Se fosse reta, a sola sairia poligonal, com um vinco visível em cada ponto de controle.
    const curva = interpolacaoMonotona([
      [0, 0],
      [1, 1],
      [2, 3],
    ]);

    expect(curva(0.5)).not.toBeCloseTo(0.5, 3);
  });

  it('fora da faixa dos pontos, devolve o extremo mais próximo', () => {
    // Extrapolar cúbica é a forma mais rápida de inventar uma largura negativa sem ninguém notar.
    const curva = interpolacaoMonotona([
      [0, 2],
      [1, 7],
    ]);

    expect(curva(-10)).toBe(2);
    expect(curva(10)).toBe(7);
  });

  it('recusa menos de 2 pontos, porque não há curva com um ponto só', () => {
    expect(() => interpolacaoMonotona([[0, 1]])).toThrow(/pelo menos 2 pontos/);
  });

  it('recusa x fora de ordem, que é o erro de digitação que faria a curva se dobrar', () => {
    expect(() =>
      interpolacaoMonotona([
        [0, 1],
        [0.5, 2],
        [0.5, 3],
      ]),
    ).toThrow(/estritamente crescente/);
  });
});
