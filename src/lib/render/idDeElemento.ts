// A política de `id` do asset-base canônico (ADR-005, decisão 2).
//
// Três garantias, nesta ordem, para que `#id` seja sempre um endereço válido e estável:
//   1. todo id é um seletor CSS seguro (SVG aceita `.` e `:` em id; `#a.b` não seria isso)
//   2. todo id é único no documento
//   3. todo elemento pintável TEM id — o que veio anônimo ganha `elemento-N`
//
// A garantia 3 é o que torna o editor possível: export padrão de Illustrator manda path
// sem id, e sem id não existe zona endereçável. Quem cunha é a normalização, nunca o
// editor — se o editor regravasse o SVG, dois membros marcando zonas ao mesmo tempo
// sobrescreveriam o mapeamento um do outro em silêncio (ADR-005, alternativa 2).

import { PINTAVEIS } from './alvosPintaveis';
import type { RelatorioDeNormalizacao } from './normalizarSvg';

/** Um id que pode ir para `#id` sem escape — `CSS.escape` nem existe em todo ambiente. */
const ID_SEGURO = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function aplicarPoliticaDeId(
  documento: Document,
  relatorio: RelatorioDeNormalizacao,
): void {
  const vistos = new Set<string>();

  for (const elemento of documento.querySelectorAll('[id]')) {
    const id = elemento.getAttribute('id') ?? '';
    const desejado = tornarSeguro(id);
    const novo = primeiroLivre(desejado, vistos);

    vistos.add(novo);

    if (novo !== id) {
      elemento.setAttribute('id', novo);
      relatorio.idsRenomeados.push({ de: id, para: novo });
    }
  }

  cunharIdsAusentes(documento, vistos, relatorio);
}

/**
 * Dá id a todo elemento pintável que não tem.
 *
 * Cunha inclusive em `fill="none"` (que nunca recebe cor): a numeração passa a depender
 * só da estrutura do arquivo, então mudar o fill de um elemento não desloca o id de todos
 * os seguintes — e id deslocado repointaria `svg_selector` já gravado no banco.
 */
function cunharIdsAusentes(
  documento: Document,
  vistos: Set<string>,
  relatorio: RelatorioDeNormalizacao,
): void {
  let contador = 1;

  for (const elemento of documento.querySelectorAll(PINTAVEIS)) {
    if (elemento.hasAttribute('id')) continue;

    let candidato = `elemento-${contador}`;
    while (vistos.has(candidato)) {
      contador += 1;
      candidato = `elemento-${contador}`;
    }

    elemento.setAttribute('id', candidato);
    vistos.add(candidato);
    relatorio.idsAtribuidos.push(candidato);
    contador += 1;
  }
}

/** Troca o que não serve num seletor por `-`, garantindo início válido. */
function tornarSeguro(id: string): string {
  if (ID_SEGURO.test(id)) return id;

  const limpo = id.replace(/[^A-Za-z0-9_-]/g, '-');

  return /^[A-Za-z_]/.test(limpo) ? limpo : `id-${limpo}`;
}

/** `nome`, `nome-2`, `nome-3`… — o mesmo sufixo que o projeto já usa para cadarço. */
function primeiroLivre(desejado: string, vistos: Set<string>): string {
  if (!vistos.has(desejado)) return desejado;

  let sufixo = 2;
  while (vistos.has(`${desejado}-${sufixo}`)) sufixo += 1;

  return `${desejado}-${sufixo}`;
}
