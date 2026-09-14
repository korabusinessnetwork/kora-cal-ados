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
import { useCopiaDeTexto } from '../lib/copia/useCopiaDeTexto';

import { catalogoDeProva, composicaoDeProva, gltfDaPecaDeProva } from '../lib/acervo/acervoDeProva';
import {
  DESCRICAO_DO_GERADOR_DE_PROVA,
  modeloDeLinguagemDeProva,
} from '../lib/composicao/modeloDeLinguagemDeProva';
import { validarComposicao } from '../lib/composicao/validarComposicao';
import type { ModeloDeLinguagem } from '../lib/composicao/gerarComposicaoPorPrompt';
import type { ProvedorDeGltfDaPeca } from '../lib/composicao/montarComposicao';
import type { Forma } from '../lib/composicao/tiposDaComposicao';
import { montarDaTela } from './composicaoDaTela';
import { ControleDaCategoria } from './ControleDaCategoria';
import { PainelDaPecaClicada } from './PainelDaPecaClicada';
import { PainelDeColar } from './PainelDeColar';
import { PainelDePrompt } from './PainelDePrompt';
import { PainelDeRecomeco } from './PainelDeRecomeco';
import { PainelDeSaida } from './PainelDeSaida';
import { ehFalha, PalcoDeModelo3d, type EstadoDoPalco } from './PalcoDeModelo3d';
import { avisoDaComposicaoGerada, type DescricaoDoModelo } from './textosDoPrompt';
import { useEscolhasDaComposicao } from './useEscolhasDaComposicao';

const CATALOGO = catalogoDeProva();
const FORMA = CATALOGO.formas[0];
const DEMO = validarComposicao(composicaoDeProva(), CATALOGO);

/** O acervo de prova é código, então a tela abre sem `.env.local` e sem rede. */
const DO_ACERVO: ProvedorDeGltfDaPeca = (peca, parametros) =>
  gltfDaPecaDeProva(peca.id, parametros);

/**
 * Quem responde o prompt nesta tela, e como ele se apresenta.
 *
 * `criar` recebe a forma porque o fornecedor da marca (D13) é chamado pelo servidor com o id da forma,
 * e não com o catálogo montado aqui: é o servidor que monta instrução e catálogo, para a rota não
 * virar um modelo de linguagem de uso geral pago pela marca.
 */
export interface ModeloDaTela {
  criar: (forma: Forma) => ModeloDeLinguagem;
  descricao: DescricaoDoModelo;
}

/** O padrão: o gerador de prova, sem IA, sem rede e sem custo (D12). É o que a tela pública usa. */
export const MODELO_DE_PROVA_DA_TELA: ModeloDaTela = {
  criar: () => modeloDeLinguagemDeProva,
  descricao: DESCRICAO_DO_GERADOR_DE_PROVA,
};

