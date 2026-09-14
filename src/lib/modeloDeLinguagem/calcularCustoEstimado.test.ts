import { describe, expect, it } from 'vitest';

import { SEM_CUSTO, calcularCustoEstimado, formatarCustoEmDolar, inteiroNaoNegativo } from './calcularCustoEstimado';

describe('calcularCustoEstimado', () => {
  it('multiplica tokens pelo preço por milhão, entrada e saída separadas', () => {
    // 1200 de entrada a US$ 0,15 e 300 de saída a US$ 0,60: 0,00018 + 0,00018.
    expect(calcularCustoEstimado(1200, 300, { entrada: 0.15, saida: 0.6 })).toBe(0.00036);
    expect(calcularCustoEstimado(1_000_000, 1_000_000, { entrada: 3, saida: 15 })).toBe(18);
  });

  it('fornecedor grátis custa zero', () => {
    expect(calcularCustoEstimado(5000, 5000, SEM_CUSTO)).toBe(0);
  });

  it('arredonda em 6 casas, a precisão da coluna', () => {
    expect(calcularCustoEstimado(1, 0, { entrada: 0.0000001, saida: 0 })).toBe(0);
    expect(calcularCustoEstimado(7, 0, { entrada: 0.3333333, saida: 0 })).toBe(0.000002);
  });

  it('usage quebrado do fornecedor conta zero, e nunca vira custo negativo ou NaN', () => {
    expect(calcularCustoEstimado(-50, Number.NaN, { entrada: 1, saida: 1 })).toBe(0);
    expect(inteiroNaoNegativo('12')).toBe(0);
    expect(inteiroNaoNegativo(12.7)).toBe(12);
  });
});

describe('formatarCustoEmDolar', () => {
  it('duas casas no normal, quatro abaixo de um centavo, vírgula decimal', () => {
    expect(formatarCustoEmDolar(0)).toBe('US$ 0,00');
    expect(formatarCustoEmDolar(12.5)).toBe('US$ 12,50');
    expect(formatarCustoEmDolar(0.00036)).toBe('US$ 0,0004');
  });
});
