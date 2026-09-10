// @vitest-environment jsdom
//
// jsdom e não o ambiente padrão porque o critério 12 carrega o modelo junto no three, e o
// `FileLoader` dispara um `ProgressEvent` ao terminar de ler o `data:` URI do buffer.
// `ProgressEvent` não existe no Node puro, e sem esta linha o teste pendura sem dizer por quê
// (o mesmo aprendizado que `carregarPecaNaCena.test.ts` já registrou).

import { Box3, type Mesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { validateBytes } from 'gltf-validator';

import { juntarModelos3d } from './juntarModelos3d';
import { ErroDeVariante } from './erros';
import type { DocumentoGltf } from './tiposDoGltf';
import { gltfDaPecaDeProva, idsDoAcervoDeProva } from '../acervo/acervoDeProva';
import { carregarPecaNaCena } from '../../palco3d/carregarPecaNaCena';

/** A lista vem do acervo, nunca digitada aqui: peça nova entra nos testes sozinha. */
const IDS = idsDoAcervoDeProva();
const MODELOS = IDS.map((id) => gltfDaPecaDeProva(id));

function documentoDe(texto: string): DocumentoGltf {
  return JSON.parse(texto) as DocumentoGltf;
}

/**
 * Do nome do nó até tudo que ele alcança por índice: malha, primitiva, material, acessor de
 * posição, bufferView e buffer.
 *
 * É por aqui que a maior parte dos testes deste arquivo julga a reindexação, e a razão é que
 * comparar índice com índice esperado seria reimplementar o algoritmo dentro do teste. O que
 * esta função devolve é **conteúdo** que só existe na peça certa: o nome do material é o id da
 * peça, o `min`/`max` do acessor são as dimensões dela, e o `uri` do buffer é a geometria dela
 * em base64. Índice deslocado errado aponta para conteúdo de outra peça, e aí a comparação cai.
 */
function oQueONoAlcanca(documento: DocumentoGltf, nomeDoNo: string) {
  const no = (documento.nodes ?? []).find((candidato) => candidato.name === nomeDoNo);
  const malha = (documento.meshes ?? [])[no?.mesh ?? -1];
  const primitiva = malha?.primitives?.[0];
  const material = (documento.materials ?? [])[primitiva?.material ?? -1];
  return {
    nomeDaMalha: malha?.name,
    nomeDoMaterial: material?.name,
    ...cadeiaDoAcessor(documento, primitiva?.attributes?.POSITION, 'posicao'),
    // Os índices de triângulo entram pelo mesmo caminho e por conta própria: toda peça de prova
    // é uma caixa, então o acessor de índices de duas peças tem conteúdo IDÊNTICO. Um
    // `primitiva.indices` sem deslocamento desenharia certo mesmo apontando para o documento
    // errado, e nenhum teste de geometria veria. O `uri` do buffer é o que denuncia.
    ...cadeiaDoAcessor(documento, primitiva?.indices, 'indices'),
  };
}

/** Do índice de um acessor até o buffer em que ele desemboca, com o rótulo do papel dele. */
function cadeiaDoAcessor(documento: DocumentoGltf, indice: number | undefined, papel: string) {
  const acessor = (documento.accessors ?? [])[indice ?? -1];
  const bufferView = (documento.bufferViews ?? [])[acessor?.bufferView ?? -1];
  const buffer = (documento.buffers ?? [])[bufferView?.buffer ?? -1];

  return {
    [`minimo-${papel}`]: acessor?.min,
    [`maximo-${papel}`]: acessor?.max,
    [`janela-${papel}`]: bufferView?.byteOffset,
    [`uriDoBuffer-${papel}`]: buffer?.uri,
  };
}

/**
 * Um glTF de mentira, com as duas coisas que as peças de prova não têm: um nó pai com filho e um
 * material cuja cor base vem de textura.
 *
 * Existe porque o acervo de prova é caixa solta sem textura, e `children`, `textures`, `images`
 * e `samplers` são justamente as referências que sairiam sem reindexar sem nenhum teste
 * reclamar. Modelo trazido por cliente tem as duas coisas, e é ele que vai passar por aqui.
 */
function gltfComFilhoETextura(nome: string): string {
  return JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: nome, children: [1] },
      { name: `${nome}-filho`, mesh: 0 },
    ],
    meshes: [{ name: nome, primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ name: nome, pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0, sampler: 0 }],
    images: [{ uri: `data:image/png;base64,${nome}` }],
    samplers: [{ magFilter: 9729 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 1, type: 'VEC3' },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 12 },
      { buffer: 0, byteOffset: 12, byteLength: 6 },
    ],
    buffers: [{ byteLength: 18, uri: `data:application/octet-stream;base64,${nome}` }],
  });
}

