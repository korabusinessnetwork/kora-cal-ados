// O que estes testes protegem: que engrossar uma peça empurre para cima tudo que está sobre ela,
// e nada do que está sob ela. Errar isso não dá erro nenhum: dá um cabedal afundado dentro da
// sola, ou flutuando acima dela, na tela, em silêncio.
//
// O caso mais importante do arquivo é o primeiro: com os valores padrão, todo deslocamento é
// ZERO. É a contraprova de que a regra derivada reproduz os assentos que T12 escreveu à mão. Sem
// ele, a conta poderia estar inteiramente errada e ainda assim parecer coerente consigo mesma.

import { describe, expect, it } from 'vitest';

import { empilharComposicao, type FaixaVertical } from './empilharComposicao';
import type { Forma } from './tiposDaComposicao';

/** A forma de prova, com a mesma anatomia que `acervoDeProva` declara. */
const TENIS: Forma = {
  id: 'prova-tenis-01',
  rotulo: 'Tênis de prova',
  categorias: [
    { categoria: 'sola', obrigatoria: true },
    { categoria: 'cabedal', obrigatoria: true, assenta_sobre: 'sola' },
    { categoria: 'cadarco', obrigatoria: false, assenta_sobre: 'cabedal' },
  ],
};

/** Os números do acervo de prova com os parâmetros padrão: sola 0,018 e cabedal 0,075. */
const PADRAO = new Map<string, FaixaVertical>([
  ['sola', { base: 0, topo: 0.018 }],
  ['cabedal', { base: 0.018, topo: 0.018 + 0.075 }],
  ['cadarco', { base: 0.093, topo: 0.093 + 0.006 }],
]);

function comSola(topo: number): Map<string, FaixaVertical> {
  return new Map(PADRAO).set('sola', { base: 0, topo });
}

