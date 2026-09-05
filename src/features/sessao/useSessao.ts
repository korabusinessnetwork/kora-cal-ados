// Único jeito de ler a sessão. Componente nenhum importa o contexto direto.
//
// O erro por falta de provedor é explícito porque a falha alternativa é silenciosa e
// perigosa: `useContext` devolveria null, o componente leria `sessao?.usuario` como
// "ninguém logado" e desenharia a tela de login por cima de um app já autenticado.

import { useContext } from 'react';
import { ContextoDeSessao, type Sessao } from './ContextoDeSessao';

export function useSessao(): Sessao {
  const sessao = useContext(ContextoDeSessao);

  if (!sessao) {
    throw new Error(
      'useSessao foi chamado fora de <ProvedorDeSessao>. Envolva a árvore em ' +
        'ProvedorDeSessao antes de usar qualquer tela protegida.',
    );
  }

  return sessao;
}
