// Os tipos que atravessam a API inteira: o vocabulário de erro e a falha que se lança.
//
// A regra central deste arquivo é uma subtração: os 7 códigos do motor
// (`src/lib/render/erros.ts`) NÃO entram aqui e não são editados lá. Aquele arquivo declara
// que "mudar um código quebra cliente, então não muda", e ele é importado pelo editor
// também, um código de transporte acrescentado lá viraria um estado impossível na tela
// ("cor inválida" faz sentido no editor; "chave ausente", não).
//
// Então o vocabulário da API é a UNIÃO de dois conjuntos com donos diferentes:
// o que o motor sabe dizer, e o que só o transporte HTTP sabe dizer.

import type { CodigoDeErro } from '../../src/lib/render/erros';

/**
 * O que só existe porque a chamada veio pela rede: autenticação, roteamento e forma do
 * pedido. Nada aqui tem a ver com pintar SVG, e é por isso que não mora no motor.
 */
export type CodigoDeTransporte =
  | 'CHAVE_AUSENTE'
  | 'CHAVE_INVALIDA'
  | 'PRODUTO_NAO_ENCONTRADO'
  | 'METODO_NAO_PERMITIDO'
  | 'CORPO_INVALIDO'
  | 'FORMATO_NAO_SUPORTADO'
  | 'FALHA_INTERNA';

/** Todo `error.code` que a API pode devolver. É contrato: cliente compara com string. */
export type CodigoDeRespostaDaApi = CodigoDeErro | CodigoDeTransporte;

/**
 * A falha já traduzida para HTTP, código, status e mensagem de tela.
 *
 * Carrega o `status` em vez de deixar o handler decidir: se a decisão de status ficasse no
 * ponto onde a falha é lançada, o mesmo código sairia como 409 num lugar e 500 noutro, e a
 * tabela de `docs/07_APIS/endpoints.md` deixaria de ser verdade sem ninguém perceber.
 * Quem constrói uma `FalhaDaApi` a partir de um erro do motor é `traduzirParaFalhaDaApi`,
 * que é o único lugar com a tabela.
 */
export class FalhaDaApi extends Error {
  readonly codigo: CodigoDeRespostaDaApi;
  readonly status: number;

  /**
   * Cabeçalhos que o status exige, hoje só `Allow: POST` no 405. Um 405 sem `Allow` é o
   * tipo de detalhe que nenhum teste de unidade sente falta e que cliente HTTP bem escrito
   * usa para se corrigir sozinho.
   */
  readonly cabecalhos: Readonly<Record<string, string>>;

  constructor(
    codigo: CodigoDeRespostaDaApi,
    status: number,
    mensagem: string,
    cabecalhos: Record<string, string> = {},
  ) {
    super(mensagem);
    this.name = 'FalhaDaApi';
    this.codigo = codigo;
    this.status = status;
    this.cabecalhos = cabecalhos;
  }
}
