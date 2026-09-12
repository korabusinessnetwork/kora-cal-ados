// `POST /api/v1/products/:productId/variants` — o handler HTTP. ORQUESTRA e NÃO DECIDE.
//
// Toda decisão (status, mensagem, formato da resposta, o que é chave válida, o que é corpo
// válido) mora em `api/_lib/`, onde cada uma tem teste próprio. Se este arquivo crescer, é
// sinal de que uma regra escapou para o único lugar do fluxo sem teste dedicado — e o
// conserto é mover a regra para `_lib/`, não escrever mais um `if` aqui.
//
// A ASSINATURA É Web Handler (`export default { fetch }`), e não `(req, res)`: é a forma
// documentada da Vercel para função Node fora de framework, e é ela que faz TODO método
// entrar no nosso código (com export por método, quem responderia a um `GET` seria a Vercel,
// com o corpo dela, fora do nosso envelope). O porquê completo está em `api/README.md`.
//
// A ORDEM DOS PASSOS É PROPRIEDADE DE SEGURANÇA, NÃO ESTILO. Ela é, nesta sequência:
//   1. método   2. autenticação   3. produto do tenant   4. ?format=   5. corpo
//   6. zonas do produto   7. pré-checagem das zone_key   8. asset-base   9. motor
//
// Os passos 4 e 5 vêm DEPOIS de 2 e 3 de propósito. Cada recusa nossa é informação: um 400
// de `?format=png` e um 400 de corpo malformado provam que a requisição chegou a ser
// processada, e um 404 de produto prova que a chave era válida. Respondendo-os antes da
// autenticação, qualquer um sem chave nenhuma diferenciaria mensagens e usaria isso para
// mapear a API; respondendo-os antes da checagem de produto, uma marca com chave própria
// diferenciaria respostas sobre o `product_id` da concorrente. Só quem já provou ter chave
// válida NAQUELE produto recebe mensagem de erro diferenciada. Por isso a ordem não pode ser
// "arrumada" depois por parecer mais natural validar a query string primeiro: validar cedo é
// bom para carga, e péssimo para vazamento de informação entre marcas concorrentes.

// EFEITO COLATERAL, E TEM DE SER O PRIMEIRO IMPORT: registra o jsdom como DOM do motor.
// Sem esta linha `analisarSvg` não tem adaptador e TODA requisição vira 500 — e isso não
// aparece em `tsc --noEmit` nem nos testes de `_lib/` (o vitest registra o adaptador por
// `setupFiles`); aparece só em runtime, na primeira chamada de cliente. `_variants.test.ts`
// tem uma guarda que lê este fonte e exige o import, com o caminho conferido em disco.
import '../../../../src/lib/render/domNode';

import type { SupabaseClient } from '@supabase/supabase-js';
import { autenticarChaveDeApi } from '../../../_lib/autenticarChaveDeApi';
import { baixarAssetBaseComServiceRole } from '../../../_lib/baixarAssetBaseComServiceRole';
import { carregarProdutoDoTenant } from '../../../_lib/carregarProdutoDoTenant';
import { criarClienteDeServico } from '../../../_lib/clienteDeServico';
import { lerCoresPedidas } from '../../../_lib/lerCoresPedidas';
import { lerCorpoDoPedido } from '../../../_lib/lerCorpoDoPedido';
import {
  listarZonasDoProdutoDoTenant,
  type ZonaDoProdutoDoTenant,
} from '../../../_lib/listarZonasDoProdutoDoTenant';
import { logDaRequisicao } from '../../../_lib/logDaRequisicao';
import { registrarUsoDaChave } from '../../../_lib/registrarUsoDaChave';
import { respostaDeErro, respostaDeSucesso } from '../../../_lib/respostaDaApi';
import type { CodigoDeRespostaDaApi } from '../../../_lib/tiposDaApi';
import {
  criarFalhaDeTransporte,
  criarFalhaDeZonaDesconhecida,
  traduzirParaFalhaDaApi,
} from '../../../_lib/traduzirParaFalhaDaApi';
import { gerarVarianteDeCor } from '../../../../src/lib/render/gerarVarianteDeCor';

