// @vitest-environment jsdom
//
// jsdom e não o ambiente padrão porque metade destes testes prova o deslocamento **pelo efeito**:
// carrega o modelo no three e mede a caixa envolvente de verdade. O `FileLoader` do three dispara
// um `ProgressEvent` ao terminar de ler o `data:` URI do buffer, e `ProgressEvent` não existe no
// Node puro; sem esta linha os testes penduram sem dizer por quê (ver `carregarPecaNaCena.ts`).
//
// Provar pelo número escrito no JSON e também pela caixa na cena não é redundância: `translation`
// certa no arquivo e peça no lugar errado na tela é exatamente a distância que o princípio nº1
// existe para vigiar, e é o motivo de o critério 8 falar de caixa envolvente e não de campo.
//
// Os modelos entram aqui pelo `normalizarModelo3d`, e não crus do acervo, porque a função promete
// operar sobre o canônico. Detalhe que custa uma hora se for descoberto depois: `gltfDaPecaDeProva`
// devolve `JSON.stringify(..., null, 2)` **sem** quebra de linha no fim, enquanto `escreverGltf`
// (e portanto o canônico) termina com uma. A igualdade byte a byte do critério 6 só vale sobre o
// canônico, que é justamente a entrada que a função documenta.

import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';

import { deslocarModelo3d, type Deslocamento3d } from './deslocarModelo3d';
import { ErroDeVariante } from './erros';
import { normalizarModelo3d } from './normalizarModelo3d';
import { gltfDaPecaDeProva, idsDoAcervoDeProva } from '../acervo/acervoDeProva';
import { carregarPecaNaCena } from '../../palco3d/carregarPecaNaCena';

interface NoLido {
  name?: string;
  mesh?: number;
  children?: number[];
  translation?: number[];
  scale?: number[];
  matrix?: number[];
}

interface DocumentoLido {
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  nodes?: NoLido[];
  accessors?: unknown[];
  bufferViews?: unknown[];
  buffers?: unknown[];
}

/** A peça do acervo no formato que a função documenta receber. */
function canonico(pecaId: string, parametros: Record<string, number> = {}): string {
  return normalizarModelo3d(gltfDaPecaDeProva(pecaId, parametros)).modelo;
}

function lerDocumento(modelo: string): DocumentoLido {
  return JSON.parse(modelo) as DocumentoLido;
}

/** De volta ao formato do canônico, para os documentos que os testes montam à mão. */
function escrever(documento: DocumentoLido): string {
  return `${JSON.stringify(documento, null, 2)}\n`;
}

function translacaoDoNo(modelo: string, nome: string): number[] {
  const no = (lerDocumento(modelo).nodes ?? []).find((candidato) => candidato.name === nome);
  if (no === undefined) throw new Error(`o nó "${nome}" não existe neste modelo`);

  return no.translation ?? [];
}

/** A caixa envolvente medida pelo three, que é o que a tela mostra. */
async function caixaDe(modelo: string) {
  return (await carregarPecaNaCena(modelo)).caixa;
}

/**
 * Uma sola dentro de um nó pai sem malha, que é a forma que a montagem da composição produz.
 *
 * O pai é a raiz da cena e o filho some da lista de raízes. É o documento do critério 8: se a
 * função deslocar os dois, a sola sobe o dobro do pedido.
 */
function comPaiEFilho(): string {
  const documento = lerDocumento(canonico('prova-sola-plana'));
  const nos = documento.nodes ?? [];
  nos.push({ name: 'pai-da-composicao', children: [0], translation: [0, 0, 0] });
  documento.nodes = nos;
  documento.scenes = [{ nodes: [nos.length - 1] }];

  return escrever(documento);
}

/** Duas peças na mesma cena, para provar que a função não para no primeiro nó raiz. */
function comDuasRaizes(): string {
  const documento = lerDocumento(canonico('prova-sola-plana'));
  const primeiro = documento.nodes?.[0];
  const nos = documento.nodes ?? [];
  nos.push({ ...primeiro, name: 'segunda-raiz', translation: [0, 0.5, 0] });
  documento.nodes = nos;
  documento.scenes = [{ nodes: [0, 1] }];

  return escrever(documento);
}

