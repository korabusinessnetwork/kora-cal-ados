// A que tenants o usuário logado pertence, e com que papel.
//
// É a consulta que decide TUDO o que o app pode mostrar: sem tenant ativo, nenhuma tela
// protegida renderiza. Por isso ela vive separada do contexto — dá para testar a forma do
// dado sem montar React.
//
// Campos explícitos, nunca `select *`: `tenants` carrega tema (white-label) e plano, e o
// front não tem por que baixar coluna que não usa (regra de segurança do CLAUDE.md).

import type { SupabaseClient } from '@supabase/supabase-js';

/** Um tenant do ponto de vista de quem entrou: identidade + o papel dele lá dentro. */
export interface TenantDoUsuario {
  id: string;
  nome: string;
  slug: string;
  /** `tema` do banco: cor_primaria, logo_url etc. É daqui que sai a identidade visual. */
  tema: Record<string, unknown>;
  papel: 'owner' | 'membro';
}

interface LinhaDeVinculo {
  papel: string;
  tenants: { id: string; nome: string; slug: string; tema: unknown } | null;
}

/**
 * Tenants do usuário, em ordem alfabética estável.
 *
 * A RLS já restringe o resultado aos vínculos dele; o `eq('user_id')` está aqui para o
 * caso importar não depender só da policy — defesa em profundidade, e deixa a intenção
 * legível para quem revisa.
 */
export async function carregarTenantsDoUsuario(
  cliente: SupabaseClient,
  userId: string,
): Promise<TenantDoUsuario[]> {
  const { data, error } = await cliente
    .from('tenant_members')
    .select('papel, tenants!inner(id, nome, slug, tema)')
    .eq('user_id', userId);

  if (error) throw error;

  return ((data ?? []) as unknown as LinhaDeVinculo[])
    .flatMap((linha) => {
      // Vínculo sem tenant não deveria existir (FK com on delete cascade). Se existir,
      // pular é melhor que quebrar a tela inteira por causa de uma linha órfã.
      if (!linha.tenants) return [];

      return [
        {
          id: linha.tenants.id,
          nome: linha.tenants.nome,
          slug: linha.tenants.slug,
          tema: (linha.tenants.tema ?? {}) as Record<string, unknown>,
          papel: linha.papel === 'owner' ? ('owner' as const) : ('membro' as const),
        },
      ];
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
