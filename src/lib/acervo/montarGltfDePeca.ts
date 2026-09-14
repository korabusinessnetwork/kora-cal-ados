// Descrição de peça vira o texto de um glTF 2.0 válido, com a geometria embutida.
//
// Por que este arquivo existe e não reusa `fixtures/gltfDeTeste.ts`: aquele constrói um glTF
// *plausível* para testar a normalização, com um accessor de mentira que nenhum renderizador
// precisa ler. Aqui o arquivo vai ser aberto por um renderizador de verdade em T13, então cada
// byte do buffer precisa estar no lugar. São propósitos opostos, e fundir os dois faria o
// fixture da normalização carregar 200 linhas de layout de buffer que os testes dela ignoram.
//
// A peça já sai **canônica** no sentido do ADR-007 D4/D5: nó com nome próprio, malha própria e
// material próprio. Não é coincidência, é o ponto: `normalizarModelo3d` sobre uma peça de prova
// tem que ser um no-op, e o teste afirma isso. Se um dia deixar de ser, o acervo de prova
// deixou de imitar o acervo de verdade.

import { geometriaDeCaixa } from './geometriaDeCaixa';
import type { MalhaDePeca } from './malhaDePeca';
import type { ParametroDePeca } from '../composicao/tiposDaComposicao';

/** As três medidas da caixa que a peça ocupa. É tudo que um modelador precisa saber de fora. */
export interface MedidasDaPeca {
  /** Metros, eixo X. */
  comprimento: number;
  /** Metros, eixo Y. */
  altura: number;
  /** Metros, eixo Z. */
  largura: number;
}

/**
 * Quem transforma as medidas da peça em malha.
 *
 * A função **precisa** entregar a peça com a base em Y = 0 e ocupando as medidas pedidas: o
 * parâmetro escala o eixo Y do nó em volta da origem, e o resto do projeto mede a peça pela
 * caixa dela. Um modelador que devolvesse a peça centrada na origem a afundaria no chão a cada
 * milímetro de espessura.
 */
export type ModeladorDePeca = (medidas: MedidasDaPeca) => MalhaDePeca;

/**
 * Uma peça do acervo de prova, pelas medidas dela e por quem sabe modelá-la.
 *
 * `altura` é ao mesmo tempo o parâmetro de peça e a altura em que a peça é modelada: o campo
 * `padrao` dele **é** a altura da malha. Foi feito assim para que os dois não possam divergir,
 * que é o defeito que este módulo mais convidaria (declarar a sola com 18 mm no catálogo e
 * modelá-la com 20 mm, e ninguém perceber porque as duas informações moram em lugares
 * diferentes).
 */
export interface DescricaoDaPecaDeProva {
  id: string;
  categoria: string;
  rotulo: string;
  /** Metros, eixo X. */
  comprimento: number;
  /** Metros, eixo Z. */
  largura: number;
  /** O parâmetro que escala o eixo Y. O `padrao` dele é a altura modelada da peça. */
  altura: ParametroDePeca;
  /** Onde a peça assenta na forma, em metros. Vira a `translation` do nó. */
  assento: readonly [number, number, number];
  /**
   * Como a peça é modelada. Sem este campo, ela é uma caixa.
   *
   * A caixa continua sendo o padrão de propósito: ela é a peça mais simples que ainda exercita
   * todo o caminho (buffer, accessor, validador, normalização), e é ela que os testes deste
   * módulo usam. Assim um defeito na geometria de uma sola aparece nos testes da sola, e um
   * defeito no layout de buffer aparece aqui, sem os dois se misturarem.
   */
  modelar?: ModeladorDePeca;
  /**
   * A peça é uma casca aberta, e o lado de dentro dela aparece. Vira `doubleSided: true` no
   * material.
   *
   * É opcional e desligado por padrão porque dupla face custa o dobro de desenho e esconde defeito
   * de sentido de triângulo: num sólido fechado, uma face virada do avesso ficaria invisível e
   * alguém notaria; com dupla face ela aparece normalmente e o defeito passa. Só quem é aberto de
   * verdade (o cabedal, pela boca) liga.
   */
  materialDeDuplaFace?: boolean;
}

/** Constantes do glTF 2.0, escritas por extenso porque número solto no meio do JSON não se lê. */
const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

const BYTES_POR_FLOAT = 4;
const BYTES_POR_INDICE = 2;

/**
 * `unsigned short` guarda até este índice. Uma caixa usa 24 vértices e uma sola com cravos umas
 * poucas centenas, então sobra muito.
 */
const MAIOR_INDICE_EM_16_BITS = 65535;

