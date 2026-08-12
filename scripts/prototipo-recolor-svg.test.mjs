// Contrato do motor de render — princípio nº1 do CLAUDE.md: a cor que sai daqui vira
// produto físico, então "não mudou a cor" nunca pode passar em silêncio.
//
// COMO LER ESTE ARQUIVO:
//   - `it(...)`        → contrato que o motor JÁ cumpre. Quebrou = regressão.
//   - `it.fails(...)`  → contrato que o motor AINDA NÃO cumpre (validado em 2026-08-12).
//                        O teste passa *porque* falha. Ao corrigir o motor (ADR-004),
//                        o vitest vai acusar "expected to fail but passed" — aí remova
//                        o `.fails`. É a trava que impede a correção ser esquecida.
//
// Cada caso abaixo é um export real de Illustrator/Figma, não hipótese.
// Quando o motor virar src/lib/render/gerarVarianteDeCor.ts, este arquivo vai junto.

import { describe, it, expect } from 'vitest';
import { gerarVarianteDeCor } from './prototipo-recolor-svg.mjs';

const NOVA = '#FF0000';

/** A zona ficou realmente com a cor pedida — e nenhum vestígio da cor antiga sobrou. */
function esperaRecolorCompleto(saida, corAntiga) {
  expect(saida).toMatch(new RegExp(NOVA, 'i'));
  expect(saida).not.toMatch(new RegExp(corAntiga, 'i'));
}

describe('gerarVarianteDeCor — o que já funciona', () => {
  it('troca a cor quando a zona usa o atributo fill', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" fill="#333333"/></svg>`;
    esperaRecolorCompleto(gerarVarianteDeCor(svg, { 'zona-sola': NOVA }), '#333333');
  });

  it('não mexe em zona que não foi pedida', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" fill="#333333"/><rect id="zona-cabedal" fill="#CCCCCC"/></svg>`;
    const saida = gerarVarianteDeCor(svg, { 'zona-sola': NOVA });
    expect(saida).toMatch(/#CCCCCC/i);
  });
});

describe('gerarVarianteDeCor — contratos ainda não cumpridos (ver ADR-004)', () => {
  it.fails('BUG-001: style inline vence o atributo fill', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" style="fill:#333333" fill="#333333"/></svg>`;
    esperaRecolorCompleto(gerarVarianteDeCor(svg, { 'zona-sola': NOVA }), '#333333');
  });

  it.fails('BUG-001: regra CSS de classe vence o atributo fill (export Illustrator)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>.st0{fill:#333333;}</style><rect id="zona-sola" class="st0"/></svg>`;
    esperaRecolorCompleto(gerarVarianteDeCor(svg, { 'zona-sola': NOVA }), '#333333');
  });

  it.fails('BUG-002: zona como grupo <g> não repinta os filhos que têm fill próprio', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><g id="zona-cabedal"><path d="M0 0" fill="#CCCCCC"/><path d="M1 1" fill="#CCCCCC"/></g></svg>`;
    esperaRecolorCompleto(gerarVarianteDeCor(svg, { 'zona-cabedal': NOVA }), '#CCCCCC');
  });

  it.fails('BUG-002: zona composta por N elementos só repinta o primeiro', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-cadarco" fill="#555555"/><rect id="zona-cadarco-2" fill="#555555"/></svg>`;
    esperaRecolorCompleto(gerarVarianteDeCor(svg, { 'zona-cadarco': NOVA }), '#555555');
  });

  it.fails('BUG-002: id duplicado deixa o segundo elemento com a cor antiga', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" fill="#111111"/><rect id="zona-sola" fill="#222222"/></svg>`;
    esperaRecolorCompleto(gerarVarianteDeCor(svg, { 'zona-sola': NOVA }), '#222222');
  });

  it.fails('BUG-003: zona inexistente devolve SVG normal em vez de falhar alto', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" fill="#000000"/></svg>`;
    expect(() => gerarVarianteDeCor(svg, { 'zona-inexistente': NOVA })).toThrow();
  });

  it.fails('BUG-003: cor inválida é aceita sem validação', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" fill="#000000"/></svg>`;
    expect(() => gerarVarianteDeCor(svg, { 'zona-sola': 'banana' })).toThrow();
  });

  it.fails('BUG-004: <script> embutido sobrevive ao motor', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect id="zona-sola" fill="#000000"/></svg>`;
    expect(gerarVarianteDeCor(svg, { 'zona-sola': NOVA })).not.toMatch(/<script/i);
  });

  it.fails('BUG-005: zona com gradiente vira cor chapa sem avisar', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="grad"><stop stop-color="#333333"/></linearGradient></defs><rect id="zona-sola" fill="url(#grad)"/></svg>`;
    expect(() => gerarVarianteDeCor(svg, { 'zona-sola': NOVA })).toThrow();
  });
});
