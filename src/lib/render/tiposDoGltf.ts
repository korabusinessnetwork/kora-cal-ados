// O subconjunto de glTF 2.0 que a normalização precisa enxergar — e só ele.
//
// Por que tipos próprios em vez de uma dependência de tipos de glTF: o normalizador toca
// quatro arrays (`nodes`, `meshes`, `materials`, mais `buffers`/`images` para recusar URI
// externa) e precisa preservar TODO o resto do documento intacto, byte a byte. Um tipo
// completo de glTF convidaria a reconstruir o documento campo a campo, e reconstruir é como
// se perde a extensão que ninguém mapeou. Daí o `[campo: string]: unknown` em cada interface:
// ele não é preguiça, é a promessa de que o que não entendemos sai como entrou.

/** Uma primitive é a unidade que carrega material — e por isso a unidade que precisa separar. */
export interface PrimitivaDoGltf {
  material?: number;
  [campo: string]: unknown;
}

export interface MalhaDoGltf {
  name?: string;
  primitives?: PrimitivaDoGltf[];
  [campo: string]: unknown;
}

/** Nó da cena. **Endereçável** é o que tem `mesh` — ver `ehEnderecavel` em `normalizarModelo3d`. */
export interface NoDoGltf {
  name?: string;
  mesh?: number;
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

/** Recurso que pode apontar para fora do arquivo — é o que a recusa de URI externa examina. */
export interface RecursoComUri {
  uri?: string;
  [campo: string]: unknown;
}

export interface DocumentoGltf {
  asset?: { version?: string; [campo: string]: unknown };
  nodes?: NoDoGltf[];
  meshes?: MalhaDoGltf[];
  materials?: MaterialDoGltf[];
  buffers?: RecursoComUri[];
  images?: RecursoComUri[];
  extensionsRequired?: string[];
  [campo: string]: unknown;
}
