// Raiz do app. Monta as telas por `useState`, sem roteador: hoje são duas, e uma
// dependência nova só se paga quando houver URL que precise ser compartilhável.
//
// Tudo o que toca o banco vive dentro de `RotaProtegida` — a autenticação é verificada
// antes de a tela existir, não dentro dela.

import { useState } from 'react';
import { EsbocoDoEditor } from './esboco/EsbocoDoEditor';
import { BarraDaSessao } from './features/sessao/BarraDaSessao';
import { ProvedorDeSessao } from './features/sessao/ContextoDeSessao';
import { TelaDeProdutos } from './features/produtos/TelaDeProdutos';
import { RotaProtegida } from './features/sessao/RotaProtegida';
import { ConfiguracaoAusente, lerConfiguracaoDoSupabase } from './lib/supabase/configuracaoDoSupabase';

type Tela = 'app' | 'esboco';

export function App() {
  const [tela, setTela] = useState<Tela>('app');

  // Sem `.env.local` o app não sobe. Falhar aqui, com o que fazer escrito na tela, é
  // melhor que uma tela de login que recusa toda senha sem explicar por quê.
  const problema = conferirConfiguracao();
  if (problema) {
    return (
      <main className="sessao-aviso">
        <h1>Configuração do Supabase ausente</h1>
        <p>{problema}</p>
      </main>
    );
  }

  if (tela === 'esboco') {
    return (
      <>
        <EsbocoDoEditor />
        <p className="rodape-telas">
          <button type="button" onClick={() => setTela('app')}>
            ← voltar para o editor
          </button>
        </p>
      </>
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
        <button type="button" onClick={() => setTela('esboco')}>
          ver o esboço do motor (sem banco)
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
