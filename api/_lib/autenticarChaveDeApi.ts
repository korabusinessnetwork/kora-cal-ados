// `Request` → `tenant_id`, ou 401. É o ponto único do ADR-006 D3, e a única razão de ele
// existir é que daqui para a frente o Postgres para de proteger: a consulta seguinte roda com
// `service_role`, que bypassa a RLS. O `tenant_id` que sai desta função é o escopo inteiro do
// resto da requisição, se ele vier errado, o handler entrega o produto da marca concorrente
// e o código parecerá correto (`api/README.md`).
//
// POR QUE A FUNÇÃO RECEBE O `Request` INTEIRO, E NÃO SÓ OS HEADERS. Porque uma das regras do
// contrato não é sobre o header: chave em query string é **recusada**
// (`docs/07_APIS/endpoints.md`, `docs/07_APIS/autenticacao.md`), e essa regra só pode existir
// aqui dentro se este módulo enxergar a URL. Recebendo só os headers, a recusa teria de morar
// no handler, e regra de credencial escrita num segundo lugar é a regra que se esquece de
// escrever na terceira rota, ou que se escreve num ramo que um `return` anterior nunca
// alcança. Uma porta de entrada, uma verificação. (É o inverso deliberado de
// `logDaRequisicao.ts`, que recusa o `Request` justamente para a chave nunca entrar no escopo
// dele: lá o objetivo é não poder vazar; aqui é não poder esquecer.)
//
// A ORDEM É PARTE DO CONTRATO. A query é verificada ANTES de o header ser lido. URL entra em
// log de CDN, de proxy, do painel e no `Referer`; autenticar "só desta vez" um pedido que
// mandou a chave por ali ensinaria o integrador a mandá-la sempre por ali, e o vazamento
// ficaria escrito em disco de terceiros para sempre.

import { timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  HASH_QUE_NUNCA_CONFERE,
  hashDoSegredo,
  interpretarChaveDeApi,
} from './formatoDaChaveDeApi';
import { criarFalhaDeTransporte } from './traduzirParaFalhaDaApi';

/** O que a autenticação entrega ao resto da requisição. Nada aqui vem do chamador. */
export interface ChaveAutenticada {
  /** Sempre da linha da chave. Nunca do corpo, nunca da URL, nunca de header (ADR-006 D3). */
  readonly tenantId: string;
  /** Para o log (`logDaRequisicao`) e para `registrarUsoDaChave`. Identifica sem autenticar. */
  readonly prefixo: string;
  /** A linha de `tenant_api_keys`, para o `last_used_at` fire-and-forget de outro módulo. */
  readonly idDaChave: string;
}

const TABELA = 'tenant_api_keys';

/**
 * Campos explícitos (CLAUDE.md proíbe `select *`). O `hash` aqui é legítimo e é o único lugar
 * do projeto onde é: ler o hash é a razão de este módulo existir, e só a `service_role` tem
 * privilégio para isso. Do lado do front ele nunca sai do banco.
 */
const CAMPOS_DA_CHAVE = 'id, tenant_id, hash, revoked_at';

/** O esquema é case-insensitive por RFC 7235; recusar `bearer` minúsculo seria bug nosso. */
const ESQUEMA_BEARER = /^Bearer[ \t]+(.+)$/i;

/** A forma do que `hashDoSegredo` produz: SHA-256 em hex. Ver `compararEmTempoConstante`. */
const HASH_VALIDO = /^[0-9a-f]{64}$/;

/**
 * Nomes de parâmetro que carregam credencial em integrações do mundo real. `api_key`, `key`,
 * `token` e `access_token` estão no contrato (`docs/07_APIS/autenticacao.md`); `apikey`,
 * `api-key`, `authorization` e `bearer` entram porque são a mesma tentativa escrita de outro
 * jeito, e recusar quatro grafias e aceitar a quinta seria o contrário do que a regra quer.
 */
const PARAMETROS_DE_CREDENCIAL: ReadonlySet<string> = new Set([
  'api_key',
  'apikey',
  'api-key',
  'key',
  'token',
  'access_token',
  'authorization',
  'bearer',
]);

/**
 * A segunda metade da recusa, e a que a lista de nomes não cobre: `?x=kora_live_...`.
 *
 * Uma lista de nomes só recusa o que já se imaginou; um integrador criativo manda a chave em
 * `?k=`, `?auth=` ou `?cred=` e passaria. O que não muda é o **valor**, a chave começa por
 * `kora_live_`/`kora_test_` porque o formato é nosso (`formatoDaChaveDeApi.ts`). Então o
 * valor é o que se examina, sob qualquer nome. Falso positivo aqui é inofensivo: o único
 * parâmetro que a rota aceita é `format=svg`, e nenhum valor legítimo dele contém `kora_live_`.
 */
const CARA_DE_CHAVE = /kora_(live|test)_/;

interface LinhaDaChave {
  readonly id: string;
  readonly tenant_id: string;
  readonly hash: string;
  readonly revoked_at: string | null;
}

/**
 * Autentica a requisição e devolve o escopo dela. Lança `FalhaDaApi`, nunca devolve `null`,
 * porque um retorno nulo seria checável com `if` e esquecível sem `if`.
 *
 * As quatro recusas por chave (malformada, prefixo inexistente, segredo errado e revogada)
 * saem por **uma única linha**, com um único código e uma única mensagem. Não é economia de
 * código: distinguir contaria a quem sonda prefixos qual deles já existiu (ADR-006 D1 e a
 * nota de implementação do mesmo ADR).
 */
