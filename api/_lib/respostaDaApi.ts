// Onde a `Response` HTTP é montada. Duas saídas, e a assimetria entre elas é regra escrita
// do projeto, não descuido deste arquivo: **sucesso é o artefato, erro é o envelope**
// (`docs/07_APIS/endpoints.md`, seção "A resposta").
//
// POR QUE O SUCESSO NÃO É ENVELOPADO, é a exceção deliberada ao "sempre envelope, mesmo em
// sucesso" de `memory/patterns.md`. Envelopar exigiria escapar um documento inteiro para
// dentro de uma string JSON e desescapá-lo do outro lado. O modo de falha desse round-trip
// (mojibake, BOM sobrando, uma sequência `\u` aparecendo dentro de um `<text>`) não é erro
// visível: é **mudança silenciosa do desenho**, a classe de defeito que o princípio nº1 do
// CLAUDE.md proíbe, e que aqui sai da fábrica como calçado errado. Com o corpo nu não existe
// transformação nenhuma entre a saída do motor e o byte que o cliente grava em disco, então
// não há onde a mudança acontecer. Os outros dois motivos (o ERP que quer `curl -o
// modelo.svg`, e o `?format=png` de um dia, que não caberia em JSON sem base64) estão no doc
// e não se repetem aqui, duplicata diverge.

import type { CodigoDeRespostaDaApi, FalhaDaApi } from './tiposDaApi';

/** O corpo do sucesso é o SVG cru; o do erro é sempre JSON. Nunca o contrário. */
const TIPO_DO_SVG = 'image/svg+xml; charset=utf-8';
const TIPO_DO_ENVELOPE = 'application/json; charset=utf-8';

/**
 * `Cache-Control: no-store` não é enfeite, e vale para as duas saídas.
 *
 * A decisão de não cachear variante em banco (`docs/01_ARQUITETURA/overview.md`) fica inútil
 * se um CDN ou proxy no meio do caminho guardar a resposta: variante velha entregue depois
 * de a zona ser remarcada no editor é o mesmo calçado errado, pela mesma causa, num lugar
 * onde ninguém pensa em olhar. No erro o argumento é gêmeo, um 404 cacheado continuaria
 * negando um produto que já existe, e um 401 cacheado sobreviveria à troca da chave.
 */
const SEM_CACHE = 'no-store';

/** `meta.version` do envelope. É a versão do formato do envelope, não a `/v1` da rota. */
export const VERSAO_DO_ENVELOPE = '1';

/**
 * O envelope de erro de `docs/07_APIS/endpoints.md`: `error` em inglês e aninhado, `code` em
 * enum estável, `message` em português. Nunca `erro` plano, duas formas de erro na mesma
 * API é o cliente parseando uma das duas errado.
 */
export interface EnvelopeDeErro {
  readonly data: null;
  readonly error: { readonly code: CodigoDeRespostaDaApi; readonly message: string };
  readonly meta: { readonly timestamp: string; readonly version: string };
}

/** 200 com o SVG cru. Nenhuma transformação: o que entra aqui sai byte a byte no corpo. */
export function respostaDeSucesso(svg: string): Response {
  return new Response(svg, {
    status: 200,
    headers: { 'Content-Type': TIPO_DO_SVG, 'Cache-Control': SEM_CACHE },
  });
}

/**
 * A resposta de erro: o envelope JSON, com o status e os cabeçalhos que a `FalhaDaApi` já
 * carrega (hoje só `Allow: POST` no 405). Este módulo **não traduz** erro nenhum, quem
 * decide código, status e mensagem é `traduzirParaFalhaDaApi`, dono único da tabela.
 *
 * O relógio entra por parâmetro, com padrão, pelo mesmo motivo que `lerConfiguracaoDoSupabase`
 * recebe o ambiente: sem isso o teste do `timestamp` vira teste de relógio, e teste que
 * depende de global não prova o formato que o contrato promete.
 */
export function respostaDeErro(
  falha: FalhaDaApi,
  relogio: () => Date = () => new Date(),
): Response {
  const envelope: EnvelopeDeErro = {
    data: null,
    error: { code: falha.codigo, message: falha.message },
    // ISO-8601 com milissegundos e sufixo `Z`, como o exemplo do contrato.
    meta: { timestamp: relogio().toISOString(), version: VERSAO_DO_ENVELOPE },
  };

  return new Response(JSON.stringify(envelope), {
    status: falha.status,
    // Os cabeçalhos da falha entram primeiro **de propósito**: os nossos dois são escritos
    // depois e vencem. Uma `FalhaDaApi` que trouxesse um `Content-Type` seu rotularia o
    // envelope como outra coisa, e o cliente pararia de parsear a única resposta que ele
    // precisa entender para saber o que deu errado.
    headers: {
      ...falha.cabecalhos,
      'Content-Type': TIPO_DO_ENVELOPE,
      'Cache-Control': SEM_CACHE,
    },
  });
}
