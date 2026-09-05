// Duas zonas do mesmo produto que compartilham elemento são estado inválido.
//
// Por que isso importa: `gerarVarianteDeCor` pinta zona por zona, em sequência. Se duas
// zonas pedidas dividem um elemento, a ÚLTIMA chave do JSON decide a cor dele — a ordem
// das chaves de um objeto passa a mandar no calçado, sem erro e sem aviso (BUG-013).
//
// Ninguém conseguia criar esse estado enquanto as zonas eram escritas à mão. O editor
// de zonas consegue, então a checagem nasce junto com ele.

import { expandirPintaveis } from './alvosPintaveis';
import { analisarSvg } from './dom';
import type { Zona } from './gerarVarianteDeCor';

export interface Sobreposicao {
  zone_key_a: string;
  zone_key_b: string;
  /** Quantos elementos as duas dividem — o número que o editor mostra ao time. */
  elementos: number;
}

/**
 * Pares de zonas que dividem pelo menos um elemento pintável.
 * Seletor que não resolve nada não é sobreposição (é zona quebrada, e quem reclama disso
 * é `relatorioDeZonas`) — aqui um seletor inválido apenas não contribui com elemento.
 */
export function zonasSobrepostas(svgCanonico: string, zonas: Zona[]): Sobreposicao[] {
  const documento = analisarSvg(svgCanonico);
  const porZona = zonas.map((zona) => ({
    zone_key: zona.zone_key,
    alvos: new Set(expandirPintaveis(resolver(documento, zona.svg_selector))),
  }));

  const achados: Sobreposicao[] = [];

  for (let a = 0; a < porZona.length; a += 1) {
    for (let b = a + 1; b < porZona.length; b += 1) {
      const esquerda = porZona[a] as (typeof porZona)[number];
      const direita = porZona[b] as (typeof porZona)[number];
      const comuns = [...esquerda.alvos].filter((alvo) => direita.alvos.has(alvo));

      if (comuns.length > 0) {
        achados.push({
          zone_key_a: esquerda.zone_key,
          zone_key_b: direita.zone_key,
          elementos: comuns.length,
        });
      }
    }
  }

  return achados;
}

function resolver(documento: Document, seletor: string): Element[] {
  try {
    return [...documento.querySelectorAll(seletor)];
  } catch {
    return [];
  }
}