/**
 * O handler.
 *
 * O segundo parâmetro existe para o TESTE injetar um `SupabaseClient` falso. Ele é opcional
 * e a Vercel chama `fetch(request)` com um argumento só, então a assinatura Web continua
 * exatamente a que `api/README.md` documenta. Foi preferido a um módulo com estado
 * (`definirCliente(...)`) porque estado de módulo sobrevive entre invocações no processo
 * reaproveitado do serverless — que é justamente o que `clienteDeServico.ts` existe para
 * evitar, já que duas invocações seguidas são, por hipótese, de tenants concorrentes.
 *
 * Note que ele NÃO é um parâmetro com valor padrão (`= criarClienteDeServico()`): valor
 * padrão é avaliado ANTES do corpo da função, então o `throw` de ambiente incompleto
 * escaparia do `try` abaixo e a resposta sairia sem envelope. Construído dentro do `try`,
 * ambiente incompleto é 500 `FALHA_INTERNA` com envelope, como manda o contrato.
 */
export default {
  async fetch(pedido: Request, clienteInjetado?: SupabaseClient): Promise<Response> {
    const comecouEm = Date.now();
    const rota = caminhoDaRota(pedido.url);

    // Capturados fora do `try` porque o `finally` precisa deles nos dois caminhos. O status
    // nasce 500: se algum dia o `catch` falhar, a linha de log conta a verdade em vez de
    // registrar um 200 que não aconteceu.
    let status = 500;
    let codigoDeErro: CodigoDeRespostaDaApi | null = null;
    let prefixoDaChave: string | null = null;

    try {
      // 1. Antes de QUALQUER trabalho — inclusive antes de construir cliente de banco.
      if (pedido.method !== 'POST') throw criarFalhaDeTransporte('METODO_NAO_PERMITIDO');

      const cliente = clienteInjetado ?? criarClienteDeServico();

      // 2. Nada acontece antes de existir um tenant: daqui para a frente as consultas rodam
      //    com `service_role` e a RLS não recusa mais nada.
      const chave = await autenticarChaveDeApi(cliente, pedido);
      prefixoDaChave = chave.prefixo;

      // Fire-and-forget, SEM `await` (`registrarUsoDaChave.ts`). Chamada aqui, e não no
      // sucesso: a chave FOI usada mesmo que o pedido termine em 404 ou 400, e `last_used_at`
      // que só avança em requisições bem-sucedidas esconderia exatamente o caso que o suporte
      // precisa ver — chave viva sendo martelada com pedidos errados.
      registrarUsoDaChave(cliente, chave.idDaChave);

      // 3. Fecha a porta da concorrente ANTES de o corpo importar.
      const produto = await carregarProdutoDoTenant(
        cliente,
        lerProductIdDaUrl(pedido.url),
        chave.tenantId,
      );

      // 4 e 5.
      exigirFormatoSuportado(pedido.url);
      const cores = lerCoresPedidas(await lerCorpoDoPedido(pedido));

      // 6 e 7.
      const zonas = await listarZonasDoProdutoDoTenant(cliente, produto.id, chave.tenantId);
      exigirZonasConhecidas(cores, zonas);

      // 8 e 9.
      const svgCanonico = await baixarAssetBaseComServiceRole(cliente, produto.base_asset_path);
      const resposta = respostaDeSucesso(gerarVarianteDeCor(svgCanonico, zonas, cores));

      status = resposta.status;
      return resposta;
    } catch (erro: unknown) {
      const falha = traduzirParaFalhaDaApi(erro);

      // O RASTRO DO 500. `logDaRequisicao` não tem campo para mensagem de exceção (decisão de
      // segurança dele) e `traduzirParaFalhaDaApi` troca a mensagem original por uma fixa —
      // então, sem esta linha, o detalhe de um 500 some para sempre e o defeito vira
      // impossível de investigar. Só no 5xx: nos 4xx a mensagem já está na resposta.
      if (falha.status >= 500) console.error(rastroDoErro(rota, erro));

      status = falha.status;
      codigoDeErro = falha.codigo;
      return respostaDeErro(falha);
    } finally {
      // UMA linha por requisição, sempre — inclusive nos caminhos de erro. No `finally`
      // porque `return` dentro de `try`/`catch` passa por aqui antes de devolver, e porque
      // duas chamadas (uma em cada ramo) viram duas linhas no dia em que alguém acrescentar
      // um terceiro ramo e esquecer a segunda.
      logDaRequisicao({
        metodo: pedido.method,
        rota,
        status,
        duracaoMs: Date.now() - comecouEm,
        prefixoDaChave,
        codigoDeErro,
      });
    }
  },
};

