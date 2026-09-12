// A cascata do achatamento. `normalizarSvg.test.ts` já prova que o `<style>` some e que o
// `!important` é respeitado; o que ninguém prendia é QUEM GANHA quando duas regras pintam o mesmo
// elemento, que é o único momento em que `calcularEspecificidade` decide alguma coisa.
//
// Por que isso merece teste próprio, e não é preciosismo de parser: o achatamento acontece uma vez,
// no upload, e o resultado dele vira o asset canônico. Errar a cascata aqui não dá erro nem aviso,
// dá um calçado cuja sola já entra no catálogo com a cor errada, e o editor e a API vão concordar
// perfeitamente sobre essa cor errada. É a falha que o princípio nº1 não consegue pegar sozinho,
// porque ele garante que o editor mostre o que a API gera, não que o canônico esteja certo.
//
// Os dois lados são testados de propósito: a função sozinha, que é onde a conta mora, e o efeito
// dela no SVG achatado, que é o que a pessoa vê. Só a segunda metade prova que a conta está
// realmente ligada no fio.

import { describe, it, expect } from 'vitest';

import { calcularEspecificidade, lerDeclaracoes, lerRegrasCss } from './lerRegrasCss';
import { normalizarSvg } from './normalizarSvg';

/** A cor que sobrou no elemento `#z` depois do achatamento. */
function corAchatada(style: string, corpo: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>${style}</style>${corpo}</svg>`;

  return normalizarSvg(svg).svg.match(/fill="([^"]*)"/i)?.[1] ?? '(nenhuma)';
}

describe('especificidade', () => {
  it('id pesa mais que classe, que pesa mais que elemento', () => {
    // A ordem entre as três é o que a conta inteira existe para preservar. Os números exatos não
    // importam, a relação importa, e é ela que está afirmada aqui.
    expect(calcularEspecificidade('#z')).toBeGreaterThan(calcularEspecificidade('.a'));
    expect(calcularEspecificidade('.a')).toBeGreaterThan(calcularEspecificidade('path'));
  });

  it('uma classe a mais desempata contra uma classe só', () => {
    expect(calcularEspecificidade('.a.b')).toBeGreaterThan(calcularEspecificidade('.a'));
  });

  it('descendente pesa mais que a classe sozinha', () => {
    // `.zona path` é `.zona` mais um elemento. Se o elemento não fosse contado, os dois empatariam
    // e quem decidiria seria a ordem no arquivo, que é outra regra.
    expect(calcularEspecificidade('.zona path')).toBeGreaterThan(calcularEspecificidade('.zona'));
  });

  it('atributo e pseudo-classe contam como classe, que é o que o CSS manda', () => {
    expect(calcularEspecificidade('[fill]')).toBe(calcularEspecificidade('.a'));
    expect(calcularEspecificidade(':hover')).toBe(calcularEspecificidade('.a'));
  });

  it('a escala é 10.000 / 100 / 1, em número cheio', () => {
    // Número exato, e não só a relação, por um motivo concreto: o regex de elemento casa letra no
    // começo ou depois de espaço, `>`, `+` ou `~`. Tirar essa âncora faz a letra depois de `.` e de
    // `#` contar como elemento, e aí TODA classe vale 101 e todo id 10.001. Com afirmação só
    // relativa a conta inteira anda junto e nada quebra: foi exatamente o que aconteceu quando essa
    // mutação foi rodada contra a versão anterior deste teste, e ela sobreviveu.
    //
    // O número cheio também é o que documenta a escala para quem for mexer: o vão de 100 entre os
    // níveis é o que garante que nenhum monte de elementos alcance uma classe num SVG real.
    expect(calcularEspecificidade('#z')).toBe(10_000);
    expect(calcularEspecificidade('.a')).toBe(100);
    expect(calcularEspecificidade('[fill]')).toBe(100);
    expect(calcularEspecificidade(':hover')).toBe(100);
    expect(calcularEspecificidade('path')).toBe(1);
    expect(calcularEspecificidade('.zona path')).toBe(101);
  });

  it('combinador filho conta os dois elementos', () => {
    expect(calcularEspecificidade('g > path')).toBe(2 * calcularEspecificidade('path'));
  });
});