/** Os índices de material que um nó alcança. É por eles que a partilha de material é medida. */
function materiaisDoNo(documento: DocumentoGltf, nomeDoNo: string): number[] {
  const no = (documento.nodes ?? []).find((candidato) => candidato.name === nomeDoNo);
  const malha = (documento.meshes ?? [])[no?.mesh ?? -1];

  return (malha?.primitives ?? [])
    .map((primitiva) => primitiva.material)
    .filter((indice): indice is number => indice !== undefined);
}

function malhas(objeto: Object3D): Mesh[] {
  const encontradas: Mesh[] = [];
  objeto.traverse((no) => {
    if ((no as Mesh).isMesh) encontradas.push(no as Mesh);
  });

  return encontradas;
}

function esperarCaixaIgual(obtida: Box3, esperada: Box3): void {
  for (const eixo of ['x', 'y', 'z'] as const) {
    expect(obtida.min[eixo]).toBeCloseTo(esperada.min[eixo], 6);
    expect(obtida.max[eixo]).toBeCloseTo(esperada.max[eixo], 6);
  }
}

/** Um documento de peça com um campo que a junção precisa recusar. */
function pecaCom(campo: string, valor: unknown): string {
  const documento = documentoDe(MODELOS[0] ?? '');
  documento[campo] = valor;

  return JSON.stringify(documento);
}