describe('deslocarModelo3d', () => {
  it('soma na translação que já existe, em vez de trocá-la pelo deslocamento', () => {
    // O cadarço assenta em [0,03, 0,093, 0]. Se a função escrevesse o deslocamento em vez de
    // somar, o Y daria 0,01 (parece plausível) e o X daria 0 (a peça saltaria da biqueira para o
    // meio do calçado). Por isso o X entra na asserção: ele é a metade que denuncia a troca.
    const deslocado = deslocarModelo3d(canonico('prova-cadarco-reto'), [0, 0.01, 0]);
    const [x, y, z] = translacaoDoNo(deslocado, 'prova-cadarco-reto');

    expect(x).toBeCloseTo(0.03, 9);
    expect(y).toBeCloseTo(0.103, 9);
    expect(z).toBeCloseTo(0, 9);
  });

  it('sobe a peça na cena de verdade, e não só o número no JSON', async () => {
    // O critério 5 pelo efeito: entre a `translation` no arquivo e a peça na tela há o
    // carregador, e é essa distância que o princípio nº1 manda vigiar.
    const antes = canonico('prova-sola-plana');
    const depois = deslocarModelo3d(antes, [0, 0.01, 0]);

    const caixaAntes = await caixaDe(antes);
    const caixaDepois = await caixaDe(depois);

    expect(caixaDepois.min.y - caixaAntes.min.y).toBeCloseTo(0.01, 7);
    expect(caixaDepois.max.y - caixaAntes.max.y).toBeCloseTo(0.01, 7);
  });

  it('desloca os três eixos, e não só a altura', async () => {
    // Escrever a soma eixo a eixo à mão é como se esquece o Z: um modelo com X e Y certos passa
    // em todo teste que só olha altura e fica com a peça deslocada em profundidade na tela.
    const antes = canonico('prova-sola-plana');
    const depois = deslocarModelo3d(antes, [0.1, 0.2, 0.3]);

    expect(translacaoDoNo(depois, 'prova-sola-plana')).toEqual([0.1, 0.2, 0.3]);

    const movimento = (await caixaDe(depois)).min.clone().sub((await caixaDe(antes)).min);
    expect(movimento.x).toBeCloseTo(0.1, 6);
    expect(movimento.y).toBeCloseTo(0.2, 6);
    expect(movimento.z).toBeCloseTo(0.3, 6);
  });

  it('sobe a partir de onde a peça já estava, e não a partir do chão', () => {
    // A sola tem assento zero e o cadarço não. Uma implementação que ignorasse a translação
    // atual acertaria a sola e derrubaria o cadarço de 0,093 para 0,01, o que na tela vira o
    // cadarço enterrado dentro do cabedal.
    const deslocado = deslocarModelo3d(canonico('prova-cadarco-reto'), [0, 0.02, 0]);

    expect(translacaoDoNo(deslocado, 'prova-cadarco-reto')[1]).toBeCloseTo(0.113, 9);
  });

  it('deslocar duas vezes acumula, em vez de a segunda anular a primeira', () => {
    const uma = deslocarModelo3d(canonico('prova-sola-plana'), [0, 0.01, 0]);
    const duas = deslocarModelo3d(uma, [0, 0.01, 0]);

    expect(translacaoDoNo(duas, 'prova-sola-plana')[1]).toBeCloseTo(0.02, 9);
  });

  it('deslocamento negativo desce a peça, em vez de subir pelo módulo', async () => {
    // Trocar o sinal por engano é invisível em qualquer teste que só compare distância. Aqui a
    // asserção é de direção: a peça tem que ficar ABAIXO do chão.
    const antes = canonico('prova-cadarco-reto');
    const depois = deslocarModelo3d(antes, [0, -0.05, 0]);

    expect(translacaoDoNo(depois, 'prova-cadarco-reto')[1]).toBeCloseTo(0.043, 9);
    expect((await caixaDe(depois)).min.y).toBeLessThan((await caixaDe(antes)).min.y);
  });

  it('nó raiz sem translação ganha uma, em vez de continuar na origem', () => {
    const documento = lerDocumento(canonico('prova-sola-plana'));
    delete documento.nodes?.[0]?.translation;
    const deslocado = deslocarModelo3d(escrever(documento), [0, 0.018, 0]);

    expect(translacaoDoNo(deslocado, 'prova-sola-plana')).toEqual([0, 0.018, 0]);
  });

  it('desloca todos os nós raiz da cena, e não só o primeiro', () => {
    const deslocado = deslocarModelo3d(comDuasRaizes(), [0, 0.01, 0]);

    expect(translacaoDoNo(deslocado, 'prova-sola-plana')[1]).toBeCloseTo(0.01, 9);
    expect(translacaoDoNo(deslocado, 'segunda-raiz')[1]).toBeCloseTo(0.51, 9);
  });

  it('desloca o nó de índice 0, que é falsy e some de qualquer checagem por veracidade', () => {
    // O primeiro nó de todo arquivo do acervo é o índice 0. Um `if (indice)` no lugar de
    // `!== undefined` pularia justamente ele, então o defeito seria o caso comum e não o raro.
    const deslocado = deslocarModelo3d(canonico('prova-sola-plana'), [0, 0.01, 0]);

    expect(lerDocumento(deslocado).nodes?.[0]?.translation).toEqual([0, 0.01, 0]);
  });

  it.each(idsDoAcervoDeProva())('%s continua com a mesma geometria depois de deslocada', (id) => {
    // O critério 7: deslocar é transformação de nó, nunca malha nova (ADR-008 D7). Comparar o
    // TEXTO dos três arrays e não só os objetos, porque é o texto que vira arquivo, e porque
    // reordenar campo sem mudar valor também é reescrever o documento.
    const antes = lerDocumento(canonico(id));
    const depois = lerDocumento(deslocarModelo3d(canonico(id), [0.1, 0.2, 0.3]));

    expect(depois.accessors).toEqual(antes.accessors);
    expect(depois.bufferViews).toEqual(antes.bufferViews);
    expect(depois.buffers).toEqual(antes.buffers);
    expect(JSON.stringify([depois.accessors, depois.bufferViews, depois.buffers])).toBe(
      JSON.stringify([antes.accessors, antes.bufferViews, antes.buffers]),
    );
  });

  it.each(idsDoAcervoDeProva())('%s deslocada por zero volta byte a byte igual', (id) => {
    // O critério 6, e a contraprova de que a função não reescreve o documento de lado nenhum:
    // se ela normalizasse, reordenasse, arredondasse ou gravasse `translation: [0,0,0]` num nó
    // que não a declarava, esta comparação de string acusaria na hora.
    const entrada = canonico(id);

    expect(deslocarModelo3d(entrada, [0, 0, 0])).toBe(entrada);
  });

  it('nó raiz sem translação continua sem translação quando o deslocamento é zero', () => {
    // O caso que a peça de prova não cobre, porque ela sempre declara `translation`. Gravar o
    // padrão do glTF 2.0 num nó que o omitia mudaria os bytes do arquivo sem mudar a cena.
    const documento = lerDocumento(canonico('prova-sola-plana'));
    delete documento.nodes?.[0]?.translation;
    const entrada = escrever(documento);

    expect(deslocarModelo3d(entrada, [0, 0, 0])).toBe(entrada);
  });

  it('desloca só o pai, e o conjunto sobe uma vez em vez de duas', async () => {
    // O critério 8, medido onde ele dói: na caixa envolvente. O filho herda a translação do pai,
    // então deslocar os dois somaria 0,05 duas vezes e a sola pararia em 0,1, um calçado com as
    // peças desencaixadas e nenhum erro no caminho.
    const antes = comPaiEFilho();
    const depois = deslocarModelo3d(antes, [0, 0.05, 0]);

    const subida = (await caixaDe(depois)).min.clone().sub((await caixaDe(antes)).min);
    expect(subida.y).toBeCloseTo(0.05, 7);
    expect(subida.y).not.toBeCloseTo(0.1, 3);
  });

  it('o nó filho sai com a translação intocada depois de o pai ser deslocado', () => {
    // O gêmeo do teste acima no nível do arquivo. Ele existe porque a caixa envolvente também
    // subiria uma vez só se a função deslocasse o FILHO em vez do pai, e essa versão errada
    // quebraria a montagem no dia em que um pai tivesse dois filhos.
    const deslocado = deslocarModelo3d(comPaiEFilho(), [0, 0.05, 0]);

    expect(translacaoDoNo(deslocado, 'prova-sola-plana')).toEqual([0, 0, 0]);
    expect(translacaoDoNo(deslocado, 'pai-da-composicao')).toEqual([0, 0.05, 0]);
  });

  it('sem "scenes", raiz é quem ninguém declara como filho', () => {
    // Documento montado à mão não é obrigado a trazer cena, e a resposta tem que ser a mesma.
    const documento = lerDocumento(comPaiEFilho());
    delete documento.scene;
    delete documento.scenes;
    const deslocado = deslocarModelo3d(escrever(documento), [0, 0.05, 0]);

    expect(translacaoDoNo(deslocado, 'pai-da-composicao')).toEqual([0, 0.05, 0]);
    expect(translacaoDoNo(deslocado, 'prova-sola-plana')).toEqual([0, 0, 0]);
  });

  it('desloca a cena que o documento declara ativa, e não a primeira da lista', () => {
    // `scene` aponta para uma cena qualquer do array. Ignorá-lo e usar `scenes[0]` deslocaria
    // nós que não estão na cena que aparece, e a peça visível ficaria parada.
    const documento = lerDocumento(comDuasRaizes());
    documento.scenes = [{ nodes: [0] }, { nodes: [1] }];
    documento.scene = 1;
    const deslocado = deslocarModelo3d(escrever(documento), [0, 0.01, 0]);

    expect(translacaoDoNo(deslocado, 'segunda-raiz')[1]).toBeCloseTo(0.51, 9);
    expect(translacaoDoNo(deslocado, 'prova-sola-plana')).toEqual([0, 0, 0]);
  });

  it('cena que lista o mesmo nó duas vezes desloca a peça uma vez só', () => {
    // glTF válido, e um laço ingênuo somaria 0,01 duas vezes. É o dobro do critério 8 entrando
    // por outra porta: mesma peça no lugar errado, mesma ausência de erro.
    const documento = lerDocumento(canonico('prova-sola-plana'));
    documento.scenes = [{ nodes: [0, 0] }];
    const deslocado = deslocarModelo3d(escrever(documento), [0, 0.01, 0]);

    expect(translacaoDoNo(deslocado, 'prova-sola-plana')[1]).toBeCloseTo(0.01, 9);
  });
});

