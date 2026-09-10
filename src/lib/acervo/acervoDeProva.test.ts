import { describe, expect, it } from 'vitest';
import { validateBytes } from 'gltf-validator';

import { catalogoDeProva, FORMA_DE_PROVA, gltfDaPecaDeProva, idsDoAcervoDeProva } from './acervoDeProva';
import { validarComposicao } from '../composicao/validarComposicao';
import { ErroDeVariante } from '../render/erros';
import { normalizarModelo3d } from '../render/normalizarModelo3d';

const CATALOGO = catalogoDeProva();

/** A lista vem do catálogo, nunca digitada aqui: peça nova entra nos testes sozinha. */
const IDS = CATALOGO.pecas.map(({ id }) => id);

function pecasDaCategoria(categoria: string): string[] {
  return CATALOGO.pecas.filter((peca) => peca.categoria === categoria).map(({ id }) => id);
}

describe('catalogoDeProva', () => {
  it('tem uma forma só, com sola e cabedal obrigatórios, cadarço opcional, e a anatomia declarada', () => {
    // A ordem da lista é a anatomia de baixo para cima, e `assenta_sobre` é o que `empilharComposicao`
    // lê para saber quem sobe quando a peça de baixo muda de tamanho. Sola sem `assenta_sobre` não é
    // esquecimento: é a peça que assenta no chão, e trocar isso por 'chao' inventaria uma categoria.
    expect(CATALOGO.formas).toHaveLength(1);
    expect(CATALOGO.formas[0]?.id).toBe(FORMA_DE_PROVA);
    expect(CATALOGO.formas[0]?.categorias).toEqual([
      { categoria: 'sola', obrigatoria: true },
      { categoria: 'cabedal', obrigatoria: true, assenta_sobre: 'sola' },
      { categoria: 'cadarco', obrigatoria: false, assenta_sobre: 'cabedal' },
    ]);
  });

  it('tem 5 peças: 2 solas, 2 cabedais e 1 cadarço', () => {
    expect(CATALOGO.pecas).toHaveLength(5);
    expect(pecasDaCategoria('sola')).toHaveLength(2);
    expect(pecasDaCategoria('cabedal')).toHaveLength(2);
    expect(pecasDaCategoria('cadarco')).toHaveLength(1);
  });

  it('toda peça pertence à única forma', () => {
    // Misturar formas é estado inválido (ADR-008 D4). Aqui não há com o que misturar, e este
    // teste é o que garante que continue assim quando alguém adicionar a segunda forma.
    for (const peca of CATALOGO.pecas) {
      expect(peca.forma_id).toBe(FORMA_DE_PROVA);
    }
  });

  it('todo id é único', () => {
    expect(new Set(IDS).size).toBe(IDS.length);
  });

  it('nenhuma categoria da forma fica sem peça', () => {
    const ocupadas = new Set(CATALOGO.pecas.map(({ categoria }) => categoria));

    for (const { categoria } of CATALOGO.formas[0]?.categorias ?? []) {
      expect(ocupadas).toContain(categoria);
    }
  });

  it('nenhuma peça ocupa categoria que a forma não declara', () => {
    const declaradas = new Set((CATALOGO.formas[0]?.categorias ?? []).map(({ categoria }) => categoria));

    for (const peca of CATALOGO.pecas) {
      expect(declaradas).toContain(peca.categoria);
    }
  });

  it('toda peça declara um parâmetro com faixa coerente e padrão dentro dela', () => {
    for (const peca of CATALOGO.pecas) {
      expect(peca.parametros.length).toBeGreaterThan(0);

      for (const parametro of peca.parametros) {
        expect(parametro.minimo).toBeLessThan(parametro.maximo);
        expect(parametro.padrao).toBeGreaterThanOrEqual(parametro.minimo);
        expect(parametro.padrao).toBeLessThanOrEqual(parametro.maximo);
      }
    }
  });
});

describe('gltfDaPecaDeProva', () => {
  it('gera glTF para todo id que o catálogo declara', () => {
    // O defeito mais provável deste módulo: alguém adiciona a peça no catálogo e esquece a
    // geometria. Percorrer o catálogo é o que faz esse esquecimento reprovar.
    for (const id of IDS) {
      expect(() => gltfDaPecaDeProva(id)).not.toThrow();
    }
  });

  it('o catálogo e a lista de ids são a mesma lista', () => {
    expect(idsDoAcervoDeProva()).toEqual(IDS);
  });

  it('recusa id que não está no acervo, listando os que estão', () => {
    expect(() => gltfDaPecaDeProva('sola-que-o-modelo-inventou')).toThrow(/não está no acervo de prova/);
  });

  it('a recusa de id não usa código de API, porque quem recusa peça inventada é o guarda', () => {
    // `PECA_NAO_ENCONTRADA` é a recusa de `validarComposicao` para a saída do modelo de
    // linguagem, e é contrato de API. Chegar aqui com id desconhecido significa que alguém
    // pulou o guarda, e isso é defeito nosso, não pedido malformado de cliente.
    try {
      gltfDaPecaDeProva('sola-que-o-modelo-inventou');
      expect.unreachable('deveria ter lançado');
    } catch (erro) {
      expect(erro).not.toBeInstanceOf(ErroDeVariante);
    }
  });
});

