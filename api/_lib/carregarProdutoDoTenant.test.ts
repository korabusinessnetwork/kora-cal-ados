// A FORMA do pedido é o que este arquivo protege, e aqui ela vale mais do que no editor:
// esta consulta sai com `service_role` e a RLS não recusa nada. Um `.eq('tenant_id', ...)`
// que suma numa refatoração não quebra teste de retorno nenhum, só passa a entregar o
// produto de uma marca ao sistema da concorrente, em silêncio. Por isso os testes afirmam
// tabela, campos e OS DOIS filtros, e ainda há uma guarda que lê o próprio fonte.
//
// Sem rede: cliente Supabase falso montado à mão, como em
// `src/features/zonas/gravarZonaNoBanco.test.ts`.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { carregarProdutoDoTenant } from './carregarProdutoDoTenant';
import { FalhaDaApi } from './tiposDaApi';

interface PedidoObservado {
  tabela: string;
  campos: string;
  filtros: Array<[string, unknown]>;
  consultou: boolean;
}

const PRODUTO_DO_BANCO = {
  id: 'prod-1',
  tenant_id: 'tenant-1',
  nome: 'Tênis Corrida',
  base_asset_path: 'tenants/tenant-1/products/prod-1/base.svg',
};

/**
 * O cliente falso só devolve a linha quando os DOIS filtros casam com ela, é o que faz o
 * teste do produto alheio significar alguma coisa. Um falso que devolvesse a linha ignorando
 * os filtros passaria verde mesmo com o filtro de tenant removido do fonte.
 */
function clienteFalso(resposta: { linha?: typeof PRODUTO_DO_BANCO | null; error?: unknown }) {
  const pedido: PedidoObservado = { tabela: '', campos: '', filtros: [], consultou: false };

  const encadeador = {
    eq(coluna: string, valor: unknown) {
      pedido.filtros.push([coluna, valor]);
      return encadeador;
    },
    maybeSingle() {
      pedido.consultou = true;
      const linha = resposta.linha === undefined ? PRODUTO_DO_BANCO : resposta.linha;
      const casou = pedido.filtros.every(
        ([coluna, valor]) => linha !== null && (linha as Record<string, unknown>)[coluna] === valor,
      );
      return Promise.resolve({
        data: resposta.error ? null : casou ? linha : null,
        error: resposta.error ?? null,
      });
    },
  };

  const cliente = {
    from(tabela: string) {
      pedido.tabela = tabela;
      return {
        select(campos: string) {
          pedido.campos = campos;
          return encadeador;
        },
      };
    },
  } as unknown as SupabaseClient;

  return { cliente, pedido };
}

async function capturarFalha(acao: () => Promise<unknown>): Promise<unknown> {
  try {
    await acao();
  } catch (falha: unknown) {
    return falha;
  }
  throw new Error('A chamada deveria ter falhado e não falhou.');
}

describe('a forma do pedido', () => {
  it('consulta `products` filtrando por id E por tenant_id', async () => {
    // Sem o segundo filtro, qualquer marca com chave válida lê o produto de qualquer outra
    // sabendo só o id: com `service_role` não há RLS para recusar.
    const { cliente, pedido } = clienteFalso({});
    await carregarProdutoDoTenant(cliente, 'prod-1', 'tenant-1');

    expect(pedido.tabela).toBe('products');
    expect(pedido.filtros).toEqual([
      ['id', 'prod-1'],
      ['tenant_id', 'tenant-1'],
    ]);
  });

  it('pede campos explícitos, nunca `*`', async () => {
    const { cliente, pedido } = clienteFalso({});
    await carregarProdutoDoTenant(cliente, 'prod-1', 'tenant-1');

    expect(pedido.campos).toBe('id, tenant_id, nome, base_asset_path');
    expect(pedido.campos).not.toContain('*');
  });

  it('devolve `base_asset_path` exatamente como veio do banco', async () => {
    // Remontar o caminho a partir de tenant_id/id faria o download depender de uma convenção
    // repetida em dois lugares, e no dia em que ela mudasse, baixaria o arquivo errado (ou o
    // de outra marca) em vez de falhar.
    const { cliente } = clienteFalso({});
    const produto = await carregarProdutoDoTenant(cliente, 'prod-1', 'tenant-1');

    expect(produto.base_asset_path).toBe('tenants/tenant-1/products/prod-1/base.svg');
    expect(produto.nome).toBe('Tênis Corrida');
  });
});

describe('guarda de fonte', () => {
  it('o filtro de tenant e a ausência de `select(*)` continuam escritos no arquivo', async () => {
    // Esta é a única guarda que sobrevive a um refactor que ajuste o cliente falso junto com
    // o fonte. Um teste de comportamento com cliente falso não pega a remoção do filtro se
    // quem removeu também "consertar" o falso; ler o fonte, sim.
    const fonte = readFileSync(new URL('./carregarProdutoDoTenant.ts', import.meta.url), 'utf8');

    expect(fonte).toContain(".eq('tenant_id'");
    expect(fonte).not.toContain("select('*')");
  });
});

