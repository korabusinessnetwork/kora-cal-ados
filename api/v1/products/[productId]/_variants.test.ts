// O handler ponta a ponta, sem rede e sem banco: `Request` montado à mão, `SupabaseClient`
// falso injetado pelo segundo parâmetro, e a `Response` lida byte a byte.
//
// O que este arquivo protege é o que NENHUM teste de `api/_lib/` consegue proteger: a ORDEM
// dos passos. Cada módulo de `_lib/` está certo isoladamente e continuaria verde se o handler
// os chamasse em outra sequência, e a sequência é uma propriedade de segurança, não estilo
// (ver o cabeçalho de `variants.ts`). Um 400 de `?format=png` respondido antes da
// autenticação, por exemplo, não quebra teste nenhum de `_lib/`: ele só passa a contar a quem
// não tem chave que a requisição chegou a ser processada.
//
// O cliente falso FILTRA de verdade pelos `.eq(...)` recebidos, no molde de
// `listarZonasDoProdutoDoTenant.test.ts`: um falso que devolvesse a linha ignorando os
// filtros deixaria o teste do produto da concorrente passar verde mesmo sem isolamento
// nenhum, que é exatamente o defeito que ele existe para pegar.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TETO_DE_BYTES_DO_CORPO } from '../../../_lib/lerCorpoDoPedido';
import { gerarChaveDeApi } from '../../../_lib/formatoDaChaveDeApi';
import { MENSAGEM_DE_FALHA_INTERNA } from '../../../_lib/traduzirParaFalhaDaApi';
import handler from './variants';

const CAMINHO_DO_FONTE = join('api', 'v1', 'products', '[productId]', 'variants.ts');

const CHAVE = gerarChaveDeApi('test');
const CHAVE_DE_OUTRA_MARCA = gerarChaveDeApi('test');

const PRODUTO = 'prod-1';
const PRODUTO_DA_CONCORRENTE = 'prod-2';
const CAMINHO_DO_ASSET = 'tenants/tenant-1/products/prod-1/base.svg';

/** Canônico minúsculo: dois elementos com `fill` chapa, que é tudo que o motor precisa. */
const SVG_BASE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
  '<rect id="zona-sola" width="10" height="2" fill="#000000"/>' +
  '<rect id="zona-cabedal" width="10" height="8" fill="#CCCCCC"/>' +
  '</svg>';

type Linha = Record<string, unknown>;

interface Chamadas {
  tabelas: string[];
  filtros: Array<[string, unknown]>;
  atualizacoes: Array<Record<string, unknown>>;
  downloads: string[];
}

interface OpcoesDoFalso {
  /** Substitui as zonas do produto (para o caso do seletor gravado quebrado). */
  zonas?: Linha[];
  /** Conteúdo do asset-base; uma função que lança simula falha inesperada no caminho. */
  asset?: string | (() => string);
}

/**
 * Banco falso com DUAS marcas na mesma tabela, a situação real que a `service_role` deixa
 * de proteger. `tenant-2` existe para que "produto da concorrente" seja um produto que
 * realmente está lá, e não um id inventado.
 */
