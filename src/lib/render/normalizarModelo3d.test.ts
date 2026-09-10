// Testes da normalização 3D. O defeito que quase todos protegem é o mesmo, e é silencioso:
// pintar uma zona e a cor aparecer também em outra, com 200 na resposta. Por isso a asserção
// que mais se repete aqui não é sobre o conteúdo do JSON, é sobre um invariante —
// `materiaisUsados` sem repetição.

import { describe, expect, it } from 'vitest';
import { ErroDeVariante } from './erros';
import { gltfDeTeste, materiaisUsados, type DescricaoDeGltf } from './fixtures/gltfDeTeste';
import { normalizarModelo3d } from './normalizarModelo3d';

function normalizar(descricao: DescricaoDeGltf) {
  return normalizarModelo3d(gltfDeTeste(descricao));
}

interface DocumentoLido {
  nodes?: Array<{ name?: string; mesh?: number; children?: number[] }>;
  meshes?: Array<{ primitives?: Array<{ material?: number }> }>;
  materials?: Array<{ pbrMetallicRoughness?: { baseColorFactor?: number[] } }>;
  accessors?: unknown[];
  buffers?: unknown[];
}

function lerDocumento(modelo: string): DocumentoLido {
  return JSON.parse(modelo) as DocumentoLido;
}

/** O código do `ErroDeVariante` que `executar` levanta — falha se não levantar nenhum. */
function codigoRecusado(executar: () => unknown): string {
  try {
    executar();
  } catch (erro) {
    if (erro instanceof ErroDeVariante) return erro.codigo;
    throw erro;
  }
  throw new Error('esperava uma recusa, mas a normalização passou');
}

function mensagemRecusada(executar: () => unknown): string {
  try {
    executar();
  } catch (erro) {
    if (erro instanceof ErroDeVariante) return erro.message;
    throw erro;
  }
  throw new Error('esperava uma recusa, mas a normalização passou');
}

/** Os índices de material das primitivas alcançadas pelo nome de uma zona (ADR-007 D4). */
function materiaisDaZona(modelo: string, nome: string): number[] {
  const documento = lerDocumento(modelo);
  const no = (documento.nodes ?? []).find((candidato) => candidato.name === nome);
  if (no?.mesh === undefined) throw new Error(`zona "${nome}" não existe no canônico`);

  return (documento.meshes?.[no.mesh]?.primitives ?? []).flatMap((primitiva) =>
    primitiva.material === undefined ? [] : [primitiva.material],
  );
}

describe('material próprio por zona (ADR-007 D5)', () => {
  it('separa material compartilhado entre duas malhas — o defeito silencioso da cor vazada', () => {
    // Sem esta separação, pintar `sola` pintaria `cabedal` junto: em glTF é idiomático várias
    // malhas apontarem para o mesmo material, e o motor pinta material.
    const { modelo, relatorio } = normalizar({
      nos: [{ nome: 'sola', malha: 0 }, { nome: 'cabedal', malha: 1 }],
      malhas: [{ materiais: [0] }, { materiais: [0] }],
      materiais: [{ cor: [1, 0, 0, 1] }],
    });

    const usados = materiaisUsados(modelo);
    expect(usados).toHaveLength(2);
    expect(new Set(usados).size).toBe(2);
    expect(relatorio.materiaisDuplicados).toBe(1);
  });

  it('o material duplicado sai com a MESMA cor do original — separar não é repintar', () => {
    const { modelo } = normalizar({
      nos: [{ nome: 'sola', malha: 0 }, { nome: 'cabedal', malha: 1 }],
      malhas: [{ materiais: [0] }, { materiais: [0] }],
      materiais: [{ cor: [0.2, 0.4, 0.6, 1] }],
    });

    const documento = lerDocumento(modelo);
    for (const indice of materiaisUsados(modelo)) {
      expect(documento.materials?.[indice]?.pbrMetallicRoughness?.baseColorFactor).toEqual([
        0.2, 0.4, 0.6, 1,
      ]);
    }
  });

  it('primitiva sem material ganha um — zona sem material existe e não recebe cor', () => {
    const { modelo, relatorio } = normalizar({
      nos: [{ nome: 'sola', malha: 0 }],
      malhas: [{ materiais: [null] }],
    });

    expect(relatorio.materiaisCriados).toBe(1);
    expect(materiaisDaZona(modelo, 'sola')).toEqual([0]);
  });

  it('não mexe em nada quando cada malha já tem o seu material', () => {
    const { relatorio } = normalizar({
      nos: [{ nome: 'sola', malha: 0 }, { nome: 'cabedal', malha: 1 }],
      malhas: [{ materiais: [0] }, { materiais: [1] }],
      materiais: [{ cor: [1, 0, 0, 1] }, { cor: [0, 1, 0, 1] }],
    });

    expect(relatorio.materiaisDuplicados).toBe(0);
    expect(relatorio.malhasDuplicadas).toBe(0);
    expect(relatorio.materiaisCriados).toBe(0);
  });
});

