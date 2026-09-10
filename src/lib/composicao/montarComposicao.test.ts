// O que estes testes protegem: que o calçado saia INTEIRO, montado na ordem certa, e que a cor
// escolhida seja a cor que sai. É o princípio nº1 no ponto mais alto da pilha, porque aqui já não
// há mais nenhum módulo depois para consertar o que passar errado.
//
// Eles não repetem a aritmética de `empilharComposicao` nem a medição de `medidaDoModelo3d`, que
// já têm seus próprios testes: o que se prova aqui é a LIGAÇÃO. O defeito que este arquivo existe
// para pegar é a orquestração chamar os quatro módulos certos na ordem errada, ou passar o
// resultado de um para o parâmetro errado do outro, e cada um deles continuar correto sozinho.

import { describe, expect, it } from 'vitest';
import { validateBytes } from 'gltf-validator';

import { montarComposicao, type ProvedorDeGltfDaPeca } from './montarComposicao';
import { validarComposicao } from './validarComposicao';
import type { ComposicaoValidada } from './tiposDaComposicao';
import {
  catalogoDeProva,
  composicaoDeProva,
  gltfDaPecaDeProva,
  idsDoAcervoDeProva,
} from '../acervo/acervoDeProva';
import { ErroDeVariante } from '../render/erros';
import { medidaDoModelo3d } from '../render/medidaDoModelo3d';
import { normalizarModelo3d } from '../render/normalizarModelo3d';
import { recolorirModelo3d } from '../render/recolorirModelo3d';

const CATALOGO = catalogoDeProva();

/** O provedor real do acervo de prova. Nada de mock: as peças de verdade são código. */
const DO_ACERVO: ProvedorDeGltfDaPeca = (peca, parametros) =>
  gltfDaPecaDeProva(peca.id, parametros);

function validar(entrada: unknown): ComposicaoValidada {
  return validarComposicao(entrada, CATALOGO);
}

/** A translação gravada no nó da peça no modelo montado. É o que `deslocarModelo3d` escreveu. */
function translacaoDe(modelo: string, pecaId: string): number[] {
  const documento = JSON.parse(modelo) as {
    nodes?: Array<{ name?: string; translation?: number[] }>;
  };
  const no = (documento.nodes ?? []).find(({ name }) => name === pecaId);

  if (no?.translation === undefined) throw new Error(`nó "${pecaId}" sem translação no montado`);

  return no.translation;
}

/**
 * A mesma translação, em micrômetros redondos. Todas as comparações de posição passam por aqui.
 *
 * A geometria do glTF é float32, e o `min`/`max` do acessor também. Medir a sola padrão devolve
 * 0,017999999225 onde a descrição da peça diz 0,018, e o empilhamento carrega essa diferença para
 * cima: um erro de um NANÔMETRO num calçado de 28 centímetros. Arredondar dentro de
 * `montarComposicao` para esconder isso inventaria precisão que o arquivo não tem, e é exatamente
 * o que o autor de `deslocarModelo3d` recusou fazer, com razão. O lugar certo de tratar é aqui, na
 * comparação, com uma tolerância folgada em relação ao float32 e fina demais para alguém enxergar.
 */
function posicaoDe(modelo: string, pecaId: string): number[] {
  return translacaoDe(modelo, pecaId).map((valor) => Number(valor.toFixed(6)));
}

function materiaisDe(modelo: string): unknown[] {
  return (JSON.parse(modelo) as { materials?: unknown[] }).materials ?? [];
}

