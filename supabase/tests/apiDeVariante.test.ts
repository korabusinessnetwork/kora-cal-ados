// O que este arquivo prova: que a API de variante entrega o calçado certo para a marca certa,
// e nada para a marca errada — contra um Supabase de verdade, com o handler inteiro no
// caminho, sem cliente falso em lugar nenhum.
//
// POR QUE ELE PRECISA DO BANCO REAL, e não é redundante com `api/v1/products/[productId]/
// _variants.test.ts`: lá o cliente é falso, e cliente falso responde o que o teste mandou
// responder. Ele prova que o handler PEDE a coisa certa. Só um banco de verdade prova que o
// que volta é a coisa certa — que o `.eq('tenant_id', …)` de fato recorta a linha, que o
// asset-base baixa do bucket privado com `service_role`, e que o `svg_selector` gravado
// resolve no arquivo canônico que está lá dentro. Sob `service_role` não há RLS: o isolamento
// é código nosso, e código nosso é o que erra.
//
// Sem ambiente configurado ele PULA em vez de passar em falso (ver `README.md` desta pasta).
//
// DEPENDE de `supabase/migrations/20260908_chave_de_api_por_tenant.sql` estar aplicada. Sem a
// tabela `tenant_api_keys`, toda autenticação vira 500 e os testes falham com uma mensagem
// que aponta para o lugar errado.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import handlerDaVariante from '../../api/v1/products/[productId]/variants';
import {
  ZONAS_DO_TESTE_DA_API,
  admin,
  limpar,
  montarCenario,
  semearChavesDaApi,
  semearZonasDoProdutoA,
  temAmbiente,
  type Cenario,
  type ChavesDoCenario,
} from './ambiente';

/** Host qualquer: o handler só lê o CAMINHO da URL, nunca a origem. */
const HOST = 'https://kora.test';

const ID_QUE_NAO_EXISTE = '00000000-0000-4000-8000-000000000000';

