// Os produtos de um tenant. É a primeira tela depois do login.
//
// `tenant_id` explícito mesmo com RLS: a policy já limita o resultado aos tenants do
// usuário, mas quem pertence a DUAS marcas veria as duas listas misturadas sem este
// filtro — e é exatamente esse usuário que a Etapa 2 passou a existir para servir.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface Produto {
  id: string;
  nome: string;
  /** Caminho no Storage, como foi GRAVADO. Nunca remontar a partir dos ids (ADR-005). */
  base_asset_path: string;
  created_at: string;
}

export async function listarProdutos(
  cliente: SupabaseClient,
  tenantId: string,
): Promise<Produto[]> {
  const { data, error } = await cliente
    .from('products')
    .select('id, nome, base_asset_path, created_at')
    .eq('tenant_id', tenantId)
    // Não existe coluna de ordem; `created_at` é a única ordenação estável que o schema
    // oferece hoje. Sem `order`, o Postgres não promete ordem nenhuma e a lista mudaria
    // de posição entre carregamentos.
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []) as Produto[];
}
