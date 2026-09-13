// Tudo o que fica atrás do login, num componente só, para poder entrar por `import()` tardio.
//
// Por que existe: o `@supabase/supabase-js` estava no chunk principal, o que todo mundo baixa. As
// três telas públicas, esboço, palco 3D e calçado montado, não importam uma linha de `features/`,
// não falam com o banco e não têm para onde mandar requisição, e mesmo assim quem abria
// `?tela=esboco` num clone recém-baixado pagava por um cliente de banco que aquela tela nunca ia
// usar. Medido antes da mudança: no `dist/assets/index-*.js` a palavra `supabase` aparecia 72 vezes
// e `realtime` 23.
//
// É o mesmo raciocínio que o `App.tsx` já aplicava ao three.js, com as mesmas palavras: o peso é de
// quem usa, e quem paga por ele é quem abre. O que faltava era aplicá-lo do outro lado.
//
// Mora na RAIZ de `features/`, e não dentro de uma das features, porque é o ponto onde as três se
// juntam. Dentro de `sessao/` ele precisaria importar de `produtos/`, e essa seta é proibida pela
// regra de dependência do `README.md` daqui: a volta quebraria justamente a propriedade que faz
// `zonas/` continuar testável sem rede.
//
// A conferência da configuração veio junto, e não ficou para trás no `App.tsx`, por um motivo de
// chunk e não de estilo: ela é a primeira coisa que a área protegida faz, e deixá-la do outro lado
// obrigaria o chunk principal a continuar importando `lib/supabase/`. Ela continua acontecendo
// DEPOIS de saber qual tela vai abrir, que era o ponto da ordem antiga: conferir antes derrubava o
// app inteiro por falta de `.env.local`, inclusive o esboço, que não faz uma requisição sequer.

import { BarraDaSessao } from './sessao/BarraDaSessao';
import { ProvedorDeSessao } from './sessao/ContextoDeSessao';
import { RotaProtegida } from './sessao/RotaProtegida';
import { TelaDeProdutos } from './produtos/TelaDeProdutos';
import {
  ConfiguracaoAusente,
  lerConfiguracaoDoSupabase,
} from '../lib/supabase/configuracaoDoSupabase';

interface Props {
  /**
   * O ambiente lido, para o teste não depender de `import.meta.env`.
   *
   * Mesmo recurso que `lerConfiguracaoDoSupabase` já usa, e pelo mesmo motivo: sem ele, a tela de
   * "falta `.env.local`" só poderia ser conferida apagando o arquivo e reiniciando o `npm run dev`,
   * que é uma verificação que ninguém repete e portanto não é feita.
   */
  ambiente?: Record<string, string | undefined>;
}

export function AreaProtegida({ ambiente }: Props = {}) {
  // Sem `.env.local` a área protegida não sobe. Falhar aqui, com o que fazer escrito na tela, é
  // melhor que uma tela de login que recusa toda senha sem explicar por quê.
  const problema = conferirConfiguracao(ambiente);
  if (problema !== null) {
    return (
      <main className="sessao-aviso">
        <h1>Configuração do Supabase ausente</h1>
        <p>{problema}</p>
      </main>
    );
  }

  return (
    <ProvedorDeSessao>
      <RotaProtegida>
        {(tenant) => (
          <>
            <BarraDaSessao />
            {/* `key` no tenant: trocar de marca REMONTA a tela. Sem isso o estado da anterior
                (produto aberto, SVG baixado) sobreviveria à troca e mostraria o modelo de um
                concorrente sob o nome da marca nova. */}
            <TelaDeProdutos key={tenant.id} tenantId={tenant.id} />
          </>
        )}
      </RotaProtegida>
    </ProvedorDeSessao>
  );
}

function conferirConfiguracao(ambiente?: Record<string, string | undefined>): string | null {
  try {
    if (ambiente === undefined) lerConfiguracaoDoSupabase();
    else lerConfiguracaoDoSupabase(ambiente);
    return null;
  } catch (falha) {
    if (falha instanceof ConfiguracaoAusente || falha instanceof Error) return falha.message;
    return 'Erro desconhecido ao ler a configuração.';
  }
}