describe('juntar as 5 peças de prova', () => {
  const junto = documentoDe(juntarModelos3d(MODELOS));

  it('não produz um arquivo que só o nosso código aceita: o validador da Khronos passa sem erro e sem aviso', async () => {
    // Critério 9, e o decisivo dos sete. É externo de propósito: um validador escrito por nós
    // julgando arquivos escritos por nós não prova nada. `validateBytes` decodifica os buffers e
    // confere alinhamento, contagem de acessor, `min`/`max` contra os vértices e cada índice
    // contra o tamanho do array que ele endereça, que é justamente o que a junção mexe.
    const bytes = new TextEncoder().encode(juntarModelos3d(MODELOS));
    const { issues } = await validateBytes(bytes, {
      externalResourceFunction: (uri: string) =>
        Promise.reject(new Error(`recurso externo proibido: ${uri}`)),
    });

    expect(issues.messages.filter(({ severity }) => severity <= 1)).toEqual([]);
    expect(issues.numErrors).toBe(0);
    expect(issues.numWarnings).toBe(0);
  });

  it('o validador reprova quando há o que reprovar, senão o critério 9 passaria vazio para sempre', async () => {
    // Canário do teste acima. `validateBytes` roda aqui sob jsdom, que não é o ambiente em que o
    // resto do projeto o usa, e um validador que devolvesse zero por não ter rodado deixaria o
    // teste decisivo deste arquivo verde sem julgar nada. Guarda que não pode falhar não é guarda.
    const quebrado = documentoDe(juntarModelos3d(MODELOS));
    const primeiroNo = quebrado.nodes?.[0];
    if (primeiroNo !== undefined) primeiroNo.mesh = 99;

    const { issues } = await validateBytes(new TextEncoder().encode(JSON.stringify(quebrado)));

    expect(issues.numErrors).toBeGreaterThan(0);
  });

  it('não perde nem duplica peça: 5 nós com nome, e todos os 5 na cena', () => {
    // Critério 10. A conferência é sobre os nós **da cena**, e não sobre o array `nodes`, porque
    // nó que existe no arquivo e não está em nenhuma cena não desenha nada: seria uma peça
    // faltando na tela com o arquivo passando em qualquer validação estrutural.
    const raizes = junto.scenes?.[junto.scene ?? 0]?.nodes ?? [];
    const nomesNaCena = raizes.map((indice) => junto.nodes?.[indice]?.name);

    expect(junto.scenes).toHaveLength(1);
    expect(junto.nodes).toHaveLength(IDS.length);
    expect(nomesNaCena).toEqual(IDS);
  });

  it('nenhuma peça herda o material de outra: cada nó alcança o material com o próprio id', () => {
    // Critério 11, e o defeito que o ADR-007 D5 existe para impedir. Juntar documentos é
    // exatamente onde ele voltaria, porque toda peça vem com `material: 0` no documento dela.
    for (const id of IDS) {
      expect(oQueONoAlcanca(junto, id).nomeDoMaterial).toBe(id);
    }
  });

  it('nenhum material é compartilhado entre nós: os índices que cada um alcança são disjuntos', () => {
    // A mesma garantia do teste acima, medida por índice em vez de por nome. Vale a repetição
    // porque nome é convenção do acervo de prova e índice é o que de fato recebe a cor: um
    // acervo futuro com dois materiais de mesmo nome passaria pelo teste de nome e cairia aqui.
    const alcancados = IDS.flatMap((id) => materiaisDoNo(junto, id));

    expect(alcancados).toHaveLength(IDS.length);
    expect(new Set(alcancados).size).toBe(IDS.length);
    expect(junto.materials).toHaveLength(IDS.length);
  });

  it('nenhuma peça lê a geometria de outra: malha, acessor e buffer de cada nó são os dela', () => {
    // Mata de uma vez o deslocamento esquecido em `meshes`, em `accessors`, em `bufferViews` e
    // em `buffers`: qualquer um deles faz o nó cair no conteúdo do primeiro documento, e o
    // `uri` em base64 da geometria não é igual em duas peças de tamanhos diferentes.
    for (const [ordem, id] of IDS.entries()) {
      expect(oQueONoAlcanca(junto, id)).toEqual(oQueONoAlcanca(documentoDe(MODELOS[ordem] ?? ''), id));
    }
  });

  it('os arrays crescem sem sobra nem falta: 5 buffers, e um bufferView por bufferView de peça', () => {
    const bufferViewsDePeca = MODELOS.reduce(
      (total, texto) => total + (documentoDe(texto).bufferViews?.length ?? 0),
      0,
    );

    expect(junto.buffers).toHaveLength(IDS.length);
    expect(junto.bufferViews).toHaveLength(bufferViewsDePeca);
    expect(junto.meshes).toHaveLength(IDS.length);
  });

  it('o que a junção não entende sai como entrou: o asset do primeiro documento é preservado', () => {
    expect(junto.asset).toEqual(documentoDe(MODELOS[0] ?? '').asset);
  });

  it('a geometria de cada peça sobrevive à junção, com a caixa que ela tinha sozinha', async () => {
    // Critério 12, e o único teste que julga o resultado por um carregador de glTF de verdade em
    // vez de por leitura de JSON. Índice certo no arquivo e malha errada na tela não é uma
    // combinação possível, mas é a que arruinaria a entrega, então é conferida.
    const { objeto } = await carregarPecaNaCena(juntarModelos3d(MODELOS));
    const encontradas = malhas(objeto);

    expect(encontradas.map(({ name }) => name)).toEqual(IDS);

    for (const malha of encontradas) {
      const sozinha = await carregarPecaNaCena(gltfDaPecaDeProva(malha.name));

      esperarCaixaIgual(new Box3().setFromObject(malha), sozinha.caixa);
    }
  });
});

