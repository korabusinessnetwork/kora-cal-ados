// Sessão do usuário. Context, não prop-drilling: auth e tenant são os dois estados que o
// projeto decidiu manter em Context (memory/patterns.md).
//
// `carregando` começa em true de propósito: entre o boot e a resposta do Supabase não se
// sabe se há sessão, e tratar "ainda não sei" como "não tem" joga o usuário logado na
// tela de login a cada refresh.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/cliente';

interface ValorDaAutenticacao {
  sessao: Session | null;
  carregando: boolean;
  entrar(email: string, senha: string): Promise<void>;
  sair(): Promise<void>;
}

const AutenticacaoContext = createContext<ValorDaAutenticacao | null>(null);

export function AutenticacaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (ativo) setSessao(data.session);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao);
    });

    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const entrar = async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error('E-mail ou senha inválidos.');
  };

  const sair = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error('Não foi possível sair. Tente de novo.');
  };

  return (
    <AutenticacaoContext.Provider value={{ sessao, carregando, entrar, sair }}>
      {children}
    </AutenticacaoContext.Provider>
  );
}

export function useAutenticacao(): ValorDaAutenticacao {
  const valor = useContext(AutenticacaoContext);
  if (!valor) throw new Error('useAutenticacao precisa estar dentro de AutenticacaoProvider.');
  return valor;
}
