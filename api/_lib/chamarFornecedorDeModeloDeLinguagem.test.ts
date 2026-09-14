// Sem rede: `fetch` injetado. O que estes testes protegem, além do caminho feliz, é que NADA da
// resposta do fornecedor volta em mensagem nossa, porque é ali que a chave vazaria.

import { describe, expect, it } from 'vitest';

import { chamarFornecedorDeModeloDeLinguagem, SEGUNDOS_DE_ESPERA } from './chamarFornecedorDeModeloDeLinguagem';
import { FalhaDaApi } from './tiposDaApi';

const PEDIDO = {
  enderecoBase: 'https://api.exemplo.com/v1',
  chave: 'gsk_chave-secreta-do-tenant',
  modelo: 'llama-3.3-70b-versatile',
  instrucao: 'Você monta calçados. Catálogo: {...}',
  prompt: 'tênis vermelho de cano alto',
};

function respostaDeChat(conteudo: unknown, uso: unknown = { prompt_tokens: 1200, completion_tokens: 300 }) {
  return new Response(JSON.stringify({ choices: [{ message: { content: conteudo } }], usage: uso }), { status: 200 });
}

function buscadorQueDevolve(resposta: Response | (() => never)) {
  const chamadas: Array<{ url: string; opcoes: RequestInit }> = [];
  const buscar = ((url: string, opcoes: RequestInit) => {
    chamadas.push({ url, opcoes });
    if (typeof resposta === 'function') resposta();
    return Promise.resolve(resposta);
  }) as unknown as typeof fetch;

  return { buscar, chamadas };
}

async function codigoAoChamar(resposta: Response | (() => never)) {
  const { buscar } = buscadorQueDevolve(resposta);
  try {
    await chamarFornecedorDeModeloDeLinguagem(PEDIDO, buscar);
    return null;
  } catch (erro) {
    if (erro instanceof FalhaDaApi) return erro.codigo;
    throw erro;
  }
}

describe('a chamada ao fornecedor, o caminho feliz', () => {
  it('manda POST em {base}/chat/completions, com a chave no Bearer e o prompt como mensagem do usuário', async () => {
    const { buscar, chamadas } = buscadorQueDevolve(respostaDeChat('{"forma_id":"f","pecas":[]}'));

    const resposta = await chamarFornecedorDeModeloDeLinguagem(PEDIDO, buscar);

    expect(resposta).toEqual({ texto: '{"forma_id":"f","pecas":[]}', tokensDeEntrada: 1200, tokensDeSaida: 300 });
    const chamada = chamadas[0];
    expect(chamada?.url).toBe('https://api.exemplo.com/v1/chat/completions');
    expect(chamada?.opcoes.method).toBe('POST');
    expect((chamada?.opcoes.headers as Record<string, string>).Authorization).toBe(`Bearer ${PEDIDO.chave}`);

    const corpo = JSON.parse(String(chamada?.opcoes.body)) as { model: string; messages: { role: string; content: string }[] };
    expect(corpo.model).toBe(PEDIDO.modelo);
    // A instrução é sistema e o prompt é usuário: é o que impede o prompt de se passar por instrução.
    expect(corpo.messages).toEqual([
      { role: 'system', content: PEDIDO.instrucao },
      { role: 'user', content: PEDIDO.prompt },
    ]);
  });

  it('não segue redirecionamento e tem prazo', async () => {
    const { buscar, chamadas } = buscadorQueDevolve(respostaDeChat('ok'));
    await chamarFornecedorDeModeloDeLinguagem(PEDIDO, buscar);

    expect(chamadas[0]?.opcoes.redirect).toBe('manual');
    expect(chamadas[0]?.opcoes.signal).toBeInstanceOf(AbortSignal);
    expect(SEGUNDOS_DE_ESPERA).toBeLessThanOrEqual(30);
  });

  it('aceita conteúdo em partes, que alguns fornecedores devolvem', async () => {
    const { buscar } = buscadorQueDevolve(respostaDeChat([{ text: '{"forma_id"' }, { text: ':"f"}' }]));
    expect((await chamarFornecedorDeModeloDeLinguagem(PEDIDO, buscar)).texto).toBe('{"forma_id":"f"}');
  });

  it('usage ausente ou quebrado vira zero, e não NaN', async () => {
    const { buscar } = buscadorQueDevolve(respostaDeChat('ok', { prompt_tokens: 'muitos' }));
    const resposta = await chamarFornecedorDeModeloDeLinguagem(PEDIDO, buscar);

    expect(resposta.tokensDeEntrada).toBe(0);
    expect(resposta.tokensDeSaida).toBe(0);
  });
});