describe('deslocarModelo3d recusa', () => {
  function codigoAoDeslocar(modelo: string, deslocamento: unknown): string | undefined {
    try {
      deslocarModelo3d(modelo, deslocamento as Deslocamento3d);
    } catch (erro) {
      return erro instanceof ErroDeVariante ? erro.codigo : `(${String(erro)})`;
    }

    return undefined;
  }

  it.each([
    ['NaN', [0, Number.NaN, 0]],
    ['Infinity', [0, Number.POSITIVE_INFINITY, 0]],
    ['texto no lugar de número', [0, '0.01', 0]],
    ['null', [0, null, 0]],
    ['dois eixos só', [0, 0.01]],
    ['quatro eixos', [0, 0.01, 0, 0]],
  ])('deslocamento com %s é PARAMETRO_INVALIDO, e não uma peça na origem', (_rotulo, valor) => {
    // `NaN` é o pior dos seis: ele atravessa a soma sem lançar, vira `null` no JSON e o
    // carregador lê `null` como zero. A peça pararia na origem com cara de defeito de
    // geometria, longe da divisão por zero que a produziu.
    expect(codigoAoDeslocar(canonico('prova-sola-plana'), valor)).toBe('PARAMETRO_INVALIDO');
  });

  it('nó raiz com "matrix" é recusado, em vez de o deslocamento sumir em silêncio', () => {
    // O glTF 2.0 proíbe `matrix` junto de `translation`. Escrever a translação por cima daria um
    // arquivo inválido em que o carregador honra a matriz: o deslocamento simplesmente não
    // aconteceria, e nada no caminho reclamaria.
    const documento = lerDocumento(canonico('prova-sola-plana'));
    const no = documento.nodes?.[0];
    if (no !== undefined) {
      delete no.translation;
      delete no.scale;
      no.matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    }

    expect(codigoAoDeslocar(escrever(documento), [0, 0.01, 0])).toBe(
      'MODELO_3D_NAO_NORMALIZAVEL',
    );
  });

  it('translação malformada no modelo é recusada, em vez de completada com zero', () => {
    // Completar o que falta transformaria arquivo quebrado em deslocamento silenciosamente
    // errado, que na tela é peça flutuando sem explicação.
    const documento = lerDocumento(canonico('prova-sola-plana'));
    const no = documento.nodes?.[0];
    if (no !== undefined) no.translation = [0, 0.018];

    expect(codigoAoDeslocar(escrever(documento), [0, 0.01, 0])).toBe('MODELO_3D_INVALIDO');
  });

  it('cena apontando para nó que não existe é recusada, em vez de não deslocar nada', () => {
    const documento = lerDocumento(canonico('prova-sola-plana'));
    documento.scenes = [{ nodes: [0, 7] }];

    expect(codigoAoDeslocar(escrever(documento), [0, 0.01, 0])).toBe('MODELO_3D_INVALIDO');
  });

  it('texto que não é glTF é recusado antes de qualquer conta', () => {
    expect(codigoAoDeslocar('isto não é glTF nenhum', [0, 0.01, 0])).toBe('MODELO_3D_INVALIDO');
  });
});

describe('deslocarModelo3d sobre o acervo inteiro', () => {
  it.each(idsDoAcervoDeProva())('%s deslocada continua carregando no three', async (id) => {
    // Uma peça deslocada que o carregador recusa é pior que uma peça no lugar errado: a tela
    // fica vazia. O `Vector3` no fim é só para exigir que a caixa exista de fato.
    const { caixa } = await carregarPecaNaCena(deslocarModelo3d(canonico(id), [0, 0.01, 0]));

    expect(caixa.getSize(new Vector3()).y).toBeGreaterThan(0);
    expect(caixa.min.y).toBeGreaterThan(0);
  });
});
