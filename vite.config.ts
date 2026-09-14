// Config única do Vite + Vitest. Uma só porque o vitest lê `vite.config.ts` por padrão,
// dois arquivos divergiriam em silêncio.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // `?raw` do Vite traz o SVG como string, o motor recebe texto, nunca um <img>.
  server: { port: 5173 },

  // O aviso de chunk grande do Vite fica logo ACIMA do chunk do three.js, e não no padrão de 500 kB.
  // Com o padrão, todo build imprimia o aviso por causa do three.js (619,51 kB no R7), que é tardio
  // de propósito e só baixa quem abre o palco. Aviso que aparece sempre é aviso que ninguém lê: um
  // chunk NOVO acima de 500 kB, como o cliente de banco voltando ao chunk principal (R6-A52), sairia
  // com a mesma frase de todo dia. Com o limite aqui, o build sai calado, e qualquer chunk que passe
  // de 640 kB volta a avisar, o do three.js inclusive se ele crescer 20 kB (R8-A61).
  build: { chunkSizeWarningLimit: 640 },

  test: {
    // As worktrees das frentes paralelas moram em `.claude/worktrees/` (uma cópia inteira do
    // repositório por frente). Sem esta exclusão, `npm test` coleta os testes DELAS junto com os
    // daqui, e uma guarda antiga da cópia reprova o código novo daqui, que é um vermelho que não
    // significa nada. Elas rodam o próprio `npm test` dentro da própria worktree.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/worktrees/**'],
    // Node não tem DOMParser: registra o jsdom como DOM do motor antes de qualquer teste.
    // No navegador nada disso carrega (ver src/lib/render/dom.ts).
    setupFiles: ['./src/lib/render/domNode.ts'],
  },
});
