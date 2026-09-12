// O `<canvas>` e o laço de render. **O único arquivo do palco que precisa de GPU.**
//
// Chama-se "de modelo" e não "da peça" porque ele nunca soube o que é uma peça: recebe texto glTF
// e desenha. Em T13 o que chegava era uma peça solta; desde T14 chega um calçado inteiro montado,
// e o arquivo não mudou uma linha para isso. O nome antigo faria "busca por nome de conceito bate
// com nome de arquivo" (ADR-003) virar mentira já na primeira reutilização.
//
// E por isso o único sem teste unitário: jsdom não tem WebGL, então nada aqui é alcançável por
// teste. A consequência prática é a regra que este arquivo tem que obedecer: **ele não decide
// nada**. Onde a câmera fica é `orbita.ts`, o que o ponteiro acertou é `nomeDaMalhaNoPonto.ts`,
// como a peça vira cena é `carregarPecaNaCena.ts`, e os três têm teste. O que sobra aqui é
// encanamento: criar o renderizador, medir o elemento, ouvir o ponteiro, chamar `render`.
//
// Se um dia aparecer aritmética de câmera ou lógica de seleção neste arquivo, ela escapou para o
// lugar onde nenhum teste olha. É o critério 20 da spec, e é a razão de ele existir.
//
// O contexto WebGL é criado **uma vez** e sobrevive à troca de peça. Recriá-lo a cada troca
// pareceria funcionar e travaria o navegador depois de algumas: o navegador limita quantos
// contextos existem ao mesmo tempo e descarta os mais velhos em silêncio.

import { useEffect, useRef } from 'react';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';

import { carregarPecaNaCena } from './carregarPecaNaCena';
import { nomeDaMalhaNoPonto } from './nomeDaMalhaNoPonto';
import { orbitaInicial, orbitarPorArraste, posicaoDaCamera, type Orbita } from './orbita';

/** Em que pé está o carregamento da peça, para a tela mostrar em vez de ficar muda. */
export type EstadoDoPalco = 'carregando' | 'pronto' | 'recusado';

export interface PalcoDeModelo3dProps {
  /** O texto glTF a desenhar. Trocar esta prop troca o modelo, sem recriar o contexto WebGL. */
  textoGltf: string;
  /** Cada clique devolve o nome do nó atingido, ou `null` quando o clique foi no vazio. */
  aoSelecionar: (nome: string | null) => void;
  /** Carregando, pronto ou recusado. Estado sempre visível é o princípio nº1. */
  aoMudarEstado: (estado: EstadoDoPalco) => void;
  /**
   * O que este palco está mostrando, em uma frase. Vira o nome acessível da moldura.
   *
   * Chega por prop e não é escrito aqui porque este arquivo NÃO SABE o que desenha: recebe texto
   * glTF, e quem sabe se é uma peça solta ou o calçado montado é a tela que o monta. Escrever a
   * frase aqui seria a primeira decisão de conteúdo num arquivo que não pode decidir nada.
   */
  rotulo: string;
}

/**
 * Quantos pixels o ponteiro pode andar entre apertar e soltar e ainda contar como clique.
 *
 * Zero não serve: a mão treme, e um clique com um pixel de deslize viraria giro, deixando a peça
 * impossível de selecionar em telas sensíveis. Um número grande também não: aí um giro curto
 * viraria clique e mudaria a seleção sem ninguém pedir.
 */
const PIXELS_ATE_VIRAR_ARRASTE = 4;

export function PalcoDeModelo3d({
  textoGltf,
  aoSelecionar,
  aoMudarEstado,
  rotulo,
}: PalcoDeModelo3dProps) {
  const moldura = useRef<HTMLDivElement | null>(null);
  const palco = useRef<Palco | null>(null);

  // Os callbacks entram por referência mutável, e não como dependência do efeito, porque a tela
  // os recria a cada render. Como dependência, o palco inteiro seria destruído e reconstruído a
  // cada tecla digitada, junto com o contexto WebGL.
  const selecionar = useRef(aoSelecionar);
  const mudarEstado = useRef(aoMudarEstado);
  selecionar.current = aoSelecionar;
  mudarEstado.current = aoMudarEstado;

  useEffect(() => {
    const elemento = moldura.current;
    if (elemento === null) return undefined;

    const criado = criarPalco(elemento, {
      aoSelecionar: (nome) => selecionar.current(nome),
      aoMudarEstado: (estado) => mudarEstado.current(estado),
    });
    palco.current = criado;

    return () => {
      palco.current = null;
      criado.destruir();
    };
  }, []);

  useEffect(() => {
    palco.current?.trocarModelo(textoGltf);
  }, [textoGltf]);

  // `touch-action: none` mora no CSS: sem ele o navegador de toque rola a página em vez de
  // entregar o arraste, e o palco fica imóvel no celular sem nenhum erro.
  //
  // `role="group"` com rótulo, e não `img`: a moldura não é uma figura, é uma área que aceita
  // arraste e clique. É o mesmo par que `PalcoDeMarcacao` já usa no editor 2D. Sem isto o palco
  // era um `<div>` anônimo com um `<canvas>` dentro, ou seja, não existia para quem navega pela
  // árvore de acessibilidade: nem o nome, nem o aviso de que dá para girar e clicar.
  return (
    <div className="palco3d__moldura" role="group" aria-label={rotulo} ref={moldura} />
  );
}