function clienteFalso(opcoes: OpcoesDoFalso = {}): {
  cliente: SupabaseClient;
  chamadas: Chamadas;
} {
  const chamadas: Chamadas = { tabelas: [], filtros: [], atualizacoes: [], downloads: [] };

  const banco: Record<string, Linha[]> = {
    tenant_api_keys: [
      { id: 'chave-1', tenant_id: 'tenant-1', prefixo: CHAVE.prefixo, hash: CHAVE.hash, revoked_at: null },
      {
        id: 'chave-2',
        tenant_id: 'tenant-2',
        prefixo: CHAVE_DE_OUTRA_MARCA.prefixo,
        hash: CHAVE_DE_OUTRA_MARCA.hash,
        revoked_at: null,
      },
    ],
    products: [
      { id: PRODUTO, tenant_id: 'tenant-1', nome: 'Tênis', base_asset_path: CAMINHO_DO_ASSET },
      {
        id: PRODUTO_DA_CONCORRENTE,
        tenant_id: 'tenant-2',
        nome: 'Bota da concorrente',
        base_asset_path: 'tenants/tenant-2/products/prod-2/base.svg',
      },
    ],
    product_zones: opcoes.zonas ?? [
      { zone_key: 'sola', svg_selector: '#zona-sola', product_id: PRODUTO, tenant_id: 'tenant-1' },
      {
        zone_key: 'cabedal',
        svg_selector: '#zona-cabedal',
        product_id: PRODUTO,
        tenant_id: 'tenant-1',
      },
    ],
  };

  function consulta(tabela: string) {
    const filtros: Array<[string, unknown]> = [];
    const casadas = (): Linha[] =>
      (banco[tabela] ?? []).filter((linha) =>
        filtros.every(([coluna, valor]) => linha[coluna] === valor),
      );
    const resultado = () => Promise.resolve({ data: casadas(), error: null });

    const encadeador = {
      eq(coluna: string, valor: unknown) {
        filtros.push([coluna, valor]);
        chamadas.filtros.push([coluna, valor]);
        return encadeador;
      },
      maybeSingle: () => Promise.resolve({ data: casadas()[0] ?? null, error: null }),
      order: resultado,
      // O `update` de `registrarUsoDaChave` é aguardado como thenable, não por `.order()`.
      then: (ok: (v: unknown) => unknown, nao?: (m: unknown) => unknown) =>
        resultado().then(ok, nao),
    };

    return encadeador;
  }

  const cliente = {
    from(tabela: string) {
      chamadas.tabelas.push(tabela);
      return {
        select: () => consulta(tabela),
        update(valores: Record<string, unknown>) {
          chamadas.atualizacoes.push(valores);
          return consulta(tabela);
        },
      };
    },
    storage: {
      from: () => ({
        download(caminho: string) {
          chamadas.downloads.push(caminho);
          const asset = opcoes.asset ?? SVG_BASE;
          return Promise.resolve({
            data: { text: async () => (typeof asset === 'function' ? asset() : asset) },
            error: null,
          });
        },
      }),
    },
  } as unknown as SupabaseClient;

  return { cliente, chamadas };
}

function url(caminho = `/api/v1/products/${PRODUTO}/variants`): string {
  return `https://host.invalid${caminho}`;
}

interface OpcoesDoPedido {
  metodo?: string;
  chave?: string | null;
  corpo?: string;
  caminho?: string;
}

function pedidoDeVariante(opcoes: OpcoesDoPedido = {}): Request {
  const metodo = opcoes.metodo ?? 'POST';
  const chave = opcoes.chave === undefined ? CHAVE.chave : opcoes.chave;
  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json' };
  if (chave !== null) cabecalhos.Authorization = `Bearer ${chave}`;

  return new Request(url(opcoes.caminho), {
    method: metodo,
    headers: cabecalhos,
    body: metodo === 'GET' ? undefined : (opcoes.corpo ?? '{"sola": "#C0392B"}'),
  });
}

async function envelopeDe(resposta: Response): Promise<{
  data: null;
  error: { code: string; message: string };
  meta: { timestamp: string; version: string };
}> {
  return JSON.parse(await resposta.text());
}

let saidaPadrao: string[];
let saidaDeErro: string[];

