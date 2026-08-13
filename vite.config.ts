// Config do app. `jsdom` é marcado como externo do bundle do navegador: quem o importa é
// só src/lib/render/analisadorDeNode.ts, que existe para Node. Se algum import errado
// puxar jsdom para o front, o build quebra aqui em vez de inchar o bundle em silêncio.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: ['jsdom'],
    },
  },
});
