// N modelos 3D canônicos viram UM documento glTF só, com toda referência por índice reapontada.
//
// Por que este módulo é bem mais simples do que "juntar arquivos binários" sugere: o glTF 2.0
// permite **vários `buffers` no mesmo documento**. Juntar N modelos, então, não exige concatenar
// binário nem recalcular offset de byte nenhum: basta concatenar os arrays e somar um
// deslocamento a cada índice. Essa é a decisão que tira daqui a aritmética de offset, que é
// justamente onde este tipo de código costuma errar (e errar em silêncio, com o arquivo abrindo
// e desenhando geometria que ninguém modelou).
//
// O que este módulo NÃO faz:
// - **não normaliza** (spec T14, D6): entra canônico, sai canônico, exatamente como
//   `recolorirModelo3d`. Quem torna um arquivo canônico é `normalizarModelo3d`, no upload.
// - **não mexe em cor**: reaponta o índice da textura de cor base porque é índice, e nada mais.
//   Quem pinta é `recolorirModelo3d`, e `soUmLugarEscreveCorNoGltf.test.ts` guarda a fronteira.
// - **não conhece three.js**: glTF é JSON, e juntar documentos é cirurgia em JSON.
// - **não posiciona peça**: quem empilha é `empilharComposicao` + `deslocarModelo3d`.

import { ErroDeVariante } from './erros';
import { analisarGltf, escreverGltf } from './lerGltf';
import type {
  AcessorDoGltf,
  BufferViewDoGltf,
  DocumentoGltf,
  MalhaDoGltf,
  MaterialDoGltf,
  NoDoGltf,
  PrimitivaDoGltf,
  RecursoComUri,
  TexturaDoGltf,
} from './tiposDoGltf';

/** Quanto somar a cada índice do documento que está sendo acrescentado. */
interface Deslocamentos {
  buffers: number;
  bufferViews: number;
  accessors: number;
  meshes: number;
  materials: number;
  images: number;
  samplers: number;
  textures: number;
  nodes: number;
}

/** Os arrays do documento junto enquanto crescem, mais os nós raiz da cena única. */
interface ArraysJuntos {
  buffers: RecursoComUri[];
  bufferViews: BufferViewDoGltf[];
  accessors: AcessorDoGltf[];
  meshes: MalhaDoGltf[];
  materials: MaterialDoGltf[];
  images: RecursoComUri[];
  samplers: Array<Record<string, unknown>>;
  textures: TexturaDoGltf[];
  nodes: NoDoGltf[];
  raizes: number[];
}

/** Os campos de topo que este módulo reconstrói. Todo o resto vem do primeiro documento. */
const CAMPOS_REINDEXADOS = new Set([
  'scene',
  'scenes',
  'nodes',
  'meshes',
  'materials',
  'accessors',
  'bufferViews',
  'buffers',
  'textures',
  'images',
  'samplers',
]);

/**
 * N modelos canônicos viram um só, com toda referência por índice reapontada.
 *
 * Lança em vez de devolver "quase certo": lista vazia, documento sem cena e documento com
 * `animations`/`skins`/`cameras` viram `ErroDeVariante` com código, nunca um glTF que abre e
 * mostra a coisa errada.
 */
export function juntarModelos3d(modelosCanonicos: readonly string[]): string {
  const documentos = modelosCanonicos.map((texto) => analisarGltf(texto));
  const primeiro = documentos[0];

  // Cena vazia devolvida com sucesso é o BUG-001 por outro caminho: nada na tela e nenhum aviso.
  // Quem chamou juntar sem modelo nenhum tem um defeito a montante, e precisa saber disso agora.
  if (primeiro === undefined) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      'Não há nenhum modelo 3D para juntar. Um glTF vazio seria um calçado invisível entregue com sucesso.',
    );
  }

  // Todas as recusas antes de qualquer concatenação, pela mesma regra de `recolorirModelo3d`:
  // o modelo junto sai inteiro ou não sai. Metade dos documentos juntos e um erro no meio
  // devolveria um arquivo que ninguém sabe interpretar.
  for (const documento of documentos) recusarOQueNaoDaParaReindexar(documento);

  const junto: ArraysJuntos = {
    buffers: [],
    bufferViews: [],
    accessors: [],
    meshes: [],
    materials: [],
    images: [],
    samplers: [],
    textures: [],
    nodes: [],
    raizes: [],
  };

  for (const documento of documentos) acrescentar(junto, documento);

  return escreverGltf(montarDocumentoJunto(primeiro, junto));
}

