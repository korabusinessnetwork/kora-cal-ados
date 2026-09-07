// O caminho inverso do seletor: dado um elemento do SVG, a qual zona ele pertence hoje?
//
// Por que existe: o palco precisa dizer "isso já é a zona sola" ANTES de o time marcar de
// novo, e o contorno precisa saber o que pintar. O perigo é sutil — se a regra de
// pertencimento daqui divergir da que `gerarVarianteDeCor` usa para pintar, o editor
// mostra uma zona e a API pinta outra, e o princípio nº1 quebra exatamente onde ninguém
// olha. Por isso a resolução passa pelo MESMO caminho do motor: `querySelectorAll` do
// `svg_selector` + `expandirPintaveis`. A regra "o que é pintável" continua morando só em
// `alvosPintaveis.ts`, e este arquivo não tem cópia dela.

import { expandirPintaveis } from '../../lib/render/alvosPintaveis';
import type { ZonaDoProduto } from './tiposDeZona';

/** `zone_key` da zona a que o elemento pertence, ou `null` se ele ainda não foi marcado. */
export function resolverZonaDoElemento(
  elemento: Element,
  zonas: ZonaDoProduto[],
): string | null {
  const documento = elemento.ownerDocument;

  // `ownerDocument` só é null quando o nó é o próprio Document — nó sem dono não tem
  // documento onde resolver seletor. Responder "não marcado" é honesto; chutar uma zona
  // pintaria o contorno em cima de um elemento que ninguém marcou.
  if (!documento) return null;

  for (const zona of zonas) {
    if (alvosDaZona(documento, zona).includes(elemento)) return zona.zone_key;
  }

  return null;
}

/**
 * Todos os elementos do documento que já pertencem a alguma zona → `zone_key`.
 *
 * **Nenhuma tela chama isto hoje** — o palco resolve elemento a elemento, no clique, que é
 * barato porque acontece uma vez por clique. O que a mantém no arquivo é o papel de
 * contraprova: ela compartilha a expansão com `resolverZonaDoElemento`, e o teste exige que
 * as duas respondam a mesma coisa para todo elemento do asset real. Se alguém trocar a
 * resolução do palco por uma varredura única, é esta função que já vem com a garantia.
 */
export function mapaDeZonasPorElemento(
  documento: Document,
  zonas: ZonaDoProduto[],
): Map<Element, string> {
  const mapa = new Map<Element, string>();

  for (const zona of zonas) {
    for (const alvo of alvosDaZona(documento, zona)) {
      // A primeira zona da lista vence, igual ao laço de `resolverZonaDoElemento`: as duas
      // funções precisam responder a mesma coisa para o mesmo elemento, senão o palco
      // mostraria uma zona no hover e outra no clique.
      if (!mapa.has(alvo)) mapa.set(alvo, zona.zone_key);
    }
  }

  return mapa;
}

/**
 * Os elementos que a zona captura hoje — a expansão única que as duas funções acima
 * compartilham.
 *
 * Sobreposição já é recusada na marcação, então no máximo uma zona casa com um elemento.
 * Se por algum motivo duas casarem (mapeamento gravado antes dessa checagem existir), a
 * primeira da lista vence: é escolha consciente por resposta determinística, não acidente.
 * Quem denuncia o estado inválido é `zonasSobrepostas` / `relatorioDeZonas`, não aqui.
 *
 * Seletor inválido não lança: apenas não contribui com elemento, igual a
 * `zonasSobrepostas.ts`. Resolver "que zona é esta" é leitura de tela — derrubar o palco
 * inteiro por causa de uma linha quebrada do banco esconderia as zonas que estão certas.
 */
function alvosDaZona(documento: Document, zona: ZonaDoProduto): Element[] {
  try {
    return expandirPintaveis([...documento.querySelectorAll(zona.svg_selector)]);
  } catch {
    return [];
  }
}
