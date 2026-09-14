// A ÚNICA ponte entre o erro do motor (`ErroDeVariante`, que não sabe o que é HTTP) e o erro
// de transporte (`FalhaDaApi`, que carrega status), e por isso a única dona da tabela de
// `docs/07_APIS/endpoints.md`.
//
// Por que a tabela mora num arquivo só: se cada ponto de lançamento decidisse o próprio
// status, o mesmo código sairia 409 num lugar e 500 noutro, e a tabela do doc deixaria de ser
// verdade sem ninguém perceber. Aqui, código do motor sem status é erro de compilação, o
// `Record<CodigoDeErro, ...>` exige a chave, nunca um 500 que um cliente descobre em
// produção.
//
// A tabela é lida de `docs/07_APIS/endpoints.md` e não é reescrita em prosa aqui: duplicata
// diverge. O que fica escrito aqui é só o que o doc não consegue impor, o porquê de cada
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
 * mensagem do motor fala de seletor, normalização e elemento, vocabulário interno sobre o
 * qual o desenvolvedor do outro lado não tem como agir. Isto diz quem corrige, e onde.
 */
const ORIENTACAO_DE_DADO_DO_TENANT =
  'O pedido está correto: o que precisa de correção é o mapeamento de zonas ou o arquivo base deste produto, no editor de zonas da marca. Repetir a chamada não resolve.';

/**
 * Todos os códigos do motor. Exportada porque o teste itera esta tabela em vez de manter uma
 * lista própria dos códigos, lista paralela envelhece em silêncio, esta não pode. (A
 * contagem não é escrita aqui de propósito: já foram "7" até o ADR-007 acrescentar os dois
 * de modelo 3D, e um número em comentário é a primeira coisa que fica velha.)
 */
export const STATUS_POR_CODIGO_DO_MOTOR: Readonly<Record<CodigoDeErro, EntradaDaTabela>> = {
  COR_INVALIDA: { status: 422, familia: 'pedido' },
  ZONE_KEY_INVALIDA: { status: 422, familia: 'pedido' },
  // Vinda do MOTOR é sempre 409. O 422 de `ZONA_NAO_ENCONTRADA` da tabela do doc é outro
  // caso, e ele nunca passa por aqui: o handler pré-checa as zone_key pedidas contra as zonas
  // do produto e levanta ele mesmo uma `FalhaDaApi` 422 (com a lista das zonas que existem)
  // ANTES de chamar o motor. Depois dessa pré-checagem, a única forma de o motor lançar este
  // código é seletor gravado quebrado, que é dado do tenant, não pedido do integrador.
  ZONA_NAO_ENCONTRADA: { status: 409, familia: 'dado do tenant' },
  ZONA_NAO_RECOLORIVEL: { status: 409, familia: 'dado do tenant' },
  ZONAS_SOBREPOSTAS: { status: 409, familia: 'dado do tenant' },
  SVG_INVALIDO: { status: 409, familia: 'dado do tenant' },
  SVG_NAO_NORMALIZAVEL: { status: 409, familia: 'dado do tenant' },
  // Gêmeos 3D dos dois acima, e pela mesma razão em 409: o pedido do integrador está certo,
  // e o que precisa de correção é o modelo gravado do tenant. Hoje eles não têm como chegar
  // até aqui, a normalização roda no provisionamento, não na requisição, e mesmo assim
  // entram na tabela: `Record<CodigoDeErro, ...>` exige a chave, e um código do motor sem
  // status é exatamente o 500 surpresa que este arquivo existe para impedir.
  MODELO_3D_INVALIDO: { status: 409, familia: 'dado do tenant' },
  MODELO_3D_NAO_NORMALIZAVEL: { status: 409, familia: 'dado do tenant' },
  // Os quatro da composição (ADR-008) são **422 e não 409**, ao contrário dos 3D acima, e a
  // diferença não é de gosto: a composição chega no CORPO do pedido, então é literalmente o
  // pedido que é improcessável, e o integrador conserta trocando o que enviou. Um 409 aqui o
  // mandaria ao editor de zonas de um produto que talvez nem exista ainda.
  //
  // O dia em que uma composição JÁ GRAVADA ficar inválida porque o acervo mudou (peça
  // removida, forma aposentada) é outro ponto de chamada, aí sim dado do tenant, e a saída é
  // a mesma que `ZONA_NAO_ENCONTRADA` já usa: o handler pré-checa e levanta ele mesmo, em vez
  // de o mesmo código sair com dois status daqui.
  PECA_NAO_ENCONTRADA: { status: 422, familia: 'pedido' },
  COMPOSICAO_INVALIDA: { status: 422, familia: 'pedido' },
  FORMAS_MISTURADAS: { status: 422, familia: 'pedido' },
  PARAMETRO_INVALIDO: { status: 422, familia: 'pedido' },
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
  // ── Os da D13, do fluxo de fornecedor de modelo de linguagem ────────────────────────
  SESSAO_AUSENTE: {
    status: 401,
    familia: 'pedido',
    mensagem: 'Entre na sua conta para usar o modelo de linguagem.',
  },
  SESSAO_INVALIDA: {
    status: 401,
    familia: 'pedido',
    mensagem: 'Sua sessão expirou. Entre de novo.',
  },
  // 403 e não 404: aqui quem chama é a própria tela, com a sessão da pessoa, e o id do tenant
  // veio da lista de tenants dela. Não há o que esconder, e um 404 mandaria a pessoa procurar
  // uma marca que existe. A mensagem é a mesma para "não é membro" e "não é owner" de
  // propósito, para não contar a quem não é membro que aquela marca existe.
  SEM_PERMISSAO: {
    status: 403,
    familia: 'pedido',
    mensagem: 'Esta ação é do dono da marca.',
  },
  FORNECEDOR_NAO_CONFIGURADO: {
    status: 409,
    familia: 'dado do tenant',
    mensagem: 'Nenhum fornecedor de modelo de linguagem configurado para esta marca.',
  },
  ENDERECO_NAO_PERMITIDO: {
    status: 400,
    familia: 'pedido',
    mensagem: 'O endereço da API própria não é aceito.',
  },
  // 502 e não 401 nos três de fornecedor: o 401 é sobre a chamada QUE CHEGOU aqui, e ela está
  // autenticada. O que falhou foi a chamada que NÓS fizemos ao terceiro, que é o que 502 diz.
  FORNECEDOR_RECUSOU_A_CHAVE: {
    status: 502,
    familia: 'dado do tenant',
    mensagem: 'O fornecedor recusou a chave. Confira a chave em "Fornecedor de modelo de linguagem", ou crie outra no site dele.',
  },
  FORNECEDOR_NAO_TEM_O_MODELO: {
    status: 502,
    familia: 'dado do tenant',
    mensagem: 'O fornecedor não reconheceu esse modelo. Nome de modelo muda com o tempo: confira no site dele.',
  },
  FORNECEDOR_NO_LIMITE: {
    status: 429,
    familia: 'dado do tenant',
    mensagem: 'O fornecedor recusou por limite de uso do plano. Tente de novo em alguns minutos.',
  },
  FORNECEDOR_NAO_RESPONDEU: {
    status: 502,
    familia: 'dado do tenant',
    mensagem: 'O fornecedor não respondeu a tempo. Tente de novo em alguns segundos.',
  },
  LIMITE_DE_GERACOES: {
    status: 429,
    familia: 'pedido',
    mensagem: 'Muitas gerações em pouco tempo. Espere um minuto e tente de novo.',
  },
  TETO_MENSAL_ATINGIDO: {
    status: 409,
    familia: 'dado do tenant',
    mensagem: 'O teto mensal de gasto desta marca foi atingido. O owner da marca pode aumentá-lo em "Fornecedor de modelo de linguagem".',
  },
  FALHA_INTERNA: { status: 500, familia: 'nossa', mensagem: MENSAGEM_DE_FALHA_INTERNA },
};

