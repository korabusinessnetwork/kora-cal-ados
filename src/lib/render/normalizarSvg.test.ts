// O normalizador é a peça que decide se um modelo entra no catálogo. Ele pode recusar
// arquivo — então precisa recusar pelo motivo certo, e nunca aceitar calado algo que
// mudaria a cor depois (ADR-004).

import { describe, it, expect } from 'vitest';
import { normalizarSvg } from './normalizarSvg';

describe('sanitização (BUG-004)', () => {
  it('remove <script> embutido', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect id="zona-sola" fill="#000000"/></svg>`;
    const { svg: canonico, relatorio } = normalizarSvg(svg);

    expect(canonico).not.toMatch(/<script/i);
    expect(relatorio.scriptsRemovidos).toBe(1);
  });

  it('remove handler inline (onload/onclick)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" fill="#000000" onclick="alert(1)"/></svg>`;
    const { svg: canonico, relatorio } = normalizarSvg(svg);

    expect(canonico).not.toMatch(/onclick/i);
    expect(relatorio.handlersRemovidos).toBe(1);
  });

  it('remove referência externa mas preserva referência interna', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><image href="https://exemplo.com/x.png"/><use href="#zona-sola"/><rect id="zona-sola" fill="#000000"/></svg>`;
    const { svg: canonico, relatorio } = normalizarSvg(svg);

    expect(canonico).not.toMatch(/exemplo\.com/);
    expect(canonico).toMatch(/href="#zona-sola"/);
    expect(relatorio.referenciasExternasRemovidas).toBe(1);
  });
});

describe('achatamento de estilo', () => {
  it('preserva propriedades que não são cor (senão o desenho mudaria)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>.st0{fill:#333333;stroke:#000000;stroke-width:2;}</style><rect id="zona-sola" class="st0"/></svg>`;
    const { svg: canonico } = normalizarSvg(svg);

    expect(canonico).toMatch(/stroke="#000000"/i);
    expect(canonico).toMatch(/stroke-width="2"/);
    expect(canonico).not.toMatch(/<style/i);
  });

  it('respeita !important dentro do bloco <style>', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>.st0{fill:#333333 !important;} #zona-sola{fill:#ABCDEF;}</style><rect id="zona-sola" class="st0"/></svg>`;
    expect(normalizarSvg(svg).svg).toMatch(/fill="#333333"/i);
  });

  it('lida com seletor de lista (.a,.b{...})', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>.st0,.st1{fill:#333333;}</style><rect id="a" class="st0"/><rect id="b" class="st1"/></svg>`;
    const { svg: canonico } = normalizarSvg(svg);

    expect((canonico.match(/fill="#333333"/gi) ?? []).length).toBe(2);
  });

  it('ignora comentário CSS', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>/* gerado pelo Illustrator */.st0{fill:#333333;}</style><rect id="zona-sola" class="st0"/></svg>`;
    expect(normalizarSvg(svg).svg).toMatch(/fill="#333333"/i);
  });
});

describe('recusa explícita em vez de achatar errado', () => {
  it('recusa @media (renderiza diferente conforme o contexto)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>@media (min-width:600px){.st0{fill:#333333;}}</style><rect id="zona-sola" class="st0"/></svg>`;
    expect(() => normalizarSvg(svg)).toThrow(
      expect.objectContaining({ codigo: 'SVG_NAO_NORMALIZAVEL' }),
    );
  });

  it('recusa propriedade CSS sem atributo de apresentação equivalente', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>.st0{fill:#333333;transform:rotate(3deg);}</style><rect id="zona-sola" class="st0"/></svg>`;
    expect(() => normalizarSvg(svg)).toThrow(
      expect.objectContaining({ codigo: 'SVG_NAO_NORMALIZAVEL' }),
    );
  });

  it('recusa arquivo que não é SVG', () => {
    expect(() => normalizarSvg('<html><body>oi</body></html>')).toThrow(
      expect.objectContaining({ codigo: 'SVG_INVALIDO' }),
    );
  });
});

describe('idempotência', () => {
  // Canário do ADR-005: o id cunhado é contrato. Se uma segunda passada renumerasse, todo
  // `svg_selector` já gravado em `product_zones` repointaria em silêncio. Por isso o
  // arquivo aqui tem elemento ANÔNIMO — normalizar arquivo já identificado não exercita
  // a cunhagem, que é justamente a parte que pode escorregar.
  it('normalizar duas vezes dá o mesmo resultado, mesmo com elemento anônimo', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>.st0{fill:#333333;}</style><rect id="zona-sola" class="st0" style="stroke:#000000"/><path fill="#111111"/><g><circle fill="#222222"/></g></svg>`;
    const primeira = normalizarSvg(svg).svg;
    const segunda = normalizarSvg(primeira);

    expect(segunda.svg).toBe(primeira);
    expect(segunda.relatorio.idsAtribuidos).toEqual([]);
  });
});
