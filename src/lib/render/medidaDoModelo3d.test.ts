// @vitest-environment jsdom
//
// jsdom e não o ambiente padrão porque o teste que carrega o peso deste arquivo compara a medida
// lida do JSON com a que o three mede depois de carregar, e o `FileLoader` do three dispara um
// `ProgressEvent` ao terminar de ler o `data:` URI do buffer. `ProgressEvent` não existe no Node
// puro: sem esta linha os testes penduram sem dizer por quê (a mesma nota está em
// `carregarPecaNaCena.test.ts`, e foi descoberta por sonda antes do build de T13).
//
// O teste decisivo é o primeiro bloco: se a medida do JSON e a do three divergirem, o projeto
// tem duas verdades sobre onde a peça está, e a montagem assenta o cabedal num lugar que a tela
// não confirma. É o princípio nº1 aplicado a geometria em vez de cor.

import { describe, expect, it } from 'vitest';

import { catalogoDeProva, gltfDaPecaDeProva, idsDoAcervoDeProva } from '../acervo/acervoDeProva';
import { ErroDeVariante } from './erros';
import { medidaDoModelo3d, type CaixaDoModelo3d } from './medidaDoModelo3d';
import { carregarPecaNaCena } from '../../palco3d/carregarPecaNaCena';
import type { ParametroDePeca } from '../composicao/tiposDaComposicao';

const CATALOGO = catalogoDeProva();
const IDS = idsDoAcervoDeProva();

/**
 * As posições são gravadas em float32 e as contas saem em float64, então a igualdade exata não
 * existe aqui. Seis casas é folgado para float32 em valores da ordem de 0,3 m (o erro esperado
 * fica na casa de 1e-8) e apertado o bastante para um milímetro de diferença ficar vermelho.
 */
const CASAS_DE_FLOAT32 = 6;

/** O assento do cabedal na forma de prova, conforme `acervoDeProva.ts`. */
const ALTURA_DA_SOLA = 0.018;

/**
 * O assento do cadarço, lido da `translation` do nó dele.
 *
 * Desde a Fase G o assento do cadarço é calculado da altura do peito do pé (`cadarcoSobreOCabedal.ts`)
 * e deixou de ser um número digitado. Ler do nó é a comparação que estes testes querem: a medida
 * começa onde o nó diz que a peça está, e não em zero.
 */
const [ASSENTO_DO_CADARCO_X = 0, ASSENTO_DO_CADARCO_Y = 0] = (
  JSON.parse(gltfDaPecaDeProva('prova-cadarco-reto')) as { nodes: Array<{ translation: number[] }> }
).nodes[0]?.translation ?? [];

function parametroDaPeca(id: string): ParametroDePeca {
  const parametro = CATALOGO.pecas.find((peca) => peca.id === id)?.parametros[0];
  if (parametro === undefined) throw new Error(`a peça "${id}" não tem parâmetro no catálogo`);

  return parametro;
}

/** A mesma caixa, medida pelo caminho que passa por three.js e por uma decodificação de buffer. */
async function medidaPeloThree(textoGltf: string): Promise<CaixaDoModelo3d> {
  const { caixa } = await carregarPecaNaCena(textoGltf);

  return {
    minimo: [caixa.min.x, caixa.min.y, caixa.min.z],
    maximo: [caixa.max.x, caixa.max.y, caixa.max.z],
  };
}

function conferirCaixasIguais(lida: CaixaDoModelo3d, doThree: CaixaDoModelo3d): void {
  for (const eixo of [0, 1, 2] as const) {
    expect(lida.minimo[eixo]).toBeCloseTo(doThree.minimo[eixo], CASAS_DE_FLOAT32);
    expect(lida.maximo[eixo]).toBeCloseTo(doThree.maximo[eixo], CASAS_DE_FLOAT32);
  }
}

interface DescricaoDeMao {
  nodes: unknown[];
  meshes?: unknown[];
  accessors?: unknown[];
}

