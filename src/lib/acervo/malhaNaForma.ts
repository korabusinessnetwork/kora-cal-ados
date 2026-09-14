// A malha de um nó de glTF no espaço da forma, lida do buffer gravado. Só para testes.
//
// Os testes entre peças (cabedal sobre sola, cadarço sobre cabedal) precisam conferir o que o
// acervo **grava**, e não o que as funções de geometria devolvem antes de virar arquivo: é no
// caminho entre as duas (assento, escala, montagem) que uma peça sai do lugar. Mora fora dos
// arquivos de teste porque dois deles leem o buffer, e duas cópias de um leitor de buffer
// divergiriam no primeiro campo opcional que uma delas esquecesse.
//
// Lê só o que o acervo de prova e `juntarModelos3d` escrevem: nó raiz com `translation` e `scale`,
// sem rotação, uma primitiva por malha, POSITION em float32 e índices em unsigned short.

type Vetor = [number, number, number];

interface Documento {
  nodes: Array<{ name?: string; mesh?: number; translation?: Vetor; scale?: Vetor }>;
  meshes: Array<{ primitives: Array<{ attributes: { POSITION: number }; indices: number }> }>;
  accessors: Array<{ bufferView: number; byteOffset?: number; count: number }>;
  bufferViews: Array<{ buffer: number; byteOffset?: number }>;
  buffers: Array<{ uri: string }>;
}

export interface MalhaLida {
  /** `x, y, z` por vértice, já com a escala e a translação do nó aplicadas. */
  posicoes: number[];
  indices: number[];
}

export function malhaNaForma(textoGltf: string, nomeDoNo: string): MalhaLida {
  const documento = JSON.parse(textoGltf) as Documento;
  const no = documento.nodes.find(({ name }) => name === nomeDoNo);
  const primitiva = documento.meshes[no?.mesh ?? -1]?.primitives[0];

  if (no === undefined || primitiva === undefined) throw new Error(`nó "${nomeDoNo}" sem malha`);

  const [tx, ty, tz] = no.translation ?? [0, 0, 0];
  const [sx, sy, sz] = no.scale ?? [1, 1, 1];
  const posicoes: number[] = [];
  const indices: number[] = [];

  const leituraDe = (acessor: number): { leitura: DataView; inicio: number; count: number } => {
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

  const doPosicao = leituraDe(primitiva.attributes.POSITION);
  for (let vertice = 0; vertice < doPosicao.count; vertice += 1) {
    const deslocamento = doPosicao.inicio + vertice * 12;
    posicoes.push(
      doPosicao.leitura.getFloat32(deslocamento, true) * sx + tx,
      doPosicao.leitura.getFloat32(deslocamento + 4, true) * sy + ty,
      doPosicao.leitura.getFloat32(deslocamento + 8, true) * sz + tz,
    );
  }

  const doIndice = leituraDe(primitiva.indices);
  for (let indice = 0; indice < doIndice.count; indice += 1) {
    indices.push(doIndice.leitura.getUint16(doIndice.inicio + indice * 2, true));
  }

  return { posicoes, indices };
}
