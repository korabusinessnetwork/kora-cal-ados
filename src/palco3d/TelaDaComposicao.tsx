// A tela do calçado montado: escolher a peça de cada categoria, a cor de cada uma, o parâmetro, e
// ver o resultado montado numa cena só.
//
// É onde o ADR-008 fica visível pela primeira vez: uma composição, que é JSON de algumas linhas,
// vira um calçado. E é a tela em que o princípio nº1 é conferido a olho, porque a pergunta "a cor
// escolhida é a cor que aparece" só tem resposta em navegador de verdade.
//
// Ela não decide nada sozinha: quem monta é `montarDaTela`, que é puro e tem teste. O componente
// guarda estado e desenha.

import { useCallback, useMemo, useState } from 'react';

import { catalogoDeProva, composicaoDeProva, gltfDaPecaDeProva } from '../lib/acervo/acervoDeProva';
import { validarComposicao } from '../lib/composicao/validarComposicao';
import type { ParametroDePeca, PecaDoAcervo } from '../lib/composicao/tiposDaComposicao';
import type { ProvedorDeGltfDaPeca } from '../lib/composicao/montarComposicao';
import {
  composicaoDasEscolhas,
  escolhasDaComposicao,
  montarDaTela,
  mudarEscolhaDaTela,
  type EscolhaDaTela,
} from './composicaoDaTela';
import { PalcoDeModelo3d, type EstadoDoPalco } from './PalcoDeModelo3d';

const CATALOGO = catalogoDeProva();
const FORMA = CATALOGO.formas[0];
const DEMO = validarComposicao(composicaoDeProva(), CATALOGO);

/** O acervo de prova é código, então a tela abre sem `.env.local` e sem rede. */
const DO_ACERVO: ProvedorDeGltfDaPeca = (peca, parametros) =>
  gltfDaPecaDeProva(peca.id, parametros);

const PASSOS_DO_PARAMETRO = 40;

/** Estado do botão de copiar. `falhou` é visível de propósito: cópia silenciosa engana. */
type EstadoDaCopia = 'pronta' | 'copiada' | 'falhou';

