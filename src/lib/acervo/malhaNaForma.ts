// A malha de um nó de glTF no espaço da forma, lida do buffer gravado. Só para testes.
//
// Os testes entre peças (cabedal sobre sola, cadarço sobre cabedal) precisam conferir o que o
// acervo **grava**, e não o que as funções de geometria devolvem antes de virar arquivo: é no
// caminho entre as duas (assento, escala, montagem) que uma peça sai do lugar. Mora fora dos
// arquivos de teste porque três deles leem o buffer, e cópias de um leitor de buffer
// divergiriam no primeiro campo opcional que uma delas esquecesse.
//
// Lê só o que o acervo de prova e `juntarModelos3d` escrevem: nó raiz com `translation` e `scale`,
// sem rotação, uma primitiva por malha, POSITION e NORMAL em float32 e índices em unsigned short.

type Vetor = [number, number, number];

interface Documento {
  nodes: Array<{ name?: string; mesh?: number; translation?: Vetor; scale?: Vetor }>;
  meshes: Array<{ primitives: Array<{ attributes: { POSITION: number; NORMAL?: number }; indices: number }> }>;
  accessors: Array<{ bufferView: number; byteOffset?: number; count: number; min?: Vetor; max?: Vetor }>;
  bufferViews: Array<{ buffer: number; byteOffset?: number }>;
  buffers: Array<{ uri: string }>;
}

export interface MalhaLida {
  /** `x, y, z` por vértice, já com a escala e a translação do nó aplicadas. */
  posicoes: number[];
  /**
   * `x, y, z` por vértice como estão no buffer, sem a transformação do nó. É contra estes que o
   * `min`/`max` do accessor e as normais precisam bater, porque é neste espaço que foram gravados.
   */
  posicoesGravadas: number[];
  /** A normal gravada de cada vértice, sem transformação; vazia quando a primitiva não tem NORMAL. */
  normais: number[];
  /** O `min` e o `max` que o accessor de POSITION declara. */
  limitesDeclarados: { min?: Vetor; max?: Vetor };
  indices: number[];
}

interface Leitura {
  leitura: DataView;
  inicio: number;
  count: number;
}

export function malhaNaForma(textoGltf: string, nomeDoNo: string): MalhaLida {
  const documento = JSON.parse(textoGltf) as Documento;
  const no = documento.nodes.find(({ name }) => name === nomeDoNo);
  const primitiva = documento.meshes[no?.mesh ?? -1]?.primitives[0];

  if (no === undefined || primitiva === undefined) throw new Error(`nó "${nomeDoNo}" sem malha`);

  const [tx, ty, tz] = no.translation ?? [0, 0, 0];
  const [sx, sy, sz] = no.scale ?? [1, 1, 1];
  const posicoes: number[] = [];
  const posicoesGravadas: number[] = [];
  const normais: number[] = [];
  const indices: number[] = [];

  const leituraDe = (acessor: number): Leitura => {
    const dados = documento.accessors[acessor];
    const vista = documento.bufferViews[dados?.bufferView ?? -1];
    const base64 = (documento.buffers[vista?.buffer ?? -1]?.uri ?? '').split(',')[1] ?? '';
    const bytes = Uint8Array.from(atob(base64), (letra) => letra.charCodeAt(0));

    return {
      leitura: new DataView(bytes.buffer),
      inicio: (vista?.byteOffset ?? 0) + (dados?.byteOffset ?? 0),
      count: dados?.count ?? 0,
    };
  };

  const tripla = ({ leitura, inicio }: Leitura, vertice: number): Vetor => [
    leitura.getFloat32(inicio + vertice * 12, true),
    leitura.getFloat32(inicio + vertice * 12 + 4, true),
    leitura.getFloat32(inicio + vertice * 12 + 8, true),
  ];

  const doPosicao = leituraDe(primitiva.attributes.POSITION);
  for (let vertice = 0; vertice < doPosicao.count; vertice += 1) {
    const [x, y, z] = tripla(doPosicao, vertice);
    posicoesGravadas.push(x, y, z);
    posicoes.push(x * sx + tx, y * sy + ty, z * sz + tz);
  }

  if (primitiva.attributes.NORMAL !== undefined) {
    const daNormal = leituraDe(primitiva.attributes.NORMAL);
    for (let vertice = 0; vertice < daNormal.count; vertice += 1) normais.push(...tripla(daNormal, vertice));
  }

  const doIndice = leituraDe(primitiva.indices);
  for (let indice = 0; indice < doIndice.count; indice += 1) {
    indices.push(doIndice.leitura.getUint16(doIndice.inicio + indice * 2, true));
  }

  const declarado = documento.accessors[primitiva.attributes.POSITION];

  return {
    posicoes,
    posicoesGravadas,
    normais,
    limitesDeclarados: { min: declarado?.min, max: declarado?.max },
    indices,
  };
}
