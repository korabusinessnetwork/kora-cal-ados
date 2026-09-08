// A ÚNICA ponte entre o erro do motor (`ErroDeVariante`, que não sabe o que é HTTP) e o erro
// de transporte (`FalhaDaApi`, que carrega status) — e por isso a única dona da tabela de
// `docs/07_APIS/endpoints.md`.
//
// Por que a tabela mora num arquivo só: se cada ponto de lançamento decidisse o próprio
// status, o mesmo código sairia 409 num lugar e 500 noutro, e a tabela do doc deixaria de ser
// verdade sem ninguém perceber. Aqui, código do motor sem status é erro de compilação — o
// `Record<CodigoDeErro, ...>` exige a chave —, nunca um 500 que um cliente descobre em
// produção.
//
// A tabela é lida de `docs/07_APIS/endpoints.md` e não é reescrita em prosa aqui: duplicata
// diverge. O que fica escrito aqui é só o que o doc não consegue impor — o porquê de cada
// escolha que um agente futuro poderia desfazer achando que simplifica.

import { ErroDeVariante, type CodigoDeErro } from '../../src/lib/render/erros';
import { FalhaDaApi, type CodigoDeTransporte } from './tiposDaApi';

/**
 * Quem tem que agir. Não é rótulo: é o que decide a MENSAGEM, e é a razão de 409 e 422 não
 * serem intercambiáveis. Um 422 manda o integrador revisar o que enviou; num 409 o pedido
 * está certo, e mandá-lo revisar o JSON o afastaria da causa, que está no dado gravado do
 * tenant.
 */
export type FamiliaDeErro = 'pedido' | 'dado do tenant' | 'nossa';

type EntradaDaTabela = { readonly status: number; readonly familia: FamiliaDeErro };

/** Mensagem fixa do 500: o detalhe interno nunca sai daqui (ver `traduzirParaFalhaDaApi`). */
export const MENSAGEM_DE_FALHA_INTERNA =
  'Erro interno ao gerar a variante. O detalhe ficou no nosso log; se persistir, informe o horário da chamada.';

/**
 * O acréscimo que transforma um erro escrito para nós num erro útil para quem integra. A
 * mensagem do motor fala de seletor, normalização e elemento — vocabulário interno sobre o
 * qual o desenvolvedor do outro lado não tem como agir. Isto diz quem corrige, e onde.
 */
const ORIENTACAO_DE_DADO_DO_TENANT =
  'O pedido está correto: o que precisa de correção é o mapeamento de zonas ou o arquivo base deste produto, no editor de zonas da marca. Repetir a chamada não resolve.';

/**
 * Os 7 códigos do motor. Exportada porque o teste itera esta tabela em vez de manter uma
 * lista própria dos códigos — lista paralela envelhece em silêncio, esta não pode.
 */
export const STATUS_POR_CODIGO_DO_MOTOR: Readonly<Record<CodigoDeErro, EntradaDaTabela>> = {
  COR_INVALIDA: { status: 422, familia: 'pedido' },
  ZONE_KEY_INVALIDA: { status: 422, familia: 'pedido' },
  // Vinda do MOTOR é sempre 409. O 422 de `ZONA_NAO_ENCONTRADA` da tabela do doc é outro
  // caso, e ele nunca passa por aqui: o handler pré-checa as zone_key pedidas contra as zonas
  // do produto e levanta ele mesmo uma `FalhaDaApi` 422 (com a lista das zonas que existem)
  // ANTES de chamar o motor. Depois dessa pré-checagem, a única forma de o motor lançar este
  // código é seletor gravado quebrado — que é dado do tenant, não pedido do integrador.
  ZONA_NAO_ENCONTRADA: { status: 409, familia: 'dado do tenant' },
  ZONA_NAO_RECOLORIVEL: { status: 409, familia: 'dado do tenant' },
  ZONAS_SOBREPOSTAS: { status: 409, familia: 'dado do tenant' },
  SVG_INVALIDO: { status: 409, familia: 'dado do tenant' },
  SVG_NAO_NORMALIZAVEL: { status: 409, familia: 'dado do tenant' },
};

type EntradaDeTransporte = EntradaDaTabela & {
  readonly mensagem: string;
  readonly cabecalhos?: Readonly<Record<string, string>>;
};

/**
 * Os códigos que o motor não sabe lançar porque não têm nada a ver com pintar SVG. Moram
 * neste arquivo, e não no ponto onde cada um é levantado, pela mesma razão da tabela do
 * motor: status decidido no ponto de lançamento é status que diverge do doc sem aviso.
 */
