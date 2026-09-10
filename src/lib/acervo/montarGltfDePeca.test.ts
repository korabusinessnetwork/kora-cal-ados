import { describe, expect, it } from 'vitest';

import { geometriaDeCaixa } from './geometriaDeCaixa';
import { montarGltfDePeca, recusarSeIndiceNaoCabe, type DescricaoDaPecaDeProva } from './montarGltfDePeca';

const SOLA: DescricaoDaPecaDeProva = {
  id: 'peca-de-teste',
  categoria: 'sola',
  rotulo: 'Peça de teste',
  comprimento: 0.28,
  largura: 0.1,
  altura: { nome: 'espessura', minimo: 0.01, maximo: 0.04, padrao: 0.018 },
  assento: [0, 0, 0],
};

interface DocumentoLido {
  asset: { version: string };
  nodes: Array<{ name?: string; mesh?: number; translation?: number[]; scale?: number[] }>;
  meshes: Array<{ name?: string; primitives: Array<Record<string, unknown>> }>;
  materials: Array<{
    name?: string;
    pbrMetallicRoughness?: { baseColorFactor?: number[]; metallicFactor?: number; roughnessFactor?: number };
  }>;
  accessors: Array<{ bufferView: number; componentType: number; count: number; type: string; min?: number[]; max?: number[] }>;
  bufferViews: Array<{ buffer: number; byteOffset: number; byteLength: number; target: number }>;
  buffers: Array<{ byteLength: number; uri: string }>;
}

function ler(peca = SOLA, parametros: Record<string, number> = {}): DocumentoLido {
  return JSON.parse(montarGltfDePeca(peca, parametros)) as DocumentoLido;
}

/** Desfaz o `data:` URI e devolve os bytes, para conferir o que foi realmente gravado. */
function bytesDoBuffer(documento: DocumentoLido): Uint8Array {
  const base64 = documento.buffers[0]?.uri.replace('data:application/octet-stream;base64,', '') ?? '';
  const binario = atob(base64);

  return Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
}