describe('as 5 peças são glTF 2.0 válido pelo validador de referência da Khronos', () => {
  // Este é o critério central de T12, e é externo de propósito: um validador escrito por mim
  // declarando válidos arquivos escritos por mim não prova nada. `validateBytes` decodifica o
  // buffer e confere `min`/`max` contra os vértices de verdade, alinhamento de byteOffset,
  // contagem de accessor e sentido de índice.
  it.each(IDS)('%s passa sem erro e sem aviso', async (id) => {
    const bytes = new TextEncoder().encode(gltfDaPecaDeProva(id));
    const { issues } = await validateBytes(bytes, {
      // Nenhuma peça aponta para fora. Se alguma apontar, o validador chama isto e o teste
      // falha com a mensagem certa em vez de baixar sabe-se lá o quê.
      externalResourceFunction: (uri) => Promise.reject(new Error(`recurso externo proibido: ${uri}`)),
    });

    expect({ id, mensagens: issues.messages.filter(({ severity }) => severity <= 1) }).toEqual({
      id,
      mensagens: [],
    });
    expect(issues.numErrors).toBe(0);
    expect(issues.numWarnings).toBe(0);
  });

  it.each(IDS)('%s continua válido com o parâmetro no extremo da faixa', async (id) => {
    const peca = CATALOGO.pecas.find((candidata) => candidata.id === id);
    const parametro = peca?.parametros[0];
    const texto = gltfDaPecaDeProva(id, { [parametro?.nome ?? '']: parametro?.maximo ?? 0 });
    const { issues } = await validateBytes(new TextEncoder().encode(texto));

    expect(issues.numErrors).toBe(0);
    expect(issues.numWarnings).toBe(0);
  });
});

describe('as peças já nascem canônicas: normalizar é um no-op', () => {
  it.each(IDS)('%s é aceita por normalizarModelo3d', (id) => {
    expect(() => normalizarModelo3d(gltfDaPecaDeProva(id))).not.toThrow();
  });

  it.each(IDS)('%s não tem nada para a normalização mudar', (id) => {
    // Se este teste ficar vermelho, o acervo de prova deixou de imitar o acervo de verdade: uma
    // peça que precisa ser normalizada é uma peça que ainda não é canônica, e o resto da esteira
    // (T13, T14) estaria sendo construído sobre uma premissa falsa.
    const { relatorio } = normalizarModelo3d(gltfDaPecaDeProva(id));

    expect(relatorio.nomesRenomeados).toEqual([]);
    expect(relatorio.nomesAtribuidos).toEqual([]);
    expect(relatorio.malhasDuplicadas).toBe(0);
    expect(relatorio.materiaisDuplicados).toBe(0);
    expect(relatorio.materiaisCriados).toBe(0);
  });

  it.each(IDS)('%s sai da normalização igual a como entrou', (id) => {
    // O gêmeo do canário `normalizarSvg(baixado) === baixado`.
    const entrada = gltfDaPecaDeProva(id);
    const { modelo } = normalizarModelo3d(entrada);

    expect(JSON.parse(modelo)).toEqual(JSON.parse(entrada));
  });

  it.each(IDS)('%s é recolorível, ou seja, não usa textura', (id) => {
    const { relatorio } = normalizarModelo3d(gltfDaPecaDeProva(id));

    expect(relatorio.malhasNaoRecoloriveis).toEqual([]);
  });

  it.each(IDS)('%s tem o próprio id como nome de malha, e a política de nome não o altera', (id) => {
    // Nome de malha é o endereço da zona (ADR-007 D4). Se a normalização renomeasse a peça, o
    // endereço gravado numa composição apontaria para o vazio.
    const documento = JSON.parse(gltfDaPecaDeProva(id)) as { nodes: Array<{ name?: string }> };

    expect(documento.nodes[0]?.name).toBe(id);
    expect(normalizarModelo3d(gltfDaPecaDeProva(id)).relatorio.nomesRenomeados).toEqual([]);
  });
});

