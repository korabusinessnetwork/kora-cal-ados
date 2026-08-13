// Config de teste. Duas coisas que o vitest não faz sozinho e o projeto precisa:
//
// 1. `env: loadEnv(...)` com prefixo vazio joga TODAS as variáveis de .env.local em
//    process.env — inclusive as sem prefixo VITE_. Sem isso o teste de isolamento
//    (supabase/tests/) PULA em `npm test`, e teste que pula silenciosamente é pior que
//    teste que falha: dá a impressão de suíte verde sem provar isolamento nenhum.
// 2. `setupFiles` registra o analisador de SVG de Node — em ambiente de teste não existe
//    DOMParser nativo (ver src/lib/render/parsearSvg.ts).

import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, process.cwd(), ''),
    setupFiles: ['./vitest.setup.ts'],
  },
}));