/**
 * Um documento inteiro entra nos arrays juntos, com cada índice dele deslocado.
 *
 * A ordem das seções aqui é indiferente ao resultado, porque os deslocamentos são todos lidos
 * antes de o primeiro `push` acontecer. Isso é obrigatório e não estilo: depois de acrescentar
 * um array, `length` já não é mais o começo deste documento, e os índices sairiam adiantados.
 */
function acrescentar(junto: ArraysJuntos, documento: DocumentoGltf): void {
  const deslocamento: Deslocamentos = {
    buffers: junto.buffers.length,
    bufferViews: junto.bufferViews.length,
    accessors: junto.accessors.length,
    meshes: junto.meshes.length,
    materials: junto.materials.length,
    images: junto.images.length,
    samplers: junto.samplers.length,
    textures: junto.textures.length,
    nodes: junto.nodes.length,
  };

  // Spread e nunca reconstrução campo a campo: `byteLength`, `byteStride`, `target`, `extras` e
  // qualquer extensão que ninguém aqui mapeou têm que sair como entraram. É a mesma promessa que
  // o `[campo: string]: unknown` de `tiposDoGltf.ts` faz, e reconstruir é como ela se perde.
  for (const buffer of documento.buffers ?? []) junto.buffers.push({ ...buffer });
  for (const imagem of documento.images ?? []) junto.images.push({ ...imagem });
  for (const sampler of documento.samplers ?? []) junto.samplers.push({ ...sampler });

  for (const bufferView of documento.bufferViews ?? []) {
    junto.bufferViews.push({ ...bufferView, buffer: somar(bufferView.buffer, deslocamento.buffers) });
  }

  for (const acessor of documento.accessors ?? []) {
    junto.accessors.push({ ...acessor, bufferView: somar(acessor.bufferView, deslocamento.bufferViews) });
  }

  for (const textura of documento.textures ?? []) {
    junto.textures.push({
      ...textura,
      source: somar(textura.source, deslocamento.images),
      sampler: somar(textura.sampler, deslocamento.samplers),
    });
  }

  for (const material of documento.materials ?? []) {
    junto.materials.push(reindexarMaterial(material, deslocamento.textures));
  }

  for (const malha of documento.meshes ?? []) {
    junto.meshes.push({
      ...malha,
      primitives: malha.primitives?.map((primitiva) => reindexarPrimitiva(primitiva, deslocamento)),
    });
  }

  for (const no of documento.nodes ?? []) {
    junto.nodes.push({
      ...no,
      mesh: somar(no.mesh, deslocamento.meshes),
      children: no.children?.map((filho) => filho + deslocamento.nodes),
    });
  }

  for (const raiz of raizesDaCena(documento)) junto.raizes.push(raiz + deslocamento.nodes);
}

/**
 * Soma o deslocamento a um índice, e deixa `undefined` passar intacto.
 *
 * **Esta é a regra mais importante do arquivo.** `primitiva.material`, `no.mesh`,
 * `textura.source` e `attributes.POSITION` valem `0` legitimamente, e `0` é falsy em JavaScript.
 * Um `if (indice)` no lugar da comparação com `undefined` pularia o PRIMEIRO material, a PRIMEIRA
 * malha e o PRIMEIRO acessor de cada documento, deixando todas as peças apontando para as do
 * primeiro. O defeito não lança, não avisa e não aparece em nenhum log: ele chega na tela como
 * uma peça com a cor de outra, que é exatamente o que o princípio nº1 existe para impedir.
 */
function somar(indice: number | undefined, deslocamento: number): number | undefined {
  return indice === undefined ? undefined : indice + deslocamento;
}

/** Uma primitiva referencia acessores (atributos e índices) e um material. Os três deslocam. */
function reindexarPrimitiva(primitiva: PrimitivaDoGltf, deslocamento: Deslocamentos): PrimitivaDoGltf {
  const atributos = primitiva.attributes;

  return {
    ...primitiva,
    attributes:
      atributos === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(atributos).map(([nome, acessor]) => [nome, acessor + deslocamento.accessors]),
          ),
    indices: somar(primitiva.indices, deslocamento.accessors),
    material: somar(primitiva.material, deslocamento.materials),
  };
}

/**
 * O único índice que um material carrega e este módulo precisa deslocar é o da textura de cor
 * base. Reapontar índice não é escrever cor: o valor da cor não é lido nem tocado aqui, e é por
 * isso que este arquivo não precisa de licença em `soUmLugarEscreveCorNoGltf.test.ts`.
 */