describe('malha compartilhada entre nós', () => {
  it('é separada — duplicar só o material não resolveria, o material mora na primitive', () => {
    const { modelo, relatorio } = normalizar({
      nos: [{ nome: 'sola-esquerda', malha: 0 }, { nome: 'sola-direita', malha: 0 }],
      malhas: [{ materiais: [0] }],
      materiais: [{ cor: [1, 0, 0, 1] }],
    });

    const documento = lerDocumento(modelo);
    expect(documento.nodes?.[0]?.mesh).not.toBe(documento.nodes?.[1]?.mesh);
    expect(relatorio.malhasDuplicadas).toBe(1);
    expect(new Set(materiaisUsados(modelo)).size).toBe(2);
  });

  it('a duplicação NÃO copia geometria: buffers e accessors não crescem', () => {
    // É o que torna a decisão barata. Se um dia alguém "consertar" isto clonando accessors,
    // o canônico dobra de tamanho a cada nó repetido e esta linha fica vermelha.
    const descricao: DescricaoDeGltf = {
      nos: [{ nome: 'a', malha: 0 }, { nome: 'b', malha: 0 }],
      malhas: [{ materiais: [0] }],
      materiais: [{}],
    };

    const antes = lerDocumento(gltfDeTeste(descricao));
    const depois = lerDocumento(normalizar(descricao).modelo);

    expect(depois.accessors?.length).toBe(antes.accessors?.length);
    expect(depois.buffers?.length).toBe(antes.buffers?.length);
    expect(depois.meshes?.length).toBe(2);
  });
});

describe('malha com várias primitivas', () => {
  it('a zona é o NÓ: as duas primitivas ganham material próprio e ambas saem pelo nome do nó', () => {
    const { modelo, relatorio } = normalizar({
      nos: [{ nome: 'cabedal', malha: 0 }],
      malhas: [{ materiais: [0, 0] }],
      materiais: [{ cor: [1, 1, 0, 1] }],
    });

    const daZona = materiaisDaZona(modelo, 'cabedal');
    expect(daZona).toHaveLength(2);
    expect(new Set(daZona).size).toBe(2);
    expect(relatorio.materiaisDuplicados).toBe(1);
  });
});

describe('hierarquia de nós', () => {
  it('nó endereçável dentro de outro endereçável são DUAS zonas independentes', () => {
    // Decisão escrita em `acharEnderecaveis`: em glTF o pai não pinta o filho (material é do
    // mesh, e a cena não o herda), então tratar o pai como dono do filho criaria uma zona que
    // pinta parte do que ela não mostra. Cada nó com malha é uma zona, e ponto.
    const cru = lerDocumento(
      gltfDeTeste({
        nos: [{ nome: 'cabedal', malha: 0 }, { nome: 'logo', malha: 1 }],
        malhas: [{ materiais: [0] }, { materiais: [0] }],
        materiais: [{ cor: [1, 1, 1, 1] }],
      }),
    );
    const pai = cru.nodes?.[0];
    if (pai !== undefined) pai.children = [1];

    const { modelo } = normalizarModelo3d(JSON.stringify(cru));

    expect(materiaisDaZona(modelo, 'cabedal')).not.toEqual(materiaisDaZona(modelo, 'logo'));
    expect(lerDocumento(modelo).nodes?.[0]?.children).toEqual([1]);
  });
});

describe('nome no canônico (ADR-007 D4)', () => {
  it('preserva o nome do modelador e cunha malha-N no anônimo, na ordem do documento', () => {
    const { modelo, relatorio } = normalizar({
      nos: [{ nome: 'sola', malha: 0 }, { malha: 1 }],
      malhas: [{ materiais: [0] }, { materiais: [1] }],
      materiais: [{}, {}],
    });

    expect(lerDocumento(modelo).nodes?.map((no) => no.name)).toEqual(['sola', 'malha-1']);
    expect(relatorio.nomesAtribuidos).toEqual(['malha-1']);
    expect(relatorio.nomesRenomeados).toEqual([]);
  });

  it('desambigua nome repetido e converte nome com vírgula, e o relatório conta as duas trocas', () => {
    const { modelo, relatorio } = normalizar({
      nos: [{ nome: 'sola', malha: 0 }, { nome: 'sola', malha: 1 }, { nome: 'a, b', malha: 2 }],
      malhas: [{ materiais: [0] }, { materiais: [1] }, { materiais: [2] }],
      materiais: [{}, {}, {}],
    });

    expect(lerDocumento(modelo).nodes?.map((no) => no.name)).toEqual(['sola', 'sola-2', 'a--b']);
    expect(relatorio.nomesRenomeados).toEqual([
      { de: 'sola', para: 'sola-2' },
      { de: 'a, b', para: 'a--b' },
    ]);
  });

  it('não cunha em nó sem malha, e o nome dele não desloca a numeração das malhas', () => {
    const { modelo } = normalizar({
      nos: [{ nome: 'raiz' }, { malha: 0 }, { malha: 1 }],
      malhas: [{ materiais: [0] }, { materiais: [1] }],
      materiais: [{}, {}],
    });

    expect(lerDocumento(modelo).nodes?.map((no) => no.name)).toEqual([
      'raiz',
      'malha-1',
      'malha-2',
    ]);
  });
});