export function TelaDaComposicao() {
  const [escolhas, setEscolhas] = useState(() => escolhasDaComposicao(DEMO));
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoDoPalco>('carregando');
  const [copia, setCopia] = useState<EstadoDaCopia>('pronta');

  // Remonta só quando as escolhas mudam. Sem o memo, cada render entregaria um texto glTF novo ao
  // palco, e ele recarregaria o calçado inteiro a cada movimento do mouse.
  const montagem = useMemo(
    () => (FORMA ? montarDaTela(FORMA, CATALOGO, escolhas, DO_ACERVO) : SEM_FORMA),
    [escolhas],
  );

  // O mesmo objeto que a API recebe, e que o modelo de linguagem vai escrever. Fica ao lado da
  // montagem, e não dentro do botão, porque ele também é o texto que aparece quando copiar falha.
  const textoDaComposicao = useMemo(
    () => (FORMA ? JSON.stringify(composicaoDasEscolhas(FORMA, escolhas), null, 2) : ''),
    [escolhas],
  );

  const aoSelecionar = useCallback((nome: string | null) => setSelecionada(nome), []);
  const aoMudarEstado = useCallback((novo: EstadoDoPalco) => setEstado(novo), []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoDaComposicao);
      setCopia('copiada');
    } catch {
      // A área de transferência é negada em página sem HTTPS, em aba sem foco e por permissão do
      // navegador. Sumir em silêncio aqui seria pior que não ter o botão: a pessoa colaria o que
      // estivesse na área de transferência antes e acharia que foi a composição.
      setCopia('falhou');
    }
  }

  function mudar(categoria: string, mudanca: Partial<EscolhaDaTela>) {
    // A composição mudou, então o aviso de "copiada" passou a falar de um texto que não é mais o
    // que está na tela.
    setCopia('pronta');
    // A transição em si mora em `composicaoDaTela`, com teste. Ela já esteve aqui, e foi aqui que
    // o BUG-019 nasceu: regra dentro do `.tsx` é regra no único arquivo desta pasta que jsdom não
    // alcança. Este componente decide QUANDO muda, nunca O QUE a mudança faz.
    setEscolhas((atual) => mudarEscolhaDaTela(atual, categoria, mudanca));
    // A seleção é do calçado que saiu de cena. Mantê-la faria a tela seguir apontando para um nó
    // que talvez nem exista mais na montagem nova.
    setSelecionada(null);
  }

  if (FORMA === undefined) return <main className="tela">O acervo de prova não tem forma.</main>;

  return (
    <main className="tela palco3d">
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Calçado montado</h1>
          <p className="cabecalho__meta">
            Uma composição validada, montada numa cena só. Arraste para girar, clique para
            identificar a peça.
          </p>
        </div>
        <span className="selo">{FORMA.rotulo}</span>
      </header>

      <div className="palco3d__colunas">
        <section className="painel">
          <h2 className="painel__titulo">Composição</h2>
          <p className="painel__ajuda">
            Uma peça por categoria, e a cor de cada uma. É esta escolha que o modelo de linguagem
            vai escrever em JSON, e ela passa pelo mesmo guarda nos dois casos.
          </p>

          {FORMA.categorias.map(({ categoria, obrigatoria }) => (
            <ControleDaCategoria
              key={categoria}
              categoria={categoria}
              obrigatoria={obrigatoria}
              pecas={CATALOGO.pecas.filter((peca) => peca.categoria === categoria)}
              escolha={escolhas.get(categoria) ?? { pecaId: null }}
              aoMudar={(mudanca) => mudar(categoria, mudanca)}
            />
          ))}

          {/* A composição não é gravada em banco (ADR-008 D6), então sem isto fechar a aba perde
              a montagem inteira. O que sai daqui é o MESMO JSON que a API recebe. */}
          <div className="palco3d__saida">
            <button type="button" className="palco3d__copiar" onClick={() => void copiar()}>
              Copiar composição
            </button>
            <p className="palco3d__saida-ajuda" role="status">
              {copia === 'copiada'
                ? 'Composição copiada. É o mesmo JSON que a API recebe.'
                : 'Leva o JSON desta montagem para onde você quiser, inclusive para a API.'}
            </p>
            {copia === 'falhou' && (
              <>
                <p className="palco3d__saida-erro" role="alert">
                  O navegador não deixou copiar (acontece fora de HTTPS ou sem permissão).
                  Selecione o texto abaixo e copie à mão.
                </p>
                <pre className="palco3d__saida-texto">{textoDaComposicao}</pre>
              </>
            )}
          </div>
        </section>

        <section className="painel palco3d__painel-cena">
          {montagem.modelo === null ? (
            <p className="palco3d__estado palco3d__estado--erro">{montagem.erro}</p>
          ) : (
            <>
              <PalcoDeModelo3d
                textoGltf={montagem.modelo}
                rotulo="Calçado montado em 3D. Arraste para girar, clique para identificar a peça."
                aoSelecionar={aoSelecionar}
                aoMudarEstado={aoMudarEstado}
              />
              <p
                className={
                  estado === 'recusado'
                    ? 'palco3d__estado palco3d__estado--erro'
                    : 'palco3d__estado'
                }
              >
                {textoDoEstado(estado, montagem.zonas.length)}
              </p>
            </>
          )}
        </section>

        <section className="painel palco3d__painel-inspecao">
          <h2 className="painel__titulo">Peça clicada</h2>
          <p className="painel__ajuda">
            O nome do nó é o id da peça (ADR-007 D4), e a zona que a API recolore é a categoria
            dela. São os dois lados do mesmo endereço.
          </p>
          {/* Mesma região viva da outra tela do palco, e pelo mesmo motivo: o clique é no
              canvas e a resposta aparece em outro canto. */}
          <div aria-live="polite" aria-atomic="true">
            {selecionada === null ? (
              <p className="palco3d__vazio">Nada selecionado. Clique numa peça do calçado.</p>
            ) : (
              <code className="palco3d__nome">{selecionada}</code>
            )}
          </div>

          <h2 className="painel__titulo painel__titulo--espacado">Zonas do calçado</h2>
          <ul className="palco3d__zonas">
            {montagem.zonas.map(({ zone_key, malhas }) => (
              <li key={zone_key} className="palco3d__zona">
                <code>{zone_key}</code>
                <span>{malhas.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

interface ControleDaCategoriaProps {
  categoria: string;
  obrigatoria: boolean;
  pecas: PecaDoAcervo[];
  escolha: EscolhaDaTela;
  aoMudar: (mudanca: Partial<EscolhaDaTela>) => void;
}

/** O bloco de uma categoria: qual peça, em que cor, com que parâmetro. */
function ControleDaCategoria({
  categoria,
  obrigatoria,
  pecas,
  escolha,
  aoMudar,
}: ControleDaCategoriaProps) {
  const peca = pecas.find(({ id }) => id === escolha.pecaId);
  const parametro = peca?.parametros[0];
  const valor = valorAtual(parametro, escolha.parametros);

  return (
    <div className="palco3d__categoria">
      <h3 className="palco3d__categoria-titulo">
        <code>{categoria}</code>
        {obrigatoria ? null : <span className="palco3d__opcional">opcional</span>}
      </h3>

      <div className="palco3d__lista">
        {pecas.map((candidata) => (
          <button
            key={candidata.id}
            type="button"
            className={
              candidata.id === escolha.pecaId ? 'palco3d__peca palco3d__peca--ativa' : 'palco3d__peca'
            }
            // A escolha existia só na borda colorida, e cor não é anúncio: para um leitor de tela
            // os botões da categoria eram todos iguais, e não havia como saber qual está valendo
            // sem sair da lista e conferir o resultado. `aria-pressed` diz "este está apertado"
            // sem depender de enxergar.
            aria-pressed={candidata.id === escolha.pecaId}
            onClick={() => aoMudar({ pecaId: candidata.id })}
          >
            <span className="palco3d__peca-rotulo">{candidata.rotulo}</span>
          </button>
        ))}
        {obrigatoria ? null : (
          <button
            type="button"
            className={escolha.pecaId === null ? 'palco3d__peca palco3d__peca--ativa' : 'palco3d__peca'}
            // Dispensar a categoria é uma escolha como qualquer outra, e o botão dela entra na
            // mesma lista, então ele anuncia do mesmo jeito. Sem isto, "nenhuma peça" seria o
            // único estado da tela que só existe para quem enxerga a borda.
            aria-pressed={escolha.pecaId === null}
            onClick={() => aoMudar({ pecaId: null })}
          >
            {/* Era `sem {categoria}`, e a tela escrevia "sem cadarco": a `categoria` é chave de
                dado, não palavra de frase, e chegava sem cedilha no meio do português. A forma não
                declara rótulo legível para categoria (só a PEÇA tem `rotulo`), então o caminho
                honesto é não costurar a chave na prosa. Qual categoria é esta já está no título do
                bloco, logo acima, com a marca de "opcional" ao lado. */}
            <span className="palco3d__peca-rotulo">Nenhuma peça</span>
          </button>
        )}
      </div>

      {peca ? (
        <div className="palco3d__ajustes">
          <label className="palco3d__cor">
            <input
              type="color"
              value={escolha.cor ?? '#FFFFFF'}
              aria-label={`cor da zona ${categoria}`}
              onChange={(evento) => aoMudar({ cor: evento.target.value.toUpperCase() })}
            />
            <code>{escolha.cor ?? 'cor da peça'}</code>
          </label>

          {parametro ? (
            <label className="palco3d__parametro">
              <span>
                {parametro.nome}: <strong>{milimetros(valor)}</strong>
              </span>
              <input
                type="range"
                className="palco3d__faixa"
                min={parametro.minimo}
                max={parametro.maximo}
                step={(parametro.maximo - parametro.minimo) / PASSOS_DO_PARAMETRO}
                value={valor}
                aria-label={`${parametro.nome} da zona ${categoria}`}
                onChange={(evento) =>
                  aoMudar({ parametros: { [parametro.nome]: Number(evento.target.value) } })
                }
              />
              {/* A faixa escrita, e não só o trilho do controle. Sem ela o número muda enquanto a
                  pessoa arrasta e não há como saber se 18,0 mm é o começo, o meio ou o fim do que a
                  peça aceita: o trilho mostra a POSIÇÃO, nunca os extremos. Quem confere "a espessura
                  que escolhi é a espessura que vai sair" precisa dos dois números à vista, que é o
                  princípio nº1 valendo para parâmetro do mesmo jeito que vale para cor.
                  Mesmo texto e mesma ordem da tela `?tela=palco3d`: é o mesmo dado, e duas telas do
                  palco escrevendo a mesma medida de jeitos diferentes é o começo de elas divergirem. */}
              <span className="palco3d__limites">
                faixa {milimetros(parametro.minimo)} a {milimetros(parametro.maximo)}
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** O acervo de prova sempre tem forma; isto existe para o tipo, e diz a verdade se acontecer. */
const SEM_FORMA = { modelo: null, zonas: [], erro: 'O acervo de prova não tem forma.' } as const;

function valorAtual(
  parametro: ParametroDePeca | undefined,
  parametros: Record<string, number> | undefined,
): number {
  if (parametro === undefined) return 0;

  return parametros?.[parametro.nome] ?? parametro.padrao;
}

/** Metros viram milímetros na tela: 0,018 m não se lê, 18 mm sim. */
function milimetros(metros: number): string {
  return `${(metros * 1000).toFixed(1).replace('.', ',')} mm`;
}

function textoDoEstado(estado: EstadoDoPalco, zonas: number): string {
  if (estado === 'carregando') return 'Montando o calçado…';
  if (estado === 'recusado') return 'O calçado montado foi recusado pelo carregador.';

  return `Calçado montado com ${zonas} ${zonas === 1 ? 'zona' : 'zonas'}. Arraste para girar.`;
}
