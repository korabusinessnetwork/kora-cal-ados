import { describe, expect, it } from 'vitest';

import { criarChamadorDaApi, FalhaDaApiDoModelo } from './chamarApiDoModeloDeLinguagem';

const TENANT = '11111111-1111-4111-8111-111111111111';

function buscadorQueResponde(resposta: Response) {
  const pedidos: { url: string; init: RequestInit }[] = [];
  const buscar = ((url: string, init: RequestInit) => {
    pedidos.push({ url, init });
    return Promise.resolve(resposta);
  }) as unknown as typeof fetch;
  return { buscar, pedidos };
}

const envelope = (data: unknown, error: unknown = null) => JSON.stringify({ data, error, meta: {} });

describe('criarChamadorDaApi', () => {
  it('manda o token da sessão e o tenant, e devolve o `data` desembrulhado', async () => {
    const { buscar, pedidos } = buscadorQueResponde(new Response(envelope({ configuracao: null }), { status: 200 }));
    const chamar = criarChamadorDaApi({ lerToken: () => Promise.resolve('token-da-sessao'), buscar });

    const dados = await chamar('uso', TENANT, { busca: { mes: '2026-09' } });

    expect(dados).toEqual({ configuracao: null });
    expect(pedidos[0]?.url).toBe(`/api/v1/modelo-de-linguagem/uso?tenant=${TENANT}&mes=2026-09`);
    expect((pedidos[0]?.init.headers as Record<string, string>).Authorization).toBe('Bearer token-da-sessao');
  });

  it('sem sessão não faz a chamada', async () => {
    const { buscar, pedidos } = buscadorQueResponde(new Response(envelope({})));
    const chamar = criarChamadorDaApi({ lerToken: () => Promise.resolve(null), buscar });

    await expect(chamar('configuracao', TENANT)).rejects.toMatchObject({ codigo: 'SESSAO_AUSENTE' });
    expect(pedidos).toHaveLength(0);
  });

  it('erro do contrato chega com o código e a mensagem do servidor', async () => {
    const { buscar } = buscadorQueResponde(
      new Response(envelope(null, { code: 'TETO_MENSAL_ATINGIDO', message: 'O teto mensal foi atingido.' }), { status: 409 }),
    );
    const chamar = criarChamadorDaApi({ lerToken: () => Promise.resolve('t'), buscar });

    const falha = await chamar('gerar', TENANT, { metodo: 'POST', corpo: {} }).catch((erro: unknown) => erro);

    expect(falha).toBeInstanceOf(FalhaDaApiDoModelo);
    expect(falha).toMatchObject({ codigo: 'TETO_MENSAL_ATINGIDO', message: 'O teto mensal foi atingido.', status: 409 });
  });

  it('página HTML no lugar do JSON diz para subir a API local, e não "Unexpected token"', async () => {
    const { buscar } = buscadorQueResponde(new Response('<!doctype html><html></html>', { status: 200 }));
    const chamar = criarChamadorDaApi({ lerToken: () => Promise.resolve('t'), buscar });

    await expect(chamar('configuracao', TENANT)).rejects.toMatchObject({
      codigo: 'API_INDISPONIVEL',
      message: expect.stringMatching(/api:local/),
    });
  });

  it('rede caída vira mensagem em português', async () => {
    const buscar = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
    const chamar = criarChamadorDaApi({ lerToken: () => Promise.resolve('t'), buscar });

    await expect(chamar('configuracao', TENANT)).rejects.toMatchObject({ codigo: 'SEM_CONEXAO' });
  });
});