/**
 * Um glTF escrito à mão, sem buffer nenhum.
 *
 * Serve aos casos que o acervo de prova não sabe produzir (hierarquia, escala negativa, arquivo
 * quebrado). Nenhum deles passa pelo three, e por isso a ausência de geometria de verdade não
 * atrapalha: o que se mede aqui é o `min`/`max` do acessor, que é o que a função lê.
 */
function gltfDeMao({ nodes, meshes, accessors }: DescricaoDeMao): string {
  return JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes: meshes ?? [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: accessors ?? [{ min: [-1, 0, -1], max: [1, 2, 1] }],
  });
}

/** A peça de prova com o nó raiz adulterado, para provar o que é recusado. */
function pecaComNoAlterado(id: string, alteracao: Record<string, unknown>): string {
  const documento = JSON.parse(gltfDaPecaDeProva(id)) as { nodes: Array<Record<string, unknown>> };
  const raiz = documento.nodes[0] ?? {};
  documento.nodes[0] = { ...raiz, ...alteracao };

  return JSON.stringify(documento);
}

function codigoRecusado(executar: () => unknown): string {
  try {
    executar();
  } catch (erro) {
    if (erro instanceof ErroDeVariante) return erro.codigo;
    throw erro;
  }
  throw new Error('esperava uma recusa, mas a medida passou');
}

describe('a medida lida do JSON é a mesma que o three mede', () => {
  it.each(IDS)('%s não tem duas medidas diferentes, uma no servidor e outra na tela', async (id) => {
    // O teste decisivo (critério 1). Ele só é possível porque T13 já sabe carregar, e é ele que
    // impede as duas leituras de divergirem: uma diferença aqui significa que a montagem assenta
    // a peça num lugar que o navegador não confirma, e ninguém veria o porquê.
    const textoGltf = gltfDaPecaDeProva(id);

    conferirCaixasIguais(medidaDoModelo3d(textoGltf), await medidaPeloThree(textoGltf));
  });

  // O cabedal tem altura fixa e não estica (decisão do dono de 2026-09-14).
  it.each(IDS.filter((id) => !id.startsWith('prova-cabedal-')))('%s continua batendo com o three depois de o parâmetro esticar a peça', async (id) => {
    // A versão padrão tem `scale: [1, 1, 1]`, então ela sozinha não provaria que a escala é
    // aplicada: uma implementação que ignorasse `scale` passaria no teste anterior inteiro.
    const parametro = parametroDaPeca(id);
    const textoGltf = gltfDaPecaDeProva(id, { [parametro.nome]: parametro.maximo });

    conferirCaixasIguais(medidaDoModelo3d(textoGltf), await medidaPeloThree(textoGltf));
  });
});

describe('a escala do nó entra na medida', () => {
  it('a altura vem do parâmetro pedido, e não da altura gravada na malha', () => {
    // Critério 2. O acervo é paramétrico (ADR-008 D7): a malha é sempre a mesma e quem muda a
    // altura é o `scale` do nó. Medir só a malha daria a mesma altura para toda variante, e a
    // sola grossa afundaria o cabedal.
    const parametro = parametroDaPeca('prova-sola-plana');
    const alturaCom = (valor: number): number => {
      const caixa = medidaDoModelo3d(
        gltfDaPecaDeProva('prova-sola-plana', { [parametro.nome]: valor }),
      );

      return caixa.maximo[1] - caixa.minimo[1];
    };

    const fina = alturaCom(parametro.minimo);
    const grossa = alturaCom(parametro.maximo);

    expect(fina).toBeCloseTo(parametro.minimo, CASAS_DE_FLOAT32);
    expect(grossa).toBeCloseTo(parametro.maximo, CASAS_DE_FLOAT32);
    expect(grossa / fina).toBeCloseTo(parametro.maximo / parametro.minimo, CASAS_DE_FLOAT32);
  });

  it('a peça engrossada cresce para cima, e não para baixo do chão', () => {
    const parametro = parametroDaPeca('prova-sola-plana');
    const fina = medidaDoModelo3d(
      gltfDaPecaDeProva('prova-sola-plana', { [parametro.nome]: parametro.minimo }),
    );
    const grossa = medidaDoModelo3d(
      gltfDaPecaDeProva('prova-sola-plana', { [parametro.nome]: parametro.maximo }),
    );

    expect(grossa.minimo[1]).toBeCloseTo(fina.minimo[1], 9);
    expect(grossa.maximo[1]).toBeGreaterThan(fina.maximo[1]);
    // O parâmetro escala só o eixo Y: comprimento e largura não podem se mexer junto.
    expect(grossa.minimo[0]).toBeCloseTo(fina.minimo[0], 9);
    expect(grossa.maximo[2]).toBeCloseTo(fina.maximo[2], 9);
  });
});

