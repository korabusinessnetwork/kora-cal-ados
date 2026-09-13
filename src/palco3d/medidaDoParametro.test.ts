// A medida que as duas telas do palco escrevem para um parâmetro de peça (R9-A68).
//
// Os valores são os do acervo de prova, lidos no navegador: a sola plana abre em 18,0 mm, e o
// cadarço vai de 3,0 mm a 12,0 mm.

import { describe, expect, it } from 'vitest';

import { milimetros, PASSOS_DO_PARAMETRO, passoDoParametro } from './medidaDoParametro';

describe('a medida de um parâmetro na tela (R9-A68)', () => {
  it('metros viram milímetros com uma casa e vírgula', () => {
    expect(milimetros(0.018)).toBe('18,0 mm');
    expect(milimetros(0.003)).toBe('3,0 mm');
    expect(milimetros(0.0185)).toBe('18,5 mm');
  });

  it('a faixa inteira cabe em 40 passos', () => {
    expect(PASSOS_DO_PARAMETRO).toBe(40);
    expect(passoDoParametro({ minimo: 0.01, maximo: 0.05 })).toBeCloseTo(0.001, 12);
  });
});
