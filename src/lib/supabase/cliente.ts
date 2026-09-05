// O único cliente Supabase do front. Um só, criado sob demanda.
//
// Por que não criar um por componente: cada `createClient` monta seu próprio listener de
// auth e sua própria cópia da sessão. Dois clientes divergem no momento do refresh do
// token — um acha que está logado, o outro não — e o sintoma aparece como "sumiu meu
// login ao trocar de tela", que é caríssimo de diagnosticar.
//
// Sempre a chave anon. A service_role ignora RLS e nunca entra no bundle (ver
// `configuracaoDoSupabase.ts`, que recusa explicitamente).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { lerConfiguracaoDoSupabase } from './configuracaoDoSupabase';

let instancia: SupabaseClient | null = null;

/**
 * Devolve o cliente, criando na primeira chamada.
 * Lança `ConfiguracaoAusente` se o `.env.local` não estiver preenchido — quem chama
 * decide como mostrar isso (o app mostra uma tela, não um console.error).
 */
export function clienteSupabase(): SupabaseClient {
  if (!instancia) {
    const { url, anonKey } = lerConfiguracaoDoSupabase();
    instancia = createClient(url, anonKey, {
      auth: {
        // Sessão sobrevive ao F5: o time marca zona por vários minutos e recarregar a
        // página não pode custar um login novo.
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return instancia;
}