describe('a translação do nó entra na medida', () => {
  it('peça assentada acima do chão mede a partir do assento, e não de zero', () => {
    // Critério 3. Ignorar a `translation` daria `minimo[1] = 0` para as três peças, e a pilha
    // inteira sairia colada no chão, uma peça dentro da outra.
    const cabedal = medidaDoModelo3d(gltfDaPecaDeProva('prova-cabedal-baixo'));
    const cadarco = medidaDoModelo3d(gltfDaPecaDeProva('prova-cadarco-reto'));

    expect(cabedal.minimo[1]).toBeCloseTo(ALTURA_DA_SOLA, 9);
    expect(cadarco.minimo[1]).toBeCloseTo(ASSENTO_DO_CADARCO_Y, 9);
  });

  it('o deslocamento lateral do cadarço aparece na medida, e não só o vertical', () => {
    // O cadarço é deslocado para a biqueira. Uma implementação que somasse só o eixo Y (o único
    // que o empilhamento usa) passaria despercebida até alguém medir a largura do calçado.
    const cadarco = medidaDoModelo3d(gltfDaPecaDeProva('prova-cadarco-reto'));
    const meioComprimento = (cadarco.maximo[0] - cadarco.minimo[0]) / 2;

    expect(cadarco.minimo[0] + meioComprimento).toBeCloseTo(ASSENTO_DO_CADARCO_X, CASAS_DE_FLOAT32);
  });

  it('a sola, que assenta no chão, continua com o piso em zero', () => {
    expect(medidaDoModelo3d(gltfDaPecaDeProva('prova-sola-plana')).minimo[1]).toBeCloseTo(0, 9);
  });
});

describe('hierarquia e espelhamento', () => {
  it('nó filho herda a transformação do pai, em vez de medir como se fosse raiz', () => {
    // A translação da filha acontece no espaço do pai, então ela entra escalada por ele: 1 + 2 ×
    // 0,5 = 2. Somar a translação crua daria 1,5 e a peça ficaria meio metro abaixo do lugar.
    const caixa = medidaDoModelo3d(
      gltfDeMao({
        nodes: [
          { name: 'pai', children: [1], translation: [0, 1, 0], scale: [2, 2, 2] },
          { name: 'filha', mesh: 0, translation: [0, 0.5, 0] },
        ],
      }),
    );

    expect(caixa.minimo).toEqual([-2, 2, -2]);
    expect(caixa.maximo).toEqual([2, 6, 2]);
  });

  it('escala negativa não devolve caixa invertida, com altura negativa', () => {
    // Espelhar é legítimo (o pé esquerdo é o direito espelhado), e a escala negativa troca o
    // mínimo com o máximo. Sem ordenar, a peça mediria altura negativa e o empilhamento a
    // enterraria na peça de baixo.
    const caixa = medidaDoModelo3d(
      gltfDeMao({
        nodes: [{ name: 'espelhada', mesh: 0, scale: [-1, 1, 1] }],
        accessors: [{ min: [0, 0, 0], max: [2, 1, 1] }],
      }),
    );

    expect(caixa.minimo[0]).toBe(-2);
    expect(caixa.maximo[0]).toBe(0);
  });

  it('a primeira malha do documento é medida, e o índice zero não é confundido com ausência', () => {
    // `mesh: 0` e `POSITION: 0` são o caso comum, e `if (indice)` os trataria como ausentes. O
    // defeito não apareceria aqui: apareceria como peça no lugar errado, três módulos adiante.
    const caixa = medidaDoModelo3d(gltfDeMao({ nodes: [{ name: 'primeira', mesh: 0 }] }));

    expect(caixa.maximo[1]).toBe(2);
  });
});

