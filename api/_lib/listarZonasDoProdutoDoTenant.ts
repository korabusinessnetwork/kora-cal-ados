// As zonas de um produto, lidas com `service_role` e com filtro de tenant EXPLÍCITO.
//
// POR QUE ESTE ARQUIVO EXISTE SE O FRONT JÁ LISTA ZONAS — a diferença mais fácil de
// esquecer do projeto inteiro, então ela fica escrita no topo do arquivo e não só num
// README. O par do editor (em `src/features/zonas/`, propositalmente não citado como
// import) consulta `product_zones` filtrando **só** por `product_id`, e o comentário dele
// declara o motivo: `product_id` é único no banco inteiro e pertence a um tenant só, então
// quem recusa o produto da marca concorrente é a RLS do Postgres.
//
// Aqui não existe RLS. `service_role` a bypassa (ver `api/README.md`), e a consulta que lá
// era segura **por causa do banco** aqui devolveria a zona de uma marca ao sistema de
// outra — sem erro, sem log, com o código parecendo correto na leitura. Por isso o filtro
// de `tenant_id` é escrito à mão, e por isso reusar o arquivo do front é proibido por
// varredura (`apiNaoImportaOFront.test.ts`), não por lembrança: proibir sai mais barato que
// lembrar.
//
// O retorno vai direto para `gerarVarianteDeCor` — é o mesmo motor do editor, e é o que
// mantém "cor no editor = cor na API" (princípio nº1 do CLAUDE.md).

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Só o que o motor consome (`Zona` de `src/lib/render/gerarVarianteDeCor.ts`).
 *
 * POR QUE NÃO TRAZ `id`, `label` NEM `cor_default`: o motor não lê nenhuma das três, e
 * `docs/07_APIS/endpoints.md` não expõe nenhuma delas na resposta — `cor_default` é dado de
 * editor, e a pré-checagem de `zone_key` do handler precisa da `zone_key`, que já está
 * aqui. Coluna a mais numa consulta sob `service_role` é superfície a mais: é dado do
 * tenant carregado para dentro de um processo onde nada mais o filtra, e o dia em que
 * alguém ecoar o objeto num erro ou num log, ele sai junto. Campo se acrescenta quando um
 * consumidor o exigir, com o consumidor junto.
 */
export interface ZonaDoProdutoDoTenant {
  readonly zone_key: string;
  readonly svg_selector: string;
}

/** Campos explícitos: `select *` é proibido (CLAUDE.md) e traria coluna nova sem revisão. */
const CAMPOS = 'zone_key, svg_selector';

/**
 * As zonas marcadas do produto, na ordem de criação.
 *
 * Devolve `[]` quando o produto não tem zona nenhuma — é uma afirmação verdadeira, e quem
 * decide o que fazer com ela (recusar o pedido, responder o SVG base) é o handler. Erro do
 * banco **sobe**, nunca vira `[]`: lista vazia por falha faria a API afirmar "este produto
 * não tem zona marcada" sobre um produto inteiro mapeado.
 */
export async function listarZonasDoProdutoDoTenant(
  cliente: SupabaseClient,
  productId: string,
  tenantId: string,
): Promise<ZonaDoProdutoDoTenant[]> {
  // Falha antes da rede: `eq('tenant_id', '')` não é uma consulta sem filtro, mas também
  // não é a consulta pretendida, e o resultado vazio dela seria lido como "produto sem
  // zona". Chamada malformada não pode se disfarçar de resposta legítima.
  if (!tenantId.trim()) throw new Error('Não dá para listar zonas sem o tenant da chave de API.');
  if (!productId.trim()) throw new Error('Não dá para listar zonas sem o id do produto.');

  const { data, error } = await cliente
    .from('product_zones')
    .select(CAMPOS)
    .eq('product_id', productId)
    // O SEGUNDO FILTRO É O ISOLAMENTO INTEIRO. `product_zones` tem `tenant_id` próprio
    // (desnormalizado no schema justamente para filtrar direto). Sem esta linha, uma
    // chave da marca A somada a um `product_id` da marca B devolve as zonas da marca B, e
    // o `carregarProdutoDoTenant` que já recusou o produto não protege esta consulta —
    // são duas consultas independentes.
    .eq('tenant_id', tenantId)
    // Não é enfeite. Sem `order`, o Postgres não promete ordem nenhuma: a mesma consulta
    // pode voltar em ordens diferentes entre duas chamadas idênticas. `created_at` é a
    // única ordenação estável que o schema oferece (não há coluna de posição), e é a mesma
    // que o editor usa — editor e API veem a lista de zonas na MESMA ordem, que é o
    // princípio nº1 aplicado a algo que ninguém olha até divergir.
    //
    // O que a ordem decide hoje, verificado em `gerarVarianteDeCor`: duas zonas que
    // dividem um elemento fazem o motor RECUSAR o pedido (`ZONAS_SOBREPOSTAS`) em vez de
    // deixar uma cor vencer, e quando ele monta essa mensagem nomeia as duas zonas. Ordem
    // instável = mensagem de erro e lista de zonas existentes (a do 422 de `zone_key`
    // desconhecida) mudando entre chamadas idênticas — o defeito mais caro de reproduzir
    // que existe. Um `order` custa uma linha; recuperar determinismo perdido, não.
    .order('created_at', { ascending: true });

  // Erro cru, de propósito, e sem virar `FalhaDaApi` aqui: `traduzirParaFalhaDaApi` é o
  // dono único da tabela código → status, e traduzir neste arquivo seria a segunda cópia
  // dela. Ele já garante que nada da mensagem do Postgres chega ao cliente (o 500 tem
  // mensagem fixa); o erro original preservado é o que sobra para o nosso log.
  if (error) throw error;

  return (data ?? []) as ZonaDoProdutoDoTenant[];
}