beforeEach(() => {
  saidaPadrao = [];
  saidaDeErro = [];
  vi.spyOn(console, 'log').mockImplementation((linha: unknown) => {
    saidaPadrao.push(String(linha));
  });
  vi.spyOn(console, 'error').mockImplementation((linha: unknown) => {
    saidaDeErro.push(String(linha));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('o método é conferido antes de qualquer trabalho', () => {
  for (const metodo of ['GET', 'PUT', 'DELETE', 'PATCH']) {
    it(`${metodo} responde 405 com Allow: POST e não toca no banco`, async () => {
      const { cliente, chamadas } = clienteFalso();
      const resposta = await handler.fetch(pedidoDeVariante({ metodo }), cliente);

      expect(resposta.status).toBe(405);
      expect(resposta.headers.get('Allow')).toBe('POST');
      expect((await envelopeDe(resposta)).error.code).toBe('METODO_NAO_PERMITIDO');
      // Nem autenticação: `tenant_api_keys` nunca foi consultada.
      expect(chamadas.tabelas).toEqual([]);
    });
  }

  it('405 sai antes até de o cliente de serviço ser construído', async () => {
    // Sem cliente injetado, o handler chamaria `criarClienteDeServico()`, que LANÇA com
    // ambiente incompleto. Se a checagem de método viesse depois dela, isto seria 500.
    const url = process.env.SUPABASE_URL;
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const resposta = await handler.fetch(pedidoDeVariante({ metodo: 'GET' }));
      expect(resposta.status).toBe(405);
    } finally {
      if (url !== undefined) process.env.SUPABASE_URL = url;
      if (chave !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = chave;
    }
  });

  it('ambiente incompleto num POST é 500 FALHA_INTERNA, não 401', async () => {
    const url = process.env.SUPABASE_URL;
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const resposta = await handler.fetch(pedidoDeVariante());
      expect(resposta.status).toBe(500);
      expect((await envelopeDe(resposta)).error.code).toBe('FALHA_INTERNA');
    } finally {
      if (url !== undefined) process.env.SUPABASE_URL = url;
      if (chave !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = chave;
    }
  });
});

describe('autenticação antes de tudo', () => {
  it('sem chave é 401 com o envelope JSON e sem cache', async () => {
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(pedidoDeVariante({ chave: null }), cliente);

    expect(resposta.status).toBe(401);
    expect(resposta.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(resposta.headers.get('Cache-Control')).toBe('no-store');

    const envelope = await envelopeDe(resposta);
    expect(envelope).toEqual({
      data: null,
      error: { code: 'CHAVE_AUSENTE', message: expect.any(String) },
      meta: { timestamp: expect.any(String), version: '1' },
    });
  });

  it('chave inventada é 401 CHAVE_INVALIDA', async () => {
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({ chave: gerarChaveDeApi('test').chave }),
      cliente,
    );

    expect(resposta.status).toBe(401);
    expect((await envelopeDe(resposta)).error.code).toBe('CHAVE_INVALIDA');
  });

  it('o corpo malformado NÃO é lido antes da chave: sem chave, a resposta é 401', async () => {
    // A ordem é o que se prova aqui. Se o corpo fosse lido primeiro, quem não tem chave
    // nenhuma receberia 400 e saberia que o pedido chegou a ser processado.
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({ chave: null, corpo: '{' }),
      cliente,
    );

    expect(resposta.status).toBe(401);
  });

  it('?format=png sem chave também é 401, não 400', async () => {
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({ chave: null, caminho: `/api/v1/products/${PRODUTO}/variants?format=png` }),
      cliente,
    );

    expect(resposta.status).toBe(401);
  });

  it('registra o uso da chave (sem await) na tabela certa', async () => {
    const { cliente, chamadas } = clienteFalso();
    await handler.fetch(pedidoDeVariante(), cliente);

    expect(chamadas.atualizacoes).toHaveLength(1);
    expect(Object.keys(chamadas.atualizacoes[0] ?? {})).toEqual(['last_used_at']);
  });
});

describe('o produto da concorrente é indistinguível de um produto que não existe', () => {
  async function corpoNormalizado(resposta: Response): Promise<string> {
    // O `meta.timestamp` é a única diferença legítima entre duas respostas emitidas em
    // milissegundos diferentes. Neutralizado, o resto tem de bater byte a byte, é o que
    // significa "a mesma resposta" para quem sonda ids de marcas concorrentes.
    const texto = await resposta.text();
    return texto.replace(/"timestamp":"[^"]*"/, '"timestamp":"<hora>"');
  }

  it('404 do produto alheio é byte a byte o 404 do id inexistente', async () => {
    const { cliente: a } = clienteFalso();
    const { cliente: b } = clienteFalso();

    const alheio = await handler.fetch(
      pedidoDeVariante({ caminho: `/api/v1/products/${PRODUTO_DA_CONCORRENTE}/variants` }),
      a,
    );
    const inexistente = await handler.fetch(
      pedidoDeVariante({ caminho: '/api/v1/products/nao-existe-em-lugar-nenhum/variants' }),
      b,
    );

    expect(alheio.status).toBe(404);
    expect(inexistente.status).toBe(404);
    expect(alheio.headers.get('Content-Type')).toBe(inexistente.headers.get('Content-Type'));
    expect(await corpoNormalizado(alheio)).toBe(await corpoNormalizado(inexistente));
  });

  it('nunca 403, o código é PRODUTO_NAO_ENCONTRADO', async () => {
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({ caminho: `/api/v1/products/${PRODUTO_DA_CONCORRENTE}/variants` }),
      cliente,
    );

    expect(resposta.status).not.toBe(403);
    expect((await envelopeDe(resposta)).error.code).toBe('PRODUTO_NAO_ENCONTRADO');
  });

  it('o produto alheio é recusado antes de o corpo importar', async () => {
    // Corpo malformado + produto da concorrente = 404, não 400: o passo 3 vem antes do 5.
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({
        caminho: `/api/v1/products/${PRODUTO_DA_CONCORRENTE}/variants`,
        corpo: '{',
      }),
      cliente,
    );

    expect(resposta.status).toBe(404);
  });
});

