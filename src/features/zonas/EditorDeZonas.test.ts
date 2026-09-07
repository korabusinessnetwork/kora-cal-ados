// Defeito achado na passada de navegador da Etapa 4, com a suíte inteira verde: marcar mais
// um ilhós numa zona já existente APAGAVA o `label` gravado.
//
// Como acontecia: o formulário volta vazio depois de salvar, e a tela mandava
// `label: null` para `marcarZona`. `null` ali significa "apague esta coluna" — semântica
// correta e documentada —, então o UPDATE limpava o rótulo que um colega tinha definido.
// Ninguém veria: a zona continua funcionando, só perde o nome legível.
//
// A distinção que conserta é entre "campo vazio porque não mexi" e "campo vazio porque quero
// apagar", e ela só existe quando a zona já existe.

import { describe, expect, it } from 'vitest';
import { ErroDeVariante } from '../../lib/render/erros';
import { motivoDaRecusaDeClique, preservarOuLimpar } from './EditorDeZonas';

describe('campo vazio numa zona que já existe', () => {
  it('preserva o que está gravado em vez de apagar', () => {
    // `undefined` é o que `marcarZona` lê como "não mexi nisso".
    expect(preservarOuLimpar('', true)).toBeUndefined();
    expect(preservarOuLimpar('   ', true)).toBeUndefined();
  });

  it('em zona nova, vazio é ausência mesmo — não há nada a preservar', () => {
    expect(preservarOuLimpar('', false)).toBeNull();
    expect(preservarOuLimpar('   ', false)).toBeNull();
  });

  it('texto digitado vale nos dois casos, sem espaço sobrando', () => {
    expect(preservarOuLimpar('  Ilhós  ', true)).toBe('Ilhós');
    expect(preservarOuLimpar('Ilhós', false)).toBe('Ilhós');
  });
});

// ---------------------------------------------------------------------------------------
// Defeito achado na passada de navegador da Etapa 6 (BUG-017).
// ---------------------------------------------------------------------------------------
//
// Clicar num elemento de gradiente que ainda não pertence a nenhuma zona mostrava
// `A zona "esta zona" usa gradiente ou padrão (url(#brilho))…`. A frase é do motor e está
// certa lá: na geração a zona existe e tem nome. No clique não há zona — e o texto se lê
// como se houvesse uma zona chamada "esta zona".
//
// Só aparece com o elemento SEM DONO: se ele já pertence a outra zona, a recusa de posse
// responde primeiro e esconde esta. Foi por isso que a primeira passada não pegou.

describe('recusa de clique falada em cima do elemento, não da zona', () => {
  it('gradiente: não inventa uma zona chamada "esta zona"', () => {
    const motivo = motivoDaRecusaDeClique(
      new ErroDeVariante(
        'ZONA_NAO_RECOLORIVEL',
        'A zona "esta zona" usa gradiente ou padrão (url(#brilho)) e não pode virar cor chapa sem descaracterizar o modelo.',
      ),
    );

    expect(motivo).not.toContain('esta zona');
    expect(motivo).toContain('Esse elemento');
    expect(motivo).toContain('gradiente');
  });

  it('código de erro sem texto próprio ainda diz o motivo, em vez de emudecer', () => {
    // Motor ganha código novo antes de a tela ganhar frase: a mensagem dele é pior que uma
    // escrita para o clique, e muito melhor que "não deu certo".
    const motivo = motivoDaRecusaDeClique(
      new ErroDeVariante('SVG_INVALIDO', 'O arquivo não é um SVG válido.'),
    );

    expect(motivo).toBe('O arquivo não é um SVG válido.');
  });

  it('falha que não é do motor não vaza texto de exceção para a tela', () => {
    // `TypeError: Cannot read properties of null` na tela de quem marca zona não ajuda
    // ninguém e assusta — mesma regra do BUG-016.
    expect(motivoDaRecusaDeClique(new TypeError('Cannot read properties of null'))).toBe(
      'Esse elemento não aceita cor.',
    );
    expect(motivoDaRecusaDeClique('qualquer coisa')).toBe('Esse elemento não aceita cor.');
  });
});
