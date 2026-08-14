// Leitura do asset-base. Espelho de `uploadDeAssetBase.ts`: lá o caminho canônico é
// escrito, aqui ele é validado e trocado por uma URL assinada de curta duração.
//
// Duas escolhas que parecem detalhe de implementação e não são:
//
// 1. O cliente Supabase chega por PARÂMETRO, nunca por import de `lib/supabase/cliente`.
//    Aquele módulo é anon-key e dá throw no carregamento sem as VITE_*; a função
//    serverless da rodada 3 roda em Node com service_role e não consegue importá-lo. Se
//    este arquivo importasse o singleton, a rodada 3 escreveria a própria leitura — e a
//    validade da URL e a validação de caminho passariam a divergir entre editor e API. É
//    exatamente a divergência que o princípio nº1 do CLAUDE.md proíbe, só que na camada
//    de leitura em vez da de cor.
//
// 2. O caminho vem do banco (`products.base_asset_path`) e é VALIDADO, nunca remontado.
//    Remontar criaria uma segunda fonte de verdade capaz de discordar da primeira em
//    silêncio. Validar é o que fecha o buraco de `base_asset_path` ser `text` livre, sem
//    check no banco ligando o caminho ao `tenant_id` da própria linha: hoje quem segura
//    esse vínculo é só a policy de Storage — e a rodada 3 vai ler com service_role, que
//    ignora RLS. Sem esta validação, aquela leitura cruzaria marcas concorrentes.

// Importado do módulo folha, e não de `uploadDeAssetBase`, porque aquele arquivo importa o
// cliente do navegador: a aresta transitiva tornaria este módulo impossível de carregar em
// Node — que é justamente o ambiente que ele existe para atender.
import { BUCKET_DE_ASSETS } from './bucketDeAssets';

/** Decidido em 2026-08-12 (`memory/decisions.md`): a URL assinada vive 5 minutos. */
export const VALIDADE_DA_URL_EM_SEGUNDOS = 300;

/** Caminho canônico: `tenants/{tenant_id}/products/{product_id}/base.svg`. */
const SEGMENTOS_DO_CAMINHO = 5;
const RAIZ_DE_TENANTS = 'tenants';
const PASTA_DE_PRODUTOS = 'products';

/**
 * Forma exigida de cada segmento. Não é preciosismo: sem isso, `%2e%2e%2f` passa — não tem
 * `..` literal, não tem barra, e o caminho segue cru para `createSignedUrl`, que o costura
 * numa URL. Se qualquer camada do caminho HTTP decodificar aquilo, a assinatura sai da
 * pasta do tenant. O whitelist mata de uma vez `%`, barra codificada, espaço, `?`, `#` e
 * `\`, e absorve a checagem de segmento vazio (string vazia não casa `+`).
 */
const SEGMENTO_VALIDO = /^[A-Za-z0-9._-]+$/;

/**
 * O mínimo que este módulo precisa de um cliente Supabase. Declarado aqui, e não importado,
 * para que tanto o cliente anônimo do editor quanto o de service_role da função serverless
 * satisfaçam o contrato sem que este arquivo conheça nenhum dos dois.
 */
export interface ClienteDeStorage {
  storage: {
    from(bucket: string): {
      createSignedUrl(
        caminho: string,
        validadeEmSegundos: number,
      ): Promise<{
        data: { signedUrl: string } | null;
        error: { message: string } | null;
      }>;
    };
  };
}

/**
 * Confere que o caminho gravado pertence mesmo ao tenant do chamador.
 * Lança com mensagem pronta para a tela — recusar é o comportamento correto: caminho fora
 * do padrão seria negado pela policy de Storage de qualquer forma, e pedir a URL antes
 * transformaria um erro explicável num "falhou" genérico.
 */
export function validarCaminhoDeAssetBase(caminho: string, tenantId: string): void {
  // Guardas separadas de propósito: no navegador o hook barra tenant ausente antes de
  // chegar aqui, mas a função serverless da rodada 3 não tem esse guarda — e mandar quem
  // perdeu a sessão investigar o produto é o tipo de mensagem que custa uma hora de
  // suporte.
  if (!caminho) {
    throw new Error('Este modelo está sem arquivo base e não pode ser aberto.');
  }

  if (!tenantId) {
    throw new Error('Não foi possível identificar a marca desta conta. Entre de novo.');
  }

  // `..` nunca aparece no caminho canônico; se apareceu, é tentativa de sair da pasta.
  if (caminho.includes('..')) {
    throw new Error('O caminho do arquivo deste modelo está fora do padrão e não pode ser aberto.');
  }

  const segmentos = caminho.split('/');

  const foraDoPadrao =
    segmentos.length !== SEGMENTOS_DO_CAMINHO ||
    segmentos[0] !== RAIZ_DE_TENANTS ||
    segmentos[2] !== PASTA_DE_PRODUTOS ||
    segmentos.some((segmento) => !SEGMENTO_VALIDO.test(segmento));

  if (foraDoPadrao) {
    throw new Error('O caminho do arquivo deste modelo está fora do padrão e não pode ser aberto.');
  }

  if (segmentos[1] !== tenantId) {
    throw new Error('Este arquivo pertence a outra marca e não pode ser aberto por esta conta.');
  }
}

/**
 * Devolve a URL assinada do SVG canônico do produto.
 * O erro do Storage não é repassado ao usuário nem registrado: pode carregar caminho de
 * outro tenant, e log com dado de tenant alheio é vazamento (`docs/11_SEGURANCA/`).
 */
export async function obterUrlDoAssetBase(
  cliente: ClienteDeStorage,
  caminho: string,
  tenantId: string,
): Promise<string> {
  validarCaminhoDeAssetBase(caminho, tenantId);

  const { data, error } = await cliente.storage
    .from(BUCKET_DE_ASSETS)
    .createSignedUrl(caminho, VALIDADE_DA_URL_EM_SEGUNDOS);

  if (error || !data) {
    throw new Error('Não foi possível abrir o arquivo deste modelo. Tente de novo.');
  }

  return data.signedUrl;
}