describe('o productId sai do caminho da URL', () => {
  /** Nenhum destes é a rota, e nenhum deles pode entregar um id por acidente de contagem. */
  const caminhosQueNaoIdentificamProduto = [
    '/api/v1/products//variants',
    `/api/v1/products/${PRODUTO}`,
    '/api/v1/variants',
    '/',
  ];

  it('barra final não muda nada: o id continua sendo lido', async () => {
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({ caminho: `/api/v1/products/${PRODUTO}/variants/` }),
      cliente,
    );

    expect(resposta.status).toBe(200);
  });

  it('id percent-encoded é decodificado antes da consulta', async () => {
    const { cliente, chamadas } = clienteFalso();
    await handler.fetch(
      pedidoDeVariante({ caminho: '/api/v1/products/prod%2D1/variants' }),
      cliente,
    );

    expect(chamadas.filtros).toContainEqual(['id', PRODUTO]);
  });

  for (const caminho of caminhosQueNaoIdentificamProduto) {
    it(`caminho inesperado (${caminho}) é 404, nunca um id por acidente`, async () => {
      const { cliente } = clienteFalso();
      const resposta = await handler.fetch(pedidoDeVariante({ caminho }), cliente);

      expect(resposta.status).toBe(404);
      expect((await envelopeDe(resposta)).error.code).toBe('PRODUTO_NAO_ENCONTRADO');
    });
  }

  it('`%` malformado não vira exceção: é 404 como qualquer outro id que não existe', async () => {
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({ caminho: '/api/v1/products/%E0%A4%A/variants' }),
      cliente,
    );

    expect(resposta.status).toBe(404);
  });
});

describe('?format=', () => {
  it('ausente responde 200', async () => {
    const { cliente } = clienteFalso();
    expect((await handler.fetch(pedidoDeVariante(), cliente)).status).toBe(200);
  });

  it('svg responde 200', async () => {
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({ caminho: `/api/v1/products/${PRODUTO}/variants?format=svg` }),
      cliente,
    );

    expect(resposta.status).toBe(200);
  });

  it('png é 400 FORMATO_NAO_SUPORTADO, com o valor recusado na mensagem', async () => {
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({ caminho: `/api/v1/products/${PRODUTO}/variants?format=png` }),
      cliente,
    );

    expect(resposta.status).toBe(400);
    const envelope = await envelopeDe(resposta);
    expect(envelope.error.code).toBe('FORMATO_NAO_SUPORTADO');
    expect(envelope.error.message).toContain('png');
    expect(envelope.error.message).toContain('format=svg');
  });

  it('valor gigante não vira resposta gigante', async () => {
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({
        caminho: `/api/v1/products/${PRODUTO}/variants?format=${'p'.repeat(5000)}`,
      }),
      cliente,
    );

    expect(resposta.status).toBe(400);
    expect((await envelopeDe(resposta)).error.message.length).toBeLessThan(200);
  });
});

describe('o corpo', () => {
  const corposRecusados: Array<[string, string]> = [
    ['vazio', ''],
    ['malformado', '{'],
    ['array', '[]'],
    ['objeto sem nenhuma zona', '{}'],
    ['não-objeto', '"sola"'],
  ];

  for (const [nome, corpo] of corposRecusados) {
    it(`${nome} é 400 CORPO_INVALIDO`, async () => {
      const { cliente } = clienteFalso();
      const resposta = await handler.fetch(pedidoDeVariante({ corpo }), cliente);

      expect(resposta.status).toBe(400);
      expect((await envelopeDe(resposta)).error.code).toBe('CORPO_INVALIDO');
    });
  }

  it('corpo acima do teto de bytes é 400 CORPO_INVALIDO, com envelope', async () => {
    // O teto em si tem teste próprio em `api/_lib/lerCorpoDoPedido.test.ts`, inclusive a prova de
    // que a leitura para no meio. O que ESTE teste prende é outra coisa: que a recusa atravesse o
    // handler no envelope certo, em vez de escapar como 500 pelo caminho genérico.
    const pares: string[] = [];
    for (let indice = 0; pares.length * 26 < TETO_DE_BYTES_DO_CORPO * 2; indice += 1) {
      pares.push(`"zona-${indice}":"#C0392B"`);
    }

    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({ corpo: `{${pares.join(',')}}` }),
      cliente,
    );

    expect(resposta.status).toBe(400);
    const envelope = await envelopeDe(resposta);
    expect(envelope.error.code).toBe('CORPO_INVALIDO');
    expect(envelope.error.message).toContain(String(TETO_DE_BYTES_DO_CORPO));
  });

  it('cor que não é hex é 422 COR_INVALIDA', async () => {
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({ corpo: '{"sola": "vermelho"}' }),
      cliente,
    );

    expect(resposta.status).toBe(422);
    expect((await envelopeDe(resposta)).error.code).toBe('COR_INVALIDA');
  });
});

