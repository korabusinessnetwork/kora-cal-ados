// O subconjunto de glTF 2.0 que a normalização precisa enxergar, e só ele.
//
// Por que tipos próprios em vez de uma dependência de tipos de glTF: o normalizador toca
// quatro arrays (`nodes`, `meshes`, `materials`, mais `buffers`/`images` para recusar URI
// externa) e precisa preservar TODO o resto do documento intacto, byte a byte. Um tipo
// completo de glTF convidaria a reconstruir o documento campo a campo, e reconstruir é como
// se perde a extensão que ninguém mapeou. Daí o `[campo: string]: unknown` em cada interface:
// ele não é preguiça, é a promessa de que o que não entendemos sai como entrou.

/** Uma primitive é a unidade que carrega material, e por isso a unidade que precisa separar. */
export interface PrimitivaDoGltf {
  material?: number;
  /** `{ POSITION: 0, NORMAL: 1 }`: nome do atributo para índice de acessor. */
  attributes?: Record<string, number>;
  indices?: number;
  [campo: string]: unknown;
}

export interface MalhaDoGltf {
  name?: string;
  primitives?: PrimitivaDoGltf[];
  [campo: string]: unknown;
}

/**
 * Nó da cena. **Endereçável** é o que tem `mesh`, ver `ehEnderecavel` em `normalizarModelo3d`.
 *
 * A transformação aparece aqui porque três módulos precisam dela e por motivos opostos:
 * `deslocarModelo3d` escreve em `translation`, `medidaDoModelo3d` lê `translation` e `scale`
 * para calcular a caixa envolvente, e os dois **recusam** `rotation` e `matrix`, porque caixa
 * alinhada aos eixos sobre geometria girada mente sem avisar. Estão declaradas para poderem ser
 * recusadas, não para serem usadas.
 */
export interface NoDoGltf {
  name?: string;
  mesh?: number;
  children?: number[];
  translation?: number[];
  scale?: number[];
  rotation?: number[];
  matrix?: number[];
  [campo: string]: unknown;
}

/**
 * Acessor: a janela tipada sobre um pedaço de buffer.
 *
 * `min` e `max` são obrigatórios em glTF 2.0 para o acessor de POSITION, e é deles que sai a
 * caixa envolvente sem descompactar um byte de geometria. O validador da Khronos confere os dois
 * contra os vértices de verdade, então confiar neles não é confiar na nossa palavra.
 */
export interface AcessorDoGltf {
  bufferView?: number;
  min?: number[];
  max?: number[];
  [campo: string]: unknown;
}

export interface BufferViewDoGltf {
  buffer?: number;
  [campo: string]: unknown;
}

/** Uma cena é uma lista de índices de nó raiz. */
export interface CenaDoGltf {
  nodes?: number[];
  [campo: string]: unknown;
}

/** Textura: aponta para `images` por `source` e para `samplers` por `sampler`. */
export interface TexturaDoGltf {
  source?: number;
  sampler?: number;
  [campo: string]: unknown;
}

export interface PbrDoGltf {
  baseColorFactor?: number[];
  baseColorTexture?: { index?: number; [campo: string]: unknown };
  [campo: string]: unknown;
}

export interface MaterialDoGltf {
  name?: string;
  pbrMetallicRoughness?: PbrDoGltf;
  [campo: string]: unknown;
}

/** Recurso que pode apontar para fora do arquivo, é o que a recusa de URI externa examina. */
export interface RecursoComUri {
  uri?: string;
  [campo: string]: unknown;
}

export interface DocumentoGltf {
  asset?: { version?: string; [campo: string]: unknown };
  scene?: number;
  scenes?: CenaDoGltf[];
  nodes?: NoDoGltf[];
  meshes?: MalhaDoGltf[];
  materials?: MaterialDoGltf[];
  accessors?: AcessorDoGltf[];
  bufferViews?: BufferViewDoGltf[];
  buffers?: RecursoComUri[];
  textures?: TexturaDoGltf[];
  images?: RecursoComUri[];
  samplers?: Array<{ [campo: string]: unknown }>;
  // Declarados só para serem RECUSADOS por `juntarModelos3d`: juntar documentos exige reindexar
  // toda referência por índice, e estes três referenciam nós e acessores por caminhos que o
  // projeto não mapeia. Juntar mesmo assim apontaria para o alvo errado em silêncio, que é a
  // família de defeito que este projeto recusa desde o ADR-004.
  animations?: unknown[];
  skins?: unknown[];
  cameras?: unknown[];
  extensionsRequired?: string[];
  [campo: string]: unknown;
}
