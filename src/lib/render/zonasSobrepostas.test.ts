// Prova o BUG-013: duas zonas que dividem um elemento fazem a ORDEM DAS CHAVES do JSON
// decidir a cor. Aqui a detecção; em gerarVarianteDeCor.test.ts, a recusa.

import { describe, expect, it } from 'vitest';
import { zonasSobrepostas } from './zonasSobrepostas';
import type { Zona } from './gerarVarianteDeCor';

const svg = `<svg xmlns="http://www.w3.org/2000/svg">
  <g id="grupo-cabedal">
    <path id="painel" fill="#111111"/>
    <path id="lingueta" fill="#222222"/>
  </g>
  <path id="sola" fill="#333333"/>
  <path id="costura" fill="none" stroke="#000000"/>
</svg>`;

const zona = (zone_key: string, svg_selector: string): Zona => ({ zone_key, svg_selector });

describe('sobreposição de zonas', () => {
  it('zonas disjuntas não acusam nada', () => {
    expect(zonasSobrepostas(svg, [zona('cabedal', '#painel'), zona('sola', '#sola')])).toEqual([]);
  });

  it('acha o elemento dividido diretamente por duas zonas', () => {
    const achados = zonasSobrepostas(svg, [
      zona('cabedal', '#painel, #lingueta'),
      zona('logo', '#lingueta'),
    ]);

    expect(achados).toEqual([{ zone_key_a: 'cabedal', zone_key_b: 'logo', elementos: 1 }]);
  });

  it('acha o compartilhamento escondido dentro de um <g>', () => {
    // O caso que o editor cria sem ninguém perceber: uma zona endereça o grupo, outra
    // endereça um filho dele. Comparar só as strings dos seletores não veria isso.
    const achados = zonasSobrepostas(svg, [
      zona('cabedal', '#grupo-cabedal'),
      zona('logo', '#lingueta'),
    ]);

    expect(achados).toEqual([{ zone_key_a: 'cabedal', zone_key_b: 'logo', elementos: 1 }]);
  });

  it('conta quantos elementos as duas dividem', () => {
    const achados = zonasSobrepostas(svg, [
      zona('cabedal', '#grupo-cabedal'),
      zona('painel-inteiro', '#painel, #lingueta'),
    ]);

    expect(achados[0]?.elementos).toBe(2);
  });

  it('elemento fill="none" não conta como compartilhado', () => {
    // Ninguém pinta contorno: duas zonas que só dividem uma costura não brigam por cor.
    expect(
      zonasSobrepostas(svg, [zona('a', '#costura, #painel'), zona('b', '#costura, #sola')]),
    ).toEqual([]);
  });

  it('todos os pares são reportados, não só o primeiro', () => {
    const achados = zonasSobrepostas(svg, [
      zona('a', '#painel'),
      zona('b', '#painel'),
      zona('c', '#painel'),
    ]);

    expect(achados.map((s) => `${s.zone_key_a}+${s.zone_key_b}`)).toEqual(['a+b', 'a+c', 'b+c']);
  });

  it('seletor inválido não derruba a checagem', () => {
    // Seletor quebrado é problema de `relatorioDeZonas`. Se estourasse aqui, o editor
    // perderia a checagem de sobreposição inteira por causa de uma zona ruim.
    const zonas = [zona('a', '#$$'), zona('b', '#painel')];

    expect(() => zonasSobrepostas(svg, zonas)).not.toThrow();
    expect(zonasSobrepostas(svg, zonas)).toEqual([]);
  });
});