describe('montarComposicao', () => {
  it('a composição demo vira UM glTF, com as três peças e as três cores (critério 22)', async () => {
    const { modelo, zonas } = montarComposicao(validar(composicaoDeProva()), DO_ACERVO);

    // Um documento só, com as três peças endereçáveis pelo nome, que é o id delas (ADR-007 D4).
    const documento = JSON.parse(modelo) as { nodes: Array<{ name: string }> };
    expect(documento.nodes.map(({ name }) => name)).toEqual([
      'prova-sola-plana',
      'prova-cabedal-baixo',
      'prova-cadarco-reto',
    ]);

    // A zona de cada peça é a CATEGORIA, não o id: é assim que o pedido de cor da API vai chegar.
    expect(zonas).toEqual([
      { zone_key: 'sola', malhas: ['prova-sola-plana'] },
      { zone_key: 'cabedal', malhas: ['prova-cabedal-baixo'] },
      { zone_key: 'cadarco', malhas: ['prova-cadarco-reto'] },
    ]);

    // E o calçado montado é glTF 2.0 válido para o validador de referência, não só para o nosso.
    // Sem isto, "as três peças estão no arquivo" poderia ser verdade num arquivo que nenhum
    // carregador abre, e o defeito só apareceria na tela do dono.
    const { issues } = await validateBytes(new TextEncoder().encode(modelo), {
      externalResourceFunction: (uri: string) =>
        Promise.reject(new Error(`recurso externo proibido: ${uri}`)),
    });
    expect(issues.messages.filter(({ severity }) => severity <= 1)).toEqual([]);
  });

  it('nos tamanhos padrão, cada peça fica exatamente onde foi modelada (critério 22)', () => {
    // A contraprova da montagem inteira: com os parâmetros padrão nenhuma peça precisa se mexer,
    // então toda translação tem que ser o assento que T12 escreveu à mão. Qualquer deslocamento
    // aqui é a orquestração inventando movimento, e é o defeito mais provável dela.
    const { modelo } = montarComposicao(validar(composicaoDeProva()), DO_ACERVO);

    expect(posicaoDe(modelo, 'prova-sola-plana')).toEqual([0, 0, 0]);
    expect(posicaoDe(modelo, 'prova-cabedal-baixo')).toEqual([0, 0.018, 0]);
    expect(posicaoDe(modelo, 'prova-cadarco-reto')).toEqual([0.03, 0.093, 0]);

    // E o calçado inteiro vai do chão ao topo do cadarço, sem sobra em cima nem embaixo.
    const caixa = medidaDoModelo3d(modelo);
    expect(caixa.minimo[1]).toBeCloseTo(0, 6);
    expect(caixa.maximo[1]).toBeCloseTo(0.099, 6);
  });

  it('sola mais grossa levanta o cabedal e o cadarço, e não a si mesma (critério 22)', () => {
    // O caso que justifica a tarefa existir. A sola vai de 0,018 para 0,04, e os 0,022 de
    // diferença precisam aparecer em tudo que está acima dela, e em nada abaixo.
    const grossa = {
      forma_id: CATALOGO.formas[0]?.id,
      pecas: [
        { peca_id: 'prova-sola-plana', parametros: { espessura: 0.04 } },
        { peca_id: 'prova-cabedal-baixo' },
        { peca_id: 'prova-cadarco-reto' },
      ],
    };
    const { modelo } = montarComposicao(validar(grossa), DO_ACERVO);

    expect(posicaoDe(modelo, 'prova-sola-plana')).toEqual([0, 0, 0]);
    expect(posicaoDe(modelo, 'prova-cabedal-baixo')[1]).toBeCloseTo(0.04, 6);
    expect(posicaoDe(modelo, 'prova-cadarco-reto')[1]).toBeCloseTo(0.115, 6);

    // A peça sobe inteira: o X do cadarço é o da biqueira e não pode ter sido tocado.
    expect(posicaoDe(modelo, 'prova-cadarco-reto')[0]).toBeCloseTo(0.03, 6);
    expect(medidaDoModelo3d(modelo).maximo[1]).toBeCloseTo(0.121, 6);
  });

  it('trocar a cor de UMA zona não encosta nos outros materiais (critério 23)', () => {
    // O princípio nº1 em forma de assertion: a cor pedida aparece, e nada mais muda. Uma
    // montagem que repintasse tudo a cada troca passaria em "a sola ficou vermelha" e falharia
    // aqui, e o defeito na tela seria o cabedal mudando de tom sozinho.
    const antes = montarComposicao(validar(composicaoDeProva()), DO_ACERVO).modelo;

    const demo = composicaoDeProva() as { forma_id: string; pecas: Array<{ cor?: string }> };
    const depois = montarComposicao(
      validar({
        ...demo,
        pecas: demo.pecas.map((peca, indice) => (indice === 0 ? { ...peca, cor: '#C0392B' } : peca)),
      }),
      DO_ACERVO,
    ).modelo;

    const materiaisAntes = materiaisDe(antes);
    const materiaisDepois = materiaisDe(depois);

    expect(materiaisDepois[0]).not.toEqual(materiaisAntes[0]);
    expect(JSON.stringify(materiaisDepois.slice(1))).toBe(JSON.stringify(materiaisAntes.slice(1)));
  });

  it('a cor que sai é a que o recolor produziria sozinho (critério 24)', () => {
    // A montagem não converte cor, não arredonda e não escreve em `baseColorFactor`: ela chama o
    // mesmo motor que a API chama. Este teste é o que impede uma segunda conversão de sRGB para
    // linear nascer aqui, que é como "a cor do editor não é a cor da API" voltaria a existir.
    const composicao = validar(composicaoDeProva());
    const { modelo, zonas } = montarComposicao(composicao, DO_ACERVO);

    const semCor = montarComposicao(
      validar({
        forma_id: composicao.forma.id,
        pecas: composicao.pecas.map(({ peca }) => ({ peca_id: peca.id })),
      }),
      DO_ACERVO,
    );
    const pintadoPeloMotor = recolorirModelo3d(semCor.modelo, zonas, {
      sola: '#F2F2F2',
      cabedal: '#1F4FA8',
      cadarco: '#E8B33C',
    });

    expect(modelo).toBe(pintadoPeloMotor);
  });

  it('peça sem cor fica com a cor própria, e não com branco nem preto forçado (critério 25)', () => {
    // Cor ausente é escolha legítima (a peça mantém o material dela). Preencher com um padrão
    // seria inventar uma decisão de marca no lugar do tenant, e ninguém veria a diferença entre
    // "escolhi branco" e "não escolhi nada".
    const semCor = {
      forma_id: CATALOGO.formas[0]?.id,
      pecas: [
        { peca_id: 'prova-sola-plana', cor: '#C0392B' },
        { peca_id: 'prova-cabedal-baixo' },
      ],
    };
    const { modelo } = montarComposicao(validar(semCor), DO_ACERVO);
    const materiais = materiaisDe(modelo) as Array<{
      pbrMetallicRoughness?: { baseColorFactor?: number[] };
    }>;

    expect(materiais[0]?.pbrMetallicRoughness?.baseColorFactor).toBeDefined();
    expect(materiais[1]?.pbrMetallicRoughness?.baseColorFactor).toBeUndefined();
  });

  it('cor inválida que escape da validação morre no motor, sem pintar aproximado (critério 26)', () => {
    // `validarComposicao` já recusa isto. O teste existe para o dia em que alguém montar uma
    // composição à mão, sem passar pelo guarda: a segunda porta precisa estar trancada também.
    const forjada = {
      forma: CATALOGO.formas[0],
      pecas: [
        {
          categoria: 'sola',
          peca: CATALOGO.pecas.find(({ id }) => id === 'prova-sola-plana'),
          cor: 'vermelho',
          parametros: {},
        },
      ],
    } as unknown as ComposicaoValidada;

    expect(() => montarComposicao(forjada, DO_ACERVO)).toThrow(ErroDeVariante);
    expect(() => montarComposicao(forjada, DO_ACERVO)).toThrow(/vermelho/);
  });

  it('as 5 peças do acervo já nascem canônicas (critério 27)', () => {
    // A licença para a montagem NÃO normalizar (D6). Se uma peça precisasse de normalização, ou
    // a montagem passaria a reescrever o asset-base do tenant (proibido pelo ADR-005), ou montaria
    // um modelo com nó anônimo, que é zona sem endereço.
    for (const id of idsDoAcervoDeProva()) {
      const { relatorio } = normalizarModelo3d(gltfDaPecaDeProva(id));

      expect({ id, ...relatorio }).toEqual({
        id,
        nomesRenomeados: [],
        nomesAtribuidos: [],
        malhasDuplicadas: 0,
        materiaisDuplicados: 0,
        materiaisCriados: 0,
        malhasNaoRecoloriveis: [],
      });
    }
  });

  it('a ordem das peças na composição não muda o calçado', () => {
    // A ordem de uma composição é a que o modelo de linguagem escreveu. Se ela influenciasse a
    // montagem, a mesma frase gerada duas vezes daria dois calçados diferentes.
    const demo = composicaoDeProva() as { forma_id: string; pecas: unknown[] };
    const direto = montarComposicao(validar(demo), DO_ACERVO);
    const invertido = montarComposicao(
      validar({ ...demo, pecas: [...demo.pecas].reverse() }),
      DO_ACERVO,
    );

    for (const id of ['prova-sola-plana', 'prova-cabedal-baixo', 'prova-cadarco-reto']) {
      expect(posicaoDe(invertido.modelo, id)).toEqual(posicaoDe(direto.modelo, id));
    }
    expect(medidaDoModelo3d(invertido.modelo)).toEqual(medidaDoModelo3d(direto.modelo));
  });

  it('monta sem a categoria opcional, com o que sobrou nos lugares certos', () => {
    const semCadarco = {
      forma_id: CATALOGO.formas[0]?.id,
      pecas: [{ peca_id: 'prova-sola-tratorada' }, { peca_id: 'prova-cabedal-cano-alto' }],
    };
    const { modelo, zonas } = montarComposicao(validar(semCadarco), DO_ACERVO);

    expect(zonas.map(({ zone_key }) => zone_key)).toEqual(['sola', 'cabedal']);
    // A tratorada padrão tem 0,03 de espessura, então o cabedal assenta 0,012 acima do assento
    // em que foi modelado. É a pilha funcionando com peças que não são as da demo.
    expect(posicaoDe(modelo, 'prova-cabedal-cano-alto')[1]).toBeCloseTo(0.03, 6);
  });

  it('entrega ao provedor a peça do catálogo e os parâmetros já completos', () => {
    // O provedor recebe a PEÇA, não o id que veio na entrada: é o que impede a string escrita
    // pelo modelo de linguagem de virar caminho de arquivo três camadas adiante. E recebe os
    // parâmetros já preenchidos com o padrão, senão cada provedor teria que preencher de novo, e
    // dois deles preencheriam diferente.
    const pedidos: Array<{ id: string; parametros: Record<string, number> }> = [];
    const espiao: ProvedorDeGltfDaPeca = (peca, parametros) => {
      pedidos.push({ id: peca.id, parametros: { ...parametros } });
      return gltfDaPecaDeProva(peca.id, parametros);
    };

    montarComposicao(validar(composicaoDeProva()), espiao);

    expect(pedidos).toEqual([
      { id: 'prova-sola-plana', parametros: { espessura: 0.018 } },
      { id: 'prova-cabedal-baixo', parametros: { 'altura-do-cano': 0.075 } },
      { id: 'prova-cadarco-reto', parametros: { espessura: 0.006 } },
    ]);
  });
});
