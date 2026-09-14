// Baixa o SVG canônico do bucket privado `assets-base`, direto, com a chave `service_role`.
//
// ESTE MÓDULO NÃO FILTRA TENANT NENHUM, e é a coisa mais importante a saber sobre ele. Ele
// baixa o objeto que o `path` recebido apontar, seja de que marca for, com `service_role`
// não há RLS de Storage no caminho (as policies do bucket, em
// `supabase/migrations/20260812_correcao_rls_e_storage.sql`, são concedidas a
// `authenticated`, não a esta chave). A única defesa que ele tem é o CHAMADOR já ter provado
// a posse do produto: o `path` tem de vir de uma linha de `products` lida com o `tenant_id`
// da chave de API (ADR-006 D3). Chamá-lo com um caminho vindo de qualquer outro lugar é
// entregar o asset de uma marca ao sistema da concorrente, e o código pareceria correto.
//
// SEM URL ASSINADA, e este é o refactor que o arquivo existe para impedir. Assinar é um
// segundo passo de rede que só faz sentido para entregar o arquivo a um NAVEGADOR, que não
// tem a chave, é por isso que `src/features/produtos/baixarAssetBase.ts` assina. Aqui quem
// baixa é a própria função, que já tem a chave: assinar criaria um link temporário para o
// asset de um cliente e o mandaria para fora do processo, sem ganho nenhum. O teste deste
// módulo lê este fonte e reprova se a assinatura voltar.

import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'assets-base';

/**
 * Devolve o texto do asset-base gravado em `products.base_asset_path`.
 *
 * O `path` é usado COMO VEIO. Este módulo não o monta a partir de `tenant_id`/`productId`:
 * o formato do caminho tem um dono só (`supabase/scripts/caminhoDoAssetBase.ts`, do lado que
 * escreve), e uma segunda montagem aqui seria a mesma convenção repetida em dois lugares,
 * no dia em que ela mudasse, a API baixaria o arquivo errado, possivelmente o de outro
 * produto, em vez de falhar.
 *
 * Erro do Storage, objeto ausente e arquivo vazio saem como `Error` comum, NÃO como
 * `FalhaDaApi`. Ver a nota no fim do arquivo.
 */
export async function baixarAssetBaseComServiceRole(
  cliente: SupabaseClient,
  baseAssetPath: string,
): Promise<string> {
  exigirCaminhoUsavel(baseAssetPath);

  const { data, error } = await cliente.storage.from(BUCKET).download(baseAssetPath);

  if (error) {
    const status = (error as { status?: number }).status;
    throw new Error(
      `Falha ao baixar o asset-base \`${baseAssetPath}\` do bucket \`${BUCKET}\`` +
        `${status === undefined ? '' : ` (status ${status})`}: ${error.message}`,
    );
  }

  // `data` nulo com `error` nulo acontece, e sem esta linha viraria um `TypeError` de
  // `.text` sobre `null`, exceção que não diz nada sobre o que falhou nem sobre qual
  // produto, no meio de uma pilha do supabase-js.
  if (!data || typeof data.text !== 'function') {
    throw new Error(
      `O Storage não devolveu conteúdo nem erro para o asset-base \`${baseAssetPath}\`.`,
    );
  }

  const conteudo = await data.text();

  // Arquivo de 0 byte tem tratamento próprio de propósito. Passado adiante, ele só falharia
  // dentro do motor, como `SVG_INVALIDO`, cuja mensagem manda a marca corrigir o arquivo
  // base "no editor de zonas", e o editor não sobe asset (o único lugar que escreve neste
  // bucket é `supabase/scripts/provisionarTenant.ts`). Além disso, 0 byte não é conteúdo
  // quebrado: é ESCRITA quebrada, mesma causa e mesmo conserto do objeto ausente, e este
  // é o único ponto do fluxo que sabe que o arquivo estava vazio; o motor só saberia dizer
  // "não é um SVG parseável".
  if (conteudo.trim() === '') {
    throw new Error(
      `O asset-base \`${baseAssetPath}\` está vazio no bucket \`${BUCKET}\`, porque a escrita do ` +
        `arquivo ficou pela metade. Reprovisione o produto.`,
    );
  }

  return conteudo;
}

/**
 * Recusa caminho impossível ANTES de pedir rede, mesmo vindo do banco.
 *
 * Não é verificação decorativa: `base_asset_path` é `text not null` sem CHECK nenhum
 * (`supabase/migrations/20260812_schema_inicial.sql`), então `''` e qualquer string cabem na
 * coluna; e, sob `service_role`, a policy do bucket que confere `storage.foldername(name)[2]`
 * contra o tenant não é consultada. No navegador ela é uma segunda barreira; aqui não há
 * segunda barreira, e esta é a última vez que alguém olha o valor antes do download.
 *
 * Recusa só o que não depende da convenção de caminho: em branco, segmento `..` e barra
 * inicial. Exigir prefixo `tenants/` seria remontar a convenção aqui, o defeito que o
 * cabeçalho deste arquivo existe para evitar.
 */
function exigirCaminhoUsavel(baseAssetPath: string): void {
  if (typeof baseAssetPath !== 'string' || baseAssetPath.trim() === '') {
    throw new Error('Produto sem `base_asset_path` gravado: não há asset-base para baixar.');
  }

  if (baseAssetPath.startsWith('/')) {
    throw new Error(
      `\`base_asset_path\` começa com "/" (\`${baseAssetPath}\`): caminho no Storage é relativo ` +
        `à raiz do bucket, e a barra inicial aponta para outro objeto.`,
    );
  }

  if (baseAssetPath.split('/').includes('..')) {
    throw new Error(
      `\`base_asset_path\` contém um segmento ".." (\`${baseAssetPath}\`): um caminho que sobe ` +
        `de pasta sairia de \`tenants/<tenant_id>/\` e alcançaria o asset de outra marca.`,
    );
  }
}

// POR QUE NENHUMA DESTAS FALHAS VIRA `FalhaDaApi` AQUI.
//
// O integrador pediu um produto que existe e cujo `base_asset_path` está gravado: culpa dele
// não é. Pela tabela de `docs/07_APIS/endpoints.md` sobram duas famílias, "dado do tenant"
// (409) e "nossa" (500), e hoje só a segunda é verdade: a mensagem que acompanha todo 409
// manda corrigir o arquivo base "no editor de zonas da marca", e o editor não tem por onde
// subir asset. Um 409 mandaria a marca para uma tela sem botão, e `criarFalhaDeTransporte`
// nem tem membro 409; inventar um seria a segunda cópia da tabela que
// `traduzirParaFalhaDaApi` existe para impedir. Revisitar quando o editor ganhar upload de
// asset-base: aí o objeto ausente vira consertável pela marca, e vira 409.
//
// Sobrando o 500, não traduzir é melhor que traduzir: `traduzirParaFalhaDaApi` já transforma
// qualquer `Error` desconhecido em `FALHA_INTERNA` 500 com MENSAGEM FIXA. As mensagens acima
// nomeiam o `path`, e o `path` contém o `tenant_id`, aceitável para quem depura, inaceitável
// na resposta que vai para o sistema de outra marca. Deixando a tradução com o dono dela, o
// `tenant_id` não tem por onde vazar; `criarFalhaDeTransporte('FALHA_INTERNA', comOPath)`
// colocaria o caminho de um cliente dentro do envelope JSON de outro.
