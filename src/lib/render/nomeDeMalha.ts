// A política de `name` do modelo 3D canônico (ADR-007, decisão 4).
//
// É o gêmeo de `idDeElemento.ts`, e de propósito: as duas garantias que importam são as
// mesmas, porque o problema é o mesmo.
//   1. todo nome é seguro para o formato em que o seletor de zona é guardado
//   2. todo nome é único no documento
//   3. todo nó endereçável TEM nome — o que veio anônimo ganha `malha-N`
//
// A garantia 3 é o que torna a zona possível: exportador de 3D manda nó sem nome com a mesma
// frequência com que o Illustrator manda path sem id, e sem nome não existe zona endereçável.
// Quem cunha é a normalização, nunca o editor — pela mesma razão do ADR-005: se o editor
// regravasse o modelo, dois membros marcando ao mesmo tempo sobrescreveriam o mapeamento um
// do outro em silêncio.
//
// Por que a garantia 1 existe se aqui não há CSS: o seletor de zona 3D é uma **lista** de
// nomes exatos (ADR-007 D4). Lista implica separador, e um nome que contenha o separador
// parte a lista em dois endereços errados — o mesmo modo de falha que `#a.b` teria no SVG,
// por outro caminho. Ser conservador aqui custa um hífen no nome e evita uma zona que aponta
// para o lugar errado sem ninguém ver.

import type { NoDoGltf } from './tiposDoGltf';

export interface RelatorioDeNome {
  nomesRenomeados: Array<{ de: string; para: string }>;
  nomesAtribuidos: string[];
}

/** Sem vírgula, sem espaço, sem aspas — o que sobrevive a qualquer formato de lista. */
const NOME_SEGURO = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * Aplica as três garantias sobre `nos`, no lugar.
 *
 * `enderecaveis` são os índices dos nós que precisam de nome. Os demais **também** entram na
 * desambiguação quando já têm nome — um nó de transformação chamado `sola` ocuparia o nome
 * que uma malha vai querer —, mas nunca ganham nome cunhado.
 */
export function aplicarPoliticaDeNome(
  nos: NoDoGltf[],
  enderecaveis: ReadonlySet<number>,
  relatorio: RelatorioDeNome,
): void {
  const vistos = new Set<string>();

  // Passada 1: quem já tem nome. Ordem do array é a ordem de documento, e é ela que decide
  // quem fica com o nome original numa colisão — estável entre execuções, que é o que impede
  // o seletor gravado no banco de repontar depois de uma renormalização.
  for (const no of nos) {
    const nome = no.name;
    if (nome === undefined || nome === '') continue;

    const desejado = tornarSeguro(nome);
    const novo = primeiroLivre(desejado, vistos);

    vistos.add(novo);

    if (novo !== nome) {
      no.name = novo;
      relatorio.nomesRenomeados.push({ de: nome, para: novo });
    }
  }

  cunharNomesAusentes(nos, enderecaveis, vistos, relatorio);
}

/**
 * Dá nome a todo nó endereçável que não tem.
 *
 * Só nó endereçável entra na contagem. Cunhar em nó sem malha (junta de esqueleto, grupo de
 * transformação, câmera) gastaria números de `malha-N` e deslocaria o nome de todas as malhas
 * seguintes — e nome deslocado repointaria um seletor de zona já gravado. É o mesmo cuidado
 * que `cunharIdsAusentes` documenta para o SVG, pelo lado oposto: lá se cunha em `fill="none"`
 * de propósito para a numeração não depender da cor; aqui se recusa a cunhar no que não é
 * malha para a numeração não depender da estrutura de cena.
 */
function cunharNomesAusentes(
  nos: NoDoGltf[],
  enderecaveis: ReadonlySet<number>,
  vistos: Set<string>,
  relatorio: RelatorioDeNome,
): void {
  let contador = 1;

  for (let indice = 0; indice < nos.length; indice += 1) {
    if (!enderecaveis.has(indice)) continue;

    const no = nos[indice];
    if (no === undefined) continue;
    if (no.name !== undefined && no.name !== '') continue;

    let candidato = `malha-${contador}`;
    while (vistos.has(candidato)) {
      contador += 1;
      candidato = `malha-${contador}`;
    }

    no.name = candidato;
    vistos.add(candidato);
    relatorio.nomesAtribuidos.push(candidato);
    contador += 1;
  }
}

/** Troca o que não serve numa lista de nomes por `-`, garantindo início válido. */
function tornarSeguro(nome: string): string {
  if (NOME_SEGURO.test(nome)) return nome;

  const limpo = nome.replace(/[^A-Za-z0-9_-]/g, '-');

  return /^[A-Za-z_]/.test(limpo) ? limpo : `malha-${limpo}`;
}

/** `nome`, `nome-2`, `nome-3`… — o mesmo sufixo que `idDeElemento.ts` já usa. */
function primeiroLivre(desejado: string, vistos: Set<string>): string {
  if (!vistos.has(desejado)) return desejado;

  let sufixo = 2;
  while (vistos.has(`${desejado}-${sufixo}`)) sufixo += 1;

  return `${desejado}-${sufixo}`;
}
