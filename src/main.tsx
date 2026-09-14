// Ponto de entrada do app. Monta o `App`, que decide entre a área protegida (sessão +
// tenant) e as telas sem banco (o esboço do motor e o palco 3D). O CSS entra aqui, uma vez, para nenhum componente
// importar estilo, a separação que o white-label exige (CLAUDE.md).

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { RedeDeProtecao } from './RedeDeProtecao';
import { lerTelaDaUrl } from './telaInicial';
import './esboco/esboco.css';
import './features/produtos/produtos.css';
import './features/sessao/sessao.css';
import './features/zonas/zonas.css';
import './palco3d/palco3d.css';

const raiz = document.getElementById('raiz');

if (!raiz) throw new Error('Elemento #raiz não existe no index.html.');

// A rede aqui fora é a última: o `App` tem uma por tela, e aquelas deixam o rodapé de pé, que é o
// desfecho melhor. Esta só atende o caso em que quem lançou foi o PRÓPRIO `App`, e aí não existe
// mais rodapé para sobrar. A tela vem da URL pelo mesmo caminho que o `App` usa, porque o estado
// dele não existe neste ponto.
createRoot(raiz).render(
  <StrictMode>
    <RedeDeProtecao atual={lerTelaDaUrl(window.location.search)}>
      <App />
    </RedeDeProtecao>
  </StrictMode>,
);
