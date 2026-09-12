import { describe, expect, it } from 'vitest';
import { contarElementos } from './contarElementos';

describe('contarElementos', () => {
  it('usa o singular só no 1', () => {
    expect(contarElementos(1)).toBe('1 elemento');
  });

  it('usa o plural no 2', () => {
    expect(contarElementos(2)).toBe('2 elementos');
  });

  // Zero é plural em português, e é o caso mais frequente na tela: produto recém-aberto.
  it('usa o plural no 0', () => {
    expect(contarElementos(0)).toBe('0 elementos');
  });

  it('flexiona o adjetivo junto com o substantivo', () => {
    const marcavel = { singular: 'marcável', plural: 'marcáveis' };

    expect(contarElementos(1, marcavel)).toBe('1 elemento marcável');
    expect(contarElementos(12, marcavel)).toBe('12 elementos marcáveis');
    expect(contarElementos(0, marcavel)).toBe('0 elementos marcáveis');
  });

  // O adjetivo recebido é usado como veio: a função não deriva plural de português, e este teste
  // existe para que uma tentativa futura de derivar reprove aqui, com duas palavras que não
  // seguem a mesma regra.
  it('não deriva o plural sozinha', () => {
    expect(contarElementos(3, { singular: 'marcado', plural: 'marcados' })).toBe(
      '3 elementos marcados',
    );
    expect(contarElementos(3, { singular: 'marcável', plural: 'marcáveis' })).toBe(
      '3 elementos marcáveis',
    );
  });
});