function reindexarMaterial(material: MaterialDoGltf, deslocamentoDeTexturas: number): MaterialDoGltf {
  const pbr = material.pbrMetallicRoughness;
  const textura = pbr?.baseColorTexture;

  if (pbr === undefined || textura === undefined) return { ...material };

  return {
    ...material,
    pbrMetallicRoughness: {
      ...pbr,
      baseColorTexture: { ...textura, index: somar(textura.index, deslocamentoDeTexturas) },
    },
  };
}

/**
 * Os nós raiz do documento, lidos da cena padrão dele.
 *
 * Recusa em vez de contribuir com lista vazia: um documento sem cena entraria no modelo junto
 * com os nós presentes no arquivo e nenhum deles alcançável, ou seja, uma peça que existe no
 * glTF e não aparece na tela. É a mesma família de defeito da lista vazia, um nível abaixo.
 */
function raizesDaCena(documento: DocumentoGltf): number[] {
  const raizes = (documento.scenes ?? [])[documento.scene ?? 0]?.nodes ?? [];

  if (raizes.length === 0) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      'O glTF não tem cena padrão com nós raiz. Sem cena, a peça entraria no modelo junto sem nunca aparecer na tela.',
    );
  }

  return raizes;
}

/**
 * `animations`, `skins` e `cameras` referenciam nós e acessores por caminhos que este módulo não
 * reindexa (canal de animação aponta para nó, skin aponta para nó e para acessor de matriz).
 * Juntar mesmo assim produziria um arquivo válido para o validador e apontando para o alvo
 * errado: a animação da peça 2 movendo o nó da peça 1. Recusa alta é a única saída honesta.
 */
function recusarOQueNaoDaParaReindexar(documento: DocumentoGltf): void {
  for (const campo of ['animations', 'skins', 'cameras'] as const) {
    const conteudo = documento[campo];

    if (Array.isArray(conteudo) && conteudo.length > 0) {
      throw new ErroDeVariante(
        'MODELO_3D_NAO_NORMALIZAVEL',
        `O glTF tem "${campo}", que referencia nós e acessores por caminhos que a montagem não reindexa. Exporte a peça sem animação, esqueleto nem câmera.`,
      );
    }
  }
}

/**
 * Os arrays juntos viram documento.
 *
 * Todo campo de topo que este módulo NÃO reindexa vem do **primeiro** documento, `asset`
 * inclusive. Vem do primeiro e não de uma soma dos N porque campo de topo é declaração sobre o
 * documento inteiro (`asset`, `extensionsUsed`, `extras`), e não existe soma definida de duas
 * declarações dessas: escolher uma é a decisão honesta, inventar uma mistura não é.
 */
function montarDocumentoJunto(primeiro: DocumentoGltf, junto: ArraysJuntos): DocumentoGltf {
  const documentoJunto: DocumentoGltf = {};

  for (const [campo, valor] of Object.entries(primeiro)) {
    if (!CAMPOS_REINDEXADOS.has(campo)) documentoJunto[campo] = valor;
  }

  // Uma cena só, com os nós raiz de todos os documentos na ordem em que eles entraram. É o que
  // faz o modelo junto ser "um modelo com N zonas", que é a forma que o motor de cor já trata.
  documentoJunto.scene = 0;
  documentoJunto.scenes = [{ nodes: junto.raizes }];
  documentoJunto.nodes = junto.nodes;

  atribuirSeTiver(documentoJunto, 'meshes', junto.meshes);
  atribuirSeTiver(documentoJunto, 'materials', junto.materials);
  atribuirSeTiver(documentoJunto, 'accessors', junto.accessors);
  atribuirSeTiver(documentoJunto, 'bufferViews', junto.bufferViews);
  atribuirSeTiver(documentoJunto, 'buffers', junto.buffers);
  atribuirSeTiver(documentoJunto, 'textures', junto.textures);
  atribuirSeTiver(documentoJunto, 'images', junto.images);
  atribuirSeTiver(documentoJunto, 'samplers', junto.samplers);

  return documentoJunto;
}

/**
 * Array vazio é proibido pelo glTF 2.0, e o validador de referência reprova `"textures": []`.
 * Escrever a chave só quando há conteúdo é a mesma precaução que `normalizarModelo3d` já toma
 * com `meshes` e `materials`.
 */
function atribuirSeTiver(documento: DocumentoGltf, campo: string, valores: readonly unknown[]): void {
  if (valores.length > 0) documento[campo] = valores;
}
