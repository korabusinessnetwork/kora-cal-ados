// A marcação que o time está fazendo agora e ainda NÃO foi gravada: quais ids de elemento
// já foram clicados para a zona em construção. Nada aqui toca banco, SVG ou rede.
//
// A regra mora fora do hook de propósito: não usamos testing-library neste projeto
// (restrição de custo, `memory/restrictions.md`), então lógica dentro de hook é lógica não
// testada. Com a regra aqui, o hook vira casca trivial e o comportamento fica coberto.
//
// Nenhuma função aqui muta o array recebido. Mutar o array que está no `useState` é o
// defeito clássico que faz a tela não atualizar (React compara por identidade) e é
// invisível em revisão, por isso todo retorno é lista nova ou a mesma lista intacta.

/**
 * Marca ou desmarca um id. Clicar num elemento já marcado desmarca, o clique é o
 * desfazer natural do usuário, e um segundo clique que não fizesse nada obrigaria a
 * explicar num manual como tirar um elemento da zona.
 *
 * A ordem de clique é a ordem que vai para `montarSeletorDeZona` e, portanto, a ordem
 * gravada em `svg_selector`. Por isso desmarcar remove a entrada e marcar de novo
 * acrescenta no fim: marcar A, marcar B, desmarcar A, marcar A resulta em `['b', 'a']`.
 * Isso é intencional, o id volta como marcação nova, não retoma o lugar antigo.
 */
export function alternarId(ids: string[], id: string): string[] {
  // Id em branco viraria entrada fantasma no seletor. Ignorar aqui é prevenção de erro.
  // Ids com espaço em volta não são "consertados" com trim: reescrever id em silêncio
  // esconderia um SVG fora do padrão que `montarSeletorDeZona` recusa alto e visível.
  if (id.trim() === '') return ids;

  if (ids.includes(id)) return ids.filter((marcado) => marcado !== id);

  return [...ids, id];
}

/** Remove o último id marcado. Lista vazia continua vazia, sem erro: desfazer sem nada
 *  para desfazer é uso normal (Ctrl+Z repetido), não falha. */
export function desfazerUltimo(ids: string[]): string[] {
  if (ids.length === 0) return ids;

  return ids.slice(0, -1);
}