export const TRANSPORTE_POR_CODIGO: Readonly<Record<CodigoDeTransporte, EntradaDeTransporte>> = {
  CHAVE_AUSENTE: {
    status: 401,
    familia: 'pedido',
    mensagem: 'Envie a chave de API em Authorization: Bearer.',
  },
  // Malformada, inexistente e revogada compartilham esta mensagem de propósito: distinguir as
  // três contaria a quem sonda chaves qual delas já existiu.
  CHAVE_INVALIDA: { status: 401, familia: 'pedido', mensagem: 'Chave de API inválida.' },
  // 404 e nunca 403: 403 confirmaria que o id existe, e marcas concorrentes convivem aqui.
  PRODUTO_NAO_ENCONTRADO: { status: 404, familia: 'pedido', mensagem: 'Produto não encontrado.' },
  METODO_NAO_PERMITIDO: {
    status: 405,
    familia: 'pedido',
    mensagem: 'Método não permitido. Use POST.',
    // Um 405 sem `Allow` obriga o integrador a adivinhar o método certo; com ele, cliente
    // HTTP bem escrito se corrige sozinho.
    cabecalhos: { Allow: 'POST' },
  },
  CORPO_INVALIDO: {
    status: 400,
    familia: 'pedido',
    mensagem:
      'Corpo inválido: envie um objeto JSON com uma cor por zone_key, por exemplo {"sola": "#C0392B"}.',
  },
  FORMATO_NAO_SUPORTADO: {
    status: 400,
    familia: 'pedido',
    mensagem: 'Formato não suportado. Use format=svg.',
  },
  FALHA_INTERNA: { status: 500, familia: 'nossa', mensagem: MENSAGEM_DE_FALHA_INTERNA },
};

/**
 * A mensagem do motor é NOSSA e é a parte acionável (nomeia a zona, a cor, o seletor), então
 * é segura de repassar. O que falta nela é quem corrige — e só o 409 precisa do acréscimo: as
 * mensagens de 422 já dizem exatamente o que mudar no pedido, e emendar "corrija o pedido"
 * nelas seria ruído.
 */
function montarMensagem(entrada: EntradaDaTabela, mensagemDoMotor: string): string {
  return entrada.familia === 'dado do tenant'
    ? `${mensagemDoMotor} ${ORIENTACAO_DE_DADO_DO_TENANT}`
    : mensagemDoMotor;
}

/**
 * Monta uma falha de transporte pela tabela. `mensagem` sobrescreve quando há detalhe
 * acionável a dar (o `?format=png` recusado, por exemplo); o status nunca é sobrescrito.
 */
export function criarFalhaDeTransporte(codigo: CodigoDeTransporte, mensagem?: string): FalhaDaApi {
  const entrada = TRANSPORTE_POR_CODIGO[codigo];
  return new FalhaDaApi(codigo, entrada.status, mensagem ?? entrada.mensagem, {
    ...entrada.cabecalhos,
  });
}

/**
 * A ÚNICA linha da tabela de `docs/07_APIS/endpoints.md` que nenhuma das duas tabelas acima
 * consegue produzir: `ZONA_NAO_ENCONTRADA` com **422**.
 *
 * O código é do motor, então não cabe em `TRANSPORTE_POR_CODIGO`; e `STATUS_POR_CODIGO_DO_MOTOR`
 * mapeia esse mesmo código para 409 de propósito, porque vindo do motor ele significa outra
 * coisa (seletor gravado quebrado). Os dois status são certos, para origens diferentes — é o
 * caso ambíguo que o doc descreve, e que o handler resolve pré-checando as `zone_key` pedidas
 * contra as zonas do produto ANTES de chamar o motor.
 *
 * Por que a fábrica mora aqui e não no handler, que é quem faz a pré-checagem: escrever
 * `new FalhaDaApi('ZONA_NAO_ENCONTRADA', 422, ...)` lá seria a terceira tabela de status do
 * projeto, na única parte que não tem tabela nenhuma. Aqui, as três linhas do par ficam no
 * mesmo arquivo, e quem for mudar 409 ou 422 vê as duas de uma vez em vez de mudar uma e
 * deixar a outra contradizendo o doc.
 *
 * A MENSAGEM é do handler, e tem de ser: só ele sabe quais zonas o produto tem, que é a parte
 * acionável da resposta.
 */
export function criarFalhaDeZonaDesconhecida(mensagem: string): FalhaDaApi {
  return new FalhaDaApi('ZONA_NAO_ENCONTRADA', STATUS_DA_PRE_CHECAGEM_DE_ZONA, mensagem);
}

/** 422 e não 409: quem corrige é quem fez o pedido, mudando a `zone_key` que enviou. */
const STATUS_DA_PRE_CHECAGEM_DE_ZONA = 422;

export function traduzirParaFalhaDaApi(erro: unknown): FalhaDaApi {
  // Já traduzida: sai igual. Retraduzir perderia o status já decidido — é o caso do 422 de
  // `ZONA_NAO_ENCONTRADA` da pré-checagem, que aqui viraria 409 e mandaria o integrador
  // procurar defeito no dado do tenant quando o defeito é a zone_key que ele pediu.
  if (erro instanceof FalhaDaApi) return erro;

  if (erro instanceof ErroDeVariante) {
    // Anotado como possivelmente ausente de propósito: o tipo garante a chave, mas um
    // `ErroDeVariante` montado à mão fora do tipo cairia num `undefined` silencioso e a
    // resposta sairia com `status: undefined`. Melhor 500 do que status inventado.
    const entrada: EntradaDaTabela | undefined = STATUS_POR_CODIGO_DO_MOTOR[erro.codigo];
    if (entrada) {
      return new FalhaDaApi(erro.codigo, entrada.status, montarMensagem(entrada, erro.message));
    }
  }

  // Qualquer outra coisa — `Error` genérico, string lançada, `undefined`. A mensagem original
  // NÃO entra na resposta: mensagem de exceção carrega caminho de arquivo, nome de coluna e
  // às vezes trecho de credencial, e quem lê esta resposta é o sistema de outra marca. É
  // regra de segurança do CLAUDE.md, não estilo.
  return criarFalhaDeTransporte('FALHA_INTERNA');
}
