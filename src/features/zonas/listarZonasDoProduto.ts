// As zonas já marcadas de um produto. É o que o editor precisa saber antes de deixar
// alguém marcar mais uma: sem esta lista, marcar "sola" de novo viraria uma segunda
// linha e esbarraria em `unique (product_id, zone_key)` só na hora de gravar.
//
// Sem filtro por tenant aqui, ao contrário de `listarProdutos`: `product_id` já é único
// no banco inteiro e pertence a um tenant só, então filtrar pelo produto já é filtrar
// pelo tenant. A RLS continua sendo quem recusa o produto de outra marca.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZonaDoProduto } from './tiposDeZona';

/** Campos explícitos: `select *` é proibido (CLAUDE.md) e vazaria coluna nova sem revisão. */
const CAMPOS = 'id, product_id, tenant_id, zone_key, svg_selector, label, cor_default';

export async function listarZonasDoProduto(
  cliente: SupabaseClient,
  productId: string,
): Promise<ZonaDoProduto[]> {
  if (!productId.trim()) {
    // Falha antes da rede: `eq('product_id', '')` volta lista vazia, e lista vazia aqui
    // significa "este produto não tem zona" — uma afirmação, não um engano de chamada.
    throw new Error('Não dá para listar zonas sem o id do produto.');
  }

  const { data, error } = await cliente
    .from('product_zones')
    .select(CAMPOS)
    .eq('product_id', productId)
    // Não existe coluna de ordem no schema; `created_at` é a única ordenação estável que
    // ele oferece. Sem `order`, o Postgres não promete ordem nenhuma e a lista de zonas
    // embaralha a cada carga — quem marca zona clica por memória de posição.
    .order('created_at', { ascending: true });

  // Erro sobe: devolver `[]` aqui seria a tela dizer "nenhuma zona marcada" sobre um
  // produto inteiro mapeado, e a pessoa remarcaria tudo por cima.
  if (error) throw error;

  return (data ?? []) as ZonaDoProduto[];
}