describe('a pré-checagem de zone_key, e o contraste que dá sentido a ela', () => {
  it('zone_key que o produto não tem é 422 e a mensagem lista as zonas existentes', async () => {
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(
      pedidoDeVariante({ corpo: '{"palmilha": "#C0392B"}' }),
      cliente,
    );

    expect(resposta.status).toBe(422);
    const envelope = await envelopeDe(resposta);
    expect(envelope.error.code).toBe('ZONA_NAO_ENCONTRADA');
    expect(envelope.error.message).toContain('palmilha');
    // A informação acionável: o que ESTE produto tem.
    expect(envelope.error.message).toContain('sola');
    expect(envelope.error.message).toContain('cabedal');
  });

  it('a pré-checagem acontece antes do motor: o asset-base nem é baixado', async () => {
    const { cliente, chamadas } = clienteFalso();
    await handler.fetch(pedidoDeVariante({ corpo: '{"palmilha": "#C0392B"}' }), cliente);

    expect(chamadas.downloads).toEqual([]);
  });

  it('produto sem zona nenhuma diz isso, em vez de listar uma lista vazia', async () => {
    const { cliente } = clienteFalso({ zonas: [] });
    const resposta = await handler.fetch(pedidoDeVariante(), cliente);

    expect(resposta.status).toBe(422);
    expect((await envelopeDe(resposta)).error.message).toContain('nenhuma zona marcada');
  });

  it('seletor gravado quebrado é 409, com o MESMO código, é o que a pré-checagem separa', async () => {
    const { cliente } = clienteFalso({
      zonas: [
        {
          zone_key: 'sola',
          svg_selector: '#seletor-que-nao-resolve-nada',
          product_id: PRODUTO,
          tenant_id: 'tenant-1',
        },
      ],
    });
    const resposta = await handler.fetch(pedidoDeVariante(), cliente);

    expect(resposta.status).toBe(409);
    const envelope = await envelopeDe(resposta);
    expect(envelope.error.code).toBe('ZONA_NAO_ENCONTRADA');
    // Família "dado do tenant": a mensagem manda corrigir no editor, não no pedido.
    expect(envelope.error.message).toContain('editor de zonas');
  });

  it('zonas sobrepostas do tenant são 409, não 500', async () => {
    const { cliente } = clienteFalso({
      zonas: [
        { zone_key: 'sola', svg_selector: '#zona-sola', product_id: PRODUTO, tenant_id: 'tenant-1' },
        {
          zone_key: 'cabedal',
          svg_selector: '#zona-sola',
          product_id: PRODUTO,
          tenant_id: 'tenant-1',
        },
      ],
    });
    const resposta = await handler.fetch(
      pedidoDeVariante({ corpo: '{"sola": "#C0392B", "cabedal": "#111111"}' }),
      cliente,
    );

    expect(resposta.status).toBe(409);
    expect((await envelopeDe(resposta)).error.code).toBe('ZONAS_SOBREPOSTAS');
  });
});

