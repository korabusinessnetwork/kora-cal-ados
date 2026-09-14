// O que os quatro handlers de `api/v1/modelo-de-linguagem/` fazem igual.
//
// Existe para os handlers ficarem com o que é deles (o método, o corpo, a ordem dos passos) e para
// a regra comum ter um lugar só com teste: o tenant que vem da URL, o método recusado com o `Allow`
// certo, e a montagem do que vai ao fornecedor.
//
// A ORDEM DOS PASSOS de cada handler é propriedade de segurança, como na rota de variante:
//   1. método   2. tenant da URL   3. sessão e papel   4. corpo   5. configuração   6. limites
//      7. fornecedor   8. registro do uso
// O corpo é conferido DEPOIS da sessão de propósito: recusa nossa é informação, e quem não provou
// ser da marca não recebe mensagem diferenciada sobre o que aquela marca tem configurado.

import { INSTRUCAO_AO_MODELO } from '../../src/lib/composicao/gerarComposicaoPorPrompt';
import { montarCatalogoParaModelo } from '../../src/lib/composicao/montarCatalogoParaModelo';
import type { CatalogoDoAcervo, Forma } from '../../src/lib/composicao/tiposDaComposicao';
import { FalhaDaApi } from './tiposDaApi';
import { criarFalhaDeTransporte, traduzirParaFalhaDaApi } from './traduzirParaFalhaDaApi';
import { ehUuid } from './autenticarSessaoDoUsuario';

/** O tenant vem da query string, e é conferido como uuid antes de qualquer consulta. */
export function lerTenantDaUrl(pedido: Request): string {
  const tenant = new URL(pedido.url).searchParams.get('tenant') ?? '';
  // `SEM_PERMISSAO` e não `CORPO_INVALIDO`: quem não manda tenant válido não provou nada sobre
  // marca nenhuma, e a resposta é a mesma de quem pede uma marca de que não é membro.
  if (!ehUuid(tenant)) throw criarFalhaDeTransporte('SEM_PERMISSAO');
  return tenant;
}

/** Recusa o método com o `Allow` daquela rota, que é o que deixa um cliente HTTP se corrigir. */
export function exigirMetodo(pedido: Request, permitidos: string[]): string {
  const metodo = pedido.method.toUpperCase();
  if (!permitidos.includes(metodo)) {
    throw criarFalhaDeTransporte('METODO_NAO_PERMITIDO', `Método não permitido. Use ${permitidos.join(', ')}.`, {
      Allow: permitidos.join(', '),
    });
  }
  return metodo;
}

/** O corpo JSON do pedido, ou recusa. Corpo vazio vira objeto vazio, que a validação recusa depois. */
export async function lerCorpoJson(pedido: Request): Promise<unknown> {
  const texto = await pedido.text();
  if (texto.trim() === '') return {};
  try {
    return JSON.parse(texto);
  } catch {
    throw criarFalhaDeTransporte('CORPO_INVALIDO', 'Envie um corpo JSON válido.');
  }
}

/**
 * A instrução que vai ao fornecedor como mensagem de sistema: a instrução fixa do ADR-008 mais o
 * catálogo daquela forma.
 *
 * É montada NO SERVIDOR, e não recebida do navegador, e essa é a diferença entre um endpoint de
 * composição e um proxy de modelo de linguagem com a chave da marca dentro. O prompt da pessoa vai
 * em campo separado, como mensagem de usuário (ADR-008 D1, item 2).
 */
export function montarInstrucaoComCatalogo(forma: Forma, catalogo: CatalogoDoAcervo): string {
  return `${INSTRUCAO_AO_MODELO}\n\nCatálogo de peças disponíveis:\n${montarCatalogoParaModelo(forma, catalogo)}`;
}

/** A forma pedida, dentro do catálogo. Id que não existe é pedido inválido, não erro nosso. */
export function acharForma(catalogo: CatalogoDoAcervo, formaId: unknown): Forma {
  const forma = typeof formaId === 'string' ? catalogo.formas.find(({ id }) => id === formaId) : undefined;
  if (forma === undefined) {
    throw criarFalhaDeTransporte(
      'CORPO_INVALIDO',
      `Envie "forma_id" com uma forma do acervo. Formas disponíveis: ${catalogo.formas.map(({ id }) => id).join(', ')}.`,
    );
  }
  return forma;
}

/** O 500 destas rotas. A mensagem da tabela fala em "variante", que é a outra API. */
export const MENSAGEM_DE_FALHA_INTERNA_DO_MODELO =
  'Erro interno no servidor. O detalhe ficou no nosso log; se persistir, informe o horário.';

/**
 * Qualquer erro do handler vira a resposta de erro. O que não é recusa nossa (erro do banco, código
 * quebrado) vai para o log com a rota e a mensagem, e a resposta sai com a frase fixa.
 *
 * Existe porque o 500 dizia "o detalhe ficou no nosso log" sem ninguém ter escrito log nenhum: o
 * erro de 2026-09-14 ao trocar o modelo só foi achado lendo o código. A mensagem logada é a da
 * exceção, que nestas rotas vem do Supabase ou da cifra; a chave do fornecedor nunca é lançada em
 * erro (`chamarFornecedorDeModeloDeLinguagem.ts`, regra 1).
 */
export function falhaDaRotaDoModelo(
  rota: string,
  erro: unknown,
  escrever: (linha: string) => void = (linha) => console.error(linha),
): FalhaDaApi {
  const falha = traduzirParaFalhaDaApi(erro);
  if (falha.codigo !== 'FALHA_INTERNA') return falha;
  const detalhe = erro instanceof Error ? `${erro.name}: ${erro.message}` : typeof erro;
  escrever(`[modelo-de-linguagem] rota=${rota} codigo=FALHA_INTERNA detalhe=${JSON.stringify(detalhe.slice(0, 500))}`);
  return new FalhaDaApi('FALHA_INTERNA', falha.status, MENSAGEM_DE_FALHA_INTERNA_DO_MODELO);
}