describe('montarGltfDePeca', () => {
  it('produz um glTF 2.0 com uma cena que aponta para o nó da peça', () => {
    const documento = ler();

    expect(documento.asset.version).toBe('2.0');
    expect(documento.nodes).toHaveLength(1);
    expect(documento.nodes[0]?.mesh).toBe(0);
  });

  it('o nó, a malha e o material levam o id da peça como nome', () => {
    // Nome próprio por malha é ADR-007 D4, e é o que torna a peça endereçável como zona.
    const documento = ler();

    expect(documento.nodes[0]?.name).toBe(SOLA.id);
    expect(documento.meshes[0]?.name).toBe(SOLA.id);
    expect(documento.materials[0]?.name).toBe(SOLA.id);
  });

  it('a peça tem material próprio, e ele NÃO carrega cor', () => {
    // Cor é da composição, nunca da peça: o sistema guarda receita e não resultado. Peça
    // pintada obrigaria a mesma sola a existir duas vezes no acervo para duas marcas.
    //
    // Nem mesmo o branco explícito: escrever `[1,1,1,1]` aqui obrigaria este arquivo a entrar
    // na lista de licença de `soUmLugarEscreveCorNoGltf.test.ts`, e daí em diante trocar a
    // constante por uma cor de verdade passaria calada.
    const documento = ler();

    expect(documento.materials).toHaveLength(1);
    expect(documento.materials[0]?.pbrMetallicRoughness?.baseColorFactor).toBeUndefined();
  });

  it('o material declara o acabamento, que é físico e não muda com a variante', () => {
    // Sem isto a peça herda `metallicFactor: 1` do glTF 2.0 e aparece como metal polido na
    // tela, que para um calçado é errado e sem mapa de ambiente sai quase preto.
    const acabamento = ler().materials[0]?.pbrMetallicRoughness;

    expect(acabamento?.metallicFactor).toBe(0);
    expect(acabamento?.roughnessFactor).toBeGreaterThan(0.5);
  });

  it('o buffer vem embutido em data: URI, sem apontar para fora', () => {
    // URI externa faz `normalizarModelo3d` recusar o arquivo, e com razão: um arquivo que some
    // depois quebraria o produto em silêncio.
    const documento = ler();

    expect(documento.buffers).toHaveLength(1);
    expect(documento.buffers[0]?.uri.startsWith('data:application/octet-stream;base64,')).toBe(true);
  });

  it('o buffer tem exatamente os bytes que declara ter', () => {
    const documento = ler();

    expect(bytesDoBuffer(documento)).toHaveLength(documento.buffers[0]?.byteLength ?? -1);
  });

  it('cada bufferView cabe dentro do buffer', () => {
    const documento = ler();
    const total = documento.buffers[0]?.byteLength ?? 0;

    for (const view of documento.bufferViews) {
      expect(view.byteOffset + view.byteLength).toBeLessThanOrEqual(total);
    }
  });

  it('o byteOffset de cada trecho está alinhado ao tamanho do componente', () => {
    // Regra da especificação glTF 2.0, e a que um layout escrito à mão viola primeiro: float
    // precisa de múltiplo de 4, unsigned short de múltiplo de 2.
    const documento = ler();
    const tamanhoDoComponente: Record<number, number> = { 5126: 4, 5123: 2 };

    for (const accessor of documento.accessors) {
      const view = documento.bufferViews[accessor.bufferView];
      const componente = tamanhoDoComponente[accessor.componentType] ?? 1;

      expect((view?.byteOffset ?? 0) % componente).toBe(0);
    }
  });

  it('cada bufferView declara para que serve, vértice ou índice', () => {
    // `target` diz ao renderizador em qual buffer da GPU o trecho vai. Sem ele o validador da
    // Khronos emite BUFFER_VIEW_TARGET_MISSING, que é **Informação** e não erro, ou seja, o
    // teste do validador NÃO pegaria a ausência. Por isso este teste existe à parte: um
    // critério que só o validador cobriria estaria descoberto sem ninguém notar.
    const documento = ler();
    const ARRAY_BUFFER = 34962;
    const ELEMENT_ARRAY_BUFFER = 34963;

    expect(documento.bufferViews.map(({ target }) => target)).toEqual([
      ARRAY_BUFFER,
      ARRAY_BUFFER,
      ELEMENT_ARRAY_BUFFER,
    ]);
  });

  it('os vértices gravados no buffer são os que a geometria calculou', () => {
    // O caminho inteiro de ida e volta: número em JavaScript, float32 little-endian no buffer,
    // base64 no JSON, e de volta. É aqui que uma troca de endianness apareceria.
    const documento = ler();
    const esperada = geometriaDeCaixa({ comprimento: SOLA.comprimento, altura: SOLA.altura.padrao, largura: SOLA.largura });
    const leitura = new DataView(bytesDoBuffer(documento).buffer);
    const view = documento.bufferViews[0];

    const lidos = esperada.posicoes.map((_, indice) =>
      leitura.getFloat32((view?.byteOffset ?? 0) + indice * 4, true),
    );

    expect(lidos).toEqual(esperada.posicoes);
  });

  it('os índices gravados no buffer são os que a geometria calculou', () => {
    const documento = ler();
    const esperada = geometriaDeCaixa({ comprimento: SOLA.comprimento, altura: SOLA.altura.padrao, largura: SOLA.largura });
    const leitura = new DataView(bytesDoBuffer(documento).buffer);
    const view = documento.bufferViews[2];

    const lidos = esperada.indices.map((_, indice) =>
      leitura.getUint16((view?.byteOffset ?? 0) + indice * 2, true),
    );

    expect(lidos).toEqual(esperada.indices);
  });

  it('o accessor de POSITION traz min e max, que são obrigatórios', () => {
    const documento = ler();
    const posicao = documento.accessors[0];

    expect(posicao?.min).toBeDefined();
    expect(posicao?.max).toBeDefined();
    expect(posicao?.count).toBe(24);
  });

  it('o nó assenta onde a descrição manda', () => {
    const documento = ler({ ...SOLA, assento: [0.03, 0.018, 0] });

    expect(documento.nodes[0]?.translation).toEqual([0.03, 0.018, 0]);
  });

  describe('parâmetro é transformação, nunca malha nova (ADR-008 D7)', () => {
    it('sem parâmetro, a peça sai no tamanho em que foi modelada', () => {
      expect(ler().nodes[0]?.scale).toEqual([1, 1, 1]);
    });

    it('o parâmetro escala o eixo Y na proporção do padrão', () => {
      // 0,036 é o dobro do padrão de 0,018, então o fator é 2.
      expect(ler(SOLA, { espessura: 0.036 }).nodes[0]?.scale).toEqual([1, 2, 1]);
    });

    it('parâmetro de outro nome não mexe na peça', () => {
      expect(ler(SOLA, { 'altura-do-cano': 0.2 }).nodes[0]?.scale).toEqual([1, 1, 1]);
    });

    it('dois valores de parâmetro produzem a MESMA geometria, byte a byte', () => {
      // Este é o teste que torna verificável a frase do ADR-008 D7. Se um dia alguém "melhorar"
      // o gerador remodelando a caixa em vez de escalar o nó, a suíte reprova aqui, e não numa
      // conferência a olho meses depois com o acervo já cheio de peças quase iguais.
      const fina = ler(SOLA, { espessura: 0.012 });
      const grossa = ler(SOLA, { espessura: 0.04 });

      expect(fina.accessors).toEqual(grossa.accessors);
      expect(fina.bufferViews).toEqual(grossa.bufferViews);
      expect(fina.buffers).toEqual(grossa.buffers);
      expect(bytesDoBuffer(fina)).toEqual(bytesDoBuffer(grossa));
    });

    it('o scale é o ÚNICO campo que muda entre dois valores de parâmetro', () => {
      const fina = ler(SOLA, { espessura: 0.012 });
      const grossa = ler(SOLA, { espessura: 0.04 });

      // Zerar o scale nos dois lados: se sobrar qualquer outra diferença, ela aparece aqui.
      const semEscala = (documento: DocumentoLido): DocumentoLido => ({
        ...documento,
        nodes: documento.nodes.map((no) => ({ ...no, scale: undefined })),
      });

      expect(semEscala(fina)).toEqual(semEscala(grossa));
    });
  });

  describe('a guarda de índice de 16 bits', () => {
    // Não dá para descrever uma caixa com 65 mil vértices, então a guarda é exportada e testada
    // direto. O que ela impede: `setUint16` **não lança** com um índice grande demais, ele
    // trunca, e o modelo sai com triângulos apontando para o vértice errado.
    it('deixa passar a contagem de uma caixa', () => {
      expect(() => recusarSeIndiceNaoCabe(24, 'peca-de-teste')).not.toThrow();
    });

    it('deixa passar exatamente o maior índice que cabe', () => {
      expect(() => recusarSeIndiceNaoCabe(65535, 'peca-de-teste')).not.toThrow();
    });

    it('recusa um vértice além do limite, dizendo o que trocar', () => {
      expect(() => recusarSeIndiceNaoCabe(65536, 'peca-de-teste')).toThrow(/UNSIGNED_INT/);
    });

    it('não usa código de erro de API, porque isto é defeito nosso e não pedido de cliente', () => {
      try {
        recusarSeIndiceNaoCabe(70000, 'peca-de-teste');
        expect.unreachable('deveria ter lançado');
      } catch (erro) {
        expect(erro).toBeInstanceOf(Error);
        expect(erro).not.toHaveProperty('codigo');
      }
    });
  });
});