describe('idempotência', () => {
  it('a segunda passada devolve o mesmo modelo e um relatório sem mudança nenhuma', () => {
    // É a asserção que pega um cunhador que renumera a cada passada — o defeito que repointaria
    // todo seletor de zona já gravado, sem ninguém ver.
    const primeira = normalizar({
      nos: [{ nome: 'sola, externa', malha: 0 }, { malha: 0 }, { nome: 'malha-1', malha: 1 }],
      malhas: [{ materiais: [0] }, { materiais: [null, 0] }],
      materiais: [{ cor: [0.1, 0.2, 0.3, 1] }],
    });

    const segunda = normalizarModelo3d(primeira.modelo);

    expect(segunda.modelo).toBe(primeira.modelo);
    expect(segunda.relatorio.nomesRenomeados).toEqual([]);
    expect(segunda.relatorio.nomesAtribuidos).toEqual([]);
    expect(segunda.relatorio.malhasDuplicadas).toBe(0);
    expect(segunda.relatorio.materiaisDuplicados).toBe(0);
    expect(segunda.relatorio.materiaisCriados).toBe(0);
  });
});

describe('recusa explícita, nunca conserto silencioso', () => {
  it('JSON malformado é MODELO_3D_INVALIDO, não uma exceção crua de parse', () => {
    expect(codigoRecusado(() => normalizarModelo3d('{ isto nao e json'))).toBe(
      'MODELO_3D_INVALIDO',
    );
  });

  it('JSON que não é objeto é MODELO_3D_INVALIDO', () => {
    expect(codigoRecusado(() => normalizarModelo3d('[1, 2, 3]'))).toBe('MODELO_3D_INVALIDO');
    expect(codigoRecusado(() => normalizarModelo3d('null'))).toBe('MODELO_3D_INVALIDO');
  });

  it('glTF 1.0 é recusado — o formato do 1.0 é outro, normalizar seria adivinhar', () => {
    expect(
      codigoRecusado(() =>
        normalizar({ versao: '1.0', nos: [{ malha: 0 }], malhas: [{ materiais: [null] }] }),
      ),
    ).toBe('MODELO_3D_INVALIDO');
  });

  it('documento sem nós é recusado', () => {
    expect(codigoRecusado(() => normalizar({ nos: [] }))).toBe('MODELO_3D_INVALIDO');
  });

  it('documento em que nenhum nó tem malha é recusado — não há o que virar zona', () => {
    expect(codigoRecusado(() => normalizar({ nos: [{ nome: 'camera' }] }))).toBe(
      'MODELO_3D_INVALIDO',
    );
  });

  it('nó apontando para malha inexistente é recusado, e a mensagem diz qual malha', () => {
    const executar = () => normalizar({ nos: [{ malha: 7 }], malhas: [{ materiais: [null] }] });

    expect(codigoRecusado(executar)).toBe('MODELO_3D_INVALIDO');
    expect(mensagemRecusada(executar)).toContain('7');
  });

  it('primitiva apontando para material inexistente é recusada', () => {
    expect(
      codigoRecusado(() =>
        normalizar({
          nos: [{ nome: 'sola', malha: 0 }],
          malhas: [{ materiais: [3] }],
          materiais: [{}],
        }),
      ),
    ).toBe('MODELO_3D_INVALIDO');
  });

  it('extensão obrigatória é NAO_NORMALIZAVEL e a mensagem ensina a exportar sem ela', () => {
    const executar = () =>
      normalizar({
        nos: [{ nome: 'sola', malha: 0 }],
        malhas: [{ materiais: [null] }],
        extensoesExigidas: ['KHR_draco_mesh_compression'],
      });

    expect(codigoRecusado(executar)).toBe('MODELO_3D_NAO_NORMALIZAVEL');
    expect(mensagemRecusada(executar)).toContain('Draco');
  });

  it('extensionsRequired vazio não recusa — array vazio é ausência, não exigência', () => {
    expect(() =>
      normalizar({
        nos: [{ nome: 'sola', malha: 0 }],
        malhas: [{ materiais: [null] }],
        extensoesExigidas: [],
      }),
    ).not.toThrow();
  });
});