/**
 * `Request.url` é absoluta por especificação, mas um `Request` montado à mão em teste pode
 * não ser — e uma exceção de parse aqui viraria 500 num caminho que nem chegou a começar.
 * Mesma base de reserva de `autenticarChaveDeApi.recusarCredencialNaQueryString`.
 */
const BASE_DE_RESERVA = 'https://placeholder.invalid';

/** Só o caminho: `logDaRequisicao` já descarta query, e a chave em query é 401 antes disto. */
function caminhoDaRota(url: string): string {
  try {
    return new URL(url, BASE_DE_RESERVA).pathname;
  } catch {
    return '';
  }
}

/**
 * De onde vem o `productId`: do CAMINHO da própria requisição.
 *
 * A Vercel roteia por sistema de arquivos — `api/v1/products/[productId]/variants.ts` **é**
 * a rota —, mas o Web Handler recebe só o `Request`: não existe um objeto de parâmetros de
 * rota para ler. Derivar do caminho é a leitura que não precisa de tabela de rotas em lugar
 * nenhum, e é por isso que o servidor local (`api/_local/`) concorda com a Vercel de graça:
 * os dois entregam a mesma URL, e a mesma função a lê. Uma tabela de rotas seria a segunda
 * fonte de verdade sobre onde a rota mora — o mesmo motivo de não existir `vercel.json`.
 *
 * Caminho inesperado, id vazio, barra final e `%` malformado devolvem `''`, que
 * `carregarProdutoDoTenant` recusa como 404 `PRODUTO_NAO_ENCONTRADO`. É de propósito que
 * não exista um código próprio para "URL estranha": a resposta fica byte a byte idêntica à
 * de um produto inexistente e à de um produto de outra marca, e URL malformada deixa de ser
 * um sinal distinguível de qualquer outra coisa.
 */
function lerProductIdDaUrl(url: string): string {
  const segmentos = caminhoDaRota(url)
    .split('/')
    .filter((segmento) => segmento !== '');

  // Confere a moldura inteira (`products/<id>/variants`) e não só a posição: um caminho que
  // não seja esta rota não pode entregar um id por acidente de contagem de barras.
  const ultimo = segmentos.length - 1;
  if (segmentos[ultimo] !== 'variants' || segmentos[ultimo - 2] !== 'products') return '';

  try {
    return decodeURIComponent(segmentos[ultimo - 1] ?? '').trim();
  } catch {
    return '';
  }
}

/** Ausente = svg. Qualquer outro valor é recusa explícita, nunca parâmetro ignorado. */
function exigirFormatoSuportado(url: string): void {
  const formato = new URL(url, BASE_DE_RESERVA).searchParams.get('format');
  if (formato === null || formato === 'svg') return;

  // O valor é ecoado porque é o que torna a mensagem acionável, e cortado porque quem chama
  // controla o tamanho dele — uma query string de um megabyte não vira uma resposta de um
  // megabyte. O JSON do envelope já escapa o conteúdo.
  const mostrado = formato.length > 40 ? `${formato.slice(0, 40)}…` : formato;
  throw criarFalhaDeTransporte(
    'FORMATO_NAO_SUPORTADO',
    `Formato "${mostrado}" não é suportado. Use format=svg.`,
  );
}