describe('o sucesso é o artefato, sem envelope', () => {
  it('200 devolve o SVG cru, com o Content-Type de SVG e sem cache', async () => {
    const { cliente } = clienteFalso();
    const resposta = await handler.fetch(pedidoDeVariante(), cliente);

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('Content-Type')).toBe('image/svg+xml; charset=utf-8');
    expect(resposta.headers.get('Cache-Control')).toBe('no-store');

    const corpo = await resposta.text();
    expect(corpo.startsWith('<svg') || corpo.startsWith('<?xml')).toBe(true);
    // Nenhum JSON em volta: nem envelope, nem `"data"`, nem base64.
    expect(corpo).not.toContain('"data"');
    expect(() => JSON.parse(corpo)).toThrow();
  });

  it('a cor pedida saiu aplicada, o motor foi mesmo chamado com o asset-base do produto', async () => {
    const { cliente, chamadas } = clienteFalso();
    const corpo = await (await handler.fetch(pedidoDeVariante(), cliente)).text();

    expect(chamadas.downloads).toEqual([CAMINHO_DO_ASSET]);
    expect(corpo).toContain('fill="#C0392B"');
    expect(corpo).not.toContain('fill="#000000"');
  });

  it('as duas consultas de dados filtram por tenant_id, não só por id', async () => {
    // O isolamento é de duas consultas independentes: recusar o produto não protege a
    // listagem de zonas, que é outra tabela e outro `where`.
    const { cliente, chamadas } = clienteFalso();
    await handler.fetch(pedidoDeVariante(), cliente);

    expect(chamadas.tabelas).toEqual(
      expect.arrayContaining(['tenant_api_keys', 'products', 'product_zones']),
    );
    expect(chamadas.filtros.filter(([coluna]) => coluna === 'tenant_id')).toHaveLength(2);
  });
});

describe('o 500 não vaza e não some', () => {
  const SEGREDO_DA_MENSAGEM = 'coluna_interna_que_nao_pode_sair';

  it('erro inesperado vira 500 com a mensagem FIXA, sem a mensagem interna', async () => {
    const { cliente } = clienteFalso({
      asset: () => {
        throw new Error(`falha ao ler ${SEGREDO_DA_MENSAGEM}`);
      },
    });
    const resposta = await handler.fetch(pedidoDeVariante(), cliente);

    expect(resposta.status).toBe(500);
    const envelope = await envelopeDe(resposta);
    expect(envelope.error.code).toBe('FALHA_INTERNA');
    expect(envelope.error.message).toBe(MENSAGEM_DE_FALHA_INTERNA);
    expect(envelope.error.message).not.toContain(SEGREDO_DA_MENSAGEM);
  });

  it('o detalhe do 500 fica no log, sem ele o defeito é impossível de investigar', async () => {
    const { cliente } = clienteFalso({
      asset: () => {
        throw new Error(`falha ao ler ${SEGREDO_DA_MENSAGEM}`);
      },
    });
    await handler.fetch(pedidoDeVariante(), cliente);

    expect(saidaDeErro.join('\n')).toContain(SEGREDO_DA_MENSAGEM);
    expect(saidaDeErro.join('\n')).toContain('falha_interna');
  });

  it('o rastro do 500 NÃO carrega a chave, mesmo se ela estiver no erro', async () => {
    // `fetch` e supabase-js incluem headers da requisição em algumas falhas, e
    // `Authorization` estaria ali dentro.
    const { cliente } = clienteFalso({
      asset: () => {
        throw new Error(`falhou com Authorization: Bearer ${CHAVE.chave}`);
      },
    });
    await handler.fetch(pedidoDeVariante(), cliente);

    const log = saidaDeErro.join('\n');
    expect(log).toContain('REDIGIDO');
    expect(log).not.toContain(CHAVE.chave);
    expect(log).not.toContain(CHAVE.hash);
  });
});

describe('uma linha de log por requisição, sempre', () => {
  it('no sucesso: uma linha, com o prefixo da chave e a duração', async () => {
    const { cliente } = clienteFalso();
    await handler.fetch(pedidoDeVariante(), cliente);

    expect(saidaPadrao).toHaveLength(1);
    expect(saidaPadrao[0]).toContain('metodo=POST');
    expect(saidaPadrao[0]).toContain('status=200');
    expect(saidaPadrao[0]).toContain(`prefixo=${CHAVE.prefixo}`);
    expect(saidaPadrao[0]).toMatch(/duracao_ms=\d+/);
    expect(saidaPadrao[0]).toContain(`rota=/api/v1/products/${PRODUTO}/variants`);
    // Nunca a chave nem o hash.
    expect(saidaPadrao[0]).not.toContain(CHAVE.chave);
  });

  it('no erro: uma linha também, com o código, no canal de erro', async () => {
    const { cliente } = clienteFalso();
    await handler.fetch(pedidoDeVariante({ chave: null }), cliente);

    expect(saidaPadrao).toEqual([]);
    expect(saidaDeErro).toHaveLength(1);
    expect(saidaDeErro[0]).toContain('status=401');
    expect(saidaDeErro[0]).toContain('codigo=CHAVE_AUSENTE');
    expect(saidaDeErro[0]).toContain('prefixo=ausente');
  });

  it('a query string não entra no log, é por ali que a chave vazaria', async () => {
    const { cliente } = clienteFalso();
    await handler.fetch(
      pedidoDeVariante({ caminho: `/api/v1/products/${PRODUTO}/variants?format=svg` }),
      cliente,
    );

    expect(saidaPadrao[0]).not.toContain('format=svg');
  });
});

