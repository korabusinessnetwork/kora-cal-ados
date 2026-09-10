// A composição validada vira UM calçado montado, colorido, pronto para a tela ou para a API.
//
// É a orquestração de T14, e o único arquivo desta entrega que conhece as outras cinco peças do
// quebra-cabeça. Ele não sabe medir, não sabe deslocar, não sabe juntar e não sabe pintar: sabe a
// ORDEM em que essas quatro coisas acontecem, que é a única regra que mora aqui.
//
// Produz glTF, e não objetos de cena (decisão D1). É o que faz a mesma montagem servir ao palco 3D
// de hoje e à API de exportação de amanhã (ADR-009), em vez de existirem duas montagens que podem
// discordar sobre onde o cabedal assenta.

import { medidaDoModelo3d } from '../render/medidaDoModelo3d';
import { deslocarModelo3d } from '../render/deslocarModelo3d';
import { juntarModelos3d } from '../render/juntarModelos3d';
import { recolorirModelo3d, type CoresPorZona, type Zona3d } from '../render/recolorirModelo3d';
import { empilharComposicao, type FaixaVertical } from './empilharComposicao';
import type { ComposicaoValidada, PecaDoAcervo } from './tiposDaComposicao';

/**
 * De onde sai o glTF de uma peça, com os parâmetros já aplicados.
 *
 * Entra por parâmetro, e não por `import`, porque hoje a única fonte é o acervo de prova (código)
 * e amanhã é o storage do tenant (rede). Amarrar a montagem a uma delas obrigaria a reescrever
 * este arquivo na virada, ou pior, faria o módulo de composição importar dados de prova para
 * sempre. Também é o que mantém o teste desta orquestração sem rede e sem mock de módulo.
 */
export type ProvedorDeGltfDaPeca = (
  peca: PecaDoAcervo,
  parametros: Readonly<Record<string, number>>,
) => string;

export interface CalcadoMontado {
  /** O glTF do calçado inteiro, canônico e já colorido. */
  modelo: string;
  /**
   * As zonas do calçado montado, uma por peça, com `zone_key` igual à **categoria** (ADR-008 D3).
   *
   * Devolvidas junto, e não recalculadas por quem consome, porque "a zona da sola é o nó chamado
   * `prova-sola-plana`" é conhecimento derivado: reconstruí-lo na tela e de novo na API criaria
   * duas versões do mesmo mapeamento, livres para divergir. É o defeito do BUG-013 mudando de
   * roupa, e aqui ele apareceria como a cor certa no lugar errado, que é o princípio nº1 ao avesso.
   */
  zonas: Zona3d[];
}

/**
 * Monta o calçado: mede cada peça, empilha, desloca, junta e pinta. Nessa ordem, que não é livre.
 *
 * Medir vem antes de deslocar porque o deslocamento é calculado sobre onde a peça foi modelada;
 * medir depois mediria o resultado do próprio deslocamento. Juntar vem antes de pintar por causa
 * da decisão D4: a cor é aplicada **uma vez, no modelo inteiro**, que é o que torna a sobreposição
 * de zonas detectável e o que garante que o motor usado aqui é o mesmo que a API vai usar.
 *
 * Assume peças **canônicas** e não normaliza (D6). Normalizar é do momento do upload, não do
 * momento de montar, e uma normalização escondida aqui reescreveria o asset-base do tenant sem
 * ninguém pedir, o que o ADR-005 proíbe. O que substitui a normalização é um teste: as peças do
 * acervo passam por `normalizarModelo3d` sem mudar nada.
 */
export function montarComposicao(
  composicao: ComposicaoValidada,
  provedorDeGltf: ProvedorDeGltfDaPeca,
): CalcadoMontado {
  const modelados = composicao.pecas.map((escolha) => ({
    escolha,
    gltf: provedorDeGltf(escolha.peca, escolha.parametros),
  }));

  const faixas = new Map<string, FaixaVertical>(
    modelados.map(({ escolha, gltf }) => [escolha.categoria, faixaVerticalDe(gltf)]),
  );
  const deslocamentos = empilharComposicao(composicao.forma, faixas);

  // A ordem em que as peças entram na junção é a da composição, que é a que o modelo de linguagem
  // escreveu. Ela decide só a numeração dos índices no documento final, nunca onde a peça fica:
  // quem decide isso é o deslocamento, que já foi calculado sem olhar ordem nenhuma. Reordenar
  // aqui daria a impressão de que a ordem importa, e alguém acabaria dependendo dela.
  const junto = juntarModelos3d(
    modelados.map(({ escolha, gltf }) =>
      deslocarModelo3d(gltf, [0, deslocamentos.get(escolha.categoria) ?? 0, 0]),
    ),
  );

  const zonas = modelados.map(({ escolha }) => ({
    zone_key: escolha.categoria,
    malhas: [escolha.peca.id],
  }));

  return { modelo: recolorirModelo3d(junto, zonas, coresPedidas(composicao)), zonas };
}

/**
 * A faixa que a peça ocupa no eixo vertical, que é tudo que o empilhamento precisa saber dela.
 *
 * O eixo 1 é o Y, que é o "para cima" do glTF 2.0 por especificação, não por convenção nossa.
 */
function faixaVerticalDe(gltf: string): FaixaVertical {
  const caixa = medidaDoModelo3d(gltf);

  return { base: caixa.minimo[1], topo: caixa.maximo[1] };
}

/**
 * Só as peças que pediram cor. Peça sem cor não entra, e por isso fica com a cor com que foi
 * modelada, em vez de receber um branco ou um preto que ninguém escolheu.
 */
function coresPedidas(composicao: ComposicaoValidada): CoresPorZona {
  const cores: CoresPorZona = {};

  for (const { categoria, cor } of composicao.pecas) {
    if (cor !== undefined) cores[categoria] = cor;
  }

  return cores;
}