/**
 * Produz o texto glTF da peça, com os parâmetros já validados aplicados.
 *
 * **Este módulo não valida parâmetro.** Quem recusa valor fora da faixa é `validarComposicao`,
 * e ter uma segunda validação aqui criaria duas regras que podem divergir, que é a família de
 * defeito que este projeto persegue desde o BUG-013. O que chega aqui já passou pelo guarda;
 * o que não passou pelo guarda não deveria estar chamando esta função.
 */
export function montarGltfDePeca(
  peca: DescricaoDaPecaDeProva,
  parametros: Readonly<Record<string, number>> = {},
): string {
  const modelar = peca.modelar ?? geometriaDeCaixa;
  const geometria = modelar({
    comprimento: peca.comprimento,
    altura: peca.altura.padrao,
    largura: peca.largura,
  });

  const vertices = geometria.posicoes.length / 3;
  recusarSeIndiceNaoCabe(vertices, peca.id);

  const buffer = montarBuffer(geometria);

  return JSON.stringify(
    {
      asset: { version: '2.0', generator: 'kora acervo de prova' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [
        {
          name: peca.id,
          mesh: 0,
          translation: [...peca.assento],
          scale: [1, fatorDeEscala(peca, parametros), 1],
        },
      ],
      meshes: [
        {
          name: peca.id,
          primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }],
        },
      ],
      // Material próprio por peça (ADR-007 D5), **sem campo de cor nenhum**.
      //
      // A peça declara o acabamento da superfície (fosco, não metálico), que é propriedade
      // física do material e não muda com a variante. Ela NÃO declara `baseColorFactor`: cor é
      // da composição, não da peça, porque o sistema guarda receita e nunca resultado (ADR-008
      // D2). Peça pintada obrigaria a mesma sola a existir duas vezes no acervo para duas
      // marcas que a querem em cores diferentes.
      //
      // Escrever o branco explícito `[1, 1, 1, 1]` daria no mesmo na tela (é o padrão do glTF
      // 2.0) e custaria caro em outro lugar: este arquivo teria que entrar na lista de licença
      // de `soUmLugarEscreveCorNoGltf.test.ts`, e a partir daí trocar aquela constante por uma
      // cor de verdade passaria calada. Omitir o campo mantém "só o recolor escreve cor no
      // glTF" literalmente verdadeiro, em vez de verdadeiro com exceção.
      materials: [
        {
          name: peca.id,
          pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.9 },
          // Campo ausente e não `false` quando desligado: `false` é o padrão do glTF 2.0, e
          // escrevê-lo mudaria o texto de toda peça que já existia sem mudar nada na tela.
          ...(peca.materialDeDuplaFace === true ? { doubleSided: true } : {}),
        },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: FLOAT,
          count: vertices,
          type: 'VEC3',
          // Obrigatórios no accessor de POSITION pela especificação glTF 2.0. O validador de
          // referência decodifica o buffer e confere os dois contra os vértices de verdade.
          min: geometria.minimo,
          max: geometria.maximo,
        },
        { bufferView: 1, componentType: FLOAT, count: vertices, type: 'VEC3' },
        { bufferView: 2, componentType: UNSIGNED_SHORT, count: geometria.indices.length, type: 'SCALAR' },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: buffer.posicoes.deslocamento, byteLength: buffer.posicoes.tamanho, target: ARRAY_BUFFER },
        { buffer: 0, byteOffset: buffer.normais.deslocamento, byteLength: buffer.normais.tamanho, target: ARRAY_BUFFER },
        { buffer: 0, byteOffset: buffer.indices.deslocamento, byteLength: buffer.indices.tamanho, target: ELEMENT_ARRAY_BUFFER },
      ],
      buffers: [
        {
          byteLength: buffer.bytes.length,
          // `data:` URI e nunca arquivo ao lado: `normalizarModelo3d` recusa URI externa, pela
          // mesma razão que `normalizarSvg` recusa referência para fora.
          uri: `data:application/octet-stream;base64,${paraBase64(buffer.bytes)}`,
        },
      ],
    },
    null,
    2,
  );
}

/**
 * Nenhuma peça do acervo de prova chega perto do limite, então esta guarda nunca dispara hoje.
 * Ela existe pelo que aconteceria se disparasse em silêncio: `setUint16` de um índice acima de 65535 **não lança**,
 * ele trunca. O resultado seria um modelo com triângulos apontando para o vértice errado, que
 * abre no navegador e desenha uma coisa que ninguém modelou.
 *
 * `Error` cru, sem `CodigoDeErro`: isto não é dado ruim de cliente, é peça de prova nossa
 * descrita errado. Um código de erro daria a este defeito um status HTTP e uma linha na tabela
 * de tradução da API, como se fosse algo que um tenant pudesse causar. Não é. Erro desconhecido
 * já vira 500 `FALHA_INTERNA`, que é a família certa: nossa.
 */