describe('a chamada ao fornecedor, o que dá errado', () => {
  it('traduz o status do fornecedor para o código do contrato', async () => {
    expect(await codigoAoChamar(new Response('', { status: 401 }))).toBe('FORNECEDOR_RECUSOU_A_CHAVE');
    expect(await codigoAoChamar(new Response('', { status: 403 }))).toBe('FORNECEDOR_RECUSOU_A_CHAVE');
    expect(await codigoAoChamar(new Response('', { status: 429 }))).toBe('FORNECEDOR_NO_LIMITE');
    expect(await codigoAoChamar(new Response('', { status: 404 }))).toBe('FORNECEDOR_NAO_TEM_O_MODELO');
    expect(await codigoAoChamar(new Response('', { status: 400 }))).toBe('FORNECEDOR_NAO_TEM_O_MODELO');
    expect(await codigoAoChamar(new Response('', { status: 500 }))).toBe('FORNECEDOR_NAO_RESPONDEU');
    // 3xx chega aqui por causa do `redirect: 'manual'`, e é para chegar.
    expect(await codigoAoChamar(new Response('', { status: 302 }))).toBe('FORNECEDOR_NAO_RESPONDEU');
  });

  it('rede fora e prazo estourado viram FORNECEDOR_NAO_RESPONDEU', async () => {
    expect(
      await codigoAoChamar(() => {
        throw new Error('ECONNREFUSED em 203.0.113.5');
      }),
    ).toBe('FORNECEDOR_NAO_RESPONDEU');
  });

  it('resposta que não é JSON de chat, ou sem conteúdo, é recusada com orientação', async () => {
    expect(await codigoAoChamar(new Response('<html>Bem-vindo</html>', { status: 200 }))).toBe('FORNECEDOR_NAO_RESPONDEU');
    expect(await codigoAoChamar(respostaDeChat(''))).toBe('FORNECEDOR_NAO_RESPONDEU');
    expect(await codigoAoChamar(new Response('{"choices":[]}', { status: 200 }))).toBe('FORNECEDOR_NAO_RESPONDEU');
  });

  it('no teste de conexão, 200 com conteúdo vazio de modelo que raciocina conta como aceito', async () => {
    const { buscar } = buscadorQueDevolve(respostaDeChat(''));
    await expect(chamarFornecedorDeModeloDeLinguagem({ ...PEDIDO, exigirConteudo: false }, buscar)).resolves.toMatchObject({ texto: '' });

    // Mas o que não é resposta de chat continua recusado, mesmo no teste.
    const semEscolhas = buscadorQueDevolve(new Response('{"choices":[]}', { status: 200 }));
    await expect(
      chamarFornecedorDeModeloDeLinguagem({ ...PEDIDO, exigirConteudo: false }, semEscolhas.buscar),
    ).rejects.toMatchObject({ codigo: 'FORNECEDOR_NAO_RESPONDEU' });
  });

  it('NADA do corpo do fornecedor entra na mensagem, nem a chave', async () => {
    // O modo de falha que este teste existe para impedir: fornecedor que devolve o cabeçalho
    // recebido (com a chave dentro) e a gente repassa isso para a tela e para o log.
    const corpoIndiscreto = JSON.stringify({
      error: { message: `chave ${PEDIDO.chave} inválida para o projeto interno-123` },
    });
    const { buscar } = buscadorQueDevolve(new Response(corpoIndiscreto, { status: 401 }));

    try {
      await chamarFornecedorDeModeloDeLinguagem(PEDIDO, buscar);
      expect.unreachable('deveria ter lançado');
    } catch (erro) {
      const mensagem = (erro as Error).message;
      expect(mensagem).not.toContain(PEDIDO.chave);
      expect(mensagem).not.toContain('interno-123');
      expect(mensagem).toMatch(/O fornecedor recusou a chave/);
    }
  });
});
