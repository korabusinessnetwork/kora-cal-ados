// A geometria grosseira do acervo de prova: uma caixa, e só.
//
// Este arquivo não conhece glTF. Ele produz listas de números, e quem as embrulha em buffer,
// bufferView e accessor é `montarGltfDePeca.ts`. A separação existe porque as duas coisas
// erram de jeitos diferentes: aqui o defeito é um vértice no lugar errado ou um triângulo
// virado do avesso; lá é byte desalinhado. Testar as duas juntas confundiria os dois.
//
// Por que caixa: a decisão 1 do dono foi provar a esteira com geometria grosseira antes de
// investir em modelagem. Caixa é o menor sólido fechado que dá para ver girando na tela e
// clicar para identificar, que é exatamente o que T13 precisa provar.

import { arredondarParaFloat32 } from './malhaDePeca';

/** Metros. glTF 2.0 fixa o metro como unidade, e um tênis 42 tem uns 0,28 m. */
export interface DimensoesDaCaixa {
  /** Eixo X, do calcanhar à biqueira. */
  comprimento: number;
  /** Eixo Y, para cima. É o eixo que o parâmetro de peça escala (ADR-008 D7). */
  altura: number;
  /** Eixo Z, de um lado ao outro do pé. */
  largura: number;
}

export interface GeometriaDeCaixa {
  /** 24 vértices (4 por face), em `x, y, z`. Ver `arredondarParaFloat32` para o porquê de 24. */
  posicoes: number[];
  /** Uma normal por vértice, na mesma ordem. */
  normais: number[];
  /** 36 índices, 2 triângulos por face, sentido anti-horário visto de fora. */
  indices: number[];
  /** O canto mínimo, já em precisão de float32. Vira `accessors[POSITION].min`. */
  minimo: [number, number, number];
  maximo: [number, number, number];
}

/**
 * Uma face, descrita pelo centro dela e por dois meio-vetores no plano dela.
 *
 * `u` e `v` são escolhidos com `u × v = normal`. Essa é a regra inteira do sentido de
 * enrolamento: percorrer os cantos como `-u-v`, `+u-v`, `+u+v`, `-u+v` sai anti-horário visto
 * de fora sempre que essa igualdade vale. Escrever assim, em vez de digitar 24 vértices na mão,
 * é o que impede uma face virada do avesso passar despercebida (ela ficaria invisível no
 * navegador, porque o renderizador descarta a face de trás).
 */
interface Face {
  normal: [number, number, number];
  centro: [number, number, number];
  u: [number, number, number];
  v: [number, number, number];
}

/**
 * A caixa nasce com o **centro da base na origem**, não o centro do volume.
 *
 * É uma escolha de montagem, não de estilo: o parâmetro de peça escala o eixo Y, e escalar em
 * volta da origem faz a peça crescer **para cima** a partir de onde ela assenta. Se o centro do
 * volume estivesse na origem, engrossar uma sola a afundaria meio milímetro no chão a cada
 * milímetro de espessura, e a montagem de T14 teria que compensar isso peça a peça.
 */
export function geometriaDeCaixa(dimensoes: DimensoesDaCaixa): GeometriaDeCaixa {
  // Arredonda a dimensão INTEIRA antes de partir ao meio, nunca o contrário: dividir por 2 é
  // exato em ponto flutuante binário, então `meiaAltura * 2` volta a ser exatamente a altura
  // pedida. Arredondar a metade primeiro faria o topo da caixa cair meio ulp longe da altura, e
  // um teste que confere "a caixa tem a altura que eu pedi" ficaria vermelho sem defeito real.
  const comprimento = arredondarParaFloat32(dimensoes.comprimento);
  const altura = arredondarParaFloat32(dimensoes.altura);
  const largura = arredondarParaFloat32(dimensoes.largura);

  const meioComprimento = comprimento / 2;
  const meiaAltura = altura / 2;
  const meiaLargura = largura / 2;

  const faces: Face[] = [
    { normal: [1, 0, 0], centro: [meioComprimento, meiaAltura, 0], u: [0, meiaAltura, 0], v: [0, 0, meiaLargura] },
    { normal: [-1, 0, 0], centro: [-meioComprimento, meiaAltura, 0], u: [0, 0, meiaLargura], v: [0, meiaAltura, 0] },
    { normal: [0, 1, 0], centro: [0, altura, 0], u: [0, 0, meiaLargura], v: [meioComprimento, 0, 0] },
    { normal: [0, -1, 0], centro: [0, 0, 0], u: [meioComprimento, 0, 0], v: [0, 0, meiaLargura] },
    { normal: [0, 0, 1], centro: [0, meiaAltura, meiaLargura], u: [meioComprimento, 0, 0], v: [0, meiaAltura, 0] },
    { normal: [0, 0, -1], centro: [0, meiaAltura, -meiaLargura], u: [0, meiaAltura, 0], v: [meioComprimento, 0, 0] },
  ];

  const posicoes: number[] = [];
  const normais: number[] = [];
  const indices: number[] = [];

  for (const face of faces) {
    const primeiro = posicoes.length / 3;

    for (const canto of cantosDaFace(face)) {
      posicoes.push(...canto);
      normais.push(...face.normal);
    }

    indices.push(primeiro, primeiro + 1, primeiro + 2, primeiro, primeiro + 2, primeiro + 3);
  }

  return { posicoes, normais, indices, minimo: extremo(posicoes, Math.min), maximo: extremo(posicoes, Math.max) };
}

/**
 * Os 4 cantos, na ordem que produz o sentido anti-horário. Ver o comentário de `Face`.
 *
 * Cada face tem os **seus** 4 vértices, então a caixa tem 24 e não 8. Compartilhar os 8 cantos
 * economizaria bytes e custaria o que importa: um vértice compartilhado carrega uma normal só,
 * e as três faces que se encontram num canto têm normais diferentes. O resultado seria uma
 * caixa de arestas arredondadas, que é o oposto do que "geometria grosseira" quer mostrar.
 */
function cantosDaFace({ centro, u, v }: Face): Array<[number, number, number]> {
  const canto = (sinalU: number, sinalV: number): [number, number, number] => [
    arredondarParaFloat32(centro[0] + sinalU * u[0] + sinalV * v[0]),
    arredondarParaFloat32(centro[1] + sinalU * u[1] + sinalV * v[1]),
    arredondarParaFloat32(centro[2] + sinalU * u[2] + sinalV * v[2]),
  ];

  return [canto(-1, -1), canto(1, -1), canto(1, 1), canto(-1, 1)];
}

/**
 * O canto mínimo ou máximo da nuvem de pontos, eixo a eixo.
 *
 * Calculado a partir das posições de verdade, nunca das dimensões pedidas. O `min`/`max` do
 * accessor de POSITION é obrigatório no glTF 2.0 e o validador de referência **decodifica o
 * buffer e confere**: um `max` derivado do parâmetro em vez do vértice reprova assim que uma
 * conta de meio-extente arredondar diferente.
 */
function extremo(posicoes: number[], escolher: (...valores: number[]) => number): [number, number, number] {
  const eixo = (deslocamento: number): number =>
    escolher(...posicoes.filter((_, indice) => indice % 3 === deslocamento));

  return [eixo(0), eixo(1), eixo(2)];
}

// `arredondarParaFloat32` mora em `malhaDePeca.ts`, que é onde toda geometria do acervo o busca.
// Continua exportado daqui para quem já importava deste arquivo não quebrar.
export { arredondarParaFloat32 };
