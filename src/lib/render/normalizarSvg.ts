// Normalizador de asset-base (ADR-004). Roda UMA vez, no upload, e produz o
// asset-base canônico — a única versão que o editor e a API leem.
//
// Por que no upload e não na geração: depois daqui, a cor de cada elemento mora no
// atributo de apresentação, que todo renderizador (navegador do editor e resvg/sharp
// do PNG) interpreta igual. Enquanto a cor mora em CSS, quem decide é o renderizador —
// e editor divergir da API é exatamente o que o princípio nº1 do CLAUDE.md proíbe.

import { analisarSvg, serializarSvg } from './dom';
import { ErroDeVariante } from './erros';
import { aplicarPoliticaDeId } from './idDeElemento';
import { lerDeclaracoes, lerRegrasCss, type RegraCss } from './lerRegrasCss';

/** Propriedades CSS que existem como atributo de apresentação SVG e podem ser achatadas. */
const PROPRIEDADES_ACHATAVEIS = new Set([
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit',
  'opacity', 'color', 'display', 'visibility',
  'clip-path', 'clip-rule', 'mask', 'filter', 'mix-blend-mode', 'isolation',
  'stop-color', 'stop-opacity', 'paint-order',
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'letter-spacing',
]);

const PRIORIDADE_INLINE = Number.MAX_SAFE_INTEGER;
const PESO_IMPORTANTE = 1e12;

export interface RelatorioDeNormalizacao {
  idsRenomeados: Array<{ de: string; para: string }>;
  /** Ids cunhados em elemento que veio sem id — é o que torna a zona endereçável (ADR-005). */
  idsAtribuidos: string[];
  declaracoesAchatadas: number;
  scriptsRemovidos: number;
  handlersRemovidos: number;
  referenciasExternasRemovidas: number;
}

export interface ResultadoDeNormalizacao {
  svg: string;
  relatorio: RelatorioDeNormalizacao;
}

/**
 * Recebe o SVG cru do cliente e devolve o asset-base canônico + relatório do que mudou.
 * Lança `SVG_INVALIDO` / `SVG_NAO_NORMALIZAVEL` quando não dá para garantir fidelidade —
 * rejeitar com explicação é preferível a aceitar um produto meio-quebrado (ADR-004, q2).
 */
export function normalizarSvg(svgTexto: string): ResultadoDeNormalizacao {
  const documento = analisarSvg(svgTexto);

  if (documento.querySelector('parsererror') || !documento.querySelector('svg')) {
    throw new ErroDeVariante('SVG_INVALIDO', 'Arquivo não é um SVG válido.');
  }

  const relatorio: RelatorioDeNormalizacao = {
    idsRenomeados: [],
    idsAtribuidos: [],
    declaracoesAchatadas: 0,
    scriptsRemovidos: 0,
    handlersRemovidos: 0,
    referenciasExternasRemovidas: 0,
  };

  sanitizar(documento, relatorio);
  acharEstilo(documento, relatorio);
  // Depois de sanitizar: elemento removido não pode consumir um número de `elemento-N`.
  aplicarPoliticaDeId(documento, relatorio);

  return { svg: serializarSvg(documento), relatorio };
}

/** Remove o que não pode chegar ao navegador de outro cliente (ver docs/11_SEGURANCA/). */
function sanitizar(documento: Document, relatorio: RelatorioDeNormalizacao): void {
  for (const elemento of documento.querySelectorAll('script, foreignObject')) {
    elemento.remove();
    relatorio.scriptsRemovidos += 1;
  }

  for (const elemento of documento.querySelectorAll('*')) {
    for (const atributo of [...elemento.attributes]) {
      const nome = atributo.name.toLowerCase();

      if (nome.startsWith('on')) {
        elemento.removeAttribute(atributo.name);
        relatorio.handlersRemovidos += 1;
        continue;
      }

      // Referência externa vaza requisição do editor para fora e pode sumir depois;
      // referência interna (#gradiente) é legítima e fica.
      if ((nome === 'href' || nome === 'xlink:href') && !atributo.value.trim().startsWith('#')) {
        elemento.removeAttribute(atributo.name);
        relatorio.referenciasExternasRemovidas += 1;
      }
    }
  }
}

/** Achata `<style>` + `style=""` em atributo de apresentação e remove as duas fontes. */
function acharEstilo(documento: Document, relatorio: RelatorioDeNormalizacao): void {
  const pendentes = new Map<Element, Map<string, { valor: string; prioridade: number }>>();

  const anotar = (elemento: Element, propriedade: string, valor: string, prioridade: number) => {
    if (!PROPRIEDADES_ACHATAVEIS.has(propriedade)) {
      throw new ErroDeVariante(
        'SVG_NAO_NORMALIZAVEL',
        `O SVG usa a propriedade CSS "${propriedade}", que não tem atributo de apresentação equivalente. Exporte com "Styling: Presentation Attributes".`,
      );
    }

    const doElemento = pendentes.get(elemento) ?? new Map();
    const atual = doElemento.get(propriedade);

    if (!atual || prioridade >= atual.prioridade) {
      doElemento.set(propriedade, { valor, prioridade });
      pendentes.set(elemento, doElemento);
    }
  };

  const blocos = [...documento.querySelectorAll('style')];
  let regras: RegraCss[] = [];

  for (const bloco of blocos) {
    regras = regras.concat(lerRegrasCss(bloco.textContent ?? '', regras.length));
  }

  for (const regra of regras) {
    let alvos: NodeListOf<Element>;
    try {
      alvos = documento.querySelectorAll(regra.seletor);
    } catch {
      throw new ErroDeVariante(
        'SVG_NAO_NORMALIZAVEL',
        `Seletor CSS não suportado no SVG: "${regra.seletor}".`,
      );
    }

    for (const alvo of alvos) {
      for (const { propriedade, valor } of regra.declaracoes) {
        const importante = valor.toLowerCase().includes('!important');
        const prioridade =
          regra.especificidade * 1e6 + regra.ordem + (importante ? PESO_IMPORTANTE : 0);

        anotar(alvo, propriedade, valor.replace(/!important/gi, '').trim(), prioridade);
      }
    }
  }

  // Estilo inline vence qualquer regra (é o que o navegador faz), então entra por último.
  for (const elemento of documento.querySelectorAll('[style]')) {
    for (const { propriedade, valor } of lerDeclaracoes(elemento.getAttribute('style') ?? '')) {
      anotar(elemento, propriedade, valor.replace(/!important/gi, '').trim(), PRIORIDADE_INLINE);
    }
    elemento.removeAttribute('style');
  }

  for (const [elemento, propriedades] of pendentes) {
    for (const [propriedade, { valor }] of propriedades) {
      elemento.setAttribute(propriedade, valor);
      relatorio.declaracoesAchatadas += 1;
    }
  }

  for (const bloco of blocos) bloco.remove();
}