describe('ordem de origem', () => {
  it('a numeração continua entre blocos <style>, que é o desempate', () => {
    // Dois blocos são comuns em SVG de ferramenta de design. Se a ordem reiniciasse no segundo, uma
    // regra dele empataria com a primeira do bloco anterior e o desempate viraria sorteio.
    const primeiro = lerRegrasCss('.a{fill:#111111;}.b{fill:#222222;}');
    const segundo = lerRegrasCss('.c{fill:#333333;}', primeiro.length);

    expect(primeiro.map((r) => r.ordem)).toEqual([0, 1]);
    expect(segundo.map((r) => r.ordem)).toEqual([2]);
  });

  it('cada seletor da lista vira uma regra com ordem própria', () => {
    expect(lerRegrasCss('.a,.b{fill:#111111;}').map((r) => r.seletor)).toEqual(['.a', '.b']);
  });
});

describe('quem ganha no SVG achatado', () => {
  it('empate de especificidade é decidido pela ordem, e ganha a última', () => {
    // As duas são `.classe`, mesmo peso. É o que o navegador faz, e o canônico tem que sair igual.
    expect(corAchatada('.a{fill:#111111;}.b{fill:#222222;}', '<rect id="z" class="a b"/>')).toBe(
      '#222222',
    );
  });

  it('inverter a ordem inverte o vencedor, provando que é a ordem que decide', () => {
    // Sem este par, o teste acima passaria também num código que sempre escolhesse a regra `.b`.
    expect(corAchatada('.b{fill:#222222;}.a{fill:#111111;}', '<rect id="z" class="a b"/>')).toBe(
      '#111111',
    );
  });

  it('o descendente ganha da classe solta MESMO vindo antes dela', () => {
    // A afirmação central do arquivo. O descendente está em primeiro no CSS, então a ordem está
    // contra ele: só a especificidade pode fazê-lo ganhar. Se `calcularEspecificidade` parar de
    // contar o elemento, os dois empatam em 100 e a classe solta, por vir depois, passa a pintar.
    expect(
      corAchatada(
        '.zona path{fill:#111111;}.solta{fill:#222222;}',
        '<g class="zona"><path id="z" class="solta"/></g>',
      ),
    ).toBe('#111111');
  });

  it('o id ganha da classe MESMO vindo antes dela', () => {
    expect(corAchatada('#z{fill:#111111;}.solta{fill:#222222;}', '<rect id="z" class="solta"/>')).toBe(
      '#111111',
    );
  });

  it('estilo inline ganha de tudo, inclusive do id', () => {
    // É o que o navegador faz. O inline entra depois de todas as regras justamente por isso.
    expect(corAchatada('#z{fill:#111111;}', '<rect id="z" style="fill:#222222"/>')).toBe('#222222');
  });
});

describe('declaração malformada é recusada, não adivinhada', () => {
  it('sem dois-pontos não vira declaração vazia calada', () => {
    expect(() => lerDeclaracoes('fill #111111')).toThrow(/malformada/i);
  });

  it('ponto e vírgula sobrando não é erro', () => {
    expect(lerDeclaracoes('fill:#111111;;')).toEqual([{ propriedade: 'fill', valor: '#111111' }]);
  });

  it('a propriedade é normalizada para minúsculo, o valor não', () => {
    // O valor precisa sobreviver como veio: `url(#Grad)` e `#ABCDEF` são sensíveis a caixa em
    // referência, e baixar a caixa do valor quebraria a referência sem avisar.
    expect(lerDeclaracoes('FILL:#ABCDEF')).toEqual([{ propriedade: 'fill', valor: '#ABCDEF' }]);
  });
});
