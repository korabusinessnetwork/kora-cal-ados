// Ponto de entrada do app. Hoje monta só o esboço; quando o editor de zonas de verdade
// existir, entra um roteador aqui e o esboço vira uma rota entre outras.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EsbocoDoEditor } from './esboco/EsbocoDoEditor';
import './esboco/esboco.css';

const raiz = document.getElementById('raiz');

if (!raiz) throw new Error('Elemento #raiz não existe no index.html.');

createRoot(raiz).render(
  <StrictMode>
    <EsbocoDoEditor />
  </StrictMode>,
);
