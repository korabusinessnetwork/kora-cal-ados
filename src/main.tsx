// Ponto de entrada do app. Monta o `App`, que decide entre a área protegida (sessão +
// tenant) e o esboço do motor. O CSS entra aqui, uma vez, para nenhum componente
// importar estilo — a separação que o white-label exige (CLAUDE.md).

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './esboco/esboco.css';
import './features/produtos/produtos.css';
import './features/sessao/sessao.css';
import './features/zonas/zonas.css';

const raiz = document.getElementById('raiz');

if (!raiz) throw new Error('Elemento #raiz não existe no index.html.');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
