// O teste do escritor de ZIP. Puro, sem banco: roda no `npm test` normal.
//
// Ele importa por um motivo que o próprio ADR-009 anota como risco: este é código que roda uma vez
// por cliente cancelado, e código que roda raramente apodrece sem ninguém notar. O teste é o que
// avisa que apodreceu, num dia em que ninguém está no meio de um cancelamento.

import { describe, expect, it } from 'vitest';

import { crc32, dataDosFormatoDos, lerZip, montarZip, textoDoZip } from './zip';

/** Texto que comprime bem, para o caminho do deflate ser exercitado de verdade. */
const REPETITIVO = 'zona '.repeat(400);

describe('crc32', () => {
  it('bate com os valores conhecidos do padrão', () => {
    // Os dois vetores clássicos do CRC-32. Sem um valor externo para comparar, um CRC errado
    // seria "consistente consigo mesmo" e o teste de ida e volta passaria feliz, enquanto nenhum
    // outro leitor de ZIP aceitaria o pacote.
    expect(crc32(Buffer.from(''))).toBe(0);
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    expect(crc32(Buffer.from('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });

  it('muda quando um byte muda', () => {
    expect(crc32(Buffer.from('zona-sola'))).not.toBe(crc32(Buffer.from('zona-sopa')));
  });
});

describe('dataDosFormatoDos', () => {
  it('a data padrão é fixa, para o mesmo conteúdo dar o mesmo arquivo', () => {
    // Determinismo não é capricho: é o que deixa alguém comparar duas exportações do mesmo tenant
    // e responder "mudou alguma coisa?". Com `new Date()` de padrão, todo pacote seria diferente
    // de todo pacote, e a pergunta não teria resposta.
    expect(montarZip([{ nome: 'a.txt', conteudo: 'a' }])).toEqual(
      montarZip([{ nome: 'a.txt', conteudo: 'a' }]),
    );
  });

  it('codifica ano, mês, dia, hora e minuto do jeito do MS-DOS', () => {
    const { hora, data } = dataDosFormatoDos(new Date(Date.UTC(2026, 8, 12, 14, 30, 20)));

    expect((data >> 9) + 1980).toBe(2026);
    expect((data >> 5) & 0b1111).toBe(9);
    expect(data & 0b11111).toBe(12);
    expect(hora >> 11).toBe(14);
    expect((hora >> 5) & 0b111111).toBe(30);
  });

  it('não escreve ano anterior a 1980, que o formato não sabe representar', () => {
    // O formato guarda o ano como deslocamento desde 1980. Uma data de 1970, que é o que um campo
    // de data vazio vira em JavaScript, produziria um ano negativo e um cabeçalho inválido.
    const { data } = dataDosFormatoDos(new Date(0));

    expect(data >> 9).toBe(0);
  });
});

describe('montarZip e lerZip', () => {
  it('o que entra é o que sai, na mesma ordem', () => {
    const entrada = [
      { nome: 'tenant.json', conteudo: '{"slug":"aurora"}' },
      { nome: 'produtos/runner/zonas.json', conteudo: REPETITIVO },
    ];

    expect(lerZip(montarZip(entrada))).toEqual([
      { nome: 'tenant.json', conteudo: Buffer.from('{"slug":"aurora"}') },
      { nome: 'produtos/runner/zonas.json', conteudo: Buffer.from(REPETITIVO) },
    ]);
  });

  it('guarda bytes que não são texto sem estragá-los', () => {
    // A saída leva SVG hoje e pode levar glTF binário amanhã (ADR-009 D1). Um escritor que só
    // aguenta texto entregaria o arquivo do cliente corrompido, e ele só descobriria ao abrir.
    const bytes = Buffer.from([0x00, 0xff, 0x7f, 0x80, 0x0a, 0x0d, 0x1a]);
    const [primeiro] = lerZip(montarZip([{ nome: 'peca.glb', conteudo: bytes }]));

    expect(primeiro?.conteudo).toEqual(bytes);
  });

  it('comprime o que vale a pena comprimir', () => {
    const comprimido = montarZip([{ nome: 'r.txt', conteudo: REPETITIVO }]);

    expect(comprimido.length).toBeLessThan(REPETITIVO.length / 2);
  });

  it('NÃO comprime quando comprimir engorda o arquivo', () => {
    // Deflate sobre conteúdo curto ou já comprimido sai maior que a entrada. Um pacote em que um
    // arquivo engordou levanta a pergunta errada na cabeça de quem confere a saída.
    const curto = 'a';
    const pacote = montarZip([{ nome: 'a.txt', conteudo: curto }]);
    const metodoNoCabecalhoLocal = pacote.readUInt16LE(8);

    expect(metodoNoCabecalhoLocal).toBe(0);
    expect(lerZip(pacote)[0]?.conteudo.toString()).toBe(curto);
  });

  it('preserva acento no nome do arquivo', () => {
    // A bandeira de UTF-8 existe para isto. Sem ela, "cadarço" chega quebrado em metade dos
    // leitores, e o cliente recebe uma pasta com nome ilegível na saída dele.
    const [primeiro] = lerZip(montarZip([{ nome: 'produtos/cadarço/zonas.json', conteudo: '[]' }]));

    expect(primeiro?.nome).toBe('produtos/cadarço/zonas.json');
  });

  it('o cabeçalho anuncia o número certo de entradas', () => {
    const pacote = montarZip([
      { nome: 'a', conteudo: '1' },
      { nome: 'b', conteudo: '2' },
      { nome: 'c', conteudo: '3' },
    ]);

    expect(pacote.readUInt16LE(pacote.length - 22 + 10)).toBe(3);
    expect(lerZip(pacote)).toHaveLength(3);
  });

  it('um pacote vazio ainda é um ZIP válido', () => {
    // Tenant sem produto nenhum é caso real: alguém que assinou, não subiu nada e cancelou. O
    // pacote precisa abrir mesmo assim, para a saída dele ser uma resposta e não um erro.
    expect(lerZip(montarZip([]))).toEqual([]);
  });
});

describe('lerZip recusa o que está errado, em vez de devolver lixo', () => {
  it('recusa o que não é ZIP', () => {
    expect(() => lerZip(Buffer.from('isto aqui é um SVG, não um pacote'))).toThrow(/não é um ZIP/);
  });

  it('recusa um pacote com o conteúdo adulterado', () => {
    // É o teste que dá sentido ao CRC. Um byte trocado no meio do arquivo, e o leitor precisa
    // acusar: o ADR-009 D5 manda o cliente CONFERIR antes de apagar o original, e conferência que
    // aceita arquivo corrompido não é conferência.
    const pacote = montarZip([{ nome: 'zonas.json', conteudo: 'sola cabedal cadarco' }]);
    const inicioDoCorpo = 30 + Buffer.from('zonas.json').length;

    pacote[inicioDoCorpo] = (pacote[inicioDoCorpo] as number) ^ 0xff;

    expect(() => lerZip(pacote)).toThrow(/CRC|corrompido/);
  });
});

describe('textoDoZip', () => {
  it('devolve o conteúdo do arquivo pedido', () => {
    const pacote = montarZip([
      { nome: 'a.json', conteudo: '{"a":1}' },
      { nome: 'b.json', conteudo: '{"b":2}' },
    ]);

    expect(textoDoZip(pacote, 'b.json')).toBe('{"b":2}');
  });

  it('recusa nome que não está no pacote, em vez de devolver vazio', () => {
    // Devolver string vazia faria uma conferência do tipo "a zona está no arquivo?" passar quando
    // o arquivo nem existe, que é o falso positivo mais caro que este módulo poderia produzir.
    expect(() => textoDoZip(montarZip([]), 'zonas.json')).toThrow(/não está no pacote/);
  });
});