describe('juntar um modelo só', () => {
  it('devolve o mesmo modelo, sem mexer em nada', () => {
    // Critério 13. Com um documento só todos os deslocamentos valem zero, então qualquer coisa
    // que a junção reconstrua em vez de preservar aparece aqui como diferença.
    const original = documentoDe(MODELOS[0] ?? '');
    const junto = documentoDe(juntarModelos3d([MODELOS[0] ?? '']));

    expect(junto).toEqual(original);
  });

  it('preserva a medida e o nome da peça depois de passar pelo carregador', async () => {
    const id = IDS[0] ?? '';
    const sozinha = await carregarPecaNaCena(gltfDaPecaDeProva(id));
    const { objeto, caixa } = await carregarPecaNaCena(juntarModelos3d([gltfDaPecaDeProva(id)]));

    expect(malhas(objeto).map(({ name }) => name)).toEqual([id]);
    esperarCaixaIgual(caixa, sozinha.caixa);
  });
});

describe('juntar a mesma peça duas vezes', () => {
  // O caso que expõe reindexação errada mais depressa que qualquer outro: os dois documentos são
  // idênticos, então cada índice do segundo é igual ao do primeiro e precisa ser deslocado. Um
  // deslocamento esquecido aqui não produz arquivo quebrado, produz uma peça só, ou duas peças
  // que dividem o material e mudam de cor juntas.
  const id = IDS[0] ?? '';
  const junto = documentoDe(juntarModelos3d([gltfDaPecaDeProva(id), gltfDaPecaDeProva(id)]));

  it('vira dois nós, e os dois entram na cena', () => {
    expect(junto.nodes).toHaveLength(2);
    expect(junto.scenes?.[0]?.nodes).toEqual([0, 1]);
  });

  it('vira dois materiais independentes, e não duas peças que mudam de cor juntas', () => {
    const primeiro = junto.meshes?.[junto.nodes?.[0]?.mesh ?? -1]?.primitives?.[0]?.material;
    const segundo = junto.meshes?.[junto.nodes?.[1]?.mesh ?? -1]?.primitives?.[0]?.material;

    expect(junto.materials).toHaveLength(2);
    expect(primeiro).toBe(0);
    // O índice `0` do segundo documento tem que virar `1`. É aqui que um `if (indice)` no lugar
    // da comparação com `undefined` deixaria `0`, e as duas peças passariam a dividir material.
    expect(segundo).toBe(1);
  });

  it('vira duas malhas e dois buffers, e o segundo nó não lê a geometria do primeiro', () => {
    expect(junto.meshes).toHaveLength(2);
    expect(junto.buffers).toHaveLength(2);
    expect(junto.nodes?.[1]?.mesh).toBe(1);
    expect(junto.meshes?.[1]?.primitives?.[0]?.attributes?.POSITION).toBe(3);
    expect(junto.accessors?.[3]?.bufferView).toBe(3);
    expect(junto.bufferViews?.[3]?.buffer).toBe(1);
  });

  it('continua sendo glTF válido pelo validador da Khronos', async () => {
    const bytes = new TextEncoder().encode(
      juntarModelos3d([gltfDaPecaDeProva(id), gltfDaPecaDeProva(id)]),
    );
    const { issues } = await validateBytes(bytes);

    expect(issues.numErrors).toBe(0);
    expect(issues.numWarnings).toBe(0);
  });
});

