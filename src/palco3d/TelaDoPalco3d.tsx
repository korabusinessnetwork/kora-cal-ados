// A tela do palco: escolher a peça, mexer no parâmetro, ver o nome do que foi clicado.
//
// É a única do palco que guarda estado, no mesmo desenho do esboço do editor: os componentes
// abaixo são burros, para ninguém ser tentado a montar glTF por fora de `gltfDaPecaDeProva`.
//
// Não fala com o banco e não pede conta. A peça vem de `src/lib/acervo/`, que é código, não
// arquivo baixado, então esta tela abre num clone recém-clonado sem `.env.local`.

import { useCallback, useMemo, useState } from 'react';

import { catalogoDeProva, gltfDaPecaDeProva } from '../lib/acervo/acervoDeProva';
import type { ParametroDePeca } from '../lib/composicao/tiposDaComposicao';
import { PalcoDeModelo3d, type EstadoDoPalco } from './PalcoDeModelo3d';

const CATALOGO = catalogoDeProva();
const PECAS = CATALOGO.pecas;

/** Quantos passos o controle deslizante tem entre o mínimo e o máximo da faixa. */
const PASSOS_DO_PARAMETRO = 40;

export function TelaDoPalco3d() {
  const [pecaId, setPecaId] = useState<string>(PECAS[0]?.id ?? '');
  const [parametros, setParametros] = useState<Record<string, number>>({});
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoDoPalco>('carregando');

  const peca = PECAS.find(({ id }) => id === pecaId);
  const parametro = peca?.parametros[0];
  const valor = valorAtual(parametro, parametros);

  // O texto glTF é recalculado só quando a peça ou o parâmetro mudam. Sem o memo ele seria
  // remontado a cada render, e a prop nova faria o palco recarregar a peça sem motivo.
  const textoGltf = useMemo(
    () => (parametro ? gltfDaPecaDeProva(pecaId, { [parametro.nome]: valor }) : gltfDaPecaDeProva(pecaId)),
    [pecaId, parametro, valor],
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
          <p className="painel__ajuda">
            Uma peça por vez. Montar as cinco numa cena só, e colori-las, é a próxima tarefa.
          </p>
          <ul className="palco3d__lista">
            {PECAS.map((candidata) => (
              <li key={candidata.id}>
                <button
                  type="button"
                  className={
                    candidata.id === pecaId ? 'palco3d__peca palco3d__peca--ativa' : 'palco3d__peca'
                  }
                  onClick={() => trocarPeca(candidata.id)}
                >
                  <span className="palco3d__peca-rotulo">{candidata.rotulo}</span>
                  <code className="palco3d__peca-id">{candidata.categoria}</code>
                </button>
              </li>
            ))}
          </ul>

          {parametro ? (
            <>
              <h2 className="painel__titulo painel__titulo--espacado">{parametro.nome}</h2>
              <p className="painel__ajuda">
                O parâmetro é escala do nó, nunca malha nova (ADR-008 D7). Engrossar a peça faz ela
                crescer para cima, a partir de onde assenta.
              </p>
              <input
                type="range"
                className="palco3d__faixa"
                min={parametro.minimo}
                max={parametro.maximo}
                step={(parametro.maximo - parametro.minimo) / PASSOS_DO_PARAMETRO}
                value={valor}
                aria-label={parametro.nome}
                onChange={(evento) =>
                  setParametros((atual) => ({
                    ...atual,
                    [parametro.nome]: Number(evento.target.value),
                  }))
                }
              />
              <p className="palco3d__medida">
                <strong>{milimetros(valor)}</strong>
                <span>
                  faixa {milimetros(parametro.minimo)} a {milimetros(parametro.maximo)}
                </span>
              </p>
            </>
          ) : null}
        </section>

        <section className="painel palco3d__painel-cena">
          <PalcoDeModelo3d
            textoGltf={textoGltf}
            aoSelecionar={aoSelecionar}
            aoMudarEstado={aoMudarEstado}
          />
          <p className={estado === 'recusado' ? 'palco3d__estado palco3d__estado--erro' : 'palco3d__estado'}>
            {textoDoEstado(estado)}
          </p>
        </section>

        <section className="painel">
          <h2 className="painel__titulo">Malha clicada</h2>
          <p className="painel__ajuda">
            O endereço de uma zona 3D é o nome do nó (ADR-007 D4). É este texto que a composição
            guarda, e é ele que a API vai recolorir.
          </p>
          {selecionada === null ? (
            <p className="palco3d__vazio">Nada selecionado. Clique na peça.</p>
          ) : (
            <code className="palco3d__nome">{selecionada}</code>
          )}
          <p className="painel__ajuda palco3d__nota">
            Clicar no vazio limpa a seleção, em vez de manter a anterior. Zona errada em silêncio é
            o que o princípio nº1 proíbe.
          </p>
        </section>
      </div>
    </main>
  );
}

/** O valor em vigor: o que o usuário mexeu, ou o padrão que a própria peça declara. */
function valorAtual(parametro: ParametroDePeca | undefined, parametros: Record<string, number>): number {
  if (parametro === undefined) return 0;

  return parametros[parametro.nome] ?? parametro.padrao;
}

/** Metros viram milímetros na tela: 0,018 m não se lê, 18 mm sim. */
function milimetros(metros: number): string {
  return `${(metros * 1000).toFixed(1).replace('.', ',')} mm`;
}

function textoDoEstado(estado: EstadoDoPalco): string {
  if (estado === 'carregando') return 'Carregando a peça…';
  if (estado === 'recusado') return 'A peça foi recusada pelo carregador. O glTF não pôde ser lido.';

  return 'Peça na cena. Arraste para girar, clique para identificar.';
}