describe('empilharComposicao', () => {
  it('não mexe em nada quando as peças estão nos tamanhos padrão', () => {
    // A contraprova da conta inteira: os assentos que T12 gravou à mão são exatamente os que a
    // regra derivada produz. Se este teste ficar vermelho, ou a regra mudou ou o acervo mudou, e
    // nos dois casos alguém precisa olhar antes de seguir.
    const deslocamentos = empilharComposicao(TENIS, PADRAO);

    expect([...deslocamentos.values()]).toEqual([0, 0, 0]);
  });

  it('engrossar a sola sobe o cabedal e o cadarço na mesma medida', () => {
    // O caso que motiva o módulo existir. 0,04 é o máximo da faixa da sola plana, e 0,04 menos os
    // 0,018 padrão dá 0,022 de subida para tudo que está em cima.
    const deslocamentos = empilharComposicao(TENIS, comSola(0.04));

    expect(deslocamentos.get('sola')).toBe(0);
    expect(deslocamentos.get('cabedal')).toBeCloseTo(0.022, 12);
    expect(deslocamentos.get('cadarco')).toBeCloseTo(0.022, 12);
  });

  it('afinar a sola desce o que está em cima, em vez de deixar fresta', () => {
    // O simétrico, e não é redundante: um sinal trocado passa no teste de engrossar e falha aqui
    // só se o resultado for conferido contra um valor negativo de verdade.
    const deslocamentos = empilharComposicao(TENIS, comSola(0.01));

    expect(deslocamentos.get('cabedal')).toBeCloseTo(-0.008, 12);
    expect(deslocamentos.get('cadarco')).toBeCloseTo(-0.008, 12);
  });

  it('aumentar o cano do cabedal sobe o cadarço e não mexe na sola', () => {
    // O que muda em cima não empurra o que está embaixo. Sem esta assertion, um empilhamento que
    // somasse na direção errada passaria em tudo que veio antes.
    const faixas = new Map(PADRAO).set('cabedal', { base: 0.018, topo: 0.018 + 0.12 });
    const deslocamentos = empilharComposicao(TENIS, faixas);

    expect(deslocamentos.get('sola')).toBe(0);
    expect(deslocamentos.get('cabedal')).toBe(0);
    expect(deslocamentos.get('cadarco')).toBeCloseTo(0.045, 12);
  });

  it('acumula ao longo da pilha: sola grossa e cano alto somam no cadarço', () => {
    // Duas mudanças em degraus diferentes têm que se somar no topo. Um empilhamento que resolvesse
    // cada peça contra o tamanho PADRÃO da de baixo, em vez de contra o tamanho já deslocado,
    // acertaria os dois testes anteriores e erraria este.
    const faixas = comSola(0.04).set('cabedal', { base: 0.018, topo: 0.018 + 0.12 });
    const deslocamentos = empilharComposicao(TENIS, faixas);

    expect(deslocamentos.get('cabedal')).toBeCloseTo(0.022, 12);
    expect(deslocamentos.get('cadarco')).toBeCloseTo(0.022 + 0.045, 12);
  });

  it('a ordem em que as peças chegam não muda o resultado', () => {
    // A ordem de uma composição é a que o modelo de linguagem escreveu, não a anatomia. Se ela
    // influenciasse, o mesmo calçado sairia diferente conforme a frase que o pediu.
    const deCimaParaBaixo = new Map([...comSola(0.04)].reverse());

    expect([...empilharComposicao(TENIS, deCimaParaBaixo)].sort()).toEqual(
      [...empilharComposicao(TENIS, comSola(0.04))].sort(),
    );
  });

  it('categoria opcional ausente não quebra a pilha', () => {
    // Composição sem cadarço é válida (a categoria é opcional na forma). Sola e cabedal têm que
    // continuar nos lugares certos, e não pode sobrar entrada para a peça que não veio.
    const semCadarco = new Map([...comSola(0.04)].filter(([categoria]) => categoria !== 'cadarco'));
    const deslocamentos = empilharComposicao(TENIS, semCadarco);

    expect([...deslocamentos.keys()]).toEqual(['sola', 'cabedal']);
    expect(deslocamentos.get('cabedal')).toBeCloseTo(0.022, 12);
  });

  it('peça no meio da pilha ausente faz a de cima assentar na de baixo, e não flutuar', () => {
    // Sem o cabedal, o cadarço tem que descer até a sola em vez de ficar pendurado na altura de um
    // cabedal que não existe. É o que a subida pela declaração até achar categoria presente faz.
    const soSolaECadarco = new Map([...PADRAO].filter(([categoria]) => categoria !== 'cabedal'));
    const deslocamentos = empilharComposicao(TENIS, soSolaECadarco);

    // O cadarço foi modelado assentando em 0,093 e agora assenta em 0,018, o topo da sola.
    expect(deslocamentos.get('cadarco')).toBeCloseTo(0.018 - 0.093, 12);
  });

  it('forma que não declara empilhamento nenhum monta as peças como foram modeladas', () => {
    // A razão de o campo ser opcional. Uma forma antiga, sem anatomia declarada, não pode ter suas
    // peças empurradas para o chão só porque este módulo passou a existir.
    const semAnatomia: Forma = {
      ...TENIS,
      categorias: TENIS.categorias.map(({ categoria, obrigatoria }) => ({ categoria, obrigatoria })),
    };

    expect([...empilharComposicao(semAnatomia, PADRAO).values()]).toEqual([0, 0, 0]);
  });

  it('recusa base que a forma não declara, em vez de deixar a peça cair no chão calada', () => {
    // Erro de digitação em `assenta_sobre` e "esta peça assenta no chão" dão o mesmo resultado e
    // têm causas opostas. Silenciar o primeiro é entregar um calçado desmontado sem aviso.
    const errada: Forma = {
      ...TENIS,
      categorias: [
        { categoria: 'sola', obrigatoria: true },
        { categoria: 'cabedal', obrigatoria: true, assenta_sobre: 'solla' },
      ],
    };

    expect(() => empilharComposicao(errada, PADRAO)).toThrow(/solla/);
  });

  it('recusa ciclo, em vez de travar o navegador', () => {
    const emCiclo: Forma = {
      ...TENIS,
      categorias: [
        { categoria: 'sola', obrigatoria: true, assenta_sobre: 'cabedal' },
        { categoria: 'cabedal', obrigatoria: true, assenta_sobre: 'sola' },
      ],
    };

    expect(() => empilharComposicao(emCiclo, PADRAO)).toThrow(/ciclo/i);
  });

  it('recusa ciclo mesmo quando ele passa só por categorias ausentes da composição', () => {
    // O ciclo que a memória de deslocamento não pega, porque nenhuma das duas chega a ser
    // resolvida: quem tem que pegá-lo é a subida em busca de categoria presente.
    const emCiclo: Forma = {
      ...TENIS,
      categorias: [
        { categoria: 'sola', obrigatoria: true },
        { categoria: 'cabedal', obrigatoria: true, assenta_sobre: 'forro' },
        { categoria: 'forro', obrigatoria: false, assenta_sobre: 'palmilha' },
        { categoria: 'palmilha', obrigatoria: false, assenta_sobre: 'forro' },
      ],
    };
    const semOMeio = new Map([...PADRAO].filter(([categoria]) => categoria !== 'cadarco'));

    expect(() => empilharComposicao(emCiclo, semOMeio)).toThrow(/ciclo/i);
  });

  it('devolve uma entrada por peça da composição, e nenhuma a mais', () => {
    // Entrada sobrando viraria deslocamento aplicado a peça que não está em cena, e o montador
    // não tem como saber que ela não devia estar ali.
    const deslocamentos = empilharComposicao(TENIS, PADRAO);

    expect([...deslocamentos.keys()].sort()).toEqual(['cabedal', 'cadarco', 'sola']);
  });
});
