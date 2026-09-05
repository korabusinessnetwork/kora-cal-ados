// Quais elementos de uma zona realmente recebem cor.
//
// Vive separado de `gerarVarianteDeCor` porque `zonasSobrepostas` precisa da MESMA
// expansão para saber se duas zonas dividem elemento. Duas implementações da regra
// "o que é pintável" divergiriam, e a divergência apareceria como cor no lugar errado.

import { ErroDeVariante } from './erros';

export const PINTAVEIS = 'path, rect, circle, ellipse, polygon, polyline, line, text, tspan';

/**
 * Elemento + descendentes pintáveis, sem julgar se aceitam cor chapa.
 * É assim que grupo `<g>` e zona feita de N paths funcionam (BUG-002).
 * `fill="none"` fica de fora: é contorno sem preenchimento, e pintá-lo mudaria o desenho.
 */
export function expandirPintaveis(elementos: Element[]): Element[] {
  const alvos = new Set<Element>();

  for (const elemento of elementos) {
    for (const candidato of [elemento, ...elemento.querySelectorAll(PINTAVEIS)]) {
      if ((candidato.getAttribute('fill') ?? '').trim().toLowerCase() === 'none') continue;
      alvos.add(candidato);
    }
  }

  return [...alvos];
}

/**
 * Os alvos que a geração vai pintar. Gradiente/pattern aborta a variante inteira em vez
 * de virar cor chapa em silêncio (ADR-004, decisão 1) — achatar apagaria o volume do
 * modelo sem ninguém pedir.
 */
export function alvosPintaveis(elementos: Element[], zoneKey: string): Element[] {
  const alvos = expandirPintaveis(elementos);

  for (const alvo of alvos) {
    const fill = (alvo.getAttribute('fill') ?? '').trim();

    if (fill.startsWith('url(')) {
      throw new ErroDeVariante(
        'ZONA_NAO_RECOLORIVEL',
        `A zona "${zoneKey}" usa gradiente ou padrão (${fill}) e não pode virar cor chapa sem descaracterizar o modelo.`,
      );
    }
  }

  return alvos;
}