/**
 * A PRÉ-CHECAGEM que desambigua `ZONA_NAO_ENCONTRADA` (`docs/07_APIS/endpoints.md`).
 *
 * Feita aqui, com a lista de zonas do produto na mão, "pediu zona que este produto não tem"
 * é 422 e a mensagem nomeia as zonas que existem — a informação acionável. Depois dela, a
 * única forma de o MOTOR lançar o mesmo código é `svg_selector` gravado quebrado, que é dado
 * do tenant e sai como 409 pela tabela de `traduzirParaFalhaDaApi` (que devolve esta falha
 * intacta ao recebê-la, em vez de retraduzi-la para 409).
 *
 * O status NÃO é escrito aqui. `criarFalhaDeZonaDesconhecida` mora em
 * `api/_lib/traduzirParaFalhaDaApi.ts`, ao lado das duas tabelas, porque este é o par
 * código/status mais fácil de contradizer do projeto: o MESMO código vale 422 vindo daqui e
 * 409 vindo do motor. Com os dois no mesmo arquivo, quem mexer num vê o outro. O handler
 * contribui com a única parte que é dele — a mensagem, que nomeia as zonas que o produto tem.
 */
function exigirZonasConhecidas(
  cores: Record<string, string>,
  zonas: readonly ZonaDoProdutoDoTenant[],
): void {
  const existentes = zonas.map((zona) => zona.zone_key);
  const desconhecidas = Object.keys(cores).filter((pedida) => !existentes.includes(pedida));
  if (desconhecidas.length === 0) return;

  const quais =
    desconhecidas.length === 1
      ? `A zona ${entreAspas(desconhecidas)} não existe neste produto.`
      : `As zonas ${entreAspas(desconhecidas)} não existem neste produto.`;

  const disponiveis =
    existentes.length === 0
      ? 'Este produto ainda não tem nenhuma zona marcada no editor de zonas da marca.'
      : `Zonas deste produto: ${entreAspas(existentes)}.`;

  throw criarFalhaDeZonaDesconhecida(`${quais} ${disponiveis}`);
}

function entreAspas(valores: readonly string[]): string {
  return valores.map((valor) => `"${valor}"`).join(', ');
}

/** `kora_live_…` em texto que vai para o log; e `Bearer …`, e o SHA-256 da coluna `hash`. */
const SEGREDOS_EM_TEXTO: ReadonlyArray<readonly [RegExp, string]> = [
  [/kora_(live|test)_[A-Za-z0-9_-]+/g, 'kora_$1_[REDIGIDO]'],
  [/Bearer[ \t]+\S+/gi, 'Bearer [REDIGIDO]'],
  [/\b[0-9a-f]{64}\b/g, '[REDIGIDO]'],
];

/**
 * O texto do 500 para o `console.error`. Redigido porque o objeto de erro pode conter
 * QUALQUER coisa: supabase-js e `fetch` incluem headers da requisição em algumas falhas, e
 * `Authorization` estaria ali dentro. Log é arquivo que muita gente lê e que fica guardado
 * por meses (mesmo argumento de `logDaRequisicao.ts`), então o segredo não pode nem passar
 * por aqui em texto puro.
 */
function rastroDoErro(rota: string, erro: unknown): string {
  let bruto: string;
  try {
    bruto =
      erro instanceof Error
        ? `${erro.name}: ${erro.message}\n${erro.stack ?? ''}`
        : `valor lançado que não é Error: ${String(erro)}`;
  } catch {
    // `String(...)` lança para Symbol e para objeto com `toString` quebrado — e perder o log
    // inteiro por causa disso deixaria o 500 sem rastro nenhum, que é o que isto evita.
    bruto = 'erro não legível como texto';
  }

  const redigido = SEGREDOS_EM_TEXTO.reduce(
    (texto, [padrao, troca]) => texto.replace(padrao, troca),
    bruto,
  );

  // Prefixo fixo para `grep falha_interna` achar todos os rastros; a linha de
  // `logDaRequisicao` da mesma requisição traz o prefixo da chave e a duração.
  return `falha_interna rota=${rota} ${redigido}`;
}
