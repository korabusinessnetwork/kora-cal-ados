// A última barreira antes de um mapeamento errado virar cor no calçado errado.
//
// Função PURA: recebe "o time clicou nestes elementos e chamou isto de sola" e devolve a
// linha de `product_zones` pronta para gravar, ou recusa o estado inválido antes de o
// banco ver qualquer coisa. Nada de I/O aqui, porque esta é a regra que o editor e a tela
// de revisão precisam rodar sem rede, e regra que depende de rede vira regra que alguém
// pula "só desta vez".
//
// O editor é SOMENTE-LEITURA sobre o asset-base (ADR-005): nada aqui reescreve o SVG.
// A checagem de "o que é pintável" e o formato do seletor moram no motor de render,
// duas implementações da mesma regra divergiriam, e a divergência apareceria como cor no
// lugar errado (princípio nº1 do CLAUDE.md).

import { alvosPintaveis, expandirPintaveis } from '../../lib/render/alvosPintaveis';
import { analisarSvg } from '../../lib/render/dom';
import { ErroDeVariante } from '../../lib/render/erros';
import { montarSeletorDeZona } from '../../lib/render/montarSeletorDeZona';
import { validarCor } from '../../lib/render/validarCor';
import { validarZoneKey } from '../../lib/render/validarZoneKey';
import type { ZonaDoProduto, ZonaParaGravar } from './tiposDeZona';

export interface PedidoDeMarcacao {
  /** O asset-base canônico, como veio do Storage. Somente leitura. */
  svgCanonico: string;
  /** As zonas já gravadas deste produto. */
  zonasAtuais: ZonaDoProduto[];
  zoneKey: string;
  /** Ids dos elementos marcados no palco. */
  idsMarcados: string[];
  /** Ausente = preserva o que já está gravado; presente = passa a valer (inclusive null). */
  label?: string | null;
  corDefault?: string | null;
}

/** Transforma a marcação do time na linha a gravar, ou lança `ErroDeVariante`. */
export function marcarZona(pedido: PedidoDeMarcacao): ZonaParaGravar {
  const chave = validarZoneKey(pedido.zoneKey);
  const documento = analisarSvg(pedido.svgCanonico);
  const idsNovos = [...new Set(pedido.idsMarcados)];

  const alvosMarcados = new Set<Element>();

  for (const id of idsNovos) {
    // `getElementById` e não `querySelector('#'+id)`: id que não é seletor seguro faria o
    // querySelector estourar SyntaxError cru, escondendo o erro de domínio real.
    const elemento = documento.getElementById(id);

    if (!elemento) {
      throw new ErroDeVariante(
        'ZONA_NAO_ENCONTRADA',
        `O elemento "${id}" não está no asset-base deste produto. Recarregue a página: o desenho mudou desde que você abriu o editor.`,
      );
    }

    const alvos = alvosPintaveis([elemento], chave);

    if (alvos.length === 0) {
      throw new ErroDeVariante(
        'ZONA_NAO_RECOLORIVEL',
        `O elemento "${id}" é uma linha de contorno (fill="none") e não aceita cor: pintá-lo mudaria o desenho do modelo, não a cor da zona "${chave}".`,
      );
    }

    for (const alvo of alvos) alvosMarcados.add(alvo);
  }

  recusarSobreposicao(documento, pedido.zonasAtuais, chave, alvosMarcados);

  const existente = pedido.zonasAtuais.find((zona) => zona.zone_key === chave);
  const idsGravados = existente ? idsDoSeletor(existente.svg_selector) : [];

  const seletor = montarSeletorDeZona([...idsGravados, ...idsNovos]);
  conferirQueOSeletorResolveAMarcacao(documento, seletor, [...idsGravados, ...idsNovos], chave);

  return {
    zone_key: chave,
    svg_selector: seletor,
    label: pedido.label !== undefined ? pedido.label : (existente?.label ?? null),
    cor_default: resolverCor(pedido, existente, chave),
    // `unique (product_id, zone_key)`: acrescentar elemento a uma zona é UPDATE da linha,
    // nunca um segundo INSERT, e `upsert` cego apagaria o mapeamento de um colega.
    idExistente: existente?.id ?? null,
  };
}

/**
 * O caminho de volta: `"#a, #b"` → `['a','b']`. Exportada porque a zona existente precisa
 * ser relida para receber mais um elemento.
 */
