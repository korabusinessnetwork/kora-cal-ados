// Leitor de CSS do próprio SVG. Existe porque o jsdom, ao parsear como
// `image/svg+xml`, não monta `document.styleSheets` — sondado em 2026-08-12, devolve 0
// folhas. Então o bloco <style> precisa ser lido à mão antes de ser achatado em
// atributo de apresentação (ADR-004).
//
// Postura deliberada: parser CONSERVADOR. O que ele não entende com certeza, ele
// rejeita — melhor recusar o upload com relatório (decisão aprovada no ADR-004) do que
// achatar errado e a cor divergir na produção.

import { ErroDeVariante } from './erros';

export interface Declaracao {
  propriedade: string;
  valor: string;
}

export interface RegraCss {
  seletor: string;
  especificidade: number;
  ordem: number;
  declaracoes: Declaracao[];
}

/** Lê `fill:#333; stroke:none` — serve tanto para corpo de regra quanto para atributo style. */
export function lerDeclaracoes(texto: string): Declaracao[] {
  const declaracoes: Declaracao[] = [];

  for (const parte of texto.split(';')) {
    const bruto = parte.trim();
    if (!bruto) continue;

    const separador = bruto.indexOf(':');
    if (separador === -1) {
      throw new ErroDeVariante(
        'SVG_NAO_NORMALIZAVEL',
        `Declaração de estilo malformada no SVG: "${bruto}".`,
      );
    }

    declaracoes.push({
      propriedade: bruto.slice(0, separador).trim().toLowerCase(),
      valor: bruto.slice(separador + 1).trim(),
    });
  }

  return declaracoes;
}

/**
 * Especificidade CSS achatada num número comparável (ids, classes, elementos).
 * Aproximação suficiente para SVG exportado por ferramenta de design, que usa
 * seletores simples — e por isso mesmo o parser rejeita o que fugir disso.
 */
export function calcularEspecificidade(seletor: string): number {
  const ids = (seletor.match(/#[\w-]+/g) ?? []).length;
  const classes = (seletor.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) ?? []).length;
  const elementos = (seletor.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length;

  return ids * 10_000 + classes * 100 + elementos;
}

/**
 * Converte o texto de um `<style>` em regras. `ordemInicial` mantém a ordem de origem
 * entre múltiplos blocos `<style>` — desempate quando a especificidade empata.
 */
export function lerRegrasCss(css: string, ordemInicial = 0): RegraCss[] {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // @media, @import, @font-face: mudam o resultado conforme contexto de renderização,
  // que é justamente o que não pode variar entre editor e API.
  if (semComentarios.includes('@')) {
    throw new ErroDeVariante(
      'SVG_NAO_NORMALIZAVEL',
      'O SVG usa regra CSS avançada (@media/@import/@font-face), que pode renderizar diferente no editor e na API. Exporte com "Styling: Presentation Attributes".',
    );
  }

  const regras: RegraCss[] = [];
  let ordem = ordemInicial;

  for (const bloco of semComentarios.split('}')) {
    if (!bloco.trim()) continue;

    const abertura = bloco.indexOf('{');
    if (abertura === -1) {
      throw new ErroDeVariante(
        'SVG_NAO_NORMALIZAVEL',
        `Bloco CSS malformado no SVG: "${bloco.trim().slice(0, 60)}".`,
      );
    }

    const declaracoes = lerDeclaracoes(bloco.slice(abertura + 1));

    for (const seletor of bloco.slice(0, abertura).split(',')) {
      const limpo = seletor.trim();
      if (!limpo) continue;

      regras.push({
        seletor: limpo,
        especificidade: calcularEspecificidade(limpo),
        ordem: ordem++,
        declaracoes,
      });
    }
  }

  return regras;
}
