// A composição da tela sobrevive a um F5.
//
// Antes disto ela não sobrevivia, e a própria tela admitia isso num comentário: "a composição não
// é gravada em lugar nenhum, então sem isto fechar a aba perde a montagem inteira". O "isto" era o
// botão de copiar, que resolve o problema só para quem copiou ANTES de perder, e ninguém copia
// antes de perder. Medido no navegador antes da mudança: pintado o cabedal de `#22aa44`, um F5
// devolvia `#1f4fa8`, o padrão, e nenhuma chave `kora*` existia no `localStorage`.
//
// O QUE é gravado é o mesmo JSON que o botão de copiar entrega, e não um formato próprio. Assim o
// que está guardado é exatamente o que a API receberia, e ler de volta é o caminho que já existe e
// já tem teste: `escolhasDoTextoColado`, que passa pelo MESMO `validarComposicao` da API.
//
// Por que passar pelo guarda na volta, se foi a própria tela que gravou: porque entre gravar e ler
// o acervo pode ter mudado. Uma peça saiu, uma faixa de parâmetro encolheu, a forma trocou de id.
// Uma gravação velha montada sem guarda viraria um calçado meio certo, com zona faltando em
// silêncio, que é o que o princípio nº1 proíbe. Com o guarda, ela é recusada e a tela abre no
// padrão, que é um calçado inteiro e correto.
//
// A recusa é SILENCIOSA de propósito, e é a única coisa silenciosa deste arquivo. Quem cai nela
// abre a tela e vê o calçado de prova, que é o que via antes deste arquivo existir. Não há cor
// aplicada no lugar errado nem montagem pela metade, só a ausência de uma conveniência. Uma
// mensagem de "sua composição anterior foi descartada" falaria de uma coisa que a pessoa talvez
// nem saiba que existia, e só aparece na prática quando o acervo muda, que hoje é trabalho de quem
// desenvolve.
//
// O armazenamento chega por parâmetro para o teste não precisar de `window`, e para os três jeitos
// de ele falhar poderem ser provocados de propósito.

import type { CatalogoDoAcervo, Forma } from '../lib/composicao/tiposDaComposicao';
import { escolhasDoTextoColado, type EscolhaDaTela } from './composicaoDaTela';

/**
 * A chave no `localStorage`.
 *
 * O `v1` não é enfeite. Se o formato gravado mudar um dia de um jeito que o guarda não recuse
 * sozinho, trocar o número é o que faz toda gravação velha ser ignorada de uma vez, sem código de
 * migração. Hoje o guarda recusa tudo o que importa, e a versão fica sendo a porta de emergência.
 */
export const CHAVE_DA_COMPOSICAO = 'kora.composicao.v1';

/** O pedaço do `Storage` que este arquivo usa, e nada além. */
export type Armazenamento = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * O armazenamento do navegador, ou `null` quando não existe ou não pode ser tocado.
 *
 * Ler `window.localStorage` pode LANÇAR, e não só devolver `undefined`: navegador com dados de site
 * bloqueados, janela privada de alguns navegadores, iframe com sandbox. Uma tela que quebra porque
 * o navegador não deixa guardar nada estaria punindo a pessoa por uma escolha de privacidade.
 */
export function armazenamentoDoNavegador(): Armazenamento | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * As escolhas guardadas, ou `null` quando não há o que restaurar.
 *
 * `null` cobre os três casos juntos, e é de propósito que quem chama não distingue um do outro: não
 * havia gravação, a gravação foi recusada pelo guarda, ou o armazenamento lançou. Nos três a tela
 * faz a mesma coisa, que é abrir no padrão.
 *
 * Gravação recusada é APAGADA, para a tela não tentar restaurar a mesma coisa inválida a cada
 * abertura, pagando o guarda inteiro para chegar na mesma recusa.
 */
export function lerComposicaoGuardada(
  armazenamento: Armazenamento | null,
  forma: Forma,
  catalogo: CatalogoDoAcervo,
): Map<string, EscolhaDaTela> | null {
  if (armazenamento === null) return null;

  try {
    const texto = armazenamento.getItem(CHAVE_DA_COMPOSICAO);
    if (texto === null) return null;

    const colagem = escolhasDoTextoColado(texto, forma, catalogo);
    if (colagem.escolhas !== null) return colagem.escolhas;

    armazenamento.removeItem(CHAVE_DA_COMPOSICAO);
    return null;
  } catch {
    return null;
  }
}

/**
 * Grava o JSON da composição.
 *
 * Engole a falha, e só esta. Cota cheia ou armazenamento bloqueado não podem derrubar a tela no
 * meio de uma mudança de cor: a montagem que está na frente da pessoa continua certa, e o que se
 * perde é só a conveniência do próximo F5.
 */
export function guardarComposicao(armazenamento: Armazenamento | null, texto: string): void {
  if (armazenamento === null) return;

  try {
    armazenamento.setItem(CHAVE_DA_COMPOSICAO, texto);
  } catch {
    // Ver o comentário da função: falhar em guardar não é falhar em mostrar.
  }
}
