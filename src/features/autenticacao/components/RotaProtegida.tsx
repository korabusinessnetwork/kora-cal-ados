// Barra qualquer rota que exija sessão. A RLS já protege o DADO no banco; isto protege a
// TELA, para o usuário sem sessão ver o login em vez de uma página quebrada de erros.

import type { ReactNode } from 'react';
import { useAutenticacao } from '../AutenticacaoContext';
import { TelaDeLogin } from './TelaDeLogin';

export function RotaProtegida({ children }: { children: ReactNode }) {
  const { sessao, carregando } = useAutenticacao();

  if (carregando) {
    return (
      <p className="estado-carregando" role="status">
        Carregando sessão…
      </p>
    );
  }

  if (!sessao) return <TelaDeLogin />;

  return <>{children}</>;
}
