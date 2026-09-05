// Motor de render (ADR-004). Recebe o asset-base CANÔNICO (já passado por
// normalizarSvg) e aplica as cores pedidas nas zonas.
//
// Este módulo é importado tanto pelo editor quanto pela função serverless — nunca
// existem duas implementações. É o que sustenta "cor no editor = cor na API".

import { analisarSvg, serializarSvg } from './dom';
import { ErroDeVariante } from './erros';
import { validarCor } from './validarCor';

/** Uma linha de `product_zones`: o que o time marcou no editor. */
export interface Zona {
  zone_key: string;
  svg_selector: string;
}

/** `{ "sola": "#C0392B" }` — chave é `zone_key` do glossário, nunca id de elemento SVG. */
export type CoresPorZona = Record<string, string>;

const PINTAVEIS = 'path, rect, circle, ellipse, polygon, polyline, line, text, tspan';

/**
 * Devolve o SVG com as zonas pedidas recoloridas.
 * Lança em vez de devolver "quase certo": zona ausente, cor inválida ou zona que não
 * aceita cor chapa viram erro com código — nunca 200 silencioso.
 */
export function gerarVarianteDeCor(
  svgCanonico: string,
  zonas: Zona[],
  coresPorZona: CoresPorZona,
): string {
  const documento = analisarSvg(svgCanonico);

  // Valida tudo antes de pintar qualquer coisa: variante sai inteira ou não sai.
  const trabalho = Object.entries(coresPorZona).map(([zoneKey, cor]) => ({
    zoneKey,
    cor: validarCor(cor, zoneKey),
    alvos: alvosPintaveis(resolverZona(documento, zonas, zoneKey), zoneKey),
  }));

  for (const { zoneKey, alvos } of trabalho) {
    if (alvos.length === 0) {
      throw new ErroDeVariante(
        'ZONA_NAO_RECOLORIVEL',
        `A zona "${zoneKey}" não tem nenhum elemento que aceite cor chapa.`,
      );
    }
  }

  for (const { cor, alvos } of trabalho) {
    for (const alvo of alvos) alvo.setAttribute('fill', cor);
  }

  return serializarSvg(documento);
}

/**
 * Quantos elementos cada zona captura hoje. O editor mostra isso no cadastro do produto
 * para o time conferir o mapeamento ANTES de existir variante — prevenção de erro vale
 * mais que mensagem de erro (CLAUDE.md).
 */
export function relatorioDeZonas(
  svgCanonico: string,
  zonas: Zona[],
): Array<{ zone_key: string; elementos: number }> {
  const documento = analisarSvg(svgCanonico);

  return zonas.map((zona) => ({
    zone_key: zona.zone_key,
    elementos: buscar(documento, zona.svg_selector, zona.zone_key).length,
  }));
}

/** Encontra a zona pelo `zone_key` e resolve o seletor — ambos falham alto. */
function resolverZona(documento: Document, zonas: Zona[], zoneKey: string): Element[] {
  const zona = zonas.find((candidata) => candidata.zone_key === zoneKey);

  if (!zona) {
    throw new ErroDeVariante(
      'ZONA_NAO_ENCONTRADA',
      `A zona "${zoneKey}" não existe neste produto.`,
    );
  }

  const encontrados = buscar(documento, zona.svg_selector, zoneKey);

  if (encontrados.length === 0) {
    throw new ErroDeVariante(
      'ZONA_NAO_ENCONTRADA',
      `O seletor "${zona.svg_selector}" da zona "${zoneKey}" não encontrou nenhum elemento no SVG.`,
    );
  }

  return encontrados;
}

function buscar(documento: Document, seletor: string, zoneKey: string): Element[] {
  try {
    return [...documento.querySelectorAll(seletor)];
  } catch {
    throw new ErroDeVariante(
      'ZONA_NAO_ENCONTRADA',
      `O seletor "${seletor}" da zona "${zoneKey}" não é um seletor CSS válido.`,
    );
  }
}

/**
 * Expande cada elemento da zona para ele mesmo + descendentes pintáveis — é assim que
 * grupo `<g>` e zona feita de N paths passam a funcionar (BUG-002).
 * Elemento com gradiente/pattern aborta (ADR-004, q1); `fill="none"` é pulado, porque
 * é contorno sem preenchimento e pintá-lo mudaria o desenho.
 */
function alvosPintaveis(elementos: Element[], zoneKey: string): Element[] {
  const alvos = new Set<Element>();

  for (const elemento of elementos) {
    for (const candidato of [elemento, ...elemento.querySelectorAll(PINTAVEIS)]) {
      const fill = (candidato.getAttribute('fill') ?? '').trim();

      if (fill.startsWith('url(')) {
        throw new ErroDeVariante(
          'ZONA_NAO_RECOLORIVEL',
          `A zona "${zoneKey}" usa gradiente ou padrão (${fill}) e não pode virar cor chapa sem descaracterizar o modelo.`,
        );
      }

      if (fill.toLowerCase() === 'none') continue;
      if (candidato.matches(PINTAVEIS) || elementos.includes(candidato)) alvos.add(candidato);
    }
  }

  return [...alvos];
}
