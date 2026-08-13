// Cliente Supabase do navegador. Único no app inteiro — dois clientes significam duas
// sessões e bugs de auth que só aparecem em produção.
//
// Só a chave ANÔNIMA entra aqui. A service_role ignora RLS por completo e vive apenas em
// scripts/ e (na rodada 3) em função serverless — nunca em código que vira bundle.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chaveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !chaveAnonima) {
  throw new Error(
    'Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY. Copie .env.example para .env.local e preencha.',
  );
}

export const supabase = createClient(url, chaveAnonima);
