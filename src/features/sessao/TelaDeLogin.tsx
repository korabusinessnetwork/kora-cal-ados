// Entrada do app. Puramente apresentacional, recebe estado e callback, não chama
// Supabase. É o que permite testar os quatro estados obrigatórios (CLAUDE.md) com
// `renderToStaticMarkup`, sem rede e sem testing-library.

import { useState, type FormEvent } from 'react';

export interface PropsDaTelaDeLogin {
  /** `enviando` desabilita o formulário; `pronta` aceita digitação. */
  estado: 'pronta' | 'enviando';
  erro: string | null;
  aoEntrar: (email: string, senha: string) => void;
}

export function TelaDeLogin({ estado, erro, aoEntrar }: PropsDaTelaDeLogin) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const enviando = estado === 'enviando';
  // Prevenção de erro > mensagem de erro: o botão só habilita quando há o que enviar,
  // em vez de deixar submeter e responder "preencha os campos".
  const podeEnviar = email.trim() !== '' && senha !== '' && !enviando;

  function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    if (podeEnviar) aoEntrar(email.trim(), senha);
  }

  return (
    <main className="login">
      <form className="login__cartao" onSubmit={handleSubmit}>
        <h1 className="login__titulo">Editor de zonas</h1>
        <p className="login__ajuda">
          Entre com a conta do seu time. O acesso é por marca, e você só enxerga os produtos
          do tenant a que pertence.
        </p>

        {erro && (
          <p className="login__erro" role="alert">
            {erro}
          </p>
        )}

        <label className="login__campo">
          <span>E-mail</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            disabled={enviando}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="login__campo">
          <span>Senha</span>
          <input
            type="password"
            name="senha"
            autoComplete="current-password"
            value={senha}
            disabled={enviando}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>

        <button className="login__enviar" type="submit" disabled={!podeEnviar}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
