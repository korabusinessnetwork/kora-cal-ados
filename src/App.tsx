// Raiz do app. Monta as telas por `useState`, sem roteador: hoje são quatro, e uma
// dependência nova só se paga quando houver URL que precise ser compartilhável.
//
// Tudo o que toca o banco vive dentro de `RotaProtegida`, a autenticação é verificada
// antes de a tela existir, não dentro dela.
//
// Cada tela entra dentro de uma `RedeDeProtecao`, e o rodapé fica FORA dela: assim uma exceção
// numa tela não leva junto a navegação, e os botões do rodapé continuam funcionando de verdade,
// porque quem guarda o estado deles é este componente, que não caiu. É por isso que aqui a rede vai
// com `comSaidas={false}`: as saídas já estão na tela, no rodapé, e a rede desenhando as dela
// deixaria a mesma lista de três destinos duas vezes, uma embaixo da outra. O `key={tela}` não é enfeite:
// sem ele, trocar de tela reaproveitaria a mesma instância da rede, com a falha antiga dentro, e o
// botão do rodapé pareceria não fazer nada.
//
// A ordem das checagens aqui é deliberada, e já foi o contrário: a configuração do
// Supabase é conferida DEPOIS de saber qual tela vai abrir, não antes. Conferir antes
// derrubava o app inteiro por falta de `.env.local`, inclusive o esboço, que não faz
// uma requisição sequer. Cobrar credencial de quem não vai usar credencial nenhuma é
// justamente a "prevenção de erro" do princípio nº1 aplicada ao contrário. A conferência hoje
// mora em `features/AreaProtegida.tsx`, e a ordem continua sendo essa: ela só acontece quando a
// tela escolhida é a protegida, porque é o `import()` dela que traz `lib/supabase/` junto.
//
// As três telas públicas saem ANTES da área protegida também por isso: cada uma delas é um
// `return` que não menciona `features/`, e é essa ausência que mantém o cliente de banco fora do
// chunk que todo mundo baixa.

import { lazy, Suspense, useEffect, useState } from 'react';
import { EsbocoDoEditor } from './esboco/EsbocoDoEditor';
import { RedeDeProtecao } from './RedeDeProtecao';
import { RodapeDeTelas } from './RodapeDeTelas';
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

// E a área protegida entra tardia pelo mesmo motivo, do outro lado: ela traz o
// `@supabase/supabase-js` junto, com o cliente de realtime dentro, e nenhuma das três telas
// públicas tem para onde mandar requisição. Enquanto este import era comum, quem abria
// `?tela=esboco` num clone recém-baixado baixava um cliente de banco que aquela tela nunca usaria.
// A conferência do `.env.local` foi junto, e está explicada em `features/AreaProtegida.tsx`: ela é
// a primeira coisa que a área faz, e deixá-la aqui obrigaria o chunk principal a continuar
// importando `lib/supabase/`.
const AreaProtegida = lazy(async () => ({
  default: (await import('./features/AreaProtegida')).AreaProtegida,
}));

export function App() {
  const [tela, setTela] = useState<Tela>(() => lerTelaDaUrl(window.location.search));

  // A aba acompanha a tela. Fica aqui, e não em cada tela, porque quem sabe qual delas está aberta
  // é este componente: espalhar o título pelas quatro faria duas delas discordarem um dia.
  useEffect(() => {
    document.title = tituloDaTela(tela);
  }, [tela]);

  // O botão Voltar do navegador anda entre as telas.
  //
  // Ele não andava, e o motivo era uma palavra: `irPara` usava `replaceState`, que SUBSTITUI a
  // entrada atual do histórico em vez de empilhar uma nova. Medido antes da mudança:
  // `history.length` ficava em 28 nas três telas seguidas enquanto o endereço mudava, e apertar
  // Voltar depois de três navegações saía do app inteiro, para o que estivesse na aba antes.
  // Voltar é o controle mais usado que existe num navegador, e ele fazia a coisa mais cara
  // possível.
  //
  // O par é `pushState` mais este ouvinte, e um sem o outro é pior que nenhum dos dois: com
  // `pushState` sozinho, Voltar mudaria o endereço e deixaria a tela anterior desenhada, que é o
  // estado mentiroso que o princípio nº1 proíbe em outra roupa.
  useEffect(() => {
    function aoAndarNoHistorico() {
      // Lê da URL, e não de um estado guardado na entrada do histórico, porque a URL é a única
      // fonte que também responde por um link colado à mão e por um F5. Duas fontes para a mesma
      // pergunta é como elas passam a discordar.
      setTela(lerTelaDaUrl(window.location.search));
    }

    window.addEventListener('popstate', aoAndarNoHistorico);

    return () => window.removeEventListener('popstate', aoAndarNoHistorico);
  }, []);

  // Trocar de tela troca o endereço junto. Sem isso um F5 no esboço devolveria a tela
  // de login, e o link não serviria para mandar a alguém "abre isto aqui".
  function irPara(destino: Tela) {
    setTela(destino);
    window.history.pushState(null, '', urlDaTela(destino, window.location.pathname));
  }

  // O esboço do motor roda sem Supabase: SVG commitado, zero rede, zero sessão. Sai
  // antes da checagem de configuração de propósito, é o que faz `?tela=esboco`
  // funcionar num clone recém-baixado, sem conta e sem `.env.local`.
  if (tela === 'esboco') {
    return (
      <>
        <RedeDeProtecao key={tela} atual="esboco" comSaidas={false}>
          <EsbocoDoEditor />
        </RedeDeProtecao>
        <RodapeDeTelas atual="esboco" irPara={irPara} />
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
        <RedeDeProtecao key={tela} atual="palco3d" comSaidas={false}>
          <Suspense fallback={<main className="tela">Carregando o palco 3D…</main>}>
            <TelaDoPalco3d />
          </Suspense>
        </RedeDeProtecao>
        <RodapeDeTelas atual="palco3d" irPara={irPara} />
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
        <RedeDeProtecao key={tela} atual="composicao" comSaidas={false}>
          <Suspense fallback={<main className="tela">Carregando o calçado montado…</main>}>
            <TelaDaComposicao />
          </Suspense>
        </RedeDeProtecao>
        <RodapeDeTelas atual="composicao" irPara={irPara} />
      </>
    );
  }

  // A área protegida, incluindo a tela de "falta `.env.local`". O rodapé fica fora dela como nas
  // outras três: saída, não beco sem saída. Antes ele era desenhado DENTRO do aviso de
  // configuração, e agora é o mesmo rodapé nos dois casos, que é o que a pessoa já viu nas telas
  // públicas.
  return (
    <>
      <RedeDeProtecao key={tela} atual="app" comSaidas={false}>
        <Suspense fallback={<main className="tela">Carregando o editor…</main>}>
          <AreaProtegida />
        </Suspense>
      </RedeDeProtecao>
      <RodapeDeTelas atual="app" irPara={irPara} />
    </>
  );
}