export function idsDoSeletor(svgSelector: string): string[] {
  const pedacos = svgSelector
    .split(',')
    .map((pedaco) => pedaco.trim())
    .filter((pedaco) => pedaco !== '');

  return pedacos.map((pedaco) => {
    if (!pedaco.startsWith('#')) {
      // Seletor de prefixo legado (`[id^="zona-"]`) é proibido pelo ADR-005 e não é uma
      // lista de ids exatos: acrescentar elemento a ele exigiria adivinhar o que ele
      // captura hoje, e adivinhar errado perderia o mapeamento do colega.
      throw new ErroDeVariante(
        'ZONA_NAO_ENCONTRADA',
        `O seletor "${svgSelector}" não é uma lista de ids exatos, então não dá para acrescentar elemento a essa zona com segurança. Remarque a zona do zero.`,
      );
    }

    return pedaco.slice(1);
  });
}

/**
 * BUG-013: duas zonas que dividem um elemento fazem a ORDEM DAS CHAVES do JSON decidir a
 * cor dele na geração, sem erro e sem aviso. O editor é o único lugar que consegue criar
 * esse estado, então a recusa vive aqui, antes do INSERT.
 */
function recusarSobreposicao(
  documento: Document,
  zonasAtuais: ZonaDoProduto[],
  chave: string,
  alvosMarcados: Set<Element>,
): void {
  for (const outra of zonasAtuais) {
    if (outra.zone_key === chave) continue;

    const compartilhados = expandirPintaveis(resolver(documento, outra.svg_selector)).filter(
      (alvo) => alvosMarcados.has(alvo),
    );

    if (compartilhados.length > 0) {
      throw new ErroDeVariante(
        'ZONAS_SOBREPOSTAS',
        `A zona "${chave}" dividiria ${compartilhados.length} elemento(s) com a zona "${outra.zone_key}". Cada elemento pertence a uma zona só. Tire esses elementos de "${outra.zone_key}" antes.`,
      );
    }
  }
}

/**
 * A promessa do ADR-005: o seletor que vai para o banco resolve EXATAMENTE os elementos que
 * a marcação diz, e a gravação é recusada se divergir.
 *
 * Os ids NOVOS já foram conferidos um a um lá em cima. Os GRAVADOS não: eles vêm da linha
 * do banco e ninguém nunca os confrontou com o desenho de hoje. Se o asset-base de um
 * produto foi trocado depois do mapeamento, ou se a linha veio de outro produto, o id
 * gravado não resolve mais nada, e acrescentar um elemento à zona regravaria o seletor
 * carregando o id morto junto, em silêncio. A zona passaria a pintar menos do que o painel
 * promete, que é o princípio nº1 quebrado exatamente onde ninguém olha.
 *
 * Recusar é caro para quem está marcando (obriga a remarcar a zona) e é o preço certo: a
 * alternativa é uma variante saindo com uma parte do calçado sem cor, já fabricada.
 */
function conferirQueOSeletorResolveAMarcacao(
  documento: Document,
  seletor: string,
  ids: string[],
  chave: string,
): void {
  const esperados = new Set<Element>();
  const ausentes: string[] = [];

  for (const id of ids) {
    const elemento = documento.getElementById(id);

    if (!elemento) {
      ausentes.push(id);
      continue;
    }

    for (const alvo of expandirPintaveis([elemento])) esperados.add(alvo);
  }

  if (ausentes.length > 0) {
    throw new ErroDeVariante(
      'ZONA_NAO_ENCONTRADA',
      `A zona "${chave}" aponta para ${ausentes.length} elemento(s) que não existem mais neste desenho (${ausentes.join(', ')}). O mapeamento dela está velho: remarque a zona do zero antes de acrescentar elementos.`,
    );
  }

  const resolvidos = expandirPintaveis(resolver(documento, seletor));

  if (resolvidos.length !== esperados.size || resolvidos.some((alvo) => !esperados.has(alvo))) {
    // Cinto e suspensório do passo acima: id que existe mas não é seletor CSS seguro (SVG
    // aceita `.` e `:` em id) monta um `#id` que casa outra coisa, ou nada. A normalização
    // renomeia esses ids, então isto só alcança linha gravada antes dessa regra existir.
    throw new ErroDeVariante(
      'ZONA_NAO_ENCONTRADA',
      `O seletor da zona "${chave}" resolveria ${resolvidos.length} elemento(s), e a marcação tem ${esperados.size}. Remarque a zona do zero.`,
    );
  }
}

function resolverCor(
  pedido: PedidoDeMarcacao,
  existente: ZonaDoProduto | undefined,
  chave: string,
): string | null {
  if (pedido.corDefault === undefined) return existente?.cor_default ?? null;
  if (pedido.corDefault === null) return null;

  return validarCor(pedido.corDefault, chave);
}

/** Seletor quebrado de OUTRA zona não contribui com elemento (mesma postura de
 *  `zonasSobrepostas`): perder a checagem inteira por uma zona ruim seria pior. */
function resolver(documento: Document, seletor: string): Element[] {
  try {
    return [...documento.querySelectorAll(seletor)];
  } catch {
    return [];
  }
}