describe('produto que a chave não pode ver', () => {
  it('produto inexistente é 404, e nunca 403', async () => {
    // 403 confirmaria que o id existe. Entre marcas concorrentes no mesmo sistema, confirmar
    // a existência do id já é informação vendável (ADR-006 D3).
    const { cliente } = clienteFalso({ linha: null });
    const falha = await capturarFalha(() =>
      carregarProdutoDoTenant(cliente, 'prod-inexistente', 'tenant-1'),
    );

    expect(falha).toBeInstanceOf(FalhaDaApi);
    expect((falha as FalhaDaApi).codigo).toBe('PRODUTO_NAO_ENCONTRADO');
    expect((falha as FalhaDaApi).status).toBe(404);
    expect((falha as FalhaDaApi).status).not.toBe(403);
  });

  it('produto de outro tenant responde idêntico ao produto inexistente', async () => {
    // O cliente falso devolve `null` porque o segundo filtro não casou, que é exatamente o
    // que o Postgres faz. Qualquer diferença entre as duas respostas (código, status,
    // mensagem, cabeçalho) seria um oráculo de existência de id.
    const { cliente: clienteAlheio } = clienteFalso({});
    const doOutroTenant = (await capturarFalha(() =>
      carregarProdutoDoTenant(clienteAlheio, 'prod-1', 'tenant-2'),
    )) as FalhaDaApi;

    const { cliente: clienteVazio } = clienteFalso({ linha: null });
    const inexistente = (await capturarFalha(() =>
      carregarProdutoDoTenant(clienteVazio, 'prod-inexistente', 'tenant-2'),
    )) as FalhaDaApi;

    expect(doOutroTenant.codigo).toBe(inexistente.codigo);
    expect(doOutroTenant.status).toBe(inexistente.status);
    expect(doOutroTenant.message).toBe(inexistente.message);
    expect(doOutroTenant.cabecalhos).toEqual(inexistente.cabecalhos);
  });

  it('a mensagem do 404 não ecoa o tenantId', async () => {
    // Eco do `productId` não seria vazamento (o integrador o escreveu na URL); eco do
    // `tenantId` seria, ele é dado nosso, derivado da chave, e o integrador não o enviou.
    // Como nenhum dos dois acrescenta detalhe acionável, a mensagem é a fixa da tabela.
    const { cliente } = clienteFalso({ linha: null });
    const falha = (await capturarFalha(() =>
      carregarProdutoDoTenant(cliente, 'prod-secreto', 'tenant-secreto'),
    )) as FalhaDaApi;

    expect(falha.message).toBe('Produto não encontrado.');
    expect(falha.message).not.toContain('tenant-secreto');
    expect(falha.message).not.toContain('prod-secreto');
  });
});

describe('recusa antes de tocar o banco', () => {
  it('tenantId em branco é defeito nosso: `Error`, não 404', async () => {
    // O tenant sai da chave já autenticada. Em branco significa que o passo anterior falhou,
    // e um 404 esconderia esse defeito atrás de "o produto do integrador não existe".
    const { cliente, pedido } = clienteFalso({});
    const falha = await capturarFalha(() => carregarProdutoDoTenant(cliente, 'prod-1', '   '));

    expect(falha).toBeInstanceOf(Error);
    expect(falha).not.toBeInstanceOf(FalhaDaApi);
    expect((falha as Error).message).toMatch(/tenantId em branco/);
    // Consultar com um tenant vazio seria consulta sem dono, com `service_role`.
    expect(pedido.consultou).toBe(false);
  });

  it('productId em branco é 404, como qualquer outro id que não temos', async () => {
    // Vem do segmento da URL: é entrada de rede, não erro de programação.
    const { cliente, pedido } = clienteFalso({});
    const falha = await capturarFalha(() => carregarProdutoDoTenant(cliente, '  ', 'tenant-1'));

    expect(falha).toBeInstanceOf(FalhaDaApi);
    expect((falha as FalhaDaApi).status).toBe(404);
    expect(pedido.consultou).toBe(false);
  });
});

describe('erro do banco não vira 404', () => {
  it('falha do Postgres sobe como veio, para o log ter o detalhe', async () => {
    // 404 é uma afirmação sobre o dado; Postgres fora do ar não autoriza essa afirmação. Quem
    // converte isso em `FALHA_INTERNA`/500 com mensagem fixa é `traduzirParaFalhaDaApi`.
    const { cliente } = clienteFalso({
      error: { code: '57P01', message: 'terminating connection due to administrator command' },
    });
    const falha = await capturarFalha(() => carregarProdutoDoTenant(cliente, 'prod-1', 'tenant-1'));

    expect(falha).not.toBeInstanceOf(FalhaDaApi);
    expect((falha as { code: string }).code).toBe('57P01');
  });
});
