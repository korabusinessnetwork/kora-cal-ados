// Raiz do app. Monta as telas por `useState`, sem roteador: hoje são quatro, e uma
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

import { lazy, Suspense, useEffect, useState } from 'react';
import { EsbocoDoEditor } from './esboco/EsbocoDoEditor';
import { BarraDaSessao } from './features/sessao/BarraDaSessao';
import { ProvedorDeSessao } from './features/sessao/ContextoDeSessao';
import { TelaDeProdutos } from './features/produtos/TelaDeProdutos';
import { RotaProtegida } from './features/sessao/RotaProtegida';
import { ConfiguracaoAusente, lerConfiguracaoDoSupabase } from './lib/supabase/configuracaoDoSupabase';
import type { Tela } from './telaInicial';
import { lerTelaDaUrl, tituloDaTela, urlDaTela } from './telaInicial';

// O palco entra por `import()` tardio, e não por import comum, porque ele traz o three.js
// junto: no chunk principal a biblioteca inteira ia no primeiro carregamento de TODO
// mundo, inclusive de quem só usa o editor 2D e nunca abre o palco. O peso é do palco, e
// quem paga por ele é quem o abre.
const TelaDoPalco3d = lazy(async () => ({
  default: (await import('./palco3d/TelaDoPalco3d')).TelaDoPalco3d,
}));

// Mesma razão, e o mesmo three.js: as duas telas do palco compartilham o chunk tardio.
const TelaDaComposicao = lazy(async () => ({
  default: (await import('./palco3d/TelaDaComposicao')).TelaDaComposicao,
}));

export function App() {
  const [tela, setTela] = useState<Tela>(() => lerTelaDaUrl(window.location.search));

  // A aba acompanha a tela. Fica aqui, e não em cada tela, porque quem sabe qual delas está aberta
  // é este componente: espalhar o título pelas quatro faria duas delas discordarem um dia.
  useEffect(() => {
    document.title = tituloDaTela(tela);
  }, [tela]);

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

  // O palco 3D sai aqui pelo mesmo motivo do esboço, e com uma razão a mais: a peça dele
  // é montada por código (`src/lib/acervo/`), não baixada de lugar nenhum. Exigir
  // credencial de uma tela que não tem para onde mandar requisição seria pedir senha para
  // abrir uma porta que não está trancada.
  if (tela === 'palco3d') {
    return (
      <>
        <Suspense fallback={<main className="tela">Carregando o palco 3D…</main>}>
          <TelaDoPalco3d />
        </Suspense>
        <p className="rodape-telas">
          <button type="button" onClick={() => irPara('composicao')}>
            ← ver o calçado montado (as peças juntas)
          </button>
          <button type="button" onClick={() => irPara('esboco')}>
            ver o esboço do motor (2D, sem banco)
          </button>
          <button type="button" onClick={() => irPara('app')}>
            ir para o editor (pede login)
          </button>
        </p>
      </>
    );
  }

  // O calçado montado sai antes do portão pelas mesmas duas razões do palco: as peças são
  // código, e a tela não tem para onde mandar requisição. É aqui que o princípio nº1 é
  // conferido a olho em 3D, e exigir login para isso atrasaria a única verificação que
  // nenhum teste faz.
  if (tela === 'composicao') {
    return (
      <>
        <Suspense fallback={<main className="tela">Carregando o calçado montado…</main>}>
          <TelaDaComposicao />
        </Suspense>
        <p className="rodape-telas">
          <button type="button" onClick={() => irPara('palco3d')}>
            ← ver uma peça por vez (palco 3D)
          </button>
          <button type="button" onClick={() => irPara('esboco')}>
            ver o esboço do motor (2D, sem banco)
          </button>
          <button type="button" onClick={() => irPara('app')}>
            ir para o editor (pede login)
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
          <button type="button" onClick={() => irPara('palco3d')}>
            ver o palco 3D (idem)
          </button>
          <button type="button" onClick={() => irPara('composicao')}>
            ver o calçado montado (idem)
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
        <button type="button" onClick={() => irPara('palco3d')}>
          ver o palco 3D (sem banco, sem conta)
        </button>
        <button type="button" onClick={() => irPara('composicao')}>
          ver o calçado montado (sem banco, sem conta)
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