describe('recusas, para que nenhuma medida saia errada em silêncio', () => {
  it.each(['rotation', 'matrix'])('nó com "%s" é recusado, e não medido torto', (campo) => {
    // Critério 4. Caixa alinhada aos eixos sobre geometria girada mente, e mentira de medida
    // vira peça flutuando na tela sem explicação. O código importa tanto quanto a recusa: é ele
    // que a API traduz, e ele diz ao cliente qual arquivo consertar.
    const valor = campo === 'rotation' ? [0.5, 0, 0, 0.866] : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const modelo = pecaComNoAlterado('prova-sola-plana', { [campo]: valor });

    expect(codigoRecusado(() => medidaDoModelo3d(modelo))).toBe('MODELO_3D_NAO_NORMALIZAVEL');
    expect(() => medidaDoModelo3d(modelo)).toThrow(new RegExp(campo));
    // A mensagem tem que dizer o que fazer, senão a recusa só troca um mistério por outro.
    expect(() => medidaDoModelo3d(modelo)).toThrow(/Exporte/);
  });

  it('rotação identidade também é recusada, para não haver "quase identidade" aceitável', () => {
    const modelo = pecaComNoAlterado('prova-sola-plana', { rotation: [0, 0, 0, 1] });

    expect(codigoRecusado(() => medidaDoModelo3d(modelo))).toBe('MODELO_3D_NAO_NORMALIZAVEL');
  });

  it('modelo sem nó nenhum é recusado, em vez de devolver uma caixa de tamanho zero', () => {
    // Caixa zerada com sucesso é o BUG-001 por outro caminho: a peça sumiria da montagem sem
    // uma linha de erro.
    expect(codigoRecusado(() => medidaDoModelo3d(JSON.stringify({ asset: { version: '2.0' } })))).toBe(
      'MODELO_3D_INVALIDO',
    );
  });

  it('modelo cujos nós não têm malha nenhuma é recusado', () => {
    expect(codigoRecusado(() => medidaDoModelo3d(gltfDeMao({ nodes: [{ name: 'vazio' }] })))).toBe(
      'MODELO_3D_INVALIDO',
    );
  });

  it('primitiva sem POSITION é recusada, e não medida como se fosse um ponto', () => {
    const modelo = gltfDeMao({
      nodes: [{ name: 'sola', mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { NORMAL: 0 } }] }],
    });

    expect(codigoRecusado(() => medidaDoModelo3d(modelo))).toBe('MODELO_3D_INVALIDO');
  });

  it('acessor de POSITION sem "min"/"max" é recusado: o glTF 2.0 os exige', () => {
    // Ausência aqui é arquivo inválido, não caso comum. Abrir o buffer para calcular daria uma
    // medida que o validador da Khronos não confere, e a promessa deste módulo é medir o que
    // está escrito no arquivo.
    const modelo = gltfDeMao({ nodes: [{ name: 'sola', mesh: 0 }], accessors: [{ bufferView: 0 }] });

    expect(codigoRecusado(() => medidaDoModelo3d(modelo))).toBe('MODELO_3D_INVALIDO');
  });

  it('hierarquia com ciclo é recusada, e não pendura o processo', () => {
    const modelo = gltfDeMao({
      nodes: [
        { name: 'pai', children: [1] },
        { name: 'filha', mesh: 0, children: [0] },
      ],
    });

    expect(codigoRecusado(() => medidaDoModelo3d(modelo))).toBe('MODELO_3D_INVALIDO');
  });

  it('JSON malformado é MODELO_3D_INVALIDO, e não uma exceção crua de parse', () => {
    expect(codigoRecusado(() => medidaDoModelo3d('{ nao e json'))).toBe('MODELO_3D_INVALIDO');
  });
});
