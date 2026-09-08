// Uma linha de log por requisição — a que conhece o **prefixo** da chave e nunca a chave.
//
// POR QUE A ASSINATURA É ESTA. Chave de API em log é credencial vazada em texto puro, em
// arquivo que muita gente lê e que fica guardado por meses; o CLAUDE.md proíbe logar dado
// sensível e o ADR-006 (D1) diz que o log registra o prefixo, que identifica a chave sem
// permitir usá-la. Escrever "não logue a chave" num comentário é confiar em disciplina, e
// disciplina falha na madrugada em que alguém está caçando um 401. Então o módulo é feito
// para tornar o vazamento **difícil**, não só desaconselhado, por três decisões:
//
// 1. **Não recebe o `Request`.** Se recebesse, a credencial estaria no escopo desta função
//    (é só ler `Authorization`), e bastaria uma linha de depuração acrescentada com pressa.
//    Recebendo escalares já extraídos, o segredo nunca entra aqui.
// 2. **Não existe campo onde a chave caiba.** O único campo derivado dela é
//    `prefixoDaChave` — e nada no tipo aceita segredo, hash ou header.
// 3. **O prefixo é filtrado por formato antes de ser escrito.** Quem passar a chave inteira
//    nesse campo por engano não vaza nada: o valor não tem a forma de prefixo e é trocado
//    por `invalido`. É a diferença entre erro improvável e erro impossível.
//
// A rota tem defesa própria, e o motivo está no contrato: chave em query string é 401
// (`docs/07_APIS/endpoints.md`) justamente porque URL entra em log. Logar a URL com a query
// reintroduziria o vazamento pela porta que o contrato fechou — então aqui só o caminho é
// registrado, e o que vem depois de `?` é descartado.

import type { CodigoDeRespostaDaApi } from './tiposDaApi';

/**
 * O prefixo é 4 bytes em hex (`formatoDaChaveDeApi.ts`). Aqui a regra é repetida como
 * **filtro de segurança**, não como segunda leitura do formato: o trabalho dela é recusar
 * qualquer coisa que não seja curta e hexadecimal — inclusive uma chave inteira, que contém
 * `_` e tem mais de 60 caracteres. `logDaRequisicao.test.ts` tem um canário que gera uma
 * chave real e exige que o prefixo dela passe por este filtro; se o formato mudar, o teste
 * falha em vez de o log passar a dizer `invalido` para todo mundo em silêncio.
 */
const PREFIXO_VALIDO = /^[0-9a-f]{8}$/;

/** Sem chave na requisição (401 `CHAVE_AUSENTE`) o campo tem de existir mesmo assim. */
const PREFIXO_AUSENTE = 'ausente';

/** Veio alguma coisa no campo do prefixo, mas não era um prefixo. Nunca ecoa o valor. */
const PREFIXO_INVALIDO = 'invalido';

/** Alfabeto de caminho de URL — é o mais largo que a linha aceita. Ver `higienizarValorDeLog`. */
const CARACTERE_SEGURO_EM_LOG = /[^A-Za-z0-9/._~%:@!$&'()*+,;=-]/g;

/** Para onde a linha vai. `true` = canal de erro. A Vercel captura stdout e stderr. */
export type EscritorDeLog = (linha: string, ehErro: boolean) => void;

/** Tudo o que a linha pode conter. Note que não há campo para chave, header nem corpo. */
export interface RequisicaoParaLog {
  readonly metodo: string;
  /** Caminho da rota. Query string e fragmento são descartados aqui dentro. */
  readonly rota: string;
  readonly status: number;
  readonly duracaoMs: number;
  /** Só o prefixo, e mesmo assim conferido. `null` quando a requisição não trouxe chave. */
  readonly prefixoDaChave?: string | null;
  /** O `error.code` que foi devolvido, quando houve erro. */
  readonly codigoDeErro?: CodigoDeRespostaDaApi | null;
}

const escreverNoConsole: EscritorDeLog = (linha, ehErro) => {
  if (ehErro) console.error(linha);
  else console.log(linha);
};

/**
 * Escreve a linha da requisição.
 *
 * Formato: uma linha, pares `chave=valor` separados por espaço. Uma linha porque log
 * multilinha faz `grep` devolver fragmento sem contexto; `chave=valor` porque é o formato em
 * que `grep 7f3ab902` acha **todas** as chamadas de uma chave — que é exatamente o trabalho
 * de suporte para o qual o prefixo existe — e em que `grep codigo=CHAVE_INVALIDA` acha todas
 * as falhas de um tipo. JSON por linha daria o mesmo poder de busca com mais ruído para
 * quem lê no painel da Vercel, que é olho humano e não coletor.
 *
 * O escritor entra por parâmetro, com padrão, para o teste capturar a linha sem espionar o
 * console global (mesma ideia do ambiente por parâmetro em `lerConfiguracaoDoSupabase`).
 */
export function logDaRequisicao(
  requisicao: RequisicaoParaLog,
  escrever: EscritorDeLog = escreverNoConsole,
): void {
  const campos = [
    `metodo=${higienizarValorDeLog(requisicao.metodo)}`,
    `rota=${higienizarValorDeLog(requisicao.rota)}`,
    `status=${Math.trunc(requisicao.status)}`,
    ...(requisicao.codigoDeErro ? [`codigo=${higienizarValorDeLog(requisicao.codigoDeErro)}`] : []),
    `duracao_ms=${Math.round(requisicao.duracaoMs)}`,
    `prefixo=${prefixoParaLog(requisicao.prefixoDaChave)}`,
  ];

  escrever(campos.join(' '), requisicao.status >= 400);
}

/** Devolve o prefixo só se ele **for** um prefixo. Nunca ecoa o valor recusado. */
function prefixoParaLog(valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return PREFIXO_AUSENTE;
  return PREFIXO_VALIDO.test(valor) ? valor : PREFIXO_INVALIDO;
}

/**
 * Caminho da URL, sem query, sem fragmento e sem caractere de fora do alfabeto.
 *
 * Duas ameaças, não uma: a query pode carregar a chave que o contrato manda recusar
 * (`?api_key=`), e espaço ou quebra de linha no valor permitiria a quem chama **forjar uma
 * segunda linha de log** — inventando um 200 onde houve 401, por exemplo. Descartar é mais
 * seguro que escapar: não há como um escape esquecido passar batido.
 */
function higienizarValorDeLog(valor: string): string {
  const semQuery = valor.split('?')[0]?.split('#')[0] ?? '';
  return semQuery.replace(CARACTERE_SEGURO_EM_LOG, '');
}
