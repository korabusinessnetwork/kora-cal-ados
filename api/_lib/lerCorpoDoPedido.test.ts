// O que estes testes protegem: que corpo grande demais seja recusado ANTES de ser lido inteiro, e
// que a recusa não dependa da palavra do cliente.
//
// A afirmação que importa não é "devolve 400", é ONDE o 400 acontece. Um teste que só olhasse o
// status passaria igualmente com a versão antiga, que lia os sete megabytes, parseava, e só então
// recusava por passar de 90 zonas. Por isso o teste central conta quantos bytes o stream chegou a
// entregar: é a única forma de afirmar que o custo não foi pago.

import { describe, expect, it } from 'vitest';
import { lerCorpoDoPedido, TETO_DE_BYTES_DO_CORPO } from './lerCorpoDoPedido';
import { FalhaDaApi } from './tiposDaApi';

/** Captura o erro lançado sem depender de `expect().toThrow`, que não expõe `codigo`. */
async function capturar(pedido: Request): Promise<unknown> {
  try {
    await lerCorpoDoPedido(pedido);
  } catch (erro) {
    return erro;
  }
  throw new Error('esperava um erro e a chamada passou');
}

function pedidoCom(corpo: BodyInit, cabecalhos: Record<string, string> = {}): Request {
  return new Request('https://exemplo.invalid/api/v1/products/p/variants', {
    method: 'POST',
    body: corpo,
    headers: { 'content-type': 'application/json', ...cabecalhos },
  });
}

/** Um JSON de zonas com aproximadamente o tamanho pedido, em bytes. */
function corpoDe(bytes: number): string {
  const pares: string[] = [];
  let tamanho = 2;

  for (let indice = 0; tamanho < bytes; indice += 1) {
    const par = `"zona-${indice}":"#C0392B"`;
    pares.push(par);
    tamanho += par.length + 1;
  }

  return `{${pares.join(',')}}`;
}

describe('lerCorpoDoPedido, caminho feliz', () => {
  it('devolve o JSON parseado', async () => {
    const pedido = pedidoCom('{"sola":"#C0392B","cabedal":"#111111"}');

    await expect(lerCorpoDoPedido(pedido)).resolves.toEqual({
      sola: '#C0392B',
      cabedal: '#111111',
    });
  });

  it('um corpo grande, mas dentro do teto, passa inteiro', async () => {
    // A borda pelo lado de dentro: o teto não pode recusar pedido honesto e folgado.
    const corpo = corpoDe(TETO_DE_BYTES_DO_CORPO - 1_000);
    const lido = await lerCorpoDoPedido(pedidoCom(corpo));

    expect(Object.keys(lido as object).length).toBe(Object.keys(JSON.parse(corpo)).length);
  });

  it('caractere multibyte PARTIDO entre dois pedaços sobrevive', async () => {
    // `TextDecoder` sem `stream: true` viraria `�` quando um caractere multibyte ficasse
    // partido entre dois pedaços, e o dano apareceria como `zone_key` que não casa com nenhuma
    // zona do produto, ou seja, como zona inexistente, longe da causa.
    //
    // O corte é FORÇADO no meio do `ç`, e tem de ser: um corpo pequeno chega num pedaço só, e
    // aí a ausência de `stream: true` não aparece. A primeira versão deste teste usava um corpo
    // comum e a mutação que apaga o `stream: true` sobrevivia a ela.
    const original = { sola: '#C0392B', nota: 'cadarço' };
    const bytes = new TextEncoder().encode(JSON.stringify(original));
    // `ç` em UTF-8 é 0xC3 0xA7. O corte cai entre os dois.
    const corte = bytes.indexOf(0xc3) + 1;

    expect(corte).toBeGreaterThan(0);
    expect(bytes[corte]).toBe(0xa7);

    const pedacos = [bytes.slice(0, corte), bytes.slice(corte)];
    let proximo = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controlador) {
        const pedaco = pedacos[proximo];
        proximo += 1;
        if (pedaco === undefined) controlador.close();
        else controlador.enqueue(pedaco);
      },
    });

    const pedido = new Request('https://exemplo.invalid/api/v1/products/p/variants', {
      method: 'POST',
      body: stream,
      headers: { 'content-type': 'application/json' },
      // @ts-expect-error `duplex` é exigido pelo runtime para corpo em stream e não está no tipo.
      duplex: 'half',
    });

    expect(await lerCorpoDoPedido(pedido)).toEqual(original);
  });
});