interface Palco {
  trocarModelo: (textoGltf: string) => void;
  destruir: () => void;
}

interface AvisosDoPalco {
  aoSelecionar: (nome: string | null) => void;
  aoMudarEstado: (estado: EstadoDoPalco) => void;
}

/**
 * Monta renderizador, cena, luz e escutas, e devolve as duas alavancas que o componente usa.
 *
 * Fora do componente de propósito: é código imperativo com ciclo de vida próprio, e misturá-lo
 * com hooks é o jeito mais fácil de vazar um laço de render que continua rodando depois de a
 * tela sair.
 */
function criarPalco(moldura: HTMLDivElement, avisos: AvisosDoPalco): Palco {
  const renderizador = new WebGLRenderer({ antialias: true });
  renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  moldura.appendChild(renderizador.domElement);

  const cena = new Scene();
  cena.background = new Color('#14141b');
  cena.add(new AmbientLight(0xffffff, 1.6));
  cena.add(luz(0xffffff, 3.2, [1, 2, 1.5]));
  // A segunda luz, fraca e do lado oposto, existe só para a face escondida não virar um bloco
  // preto. Sem ela a peça parece uma silhueta chapada, que é justamente o que a conferência a
  // olho da spec manda procurar.
  cena.add(luz(0xffffff, 1.1, [-1.5, 0.5, -1]));

  const camera = new PerspectiveCamera(45, 1, 0.01, 100);
  let orbita: Orbita = orbitaInicial(1);
  let alvo = { x: 0, y: 0, z: 0 };

  let pecaAtual: Object3D | null = null;
  // Cada pedido de troca ganha um número. Só o mais recente tem direito de entrar na cena: sem
  // isso, trocar de peça duas vezes depressa pode fazer a primeira chegar depois da segunda e
  // ficar na tela, com o seletor mostrando outra coisa.
  let pedidoAtual = 0;

  let arrastando: { x: number; y: number; andou: number } | null = null;
  let quadro = 0;
  let vivo = true;

  function posicionarCamera() {
    const posicao = posicaoDaCamera(orbita, alvo);
    camera.position.set(posicao.x, posicao.y, posicao.z);
    camera.lookAt(alvo.x, alvo.y, alvo.z);
  }

  function desenhar() {
    if (!vivo) return;
    quadro = requestAnimationFrame(desenhar);

    const largura = moldura.clientWidth;
    const altura = moldura.clientHeight;
    // Antes do primeiro layout o elemento mede 0 por 0, e a razão de aspecto viraria divisão por
    // zero, que o three propaga como matriz `NaN` e a tela fica preta sem erro nenhum. Esperar
    // uma medida positiva é mais barato que descobrir isso depois.
    if (largura === 0 || altura === 0) return;

    if (renderizador.domElement.width !== Math.floor(largura * renderizador.getPixelRatio())) {
      renderizador.setSize(largura, altura, false);
      camera.aspect = largura / altura;
      camera.updateProjectionMatrix();
    }

    renderizador.render(cena, camera);
  }

  function aoApertar(evento: PointerEvent) {
    renderizador.domElement.setPointerCapture(evento.pointerId);
    arrastando = { x: evento.clientX, y: evento.clientY, andou: 0 };
  }

  function aoMover(evento: PointerEvent) {
    if (arrastando === null) return;

    const deltaX = evento.clientX - arrastando.x;
    const deltaY = evento.clientY - arrastando.y;
    orbita = orbitarPorArraste(orbita, deltaX, deltaY);
    posicionarCamera();

    arrastando = {
      x: evento.clientX,
      y: evento.clientY,
      andou: arrastando.andou + Math.abs(deltaX) + Math.abs(deltaY),
    };
  }

  function aoSoltar(evento: PointerEvent) {
    const arraste = arrastando;
    arrastando = null;
    if (renderizador.domElement.hasPointerCapture(evento.pointerId)) {
      renderizador.domElement.releasePointerCapture(evento.pointerId);
    }
    // `arraste === null` acontece quando a peça foi trocada com o ponteiro apertado: o arraste
    // foi cancelado ali, e soltar depois não pode virar um clique que ninguém deu.
    if (arraste === null || arraste.andou > PIXELS_ATE_VIRAR_ARRASTE) return;

    avisos.aoSelecionar(nomeDaMalhaNoPonto(normalizar(evento), camera, cena));
  }

  /**
   * Pixel da tela vira o intervalo `-1`..`1` que o raio espera.
   *
   * A conversão mora aqui, e não em `nomeDaMalhaNoPonto`, porque depende de
   * `getBoundingClientRect`, que jsdom devolve zerado. Lá dentro, ela tornaria a função
   * intestável justamente na parte que decide qual zona o usuário tocou.
   */
  function normalizar(evento: PointerEvent): { x: number; y: number } {
    const area = renderizador.domElement.getBoundingClientRect();

    return {
      x: ((evento.clientX - area.left) / area.width) * 2 - 1,
      y: -((evento.clientY - area.top) / area.height) * 2 + 1,
    };
  }

  renderizador.domElement.addEventListener('pointerdown', aoApertar);
  renderizador.domElement.addEventListener('pointermove', aoMover);
  renderizador.domElement.addEventListener('pointerup', aoSoltar);
  renderizador.domElement.addEventListener('pointercancel', aoSoltar);

  quadro = requestAnimationFrame(desenhar);

  return {
    trocarModelo(textoGltf: string) {
      pedidoAtual += 1;
      const meuPedido = pedidoAtual;
      // Um arraste em curso passou a apontar para uma peça que vai deixar de existir. Cancelar
      // aqui é o que impede o soltar seguinte de virar clique sobre a peça errada.
      arrastando = null;
      avisos.aoMudarEstado('carregando');

      carregarPecaNaCena(textoGltf).then(
        ({ objeto, alvo: centro, distancia }) => {
          if (!vivo || meuPedido !== pedidoAtual) {
            descartar(objeto);
            return;
          }

          if (pecaAtual !== null) {
            cena.remove(pecaAtual);
            descartar(pecaAtual);
          }
          pecaAtual = objeto;
          cena.add(objeto);

          alvo = { x: centro.x, y: centro.y, z: centro.z };
          // A órbita recomeça na vista inicial porque a distância vem do tamanho da peça nova, e
          // manter a distância da anterior faria o cadarço virar um ponto depois da sola.
          orbita = orbitaInicial(distancia);
          posicionarCamera();
          avisos.aoMudarEstado('pronto');
        },
        () => {
          if (!vivo || meuPedido !== pedidoAtual) return;
          avisos.aoMudarEstado('recusado');
        },
      );
    },

    destruir() {
      vivo = false;
      cancelAnimationFrame(quadro);

      renderizador.domElement.removeEventListener('pointerdown', aoApertar);
      renderizador.domElement.removeEventListener('pointermove', aoMover);
      renderizador.domElement.removeEventListener('pointerup', aoSoltar);
      renderizador.domElement.removeEventListener('pointercancel', aoSoltar);

      if (pecaAtual !== null) {
        cena.remove(pecaAtual);
        descartar(pecaAtual);
        pecaAtual = null;
      }

      // `dispose` devolve o contexto WebGL. Sem ele, trocar de tela algumas vezes esgota o
      // limite de contextos do navegador e o palco simplesmente para de desenhar, sem erro.
      renderizador.dispose();
      renderizador.domElement.remove();
    },
  };
}

function luz(cor: number, intensidade: number, [x, y, z]: readonly [number, number, number]) {
  const direcional = new DirectionalLight(cor, intensidade);
  direcional.position.set(x, y, z);

  return direcional;
}

/**
 * Devolve a memória de GPU da peça que saiu de cena.
 *
 * `remove` tira o objeto da árvore, e só. Geometria e material continuam na placa de vídeo até
 * alguém pedir `dispose`, e trocar de peça dezenas de vezes numa sessão de trabalho é exatamente
 * o uso previsto desta tela.
 */
function descartar(objeto: Object3D) {
  objeto.traverse((no) => {
    if (!(no instanceof Mesh)) return;

    no.geometry.dispose();
    const materiais: Material[] = Array.isArray(no.material) ? no.material : [no.material];
    for (const material of materiais) material.dispose();
  });
}
