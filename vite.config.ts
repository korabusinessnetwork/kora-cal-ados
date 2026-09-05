// Config única do Vite + Vitest. Uma só porque o vitest lê `vite.config.ts` por padrão —
// dois arquivos divergiriam em silêncio.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // `?raw` do Vite traz o SVG como string — o motor recebe texto, nunca um <img>.
  server: { port: 5173 },

  test: {
    // Node não tem DOMParser: registra o jsdom como DOM do motor antes de qualquer teste.
    // No navegador nada disso carrega (ver src/lib/render/dom.ts).
    setupFiles: ['./src/lib/render/domNode.ts'],
  },
});