describe('lerCorpoDoPedido, teto de bytes', () => {
  it('recusa pelo `content-length` sem chegar a consumir o corpo', async () => {
    // O atalho barato: o cabeçalho anuncia mais que o teto e a recusa sai antes da leitura.
    //
    // A prova é `bodyUsed`, e não uma contagem de bytes, porque o runtime puxa um pedaço do
    // stream por conta própria ao montar o `Request`: contar bytes mediria o prefetch dele, não
    // o que este módulo leu. `bodyUsed` responde exatamente a pergunta que importa aqui.
    const pedido = pedidoCom(corpoDe(1_000), {
      'content-length': String(TETO_DE_BYTES_DO_CORPO + 1),
    });

    const erro = await capturar(pedido);

    expect(erro).toBeInstanceOf(FalhaDaApi);
    expect((erro as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
    expect((erro as FalhaDaApi).status).toBe(400);
    expect(pedido.bodyUsed).toBe(false);
  });

  it('recusa mesmo sem `content-length`, contando o que chega', async () => {
    // A conferência que não depende do cliente. Requisição em `chunked` não traz o cabeçalho, e
    // cabeçalho mentiroso é o primeiro contorno que alguém tentaria.
    const erro = await capturar(pedidoCom(corpoDe(TETO_DE_BYTES_DO_CORPO + 10_000)));

    expect(erro).toBeInstanceOf(FalhaDaApi);
    expect((erro as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
    expect((erro as FalhaDaApi).status).toBe(400);
  });

  it('para de ler no primeiro pedaço que passa do teto', async () => {
    // A AFIRMAÇÃO CENTRAL. Sem ela, este arquivo inteiro passaria igual com a versão antiga, que
    // lia tudo e recusava depois. O stream conta quanto entregou; se a recusa fosse depois da
    // leitura, `entregues` seria o corpo inteiro.
    const PEDACO = 16 * 1024;
    const TOTAL = TETO_DE_BYTES_DO_CORPO * 8;
    let entregues = 0;

    const stream = new ReadableStream<Uint8Array>({
      pull(controlador) {
        if (entregues >= TOTAL) {
          controlador.close();
          return;
        }
        const pedaco = new TextEncoder().encode('x'.repeat(PEDACO));
        entregues += pedaco.byteLength;
        controlador.enqueue(pedaco);
      },
    });

    const pedido = new Request('https://exemplo.invalid/api/v1/products/p/variants', {
      method: 'POST',
      body: stream,
      headers: { 'content-type': 'application/json' },
      // @ts-expect-error `duplex` é exigido pelo runtime para corpo em stream e não está no tipo.
      duplex: 'half',
    });

    const erro = await capturar(pedido);

    expect((erro as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
    // O corpo tem oito vezes o teto e a leitura parou perto do teto. O número exato não é
    // afirmável: além do pedaço que estourou a conta, o próprio stream adianta pedaços por
    // backpressure, e isso é dele, não deste módulo. O que é afirmável, e é o que importa, é
    // que o corpo inteiro não foi lido: com a versão antiga, `entregues` seria `TOTAL`.
    expect(entregues).toBeLessThan(TOTAL / 2);
  });

  it('a mensagem da recusa diz o limite, para o integrador saber o que mudar', async () => {
    const erro = await capturar(pedidoCom(corpoDe(TETO_DE_BYTES_DO_CORPO + 10_000)));

    expect((erro as FalhaDaApi).message).toContain(String(TETO_DE_BYTES_DO_CORPO));
  });

  it('`content-length` ausente ou lixo não recusa sozinho um corpo pequeno', async () => {
    // `Number(null)` é 0 e `Number('abc')` é NaN, e nenhum é maior que o teto. Se a comparação
    // fosse escrita ao contrário, todo pedido sem o cabeçalho viraria 400.
    const pedido = pedidoCom('{"sola":"#C0392B"}', { 'content-length': 'abc' });

    await expect(lerCorpoDoPedido(pedido)).resolves.toEqual({ sola: '#C0392B' });
  });
});

describe('lerCorpoDoPedido, corpo que não é JSON', () => {
  it('corpo malformado é CORPO_INVALIDO 400, e não 500', async () => {
    // `SyntaxError` cru sairia como 500 pelo caminho genérico do handler, dizendo ao integrador
    // que o defeito é nosso quando é o JSON dele.
    const erro = await capturar(pedidoCom('{"sola": '));

    expect(erro).toBeInstanceOf(FalhaDaApi);
    expect((erro as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
    expect((erro as FalhaDaApi).status).toBe(400);
  });

  it('corpo vazio é CORPO_INVALIDO 400', async () => {
    const erro = await capturar(pedidoCom(''));

    expect((erro as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
  });

  it('POST sem corpo nenhum é CORPO_INVALIDO 400', async () => {
    const pedido = new Request('https://exemplo.invalid/api/v1/products/p/variants', {
      method: 'POST',
    });

    expect(((await capturar(pedido)) as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
  });
});