export function recusarSeIndiceNaoCabe(vertices: number, pecaId: string): void {
  if (vertices <= MAIOR_INDICE_EM_16_BITS) return;

  throw new Error(
    `A peça "${pecaId}" tem ${vertices} vértices e os índices do acervo de prova são de 16 bits. Troque o tipo de índice para UNSIGNED_INT (5125) antes de descrever peças deste tamanho.`,
  );
}

/**
 * O parâmetro vira **escala**, nunca malha nova (ADR-008 D7).
 *
 * É por isso que gerar a mesma peça com dois valores de espessura produz `accessors`,
 * `bufferViews` e `buffers` idênticos byte a byte: o único campo que muda no documento inteiro
 * é o `scale` do nó. Um teste afirma isso, porque é a diferença entre um acervo paramétrico e
 * um kit de montar com uma peça para cada milímetro.
 */
function fatorDeEscala(
  peca: DescricaoDaPecaDeProva,
  parametros: Readonly<Record<string, number>>,
): number {
  const pedido = parametros[peca.altura.nome];

  return pedido === undefined ? 1 : pedido / peca.altura.padrao;
}

interface Trecho {
  deslocamento: number;
  tamanho: number;
}

interface BufferDaPeca {
  bytes: Uint8Array;
  posicoes: Trecho;
  normais: Trecho;
  indices: Trecho;
}

/**
 * Escreve os três trechos num buffer só, na ordem posições, normais, índices.
 *
 * **Alinhamento**: o `byteOffset` de um accessor precisa ser múltiplo do tamanho do componente
 * dele. Os dois trechos de float ocupam 12 bytes por vértice cada (3 eixos × 4 bytes), então o
 * trecho de índices sempre começa num múltiplo de 4, que já é múltiplo de 2. O deslocamento é
 * calculado em vez de digitado justamente por isso: peça de qualquer contagem de vértices,
 * caixa ou sola com cravos, continua alinhada sozinha.
 */
function montarBuffer(geometria: MalhaDePeca): BufferDaPeca {
  const posicoes: Trecho = { deslocamento: 0, tamanho: geometria.posicoes.length * BYTES_POR_FLOAT };
  const normais: Trecho = {
    deslocamento: posicoes.tamanho,
    tamanho: geometria.normais.length * BYTES_POR_FLOAT,
  };
  const indices: Trecho = {
    deslocamento: alinhar(normais.deslocamento + normais.tamanho, BYTES_POR_INDICE),
    tamanho: geometria.indices.length * BYTES_POR_INDICE,
  };

  const bytes = new Uint8Array(indices.deslocamento + indices.tamanho);
  const escrita = new DataView(bytes.buffer);

  // `littleEndian: true` explícito em toda escrita. O glTF 2.0 fixa little-endian, e um
  // `Float32Array` herdaria a ordem da máquina: correto em x86 e ARM de hoje, e um arquivo
  // corrompido em silêncio no dia em que não for.
  geometria.posicoes.forEach((valor, indice) => {
    escrita.setFloat32(posicoes.deslocamento + indice * BYTES_POR_FLOAT, valor, true);
  });
  geometria.normais.forEach((valor, indice) => {
    escrita.setFloat32(normais.deslocamento + indice * BYTES_POR_FLOAT, valor, true);
  });
  geometria.indices.forEach((valor, indice) => {
    escrita.setUint16(indices.deslocamento + indice * BYTES_POR_INDICE, valor, true);
  });

  return { bytes, posicoes, normais, indices };
}

function alinhar(deslocamento: number, multiplo: number): number {
  const sobra = deslocamento % multiplo;

  return sobra === 0 ? deslocamento : deslocamento + (multiplo - sobra);
}

/**
 * Bytes para base64 sem `Buffer`.
 *
 * `Buffer` só existe no Node, e este módulo é importado pelo navegador em T13. `btoa` existe
 * nos dois desde o Node 16. Um `Buffer.from(...)` aqui compilaria, passaria nos testes e
 * quebraria só na tela, que é o pior lugar para descobrir.
 */
function paraBase64(bytes: Uint8Array): string {
  let texto = '';
  for (const byte of bytes) texto += String.fromCharCode(byte);

  return btoa(texto);
}
