// A resposta do modelo de linguagem virando dado, antes de virar composição.
//
// Só tira o JSON de dentro do texto. NÃO confere nada da composição: isso é de
// `validarComposicao`, e uma segunda conferência aqui seria uma segunda implementação da regra,
// capaz de aceitar o que o guarda recusa.
//
// Existe porque modelo de linguagem responde texto, e texto de modelo costuma vir embrulhado:
// dentro de um bloco de código marcado como json, ou com uma frase antes ("Aqui está a
// composição:"). Recusar isso seria recusar a resposta certa pela embalagem.

import { ErroDeVariante } from '../render/erros';

/**
 * Teto do texto aceito. Uma composição de verdade tem algumas linhas; uma resposta muito maior
 * que isso não é composição, e fazer `JSON.parse` nela é trabalho à toa.
 */
export const TAMANHO_MAXIMO_DA_RESPOSTA = 20_000;

/** O JSON que está dentro da resposta, ainda `unknown`: quem diz se é composição é o guarda. */
export function lerRespostaDoModelo(texto: string): unknown {
  if (texto.length > TAMANHO_MAXIMO_DA_RESPOSTA) {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      `A resposta do modelo de linguagem tem ${texto.length} caracteres, e uma composição cabe em ` +
        `${TAMANHO_MAXIMO_DA_RESPOSTA}. Ela foi descartada sem ser lida.`,
    );
  }

  // Da primeira chave de abrir à última de fechar. Pega o bloco de código e a frase antes dele sem
  // precisar reconhecer nenhum dos dois, e não tenta consertar nada no meio.
  const inicio = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');

  if (inicio === -1 || fim < inicio) {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      'A resposta do modelo de linguagem não trouxe uma composição em JSON.',
    );
  }

  try {
    return JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      'A resposta do modelo de linguagem parece JSON, mas não é JSON válido.',
    );
  }
}
