// Construtor de glTF mínimo para os testes da normalização 3D.
//
// Existe porque glTF é JSON: escrever o documento à mão em cada teste faria cada caso carregar
// 40 linhas de `bufferViews` e `accessors` irrelevantes, e o que o teste quer dizer ("dois nós
// apontam para a mesma malha") sumiria no meio. Aqui a descrição é a intenção, e o ruído é
// gerado.
//
// Todas as primitivas apontam para o MESMO accessor de propósito: é isso que torna verificável
// a promessa de que duplicar malha não copia geometria, se `accessors` crescer, o teste vê.

interface DescricaoDeNo {
  nome?: string;
  /** Índice em `malhas`. Ausente = nó sem malha (não endereçável: junta, grupo, câmera). */
  malha?: number;
}

interface DescricaoDeMalha {
  /** Uma entrada por primitiva. `null` = primitiva sem material, que o glTF permite. */
  materiais: Array<number | null>;
}

interface DescricaoDeMaterial {
  cor?: [number, number, number, number];
  /** Cor base vinda de textura, o gêmeo do gradiente do SVG. */
  textura?: boolean;
}

export interface DescricaoDeGltf {
  nos: DescricaoDeNo[];
  malhas?: DescricaoDeMalha[];
  materiais?: DescricaoDeMaterial[];
  buffers?: Array<{ uri: string }>;
  imagens?: Array<{ uri: string }>;
  extensoesExigidas?: string[];
  /** Para o caso "não é glTF 2.0". Ausente = `2.0`. */
  versao?: string;
}

export function gltfDeTeste(descricao: DescricaoDeGltf): string {
  const documento: Record<string, unknown> = {
    asset: { version: descricao.versao ?? '2.0', generator: 'fixture de teste' },
    scene: 0,
    scenes: [{ nodes: descricao.nos.map((_, indice) => indice) }],
    nodes: descricao.nos.map((no) => ({
      ...(no.nome === undefined ? {} : { name: no.nome }),
      ...(no.malha === undefined ? {} : { mesh: no.malha }),
    })),
    meshes: (descricao.malhas ?? []).map((malha) => ({
      primitives: malha.materiais.map((material) => ({
        attributes: { POSITION: 0 },
        ...(material === null ? {} : { material }),
      })),
    })),
    accessors: [{ componentType: 5126, count: 3, type: 'VEC3' }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    buffers: descricao.buffers ?? [{ byteLength: 36, uri: 'data:application/octet-stream;base64,' }],
  };

  const materiais = descricao.materiais ?? [];
  if (materiais.length > 0) {
    documento['materials'] = materiais.map((material) => ({
      pbrMetallicRoughness: {
        baseColorFactor: material.cor ?? [1, 1, 1, 1],
        ...(material.textura === true ? { baseColorTexture: { index: 0 } } : {}),
      },
    }));
  }

  if (descricao.imagens !== undefined) documento['images'] = descricao.imagens;
  if (descricao.extensoesExigidas !== undefined) {
    documento['extensionsRequired'] = descricao.extensoesExigidas;
  }

  return JSON.stringify(documento, null, 2);
}

/**
 * Os índices de material usados pelas primitivas **alcançáveis a partir dos nós**, em ordem.
 *
 * Anda a partir de `nodes` e não varrendo `meshes` porque é essa a pergunta que interessa:
 * duas ZONAS compartilham cor? Uma malha órfã, que nó nenhum referencia, não é zona e não
 * pode reprovar o modelo.
 */
export function materiaisUsados(modelo: string): number[] {
  const documento = JSON.parse(modelo) as {
    nodes?: Array<{ mesh?: number }>;
    meshes?: Array<{ primitives?: Array<{ material?: number }> }>;
  };

  const usados: number[] = [];
  for (const no of documento.nodes ?? []) {
    if (no.mesh === undefined) continue;
    for (const primitiva of documento.meshes?.[no.mesh]?.primitives ?? []) {
      if (primitiva.material !== undefined) usados.push(primitiva.material);
    }
  }
  return usados;
}
