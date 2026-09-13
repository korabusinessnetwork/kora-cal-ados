// A frase de um campo de hex, a mesma no esboço e na tela da composição (R9-A70).

import { describe, expect, it } from 'vitest';

import { mensagemDoHexDigitado } from './mensagemDoHexDigitado';

const frase = (texto: string) => mensagemDoHexDigitado(texto, 'a peça');

describe('a frase de cada estado do hex digitado', () => {
  it('cor completa não tem frase', () => {
    expect(frase('#C0392B')).toBe('');
    expect(frase(' #c03 ')).toBe('');
  });

  it('vazio não acusa erro, ensina o caminho', () => {
    expect(frase('')).toContain('Sem cor');
    expect(frase('   ')).toContain('Sem cor');
  });

  it('rascunho diz que falta fechar, e o que só muda quando fechar', () => {
    expect(frase('#C0')).toBe('Cor incompleta. O formato é #RGB ou #RRGGBB, e a peça só muda quando ela fecha.');
    expect(mensagemDoHexDigitado('#C0', 'o preview')).toContain('e o preview só muda');
  });

  it('errado diz que não é hex, e dá um exemplo', () => {
    for (const texto of ['vermelho', '#GGGGGG', '#C0392BB', 'rgb(1,2,3)', '#22aa44ff']) {
      expect(frase(texto)).toBe('Isso não é um hex. O formato é #RGB ou #RRGGBB, por exemplo #C0392B.');
    }
  });

  it('hex completo sem # diz que falta o #, e escreve a cor já com ele', () => {
    // É o formato que ferramenta de design copia. A cor está completa: dizer "incompleta" ou "não é
    // um hex" manda a pessoa procurar o erro no lugar errado.
    expect(frase('22aa44')).toBe('Falta o # no começo. Escreva #22aa44.');
    expect(frase(' C0392B ')).toBe('Falta o # no começo. Escreva #C0392B.');
    expect(frase('abc')).toBe('Falta o # no começo. Escreva #abc.');
  });

  it('começo de hex sem # também diz que falta o #, sem inventar a cor', () => {
    expect(frase('22aa')).toBe('Falta o # no começo. O formato é #RGB ou #RRGGBB.');
    expect(frase('2')).toBe('Falta o # no começo. O formato é #RGB ou #RRGGBB.');
  });

  it('sete dígitos sem # não é hex nenhum, com ou sem #', () => {
    expect(frase('22aa441')).toContain('não é um hex');
  });
});