describe('validarComposicao monta uma composição sobre o acervo de prova', () => {
  const sola = pecasDaCategoria('sola')[0] ?? '';
  const cabedal = pecasDaCategoria('cabedal')[0] ?? '';
  const cadarco = pecasDaCategoria('cadarco')[0] ?? '';

  it('aceita uma composição completa e devolve as 3 peças do catálogo', () => {
    const validada = validarComposicao(
      { forma_id: FORMA_DE_PROVA, pecas: [{ peca_id: sola }, { peca_id: cabedal }, { peca_id: cadarco }] },
      CATALOGO,
    );

    expect(validada.forma.id).toBe(FORMA_DE_PROVA);
    expect(validada.pecas.map(({ categoria }) => categoria)).toEqual(['sola', 'cabedal', 'cadarco']);
  });

  it('aceita composição sem o cadarço, porque a categoria é opcional', () => {
    const validada = validarComposicao(
      { forma_id: FORMA_DE_PROVA, pecas: [{ peca_id: sola }, { peca_id: cabedal }] },
      CATALOGO,
    );

    expect(validada.pecas).toHaveLength(2);
  });

  it('preenche o parâmetro com o padrão da peça quando a composição não pede nada', () => {
    const validada = validarComposicao(
      { forma_id: FORMA_DE_PROVA, pecas: [{ peca_id: sola }, { peca_id: cabedal }] },
      CATALOGO,
    );
    const parametroDaSola = CATALOGO.pecas.find(({ id }) => id === sola)?.parametros[0];

    expect(validada.pecas[0]?.parametros[parametroDaSola?.nome ?? '']).toBe(parametroDaSola?.padrao);
  });

  it('recusa peça que não existe neste acervo, com PECA_NAO_ENCONTRADA', () => {
    // A prova de que o acervo de prova exercita o guarda de verdade, e não só o caminho feliz.
    expect(() =>
      validarComposicao(
        { forma_id: FORMA_DE_PROVA, pecas: [{ peca_id: 'sola-inventada' }, { peca_id: cabedal }] },
        CATALOGO,
      ),
    ).toThrow(expect.objectContaining({ codigo: 'PECA_NAO_ENCONTRADA' }));
  });

  it('recusa composição sem a sola, que é categoria obrigatória', () => {
    expect(() =>
      validarComposicao({ forma_id: FORMA_DE_PROVA, pecas: [{ peca_id: cabedal }] }, CATALOGO),
    ).toThrow(expect.objectContaining({ codigo: 'COMPOSICAO_INVALIDA' }));
  });

  it('recusa duas solas na mesma composição', () => {
    const [primeira = '', segunda = ''] = pecasDaCategoria('sola');

    expect(() =>
      validarComposicao(
        { forma_id: FORMA_DE_PROVA, pecas: [{ peca_id: primeira }, { peca_id: segunda }, { peca_id: cabedal }] },
        CATALOGO,
      ),
    ).toThrow(expect.objectContaining({ codigo: 'COMPOSICAO_INVALIDA' }));
  });

  it('recusa parâmetro fora da faixa, e é ELE quem recusa, não o gerador', () => {
    // Critério 19 da spec: o gerador de glTF não valida parâmetro, de propósito. Duas
    // validações da mesma regra em lugares diferentes é a família de defeito do BUG-013.
    const parametro = CATALOGO.pecas.find(({ id }) => id === sola)?.parametros[0];

    expect(() =>
      validarComposicao(
        {
          forma_id: FORMA_DE_PROVA,
          pecas: [
            { peca_id: sola, parametros: { [parametro?.nome ?? '']: (parametro?.maximo ?? 0) * 10 } },
            { peca_id: cabedal },
          ],
        },
        CATALOGO,
      ),
    ).toThrow(expect.objectContaining({ codigo: 'PARAMETRO_INVALIDO' }));
  });

  it('a composição validada leva ao glTF da peça certa, fechando a esteira', () => {
    // O elo que T12 existe para provar: composição validada, peça do catálogo, glTF na mão.
    const validada = validarComposicao(
      { forma_id: FORMA_DE_PROVA, pecas: [{ peca_id: sola }, { peca_id: cabedal }] },
      CATALOGO,
    );

    for (const escolhida of validada.pecas) {
      const documento = JSON.parse(gltfDaPecaDeProva(escolhida.peca.id, escolhida.parametros)) as {
        nodes: Array<{ name?: string }>;
      };

      expect(documento.nodes[0]?.name).toBe(escolhida.peca.id);
    }
  });
});
