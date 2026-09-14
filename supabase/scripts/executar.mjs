// Carregador dos scripts em TypeScript.
//
// Por que ele existe: os scripts importam o motor de render (`src/lib/render/`), têm de
// importar, porque normalizar com uma segunda implementação é exatamente o que o
// princípio nº1 proíbe. O Node executa TypeScript, mas não resolve os imports sem
// extensão que o motor usa, e falha com ERR_MODULE_NOT_FOUND.
//
// A alternativa seria uma dependência nova (tsx, vite-node). Não se paga: o Vite já é
// dependência do projeto e resolve exatamente isso em quatro linhas.
//
// Uso: node supabase/scripts/executar.mjs <script.ts> [argumentos do script]

import { createServer } from 'vite';

const alvo = process.argv[2];

if (!alvo) {
  console.error('Uso: node supabase/scripts/executar.mjs <script.ts> [argumentos]');
  process.exit(1);
}

// Reescreve o argv para o script carregado enxergar o que enxergaria se o Node o tivesse
// executado direto: `process.argv[2]` é o primeiro argumento DELE, não o caminho dele.
// Sem isto todo script aqui teria de saber que roda atrás de um carregador.
process.argv = [process.argv[0], alvo, ...process.argv.slice(3)];

const servidor = await createServer({
  // Sem isto o Vite abriria uma porta HTTP só para carregar um arquivo.
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'warn',
});

try {
  await servidor.ssrLoadModule(alvo.startsWith('/') ? alvo : `/${alvo}`);
} finally {
  await servidor.close();
}
