// Entrada do app. Não há cadastro self-serve na Fase 1: o acesso é provisionado por
// script (scripts/provisionarTenant.ts), porque a venda é manual/contrato.

import { useState, type FormEvent } from 'react';
import { useAutenticacao } from '../AutenticacaoContext';
import './TelaDeLogin.css';

export function TelaDeLogin() {
  const { entrar } = useAutenticacao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (evento: FormEvent) => {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      await entrar(email.trim(), senha);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="tela-de-login">
      <form className="tela-de-login__caixa" onSubmit={handleSubmit}>
        <h1 className="tela-de-login__titulo">Entrar</h1>

        <label className="tela-de-login__campo">
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="tela-de-login__campo">
          <span>Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {erro && (
          <p className="tela-de-login__erro" role="alert">
            {erro}
          </p>
        )}

        <button type="submit" className="tela-de-login__botao" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