describe.skipIf(!temAmbiente)('API de variante — contra o banco real', () => {
  let cenario: Cenario;
  let chaves: ChavesDoCenario;

  beforeAll(async () => {
    cenario = await montarCenario();
    chaves = await semearChavesDaApi(cenario);
    await semearZonasDoProdutoA(cenario);
  }, 120_000);

  afterAll(async () => {
    // Zonas e chaves somem no cascade de `tenants`; o arquivo do Storage, não — `limpar` cuida.
    if (cenario) await limpar(cenario);
  }, 120_000);

  describe('o caminho que o produto vende', () => {
    it('devolve o SVG do calçado com a zona pedida na cor pedida', async () => {
      const resposta = await chamar(cenario.produtoA, chaves.ativaDeA.chave, { sola: '#C0392B' });
      const corpo = await resposta.text();

      expect(resposta.status).toBe(200);
      expect(resposta.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
      // `no-store` importa aqui tanto quanto o desenho: variante cacheada por um CDN depois de
      // a zona ser remarcada no editor é o mesmo calçado errado, num lugar onde ninguém olha.
      expect(resposta.headers.get('cache-control')).toBe('no-store');

      // Sucesso é o ARTEFATO, não um envelope com o artefato dentro.
      expect(corpo.startsWith('<svg')).toBe(true);
      expect(corpo).not.toContain('"data"');
      expect(corpo).toContain('#C0392B');
    });

    it('e muda a zona pedida sem mexer nas outras', async () => {
      // O princípio nº1 escrito como assertion: a garantia não é "saiu um SVG", é "saiu ESTE
      // SVG com UMA diferença". Sem a segunda metade, um seletor que capturasse o calçado
      // inteiro passaria neste arquivo e só apareceria quando um cliente abrisse o arquivo.
      const original = await baixarCanonico(cenario);
      const corpo = await (
        await chamar(cenario.produtoA, chaves.ativaDeA.chave, { sola: '#C0392B' })
      ).text();

      const antes = ocorrenciasDeCor(original);
      const depois = ocorrenciasDeCor(corpo);

      expect(depois['#C0392B']).toBeGreaterThan(0);
      // A cor original da sola sumiu (foi trocada); a do cabedal continua igual.
      expect(depois['#2E2E33'] ?? 0).toBeLessThan(antes['#2E2E33'] ?? 0);
      expect(depois['#E9E4DA'] ?? 0).toBe(antes['#E9E4DA'] ?? 0);
    });

    it('registra o uso da chave sem bloquear a resposta', async () => {
      // `registrarUsoDaChave` é fire-and-forget: a resposta não a espera. Por isso aqui há um
      // laço curto de releitura em vez de uma leitura única — e por isso este teste NÃO
      // afirma quanto tempo ela leva. O módulo já documenta que em serverless a escrita pode
      // se perder de vez; num processo de teste, que não congela, ela chega.
      await chamar(cenario.produtoA, chaves.ativaDeA.chave, { sola: '#1F6F5C' });

      const usada = await aguardarLastUsedAt(chaves.ativaDeA.id);

      expect(usada).not.toBeNull();
    });
  });

  describe('a marca concorrente não alcança nada', () => {
    it('a chave de B pedindo o produto de A recebe 404 — idêntico ao de um id inventado', async () => {
      // O requisito comercial inteiro em duas linhas. 403 confirmaria que o id existe, e
      // confirmar existência já é vazamento entre concorrentes (ADR-006 D3). Por isso a
      // comparação é entre as DUAS respostas, e não contra um literal: é assim que "idêntico"
      // vira verificável.
      const alheio = await chamar(cenario.produtoA, chaves.ativaDeB.chave, { sola: '#C0392B' });
      const inexistente = await chamar(ID_QUE_NAO_EXISTE, chaves.ativaDeB.chave, {
        sola: '#C0392B',
      });

      expect(alheio.status).toBe(404);
      expect(await envelope(alheio)).toEqual(await envelope(inexistente));
    });

    it('e o SVG do produto alheio não vaza em resposta nenhuma', async () => {
      const corpo = await (
        await chamar(cenario.produtoA, chaves.ativaDeB.chave, { sola: '#C0392B' })
      ).text();

      expect(corpo).not.toContain('<svg');
      expect(corpo).not.toContain('zona-sola');
    });
  });

  describe('a chave', () => {
    it('revogada responde igual a uma chave inventada', async () => {
      // Se a revogada respondesse diferente, quem sonda saberia que aquele prefixo já existiu
      // — que é o oráculo que o ADR-006 D1 fecha.
      const revogada = await chamar(cenario.produtoA, chaves.revogadaDeA.chave, {
        sola: '#C0392B',
      });
      const inventada = await chamar(cenario.produtoA, chaveInventada(), { sola: '#C0392B' });

      expect(revogada.status).toBe(401);
      expect(await envelope(revogada)).toEqual(await envelope(inventada));
    });

    it('mandada na query string é recusada, mesmo com o header válido junto', async () => {
      const resposta = await chamar(
        cenario.produtoA,
        chaves.ativaDeA.chave,
        { sola: '#C0392B' },
        `?api_key=${chaves.ativaDeA.chave}`,
      );

      expect(resposta.status).toBe(401);
      expect((await envelope(resposta)).error.code).toBe('CHAVE_AUSENTE');
    });

    it('não abre o editor: ela não é credencial do Supabase', async () => {
      // A separação que sustenta o produto inteiro. Se a chave de API fosse aceita pelo
      // supabase-js, um cliente com chave de integração teria acesso de leitura ao banco pela
      // porta do front — e o que a nossa função filtra deixaria de importar.
      const comChaveDaApi = createClient(process.env['SUPABASE_URL'] ?? '', chaves.ativaDeA.chave, {
        auth: { persistSession: false },
      });

      const { data, error } = await comChaveDaApi.from('products').select('id');

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe('erro do pedido × erro do dado do tenant — a distinção que a mensagem carrega', () => {
    it('zona que o produto não tem é 422, e a mensagem lista as que ele tem', async () => {
      const resposta = await chamar(cenario.produtoA, chaves.ativaDeA.chave, { bico: '#C0392B' });
      const { error } = await envelope(resposta);

      expect(resposta.status).toBe(422);
      expect(error.code).toBe('ZONA_NAO_ENCONTRADA');
      // A parte acionável: sem a lista, quem integra fica adivinhando o nome da zona.
      expect(error.message).toContain('"sola"');
    });

    it('mas o MESMO código vindo do motor é 409 — seletor gravado que não resolve', async () => {
      // O par que o `docs/07_APIS/endpoints.md` chama de "único código ambíguo". A linha
      // existe em `product_zones`, então a pré-checagem deixa passar; quem recusa é o motor,
      // e aí a causa é dado do tenant, não pedido do integrador.
      const resposta = await chamar(cenario.produtoA, chaves.ativaDeA.chave, {
        quebrada: '#C0392B',
      });
      const { error } = await envelope(resposta);

      expect(resposta.status).toBe(409);
      expect(error.code).toBe('ZONA_NAO_ENCONTRADA');
      expect(error.message).toContain('editor de zonas');
    });

    it('zona com gradiente é 409, e manda corrigir no editor — não no pedido', async () => {
      const resposta = await chamar(cenario.produtoA, chaves.ativaDeA.chave, {
        detalhe: '#C0392B',
      });
      const { error } = await envelope(resposta);

      expect(resposta.status).toBe(409);
      expect(error.code).toBe('ZONA_NAO_RECOLORIVEL');
      expect(error.message).toContain('editor de zonas');
    });

    it('duas zonas no mesmo elemento é 409, e nenhuma cor é aplicada', async () => {
      // BUG-013: sem esta recusa, qual cor vale seria decidido pela ordem do pedido — duas
      // chamadas iguais poderiam devolver calçados diferentes.
      const resposta = await chamar(cenario.produtoA, chaves.ativaDeA.chave, {
        sola: '#C0392B',
        'sola-espelho': '#1F6F5C',
      });
      const { error } = await envelope(resposta);

      expect(resposta.status).toBe(409);
      expect(error.code).toBe('ZONAS_SOBREPOSTAS');
    });

    it('cor inválida é 422: o pedido é que está errado, e a mensagem não fala de editor', async () => {
      const resposta = await chamar(cenario.produtoA, chaves.ativaDeA.chave, { sola: 'vermelho' });
      const { error } = await envelope(resposta);

      expect(resposta.status).toBe(422);
      expect(error.code).toBe('COR_INVALIDA');
      expect(error.message).not.toContain('editor de zonas');
    });
  });

  describe('transporte', () => {
    it('GET é 405 com `Allow: POST`, antes de qualquer trabalho', async () => {
      const resposta = await handlerDaVariante.fetch(
        new Request(`${HOST}/api/v1/products/${cenario.produtoA}/variants`, { method: 'GET' }),
      );

      expect(resposta.status).toBe(405);
      expect(resposta.headers.get('allow')).toBe('POST');
    });

    it('`?format=png` é 400 explícito, nunca ignorado em silêncio', async () => {
      const resposta = await chamar(
        cenario.produtoA,
        chaves.ativaDeA.chave,
        { sola: '#C0392B' },
        '?format=png',
      );

      expect(resposta.status).toBe(400);
      expect((await envelope(resposta)).error.code).toBe('FORMATO_NAO_SUPORTADO');
    });

    it('corpo vazio é 400 — 200 com o modelo original seria erro silencioso', async () => {
      const resposta = await chamar(cenario.produtoA, chaves.ativaDeA.chave, {});

      expect(resposta.status).toBe(400);
      expect((await envelope(resposta)).error.code).toBe('CORPO_INVALIDO');
    });
  });
});

// ── auxiliares ───────────────────────────────────────────────────────────────

/** Uma chamada à API: monta o `Request` e entrega ao handler, como a Vercel faria. */
function chamar(
  productId: string,
  chave: string | null,
  corpo: unknown,
  query = '',
): Promise<Response> {
  return handlerDaVariante.fetch(
    new Request(`${HOST}/api/v1/products/${productId}/variants${query}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(chave === null ? {} : { Authorization: `Bearer ${chave}` }),
      },
      body: JSON.stringify(corpo),
    }),
  );
}

interface EnvelopeDeErro {
  data: null;
  error: { code: string; message: string };
  meta: { timestamp: string; version: string };
}

/**
 * O envelope de erro **sem o `timestamp`**, para duas respostas poderem ser comparadas entre
 * si. O `timestamp` muda a cada chamada por definição; deixá-lo dentro tornaria impossível
 * escrever "estas duas respostas são idênticas", que é justamente o requisito de segurança
 * mais importante deste arquivo.
 */
async function envelope(resposta: Response): Promise<{ status: number; error: EnvelopeDeErro['error'] }> {
  const corpo = (await resposta.json()) as EnvelopeDeErro;
  return { status: resposta.status, error: corpo.error };
}

/** Uma chave com formato válido que nunca existiu no banco. */
function chaveInventada(): string {
  return `kora_test_deadbeef_${'k'.repeat(43)}`;
}

/** O canônico como ele está no bucket — a referência do "mudou só a sola". */
async function baixarCanonico(cenario: Cenario): Promise<string> {
  const { data, error } = await admin()
    .storage.from('assets-base')
    .download(cenario.assetDoProdutoA);
  if (error || !data) throw error ?? new Error('asset-base não baixou');
  return data.text();
}

/** Quantas vezes cada hex aparece no documento. Comparação grosseira, e suficiente. */
function ocorrenciasDeCor(svg: string): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const achado of svg.matchAll(/#[0-9A-Fa-f]{6}/g)) {
    const cor = achado[0].toUpperCase();
    contagem[cor] = (contagem[cor] ?? 0) + 1;
  }
  return contagem;
}

/** Relê `last_used_at` algumas vezes: a escrita é disparada, não aguardada. */
async function aguardarLastUsedAt(idDaChave: string): Promise<string | null> {
  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    const { data } = await admin()
      .from('tenant_api_keys')
      .select('last_used_at')
      .eq('id', idDaChave)
      .maybeSingle();

    const valor = (data?.['last_used_at'] as string | null) ?? null;
    if (valor !== null) return valor;
    await new Promise((resolver) => setTimeout(resolver, 100));
  }
  return null;
}