export async function autenticarChaveDeApi(
  cliente: SupabaseClient,
  pedido: Request,
): Promise<ChaveAutenticada> {
  recusarCredencialNaQueryString(pedido.url);

  const cabecalho = pedido.headers.get('authorization');
  const capturado = cabecalho === null ? null : ESQUEMA_BEARER.exec(cabecalho);
  const bruta = capturado?.[1]?.trim();
  if (bruta === undefined || bruta === '') throw criarFalhaDeTransporte('CHAVE_AUSENTE');

  const chave = interpretarChaveDeApi(bruta);

  // Chave malformada não consulta o banco, não há prefixo para consultar, mas também não
  // sai por um `throw` próprio: ela desce até a MESMA linha de recusa das outras três. O
  // tempo dela é distinguível, e isso é aceitável: o formato da chave é público (está no doc
  // da API), então saber que o formato estava errado não conta nada a quem sonda.
  const linha = chave === null ? null : await buscarLinhaDaChave(cliente, chave.prefixo);

  // A COMPARAÇÃO ACONTECE SEMPRE, inclusive quando não há linha. Um `return` antecipado aqui
  // faria o prefixo inexistente responder mais rápido que o prefixo real com segredo errado,
  // e essa diferença é um oráculo que diz ao atacante quando ele acertou um prefixo, o
  // mesmo oráculo que a mensagem idêntica existe para fechar.
  const hashRecebido = hashDoSegredo(chave?.segredo ?? '');
  const hashArmazenado =
    linha !== null && HASH_VALIDO.test(linha.hash ?? '') ? linha.hash : HASH_QUE_NUNCA_CONFERE;
  const confere = compararEmTempoConstante(hashRecebido, hashArmazenado);
  const revogada = linha !== null && linha.revoked_at !== null && linha.revoked_at !== undefined;

  // A única saída de recusa por chave do arquivo. Se um dia aparecer uma segunda, a
  // indistinguibilidade das quatro deixou de ser estrutural e virou coincidência.
  if (chave === null || linha === null || !confere || revogada) {
    throw criarFalhaDeTransporte('CHAVE_INVALIDA');
  }

  // Linha autenticada mas sem escopo utilizável é defeito nosso, não credencial errada: as
  // duas colunas são `not null` no schema. Devolver `tenantId: ''` daqui abriria uma consulta
  // sem escopo lá na frente, que é exatamente o vazamento que este módulo existe para negar.
  if (naoEhTextoUtil(linha.tenant_id) || naoEhTextoUtil(linha.id)) {
    throw criarFalhaDeTransporte('FALHA_INTERNA');
  }

  return { tenantId: linha.tenant_id, prefixo: chave.prefixo, idDaChave: linha.id };
}

/**
 * Recusa antes de qualquer leitura de credencial. `CHAVE_AUSENTE`, e não `CHAVE_INVALIDA`,
 * porque é o que o contrato escreve em três lugares (`docs/07_APIS/endpoints.md`, tabela de
 * códigos e seção "Autenticação"; `docs/07_APIS/autenticacao.md`), e a mensagem desse código
 * é justamente a instrução que falta a quem errou assim: "envie em Authorization: Bearer".
 *
 * A URL é parseada com base de reserva porque `Request.url` é absoluta por especificação, mas
 * um `Request` montado à mão em teste pode não ser, e falhar a checagem por causa disso
 * abriria a porta que ela fecha.
 */
function recusarCredencialNaQueryString(url: string): void {
  const parametros = new URL(url, 'https://placeholder.invalid').searchParams;

  for (const [nome, valor] of parametros) {
    if (PARAMETROS_DE_CREDENCIAL.has(nome.toLowerCase()) || CARA_DE_CHAVE.test(valor)) {
      throw criarFalhaDeTransporte('CHAVE_AUSENTE');
    }
  }
}

/**
 * Erro do banco NÃO é 401. Um Postgres fora do ar respondendo "chave inválida" mandaria o
 * integrador rotacionar uma chave que está correta, e ele passaria o incidente inteiro
 * caçando o defeito no lado dele.
 *
 * Por que `criarFalhaDeTransporte('FALHA_INTERNA')` e não "deixar o erro subir": supabase-js
 * devolve o erro como **valor** (`{ data, error }`), não o lança. Não existe erro subindo
 * sozinho, existe um `error` que, se fosse ignorado, deixaria `data` nulo e cairia na recusa
 * de chave logo abaixo. Ou seja, o caminho "natural" é exatamente o defeito. O detalhe do
 * Postgres fica fora da `FalhaDaApi` de propósito: a resposta vai para o sistema de outra
 * marca, e mensagem de exceção carrega nome de coluna e caminho de arquivo.
 */
async function buscarLinhaDaChave(
  cliente: SupabaseClient,
  prefixo: string,
): Promise<LinhaDaChave | null> {
  const { data, error } = await cliente
    .from(TABELA)
    .select(CAMPOS_DA_CHAVE)
    .eq('prefixo', prefixo)
    .maybeSingle();

  if (error) throw criarFalhaDeTransporte('FALHA_INTERNA');
  return (data as LinhaDaChave | null) ?? null;
}

/**
 * `timingSafeEqual` LANÇA quando os buffers têm tamanhos diferentes, e uma exceção aqui
 * viraria 500 onde o contrato promete 401, além de o próprio lançamento denunciar, pelo
 * tempo, que os tamanhos diferiam. Por isso o tamanho é conferido antes, e o hash lido do
 * banco já chega normalizado para 64 caracteres por `HASH_QUE_NUNCA_CONFERE`: na prática os
 * dois lados sempre têm o mesmo tamanho, e esta guarda é a rede embaixo disso.
 */
function compararEmTempoConstante(recebido: string, armazenado: string): boolean {
  const a = Buffer.from(recebido, 'utf8');
  const b = Buffer.from(armazenado, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function naoEhTextoUtil(valor: unknown): boolean {
  return typeof valor !== 'string' || valor.trim() === '';
}
