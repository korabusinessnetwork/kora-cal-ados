// A tela do palco: escolher a peça, mexer no parâmetro, ver o nome do que foi clicado.
//
// É a única do palco que guarda estado, no mesmo desenho do esboço do editor: os componentes
// abaixo são burros, para ninguém ser tentado a montar glTF por fora de `gltfDaPecaDeProva`.
//
// Não fala com o banco e não pede conta. A peça vem de `src/lib/acervo/`, que é código, não
// arquivo baixado, então esta tela abre num clone recém-clonado sem `.env.local`.

import { useCallback, useMemo, useState } from 'react';

import { catalogoDeProva, gltfDaPecaDeProva } from '../lib/acervo/acervoDeProva';
import type { PecaDoAcervo } from '../lib/composicao/tiposDaComposicao';
import { ehFalha, PalcoDeModelo3d, type EstadoDoPalco } from './PalcoDeModelo3d';
import { ParametrosDaPeca, valoresEmVigor } from './ParametrosDaPeca';

const CATALOGO = catalogoDeProva();
const PECAS = CATALOGO.pecas;

interface TelaDoPalco3dProps {
  /**
   * As peças da lista. O app nunca passa: vale o acervo de prova. Existe para um teste montar a
   * tela com uma peça de dois parâmetros, que o acervo de prova não tem, e reprovar a tela que
   * desenhasse só o primeiro (R8-A63). Os ids têm de ser do acervo de prova, porque o glTF sai dele.
   */
  pecas?: readonly PecaDoAcervo[];
}

