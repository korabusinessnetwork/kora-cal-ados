// Registra o jsdom como DOM do motor. Importar este arquivo é um efeito colateral de
// propósito (como um polyfill): quem roda em Node importa uma vez e o motor funciona.
//
// Hoje é importado por `vite.config.ts` (setupFiles do vitest). A função serverless de
// geração de variante também vai importar quando existir.
//
// O navegador NUNCA importa este arquivo — é o que mantém o jsdom fora do bundle do editor.

import { JSDOM } from 'jsdom';
import { definirAdaptadorDeDom } from './dom';

// jsdom serializa pelo objeto JSDOM, não pelo Document — este mapa faz a volta.
// WeakMap para o documento poder ser coletado normalmente.
const origem = new WeakMap<Document, JSDOM>();

definirAdaptadorDeDom({
  analisar(svgTexto) {
    const dom = new JSDOM(svgTexto, { contentType: 'image/svg+xml' });
    origem.set(dom.window.document, dom);
    return dom.window.document;
  },

  serializar(documento) {
    const dom = origem.get(documento);

    if (!dom) {
      throw new Error('Documento não foi criado por este adaptador — não dá para serializar.');
    }

    return dom.serialize();
  },
});