/**
 * A mensagem do motor é NOSSA e é a parte acionável (nomeia a zona, a cor, o seletor), então
 * é segura de repassar. O que falta nela é quem corrige, e só o 409 precisa do acréscimo: as
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
export function criarFalhaDeTransporte(
  codigo: CodigoDeTransporte,
  mensagem?: string,
  cabecalhos?: Record<string, string>,
): FalhaDaApi {
  const entrada = TRANSPORTE_POR_CODIGO[codigo];
  // Os cabeçalhos entram por parâmetro só porque o `Allow` do 405 depende da ROTA: a de
  // variante permite POST, a de configuração permite GET, PUT e DELETE. O status continua
  // vindo da tabela, que é o que este arquivo existe para centralizar.
  return new FalhaDaApi(codigo, entrada.status, mensagem ?? entrada.mensagem, {
    ...entrada.cabecalhos,
    ...cabecalhos,
  });
}

/**
 * A ÚNICA linha da tabela de `docs/07_APIS/endpoints.md` que nenhuma das duas tabelas acima
 * consegue produzir: `ZONA_NAO_ENCONTRADA` com **422**.
 *
 * O código é do motor, então não cabe em `TRANSPORTE_POR_CODIGO`; e `STATUS_POR_CODIGO_DO_MOTOR`
 * mapeia esse mesmo código para 409 de propósito, porque vindo do motor ele significa outra
 * coisa (seletor gravado quebrado). Os dois status são certos, para origens diferentes, é o
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
  // Já traduzida: sai igual. Retraduzir perderia o status já decidido, é o caso do 422 de
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

  // Qualquer outra coisa, `Error` genérico, string lançada, `undefined`. A mensagem original
  // NÃO entra na resposta: mensagem de exceção carrega caminho de arquivo, nome de coluna e
  // às vezes trecho de credencial, e quem lê esta resposta é o sistema de outra marca. É
  // regra de segurança do CLAUDE.md, não estilo.
  return criarFalhaDeTransporte('FALHA_INTERNA');
}
