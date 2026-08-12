// Demonstração executável do motor de recolor — gera um arquivo pra abrir no navegador.
// O motor em si vive em `prototipo-recolor-svg.mjs` (sem efeito colateral, importável em teste).
//
// Uso: npm run prototipo:recolor

import { readFileSync, writeFileSync } from 'node:fs';
import { gerarVarianteDeCor } from './prototipo-recolor-svg.mjs';

const svgBase = readFileSync(new URL('./teste-zona.svg', import.meta.url), 'utf-8');

const variante = gerarVarianteDeCor(svgBase, {
  'zona-sola': '#FF0000',
  'zona-cabedal': '#0000FF',
});

writeFileSync(new URL('./variante-teste.svg', import.meta.url), variante);
console.log('✅ scripts/variante-teste.svg gerado — abre no navegador pra conferir.');
console.log('⚠️  Lembrete: este SVG é feito à mão. Em SVG real de Illustrator/Figma o motor');
console.log('   atual falha em silêncio — ver scripts/prototipo-recolor-svg.test.mjs.');
