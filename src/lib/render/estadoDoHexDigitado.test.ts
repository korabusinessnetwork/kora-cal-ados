// A fronteira entre "ainda está digitando" e "isso não vai virar cor" é a que decide se a pessoa
// leva bronca por um erro que não cometeu. Os dois lados custam: cedo demais ensina a ignorar o
// aviso, tarde demais guarda a má notícia para o momento de salvar.

import { describe, expect, it } from 'vitest';
import { estadoDoHexDigitado } from './estadoDoHexDigitado';

describe('estado do hex digitado', () => {
  it('campo em branco é ausência de cor, não erro', () => {
    expect(estadoDoHexDigitado('')).toBe('vazio');
    expect(estadoDoHexDigitado('   ')).toBe('vazio');
  });

  it('a forma curta é completa, e não um prefixo da longa', () => {
    // `#ABC` casa com a regra de rascunho E com a de cor válida. Se rascunho fosse conferido
    // primeiro, a forma curta nunca chegaria ao motor e o campo ficaria em "incompleto" para
    // sempre, com três dígitos perfeitamente válidos na tela.
    expect(estadoDoHexDigitado('#ABC')).toBe('completo');
    expect(estadoDoHexDigitado('#abc')).toBe('completo');
  });

  it('a forma longa é completa', () => {
    expect(estadoDoHexDigitado('#C0392B')).toBe('completo');
    expect(estadoDoHexDigitado('  #c0392b  ')).toBe('completo');
  });

  it('o caminho de quem está digitando não vira erro em nenhuma tecla', () => {
    // Esta é a sequência literal de quem digita "#C0392B" caractere a caractere. Nenhum passo
    // pode acusar, e o passo de 3 dígitos é completo porque já É uma cor.
    const digitando = ['#', '#C', '#C0', '#C03', '#C039', '#C0392', '#C0392B'];
    const estados = digitando.map(estadoDoHexDigitado);

    expect(estados).toEqual([
      'rascunho',
      'rascunho',
      'rascunho',
      'completo',
      'rascunho',
      'rascunho',
      'completo',
    ]);
    expect(estados).not.toContain('errado');
  });

  it('o que nenhuma tecla a mais salva é erro na hora', () => {
    // Esperar até o salvar para avisar destes seria adiar a mesma má notícia para o pior momento.
    expect(estadoDoHexDigitado('vermelho')).toBe('errado');
    expect(estadoDoHexDigitado('#GGG')).toBe('errado');
    expect(estadoDoHexDigitado('C0392B')).toBe('errado'); // sem o `#`
    expect(estadoDoHexDigitado('#C0392BB')).toBe('errado'); // um dígito a mais
    expect(estadoDoHexDigitado('rgb(1,2,3)')).toBe('errado');
  });
});
