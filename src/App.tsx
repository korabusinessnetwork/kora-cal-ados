// Raiz do app. Monta as telas por `useState`, sem roteador: hoje são duas, e uma
// dependência nova só se paga quando houver URL que precise ser compartilhável.
//
// Tudo o que toca o banco vive dentro de `RotaProtegida` — a autenticação é verificada
// antes de a tela existir, não dentro dela.
//
// A ordem das checagens aqui é deliberada, e já foi o contrário: a configuração do
// Supabase é conferida DEPOIS de saber qual tela vai abrir, não antes. Conferir antes
// derrubava o app inteiro por falta de `.env.local` — inclusive o esboço, que não faz
// uma requisição sequer. Cobrar credencial de quem não vai usar credencial nenhuma é
// justamente a "prevenção de erro" do princípio nº1 aplicada ao contrário.

import { useState } from 'react';
import { EsbocoDoEditor } from './esboco/EsbocoDoEditor';
import { BarraDaSessao } from './features/sessao/BarraDaSessao';
import { ProvedorDeSessao } from './features/sessao/ContextoDeSessao';
import { TelaDeProdutos } from './features/produtos/TelaDeProdutos';
import { RotaProtegida } from './features/sessao/RotaProtegida';
import { ConfiguracaoAusente, lerConfiguracaoDoSupabase } from './lib/supabase/configuracaoDoSupabase';
import type { Tela } from './telaInicial';
import { lerTelaDaUrl, urlDaTela } from './telaInicial';

export function App() {
  const [tela, setTela] = useState<Tela>(() => lerTelaDaUrl(window.location.search));

  // Trocar de tela troca o endereço junto. Sem isso um F5 no esboço devolveria a tela
  // de login, e o link não serviria para mandar a alguém "abre isto aqui".
  function irPara(destino: Tela) {
    setTela(destino);
    window.history.replaceState(null, '', urlDaTela(destino, window.location.pathname));
  }

  // O esboço do motor roda sem Supabase: SVG commitado, zero rede, zero sessão. Sai
  // antes da checagem de configuração de propósito — é o que faz `?tela=esboco`
  // funcionar num clone recém-baixado, sem conta e sem `.env.local`.
  if (tela === 'esboco') {
    return (
      <>
        <EsbocoDoEditor />
        <p className="rodape-telas">
          <button type="button" onClick={() => irPara('app')}>
            ← ir para o editor (pede login)
          </button>
        </p>
      </>
    );
  }

  // Sem `.env.local` a área protegida não sobe. Falhar aqui, com o que fazer escrito na
  // tela, é melhor que uma tela de login que recusa toda senha sem explicar por quê.
  const problema = conferirConfiguracao();
  if (problema) {
    return (
      <main className="sessao-aviso">
        <h1>Configuração do Supabase ausente</h1>
        <p>{problema}</p>
        <p className="rodape-telas">
          {/* Saída, não beco sem saída: o esboço não precisa de nada disso. */}
          <button type="button" onClick={() => irPara('esboco')}>
            ver o esboço do motor (funciona sem conta e sem `.env.local`)
          </button>
        </p>
      </main>
    );
  }

  return (
    <ProvedorDeSessao>
      <RotaProtegida>
        {(tenant) => (
          <>
            <BarraDaSessao />
            {/* `key` no tenant: trocar de marca REMONTA a tela. Sem isso o estado da
                anterior (produto aberto, SVG baixado) sobreviveria à troca e mostraria o
                modelo de um concorrente sob o nome da marca nova. */}
            <TelaDeProdutos key={tenant.id} tenantId={tenant.id} />
          </>
        )}
      </RotaProtegida>
      <p className="rodape-telas">
        <button type="button" onClick={() => irPara('esboco')}>
          ver o esboço do motor (sem banco, sem conta)
        </button>
      </p>
    </ProvedorDeSessao>
  );
}

function conferirConfiguracao(): string | null {
  try {
    lerConfiguracaoDoSupabase();
    return null;
  } catch (falha) {
    if (falha instanceof ConfiguracaoAusente || falha instanceof Error) return falha.message;
    return 'Erro desconhecido ao ler a configuração.';
  }
}