describe('URI externa', () => {
  it('buffer apontando para arquivo externo é recusado, não remendado', () => {
    // Recusa e não remoção: tirar o `uri` deixaria o modelo sem geometria, e um canônico sem
    // geometria é pior que arquivo rejeitado — passa no cadastro e falha no cliente.
    const executar = () =>
      normalizar({
        nos: [{ nome: 'sola', malha: 0 }],
        malhas: [{ materiais: [null] }],
        buffers: [{ uri: 'geometria.bin' }],
      });

    expect(codigoRecusado(executar)).toBe('MODELO_3D_NAO_NORMALIZAVEL');
    expect(mensagemRecusada(executar)).toContain('geometria.bin');
  });

  it('imagem apontando para URL externa é recusada', () => {
    expect(
      codigoRecusado(() =>
        normalizar({
          nos: [{ nome: 'sola', malha: 0 }],
          malhas: [{ materiais: [null] }],
          imagens: [{ uri: 'https://exemplo.invalido/textura.png' }],
        }),
      ),
    ).toBe('MODELO_3D_NAO_NORMALIZAVEL');
  });

  it('buffer em data: URI passa — é o formato que o exportador embutido produz', () => {
    expect(() =>
      normalizar({
        nos: [{ nome: 'sola', malha: 0 }],
        malhas: [{ materiais: [null] }],
        buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }],
      }),
    ).not.toThrow();
  });
});

describe('textura: observada, não ignorada nem recusada', () => {
  it('malha com baseColorTexture entra em malhasNaoRecoloriveis pelo nome, e o modelo passa', () => {
    // Gêmeo do gradiente no SVG: `normalizarSvg` também não recusa, quem recusa é o motor na
    // hora de pintar. Recusar o modelo inteiro por causa de uma textura num logo seria
    // proibição preventiva; o que não pode é a textura passar em silêncio.
    const { relatorio } = normalizar({
      nos: [{ nome: 'sola', malha: 0 }, { nome: 'logo', malha: 1 }],
      malhas: [{ materiais: [0] }, { materiais: [1] }],
      materiais: [{ cor: [1, 0, 0, 1] }, { textura: true }],
    });

    expect(relatorio.malhasNaoRecoloriveis).toEqual(['logo']);
  });

  it('continua apontando a textura na segunda passada — descreve o modelo, não a mudança', () => {
    const primeira = normalizar({
      nos: [{ nome: 'logo', malha: 0 }],
      malhas: [{ materiais: [0] }],
      materiais: [{ textura: true }],
    });

    expect(normalizarModelo3d(primeira.modelo).relatorio.malhasNaoRecoloriveis).toEqual(['logo']);
  });
});

describe('canônico e relatório', () => {
  it('preserva campo que a normalização não entende — o que não conhecemos sai como entrou', () => {
    const cru = lerDocumento(
      gltfDeTeste({ nos: [{ nome: 'sola', malha: 0 }], malhas: [{ materiais: [null] }] }),
    ) as Record<string, unknown>;
    cru['extras'] = { autor: 'estudio da marca' };

    const { modelo } = normalizarModelo3d(JSON.stringify(cru));

    expect((lerDocumento(modelo) as Record<string, unknown>)['extras']).toEqual({
      autor: 'estudio da marca',
    });
  });

  it('devolve o relatório inteiro, que é o que o provisionamento imprime para quem sobe a peça', () => {
    const { relatorio } = normalizar({
      nos: [{ nome: 'sola', malha: 0 }, { nome: 'sola', malha: 0 }, { malha: 1 }],
      malhas: [{ materiais: [0] }, { materiais: [null] }],
      materiais: [{ cor: [1, 0, 0, 1] }],
    });

    expect(relatorio).toEqual({
      nomesRenomeados: [{ de: 'sola', para: 'sola-2' }],
      nomesAtribuidos: ['malha-1'],
      malhasDuplicadas: 1,
      materiaisDuplicados: 1,
      materiaisCriados: 1,
      malhasNaoRecoloriveis: [],
    });
  });

  it('o canônico termina em quebra de linha, como o do SVG', () => {
    const { modelo } = normalizar({
      nos: [{ nome: 'sola', malha: 0 }],
      malhas: [{ materiais: [null] }],
    });

    expect(modelo.endsWith('\n')).toBe(true);
  });
});