export function TelaDaComposicao({ modeloDaTela = MODELO_DE_PROVA_DA_TELA }: { modeloDaTela?: ModeloDaTela } = {}) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoDoPalco>('carregando');
  // Toda troca de montagem larga a peça clicada. Quem decide QUANDO a montagem troca é o hook, e
  // ele avisa por aqui, no mesmo passo, para a tela nunca desenhar uma seleção do calçado que saiu.
  const largarSelecao = useCallback(() => setSelecionada(null), []);
  const composicao = useEscolhasDaComposicao(FORMA, CATALOGO, DEMO, largarSelecao);
  const { escolhas } = composicao;

  // Remonta só quando as escolhas mudam. Sem o memo, cada render entregaria um texto glTF novo ao
  // palco, e ele recarregaria o calçado inteiro a cada movimento do mouse.
  const montagem = useMemo(
    () => (FORMA ? montarDaTela(FORMA, CATALOGO, escolhas, DO_ACERVO) : SEM_FORMA),
    [escolhas],
  );

  // O descarte do aviso ao mudar a composição é do próprio hook, e não um `setCopia('pronta')`
  // dentro de `mudar()` como já foi: com a regra amarrada ao texto, o caminho novo que mudasse a
  // composição sem passar por `mudar()` não teria como esquecer de apagar o aviso.
  const copia = useCopiaDeTexto(composicao.texto);

  // Um modelo por forma e por quem responde: recriar a cada render trocaria a identidade da função
  // que o painel de prompt recebe, sem ganho nenhum.
  const modelo = useMemo(() => (FORMA ? modeloDaTela.criar(FORMA) : null), [modeloDaTela]);

  const aoSelecionar = useCallback((nome: string | null) => setSelecionada(nome), []);
  const aoMudarEstado = useCallback((novo: EstadoDoPalco) => setEstado(novo), []);

  if (FORMA === undefined || modelo === null) return <main className="tela">O acervo de prova não tem forma.</main>;

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
            Uma peça por categoria, e a cor de cada uma. Descrever o calçado produz a mesma
            escolha que os controles abaixo, e ela passa pelo mesmo guarda nos dois casos.
          </p>

          {/* Quem responde vem por prop: o gerador de prova na tela pública, e o fornecedor da marca
              na área protegida, quando o owner configurou um (D13). A chave do fornecedor nunca chega
              aqui; o `modelo` da marca é uma chamada à nossa função de servidor. */}
          <PainelDePrompt
            forma={FORMA}
            catalogo={CATALOGO}
            modelo={modelo}
            descricao={modeloDaTela.descricao}
            geradoEmCena={composicao.geradaPorPrompt}
            aoGerar={composicao.aceitarOGerado}
          />

          {FORMA.categorias.map(({ categoria, obrigatoria }) => (
            <ControleDaCategoria
              key={categoria}
              categoria={categoria}
              obrigatoria={obrigatoria}
              pecas={CATALOGO.pecas.filter((peca) => peca.categoria === categoria)}
              escolha={escolhas.get(categoria) ?? { pecaId: null }}
              aoMudar={(mudanca) => composicao.mudar(categoria, mudanca)}
            />
          ))}

          <PainelDeRecomeco
            ehPadrao={composicao.ehPadrao}
            podeDesfazer={composicao.podeDesfazer}
            aoVoltarAoPadrao={composicao.voltarAoPadrao}
            aoDesfazer={composicao.desfazerORecomeco}
          />

          <PainelDeSaida copia={copia} texto={composicao.texto} />

          <PainelDeColar forma={FORMA} catalogo={CATALOGO} aoAceitar={composicao.aceitarOColado} />
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
                  ehFalha(estado) ? 'palco3d__estado palco3d__estado--erro' : 'palco3d__estado'
                }
              >
                {textoDoEstadoDaComposicao(estado, montagem.zonas.length)}
              </p>
              {/* Perto do calçado, e não no painel do prompt: a regra de transparência pede o aviso
                  no lugar em que o calçado aparece. Fora de região viva, porque quem gerou já
                  ouviu o desfecho pelo painel. */}
              {composicao.geradaPorPrompt && (
                <p className="palco3d__aviso-gerado">{avisoDaComposicaoGerada(modeloDaTela.descricao)}</p>
              )}
            </>
          )}
        </section>

        <PainelDaPecaClicada selecionada={selecionada} zonas={montagem.zonas} />
      </div>
    </main>
  );
}

/** O acervo de prova sempre tem forma; isto existe para o tipo, e diz a verdade se acontecer. */
const SEM_FORMA = { modelo: null, zonas: [], erro: 'O acervo de prova não tem forma.' } as const;

/**
 * A frase de cada estado do palco, nesta tela.
 *
 * Separada da irmã de `TelaDoPalco3d` de propósito: o que está na cena é diferente nas duas, e uma
 * frase só teria que falar de "peça" e de "calçado montado" ao mesmo tempo. O que as duas dividem
 * é o `ehFalha`, que é a REGRA de quando o que está na moldura não vale, e essa é uma só.
 */
export function textoDoEstadoDaComposicao(estado: EstadoDoPalco, zonas: number): string {
  if (estado === 'carregando') return 'Montando o calçado…';
  if (estado === 'recusado') return 'O calçado montado foi recusado pelo carregador.';
  if (estado === 'contexto-perdido') {
    return (
      'O 3D caiu: o navegador tirou o contexto gráfico desta aba. O calçado não está sendo ' +
      'desenhado. Se ele não voltar sozinho em alguns segundos, recarregue a página.'
    );
  }
  if (estado === 'contexto-negado') {
    return (
      'O 3D não pôde ser iniciado: este navegador não entregou um contexto gráfico (WebGL). ' +
      'Não adianta recarregar, o calçado não vai aparecer nesta máquina. As cores continuam ' +
      'valendo e o esboço desenha o mesmo tênis em SVG, sem precisar de placa de vídeo.'
    );
  }

  return `Calçado montado com ${zonas} ${zonas === 1 ? 'zona' : 'zonas'}. Arraste para girar.`;
}
