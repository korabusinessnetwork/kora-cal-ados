// Protótipo do motor de render: a mesma coisa que você acabou de fazer na mão via
// DevTools (Elements > editar fill), só que como código reaproveitável.
//
// Vira src/lib/render/gerarVarianteDeCor.ts quando o projeto Vite existir — ver
// docs/03_REGRAS_DE_NEGOCIO/glossario.md e memory/patterns.md, esse é o nome
// canônico já registrado lá.
//
// Este arquivo é só o MOTOR (sem efeito colateral) para poder ser importado pelo teste
// — a demonstração executável vive em `prototipo-recolor-demo.mjs` (npm run prototipo:recolor).
//
// ⚠️  LIMITAÇÕES CONHECIDAS E VALIDADAS (2026-08-12) — ver memory/bugs.md BUG-001..003 e
//     `scripts/prototipo-recolor-svg.test.mjs`. Este motor NÃO está pronto para SVG real
//     de Illustrator/Figma: `style` inline e regra CSS vencem o atributo `fill`, então a
//     cor falha em silêncio. Contrato corrigido proposto em ADR-004.

import { JSDOM } from 'jsdom';

/**
 * Recebe o SVG base (texto) e um mapa { zona_id: cor } e devolve o SVG com as
 * zonas pedidas recoloridas. Zona que não existe no SVG é ignorada com aviso —
 * nunca falha silenciosamente (ver princípio nº1 do CLAUDE.md: fidelidade de cor).
 */
export function gerarVarianteDeCor(svgTexto, zoneColors) {
  const dom = new JSDOM(svgTexto, { contentType: 'image/svg+xml' });
  const document = dom.window.document;

  for (const [zonaId, cor] of Object.entries(zoneColors)) {
    const elemento = document.getElementById(zonaId);
    if (!elemento) {
      console.warn(`⚠️  Zona "${zonaId}" não encontrada no SVG — ignorada.`);
      continue;
    }
    elemento.setAttribute('fill', cor);
  }

  return dom.serialize();
}