describe('juntar modelos com hierarquia de nós e com textura', () => {
  // O acervo de prova não exercita `children`, `textures`, `images` nem `samplers`, e um
  // deslocamento esquecido em qualquer um deles passaria em todos os testes acima. Num modelo
  // trazido por cliente o efeito é o de sempre: a peça pega o desenho da peça de outra marca.
  const junto = documentoDe(
    juntarModelos3d([gltfComFilhoETextura('alfa'), gltfComFilhoETextura('beta')]),
  );

  it('o filho do segundo modelo continua sendo o filho dele, e não um nó do primeiro', () => {
    expect(junto.nodes?.map(({ name }) => name)).toEqual(['alfa', 'alfa-filho', 'beta', 'beta-filho']);
    expect(junto.nodes?.[0]?.children).toEqual([1]);
    expect(junto.nodes?.[2]?.children).toEqual([3]);
    expect(junto.scenes?.[0]?.nodes).toEqual([0, 2]);
  });

  it('o nó pai, que não tem malha, continua sem malha em vez de ganhar a do vizinho', () => {
    // `mesh` ausente tem que sair ausente. Somar deslocamento a `undefined` daria `NaN`, e um
    // `?? 0` no lugar da comparação com `undefined` daria ao nó de transformação a malha 0.
    expect(junto.nodes?.[0]?.mesh).toBeUndefined();
    expect(junto.nodes?.[2]?.mesh).toBeUndefined();
    expect(junto.nodes?.[3]?.mesh).toBe(1);
  });

  it('a textura do segundo modelo aponta para a imagem e o sampler dele, não para os do primeiro', () => {
    expect(junto.textures?.[0]).toEqual({ source: 0, sampler: 0 });
    expect(junto.textures?.[1]).toEqual({ source: 1, sampler: 1 });
    expect(junto.images?.[1]?.uri).toBe('data:image/png;base64,beta');
  });

  it('o material do segundo modelo aponta para a textura dele, e a cor não é tocada', () => {
    expect(junto.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture?.index).toBe(0);
    expect(junto.materials?.[1]?.pbrMetallicRoughness?.baseColorTexture?.index).toBe(1);
    // Reapontar índice não é pintar: nenhum campo de cor aparece onde não havia (ADR-007 D3).
    expect(junto.materials?.[1]?.pbrMetallicRoughness).toEqual({ baseColorTexture: { index: 1 } });
  });
});

describe('as recusas da junção', () => {
  it('lista vazia é recusa explícita, e não um glTF vazio entregue com sucesso', () => {
    // Critério 14. Cena vazia com sucesso é o BUG-001 por outro caminho: nada na tela, nenhum
    // aviso, e ninguém com o que depurar. O teste confere o `codigo` e não só que lançou, porque
    // o código é contrato de API e é ele que decide o status HTTP.
    expect(() => juntarModelos3d([])).toThrow(ErroDeVariante);
    expect(() => juntarModelos3d([])).toThrow(
      expect.objectContaining({ codigo: 'MODELO_3D_INVALIDO' }),
    );
  });

  it.each(['animations', 'skins', 'cameras'])(
    '%s é recusado, em vez de juntado com os índices apontando para o alvo errado',
    (campo) => {
      // Critério 15. Os três referenciam nós e acessores por caminhos que a junção não reindexa.
      // Juntar mesmo assim produziria um arquivo que o validador aceita e que move o nó errado.
      expect(() => juntarModelos3d([pecaCom(campo, [{}])])).toThrow(
        expect.objectContaining({ codigo: 'MODELO_3D_NAO_NORMALIZAVEL' }),
      );
    },
  );

  it.each(['animations', 'skins', 'cameras'])(
    '%s vazio não é recusado, porque array vazio não referencia nada',
    (campo) => {
      // A recusa é sobre conteúdo, não sobre a chave existir. Recusar `"skins": []` reprovaria um
      // arquivo que não tem esqueleto nenhum, e a mensagem mandaria consertar o que já está certo.
      expect(() => juntarModelos3d([pecaCom(campo, [])])).not.toThrow();
    },
  );

  it('recusa o documento com o campo proibido mesmo quando ele não é o primeiro da lista', () => {
    // A recusa acontece antes de qualquer concatenação: o modelo junto sai inteiro ou não sai.
    expect(() => juntarModelos3d([MODELOS[0] ?? '', pecaCom('animations', [{}])])).toThrow(
      expect.objectContaining({ codigo: 'MODELO_3D_NAO_NORMALIZAVEL' }),
    );
  });

  it('peça sem cena é recusada, e não juntada como um nó que nunca aparece na tela', () => {
    const semCena = documentoDe(MODELOS[0] ?? '');
    delete semCena.scenes;

    expect(() => juntarModelos3d([JSON.stringify(semCena)])).toThrow(
      expect.objectContaining({ codigo: 'MODELO_3D_INVALIDO' }),
    );
  });

  it('texto que não é glTF é recusado pelo leitor, com o código dele', () => {
    expect(() => juntarModelos3d(['isto não é json'])).toThrow(
      expect.objectContaining({ codigo: 'MODELO_3D_INVALIDO' }),
    );
  });
});