export function TelaDoPalco3d({ pecas = PECAS }: TelaDoPalco3dProps = {}) {
  const [pecaId, setPecaId] = useState<string>(pecas[0]?.id ?? '');
  const [parametros, setParametros] = useState<Record<string, number>>({});
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoDoPalco>('carregando');

  const peca = pecas.find(({ id }) => id === pecaId);
  const declarados = peca?.parametros ?? [];
  // Todos os parâmetros declarados, e não só o primeiro (R8-A63).
  const chaveDosValores = JSON.stringify(valoresEmVigor(declarados, parametros));

  // O texto glTF é recalculado só quando a peça ou algum valor mudam. Sem o memo ele seria
  // remontado a cada render, e a prop nova faria o palco recarregar a peça sem motivo. A chave é o
  // texto dos valores, e não o objeto, porque o objeto nasce novo a cada render.
  const textoGltf = useMemo(
    () =>
      declarados.length > 0
        ? gltfDaPecaDeProva(pecaId, JSON.parse(chaveDosValores) as Record<string, number>)
        : gltfDaPecaDeProva(pecaId),
    [pecaId, declarados.length, chaveDosValores],
  );

  // Os dois callbacks são estáveis porque o palco os guarda em referência. Recriá-los a cada
  // render não quebraria nada hoje, mas deixaria a porta aberta para um efeito com dependência
  // errada derrubar o contexto WebGL a cada tecla.
  const aoSelecionar = useCallback((nome: string | null) => setSelecionada(nome), []);
  const aoMudarEstado = useCallback((novo: EstadoDoPalco) => setEstado(novo), []);

  function trocarPeca(id: string) {
    setPecaId(id);
    // A seleção é da peça que saiu de cena. Mantê-la faria a tela seguir afirmando que algo
    // está selecionado depois de a peça nem existir mais.
    setSelecionada(null);
  }

  return (
    <main className="tela palco3d">
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Palco 3D</h1>
          <p className="cabecalho__meta">
            Acervo de prova, gerado por código. Arraste para girar, clique para identificar a peça.
          </p>
        </div>
        <span className="selo">{CATALOGO.formas[0]?.rotulo ?? 'forma de prova'}</span>
      </header>

      <div className="palco3d__colunas">
        <section className="painel">
          <h2 className="painel__titulo">Peça</h2>
          {/* A frase dizia "montar as cinco numa cena só, e colori-las, é a próxima tarefa", e
              isso deixou de ser verdade no dia em que a tela do calçado montado nasceu. Texto que
              promete o que já existe é pior que texto nenhum: quem lê conclui que o produto não
              faz, e não vai procurar. Por isso a frase agora APONTA, com o mesmo nome que o rodapé
              usa para aquele destino (ADR-003, "um termo, um nome, sempre"). */}
          <p className="painel__ajuda">
            Uma peça por vez, isolada, para conferir o parâmetro e o nome do nó. As cinco juntas, e
            já coloridas, estão no calçado montado, no rodapé desta tela.
          </p>
          <ul className="palco3d__lista">
            {pecas.map((candidata) => (
              <li key={candidata.id}>
                <button
                  type="button"
                  className={
                    candidata.id === pecaId ? 'palco3d__peca palco3d__peca--ativa' : 'palco3d__peca'
                  }
                  // A peça em cena existia só na borda colorida, e cor não é anúncio: o mesmo
                  // conserto, e pelo mesmo motivo, da lista da tela da composição.
                  aria-pressed={candidata.id === pecaId}
                  onClick={() => trocarPeca(candidata.id)}
                >
                  <span className="palco3d__peca-rotulo">{candidata.rotulo}</span>
                  <code className="palco3d__peca-id">{candidata.categoria}</code>
                </button>
              </li>
            ))}
          </ul>

          <ParametrosDaPeca
            parametros={declarados}
            valores={parametros}
            aoMudar={(nome, valor) => setParametros((atual) => ({ ...atual, [nome]: valor }))}
          />
        </section>

        <section className="painel palco3d__painel-cena">
          <PalcoDeModelo3d
            textoGltf={textoGltf}
            rotulo="Peça em 3D. Arraste para girar, clique para identificar a malha."
            aoSelecionar={aoSelecionar}
            aoMudarEstado={aoMudarEstado}
          />
          <p className={ehFalha(estado) ? 'palco3d__estado palco3d__estado--erro' : 'palco3d__estado'}>
            {textoDoEstadoDaPeca(estado)}
          </p>
        </section>

        <section className="painel palco3d__painel-inspecao">
          <h2 className="painel__titulo">Malha clicada</h2>
          <p className="painel__ajuda">
            O endereço de uma zona 3D é o nome do nó (ADR-007 D4). É este texto que a composição
            guarda, e é ele que a API vai recolorir.
          </p>
          {/* Região viva: o clique acontece dentro do canvas, e o que ele produziu aparece
              AQUI, em outro canto da tela. Sem isto, quem não enxerga o resultado clica no 3D e
              não recebe resposta nenhuma. `polite` porque a pessoa costuma clicar várias vezes
              seguidas procurando a malha certa, e `atomic` porque o nome do nó só significa alguma
              coisa junto da frase que diz o que ele é. */}
          <div aria-live="polite" aria-atomic="true">
            {selecionada === null ? (
              <p className="palco3d__vazio">Nada selecionado. Clique na peça.</p>
            ) : (
              <code className="palco3d__nome">{selecionada}</code>
            )}
          </div>
          <p className="painel__ajuda palco3d__nota">
            Clicar no vazio limpa a seleção, em vez de manter a anterior. Zona errada em silêncio é
            o que o princípio nº1 proíbe.
          </p>
        </section>
      </div>
    </main>
  );
}

/**
 * A frase de cada estado do palco.
 *
 * Exportada para ter teste, pelo mesmo motivo de `mensagemDoHex`: é o texto que a pessoa lê para
 * saber se o que está na tela é confiável, e texto que a pessoa lê merece teste tanto quanto a
 * regra que o escolhe.
 *
 * Os cinco estados são tratados por nome, sem um `return` de fim que sirva de coringa. O coringa
 * era o defeito: qualquer estado novo caía nele e a tela dizia "Peça na cena" sem que houvesse
 * peça na cena.
 */
export function textoDoEstadoDaPeca(estado: EstadoDoPalco): string {
  if (estado === 'carregando') return 'Carregando a peça…';
  if (estado === 'recusado') return 'A peça foi recusada pelo carregador. O glTF não pôde ser lido.';
  if (estado === 'contexto-perdido') {
    return (
      'O 3D caiu: o navegador tirou o contexto gráfico desta aba. A peça não está sendo ' +
      'desenhada. Se ela não voltar sozinha em alguns segundos, recarregue a página.'
    );
  }
  if (estado === 'contexto-negado') {
    return (
      'O 3D não pôde ser iniciado: este navegador não entregou um contexto gráfico (WebGL). ' +
      'Não adianta recarregar, o 3D não vai abrir nesta máquina. Abra o esboço, que desenha o ' +
      'mesmo tênis em SVG e não precisa de placa de vídeo.'
    );
  }

  return 'Peça na cena. Arraste para girar, clique para identificar.';
}
