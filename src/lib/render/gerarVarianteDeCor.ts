// Motor de render (ADR-004). Recebe o asset-base CANÔNICO (já passado por
// normalizarSvg) e aplica as cores pedidas nas zonas.
//
// Este módulo é importado tanto pelo editor quanto pela função serverless, nunca
// existem duas implementações. É o que sustenta "cor no editor = cor na API".

import { alvosPintaveis } from './alvosPintaveis';
import { analisarSvg, serializarSvg } from './dom';
import { ErroDeVariante } from './erros';
import { validarCor } from './validarCor';

/** Uma linha de `product_zones`: o que o time marcou no editor. */
export interface Zona {
  zone_key: string;
  svg_selector: string;
}

/** `{ "sola": "#C0392B" }`, chave é `zone_key` do glossário, nunca id de elemento SVG. */
export type CoresPorZona = Record<string, string>;

/**
 * Devolve o SVG com as zonas pedidas recoloridas.
 * Lança em vez de devolver "quase certo": zona ausente, cor inválida ou zona que não
 * aceita cor chapa viram erro com código, nunca 200 silencioso.
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

  recusarSobreposicao(trabalho);

  for (const { cor, alvos } of trabalho) {
    for (const alvo of alvos) alvo.setAttribute('fill', cor);
  }

  return serializarSvg(documento);
}

/**
 * Quantos elementos cada zona captura hoje. O editor mostra isso no cadastro do produto
 * para o time conferir o mapeamento ANTES de existir variante, prevenção de erro vale
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

/** Encontra a zona pelo `zone_key` e resolve o seletor, ambos falham alto. */
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
 * Duas zonas pedidas que dividem um elemento fazem a ÚLTIMA chave do JSON decidir a cor
 * dele, ordem de chave mandando no calçado, sem erro (BUG-013). Recusa o pedido inteiro:
 * variante sai inteira ou não sai.
 */
function recusarSobreposicao(trabalho: Array<{ zoneKey: string; alvos: Element[] }>): void {
  for (let a = 0; a < trabalho.length; a += 1) {
    for (let b = a + 1; b < trabalho.length; b += 1) {
      const esquerda = trabalho[a] as (typeof trabalho)[number];
      const direita = trabalho[b] as (typeof trabalho)[number];
      const comuns = esquerda.alvos.filter((alvo) => direita.alvos.includes(alvo));

      if (comuns.length > 0) {
        throw new ErroDeVariante(
          'ZONAS_SOBREPOSTAS',
          `As zonas "${esquerda.zoneKey}" e "${direita.zoneKey}" dividem ${comuns.length} elemento(s). Qual cor vale seria decidido pela ordem do pedido. Corrija o mapeamento das zonas.`,
        );
      }
    }
  }
}