// A guarda que lê o próprio fonte. Duas regras (`api/_lib/README.md`): ela lê o código SEM
// comentários, e para identificador importado exige mais de uma ocorrência. Todas as três
// abaixo foram MUTADAS antes de serem consideradas prontas, guarda não mutada é guarda não
// verificada.
describe('guarda de fonte do handler', () => {
  const fonte = readFileSync(CAMINHO_DO_FONTE, 'utf8');
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');

  it('a varredura está mesmo lendo este handler (canário)', () => {
    expect(codigo).toContain('export default');
    expect(codigo).toContain('async fetch(');
  });

  it('importa `domNode` como efeito colateral, e é o domNode do motor', () => {
    // Sem este import o adaptador de DOM não é registrado e TODA requisição vira 500. Não
    // aparece em `tsc --noEmit` nem no comportamento testado aqui, o vitest registra o
    // adaptador por `setupFiles`, então os 48 testes acima passam sem o import. Só quebra em
    // runtime, na primeira chamada de cliente. Esta é a única checagem que pega isso.
    const achado = /import\s+'([^']*domNode)'/.exec(codigo);

    expect(achado, 'O handler não importa src/lib/render/domNode como efeito colateral.').not.toBe(
      null,
    );

    // Resolvido em disco, e conferido contra o arquivo do MOTOR: `..` a mais ou a menos o
    // próprio carregador de módulos já recusa, mas um `domNode` copiado para dentro de
    // `api/` resolveria e registraria um segundo adaptador, duas implementações de DOM,
    // que é o princípio nº1 quebrado no lugar onde ninguém procuraria.
    const especificador = achado?.[1] ?? '';
    const resolvido = join(dirname(CAMINHO_DO_FONTE), `${especificador}.ts`);
    expect(existsSync(resolvido), `O caminho \`${especificador}\` não existe: ${resolvido}`).toBe(
      true,
    );
    expect(resolvido).toBe(join('src', 'lib', 'render', 'domNode.ts'));
  });

  it('o handler não decide status nenhum: zero `new FalhaDaApi(` e zero número de status', () => {
    // A regra do projeto é "status vem sempre de uma fábrica de `_lib/`", e aqui ela vale sem
    // exceção. O 422 de `ZONA_NAO_ENCONTRADA` foi o caso difícil: `criarFalhaDeTransporte` só
    // aceita `CodigoDeTransporte` e este é código do motor, então por um tempo ele foi escrito
    // à mão neste arquivo. A solução não foi abrir exceção e sim mover o par para
    // `criarFalhaDeZonaDesconhecida`, ao lado das duas tabelas, porque o MESMO código vale
    // 422 vindo da pré-checagem e 409 vindo do motor, e os dois precisam ser vistos juntos.
    expect(codigo).not.toContain('new FalhaDaApi(');

    // E nenhum 4xx solto: todo status de erro do cliente nasce numa fábrica de `_lib/`, então
    // um `422` ou `409` digitado neste arquivo é a tabela renascendo aqui, inclusive por um
    // caminho que a guarda acima não veria, como passar o número para outra função. Os `5xx`
    // ficam de fora da proibição de propósito: `let status = 500` é a semente da linha de log
    // (o valor que sai quando nem o `catch` responde) e `falha.status >= 500` é o corte do
    // rastro no console, nenhum dos dois decide o status de uma resposta.
    expect(codigo).not.toMatch(/\b4\d\d\b/);
  });

  it('o handler não consulta o banco direto: nenhum `select(`', () => {
    // Consulta escrita aqui seria consulta sem o `.eq(\'tenant_id\', ...)` conferido por
    // teste, sob `service_role`, que é onde o dado de uma marca sai na resposta de outra.
    expect(codigo).not.toMatch(/\.select\(|\bfrom\(/);
  });
});
