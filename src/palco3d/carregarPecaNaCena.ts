// Texto glTF vira objeto de cena, mais o enquadramento que faz a peça caber no quadro.
//
// É a fronteira entre o acervo (que produz texto) e o palco (que desenha). Fica separada do
// componente por um motivo prático: o componente precisa de GPU e nenhum teste alcança, enquanto
// isto aqui roda inteiro sob jsdom, sem uma linha de WebGL.
//
// Nota de ambiente: o `FileLoader` do three dispara um `ProgressEvent` ao terminar de ler o
// `data:` URI, e `ProgressEvent` não existe no Node puro. Por isso os testes deste arquivo
// declaram `// @vitest-environment jsdom`. Foi descoberto por sonda antes do build, não no meio
// dele.

import { Box3, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface PecaNaCena {
  objeto: Object3D;
  /** O canto mínimo e máximo da peça no mundo, em metros. */
  caixa: Box3;
  /** Para onde a câmera olha: o centro da peça, não a origem. */
  alvo: Vector3;
  /** A que distância a câmera precisa ficar para a peça preencher o quadro. */
  distancia: number;
}

/**
 * Quantas vezes a maior dimensão da peça cabe entre a câmera e o alvo.
 *
 * Distância proporcional ao tamanho, nunca fixa: o cadarço tem 0,13 m e a sola tem 0,28 m, e uma
 * distância fixa faria a peça pequena virar um ponto enquanto a grande estoura o quadro. O
 * número é folgado o bastante para a peça não encostar nas bordas ao girar, porque uma caixa
 * vista pela diagonal é mais larga que vista de frente.
 */
const FOLGA_DO_ENQUADRAMENTO = 2.2;

/**
 * Carrega o texto glTF e devolve o objeto pronto para entrar na cena, já enquadrado.
 *
 * Recebe **texto**, nunca URL, porque é assim que o acervo de prova entrega
 * (`gltfDaPecaDeProva(id)`) e é a mesma chamada que o produto trazido usará depois de baixar o
 * arquivo do Storage. Nada aqui faz requisição.
 */
export async function carregarPecaNaCena(textoGltf: string): Promise<PecaNaCena> {
  const objeto = await analisar(textoGltf);

  return { objeto, ...enquadrar(objeto) };
}

/**
 * O enquadramento, derivado da caixa envolvente de verdade.
 *
 * Separado de `carregarPecaNaCena` porque T14 vai precisar dele sobre um grupo de peças montado,
 * e não sobre uma peça só. A regra é a mesma; o que muda é o que entra.
 */
export function enquadrar(objeto: Object3D): { caixa: Box3; alvo: Vector3; distancia: number } {
  const caixa = new Box3().setFromObject(objeto);
  const tamanho = caixa.getSize(new Vector3());
  const maiorDimensao = Math.max(tamanho.x, tamanho.y, tamanho.z);

  return {
    caixa,
    alvo: caixa.getCenter(new Vector3()),
    distancia: maiorDimensao * FOLGA_DO_ENQUADRAMENTO,
  };
}

/**
 * `GLTFLoader.parse` embrulhado em promessa.
 *
 * O segundo argumento é o caminho base para recursos externos. Vai vazio de propósito: as peças
 * do acervo trazem o buffer embutido em `data:` URI e `normalizarModelo3d` recusa qualquer uma
 * que aponte para fora. Um caminho base aqui daria a impressão de que buscar arquivo ao lado é
 * possibilidade prevista.
 */
function analisar(textoGltf: string): Promise<Object3D> {
  return new Promise((resolver, rejeitar) => {
    new GLTFLoader().parse(
      textoGltf,
      '',
      (gltf) => resolver(gltf.scene),
      (erro) => rejeitar(erro instanceof Error ? erro : new Error(String(erro))),
    );
  });
}
