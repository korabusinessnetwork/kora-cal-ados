// A FORMA do pedido é o que este arquivo protege, no molde de
// `gravarZonaNoBanco.test.ts`: qual tabela, quais campos, quais filtros e qual ordenação
// foram enviados, não só o valor de retorno.
//
// O defeito que estes testes existem para pegar não aparece na tela nem no log: uma
// consulta sob `service_role` sem `.eq('tenant_id', ...)` devolve as zonas da marca
// concorrente e responde 200. Um teste que só olhasse o retorno passaria, porque o cliente
// falso devolveria o que lhe mandassem devolver, por isso o cliente falso daqui FILTRA de
// verdade as linhas pelos filtros recebidos, e por isso há também uma guarda que lê o
// próprio fonte.
//
// Sem rede: cliente Supabase falso montado à mão.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Zona } from '../../src/lib/render/gerarVarianteDeCor';
import { listarZonasDoProdutoDoTenant } from './listarZonasDoProdutoDoTenant';

interface PedidoObservado {
  tabela: string;
  campos: string;
  filtros: Array<[string, unknown]>;
  ordenacoes: Array<[string, boolean | undefined]>;
}

type Linha = Record<string, unknown>;

/**
 * Linhas de dois tenants diferentes no mesmo `product_zones`, que é a situação real: marcas
 * concorrentes convivem na mesma tabela e a RLS não está mais lá para separá-las.
 */
const LINHAS: Linha[] = [
  {
    zone_key: 'sola',
    svg_selector: '#sola',
    product_id: 'prod-1',
    tenant_id: 'tenant-1',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    zone_key: 'cabedal',
    svg_selector: '#cabedal',
    product_id: 'prod-1',
    tenant_id: 'tenant-1',
    created_at: '2026-01-02T00:00:00Z',
  },
  {
    zone_key: 'sola',
    svg_selector: '#sola-da-concorrente',
    product_id: 'prod-2',
    tenant_id: 'tenant-2',
    created_at: '2026-01-03T00:00:00Z',
  },
];

/**
 * Aplica de verdade os filtros que o módulo enviou e projeta só os campos pedidos. É o que
 * torna o teste do isolamento honesto: se o módulo esquecer o `.eq('tenant_id', ...)`, o
 * cliente falso devolve a linha do outro tenant, exatamente como o Postgres faria sob
 * `service_role`.
 */
function clienteFalso(opcoes: { linhas?: Linha[]; error?: unknown } = {}) {
  const linhas = opcoes.linhas ?? [];
  const pedido: PedidoObservado = { tabela: '', campos: '', filtros: [], ordenacoes: [] };

  function resolver() {
    if (opcoes.error) return { data: null, error: opcoes.error };

    const casadas = linhas.filter((linha) =>
      pedido.filtros.every(([coluna, valor]) => linha[coluna] === valor),
    );
    const projetadas = casadas.map((linha) =>
      Object.fromEntries(
        pedido.campos
          .split(',')
          .map((campo) => campo.trim())
          .filter((campo) => campo.length > 0 && campo !== '*')
          .map((campo) => [campo, linha[campo]]),
      ),
    );

    return { data: projetadas, error: null };
  }

  const encadeador = {
    eq(coluna: string, valor: unknown) {
      pedido.filtros.push([coluna, valor]);
      return encadeador;
    },
    order(coluna: string, opcoesDeOrdem?: { ascending?: boolean }) {
      pedido.ordenacoes.push([coluna, opcoesDeOrdem?.ascending]);
      return encadeador;
    },
    // Thenable: `await` na cadeia resolve aqui, como o builder do supabase-js faz.
    then(aoResolver: (valor: ReturnType<typeof resolver>) => unknown) {
      return Promise.resolve(resolver()).then(aoResolver);
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
  it('consulta product_zones filtrando por product_id E por tenant_id', async () => {
    const { cliente, pedido } = clienteFalso({ linhas: LINHAS });
    await listarZonasDoProdutoDoTenant(cliente, 'prod-1', 'tenant-1');

    expect(pedido.tabela).toBe('product_zones');
    expect(pedido.filtros).toEqual([
      ['product_id', 'prod-1'],
      ['tenant_id', 'tenant-1'],
    ]);
  });

  it('ordena por created_at ascendente', async () => {
    // Sem `order` o Postgres não promete ordem nenhuma, e duas chamadas idênticas podem
    // devolver a lista em ordens diferentes. `created_at` é a única ordenação estável do
    // schema e é a mesma que o editor usa, as duas pontas veem a mesma ordem.
    const { cliente, pedido } = clienteFalso({ linhas: LINHAS });
    await listarZonasDoProdutoDoTenant(cliente, 'prod-1', 'tenant-1');

    expect(pedido.ordenacoes).toEqual([['created_at', true]]);
  });

  it('pede campos explícitos, nunca `*`', async () => {
    // `select *` sob service_role carrega colunas do tenant que ninguém pediu para dentro
    // de um processo onde nada mais as filtra.
    const { cliente, pedido } = clienteFalso({ linhas: LINHAS });
    await listarZonasDoProdutoDoTenant(cliente, 'prod-1', 'tenant-1');

    expect(pedido.campos).toBe('zone_key, svg_selector');
    expect(pedido.campos).not.toContain('*');
  });
});

describe('isolamento entre marcas concorrentes', () => {
  it('não devolve a zona de outro tenant, mesmo com o product_id dele em mãos', async () => {
    // O CONTRA-EXEMPLO QUE DÁ SENTIDO A ESTE MÓDULO: o par que o editor usa
    // (`listarZonasDoProduto`, no front) NÃO manda filtro de tenant, de propósito, lá quem
    // recusa é a RLS. Aqui não há RLS, e sem o filtro esta chamada devolveria `#sola-da-
    // concorrente`. O arquivo do front não é importado nem lido aqui: `api/` não pode tocar
    // `src/features/` (`apiNaoImportaOFront.test.ts`).
    const { cliente } = clienteFalso({ linhas: LINHAS });

    const zonas = await listarZonasDoProdutoDoTenant(cliente, 'prod-2', 'tenant-1');

    expect(zonas).toEqual([]);
  });

  it('devolve as zonas do próprio tenant, na ordem gravada', async () => {
    const { cliente } = clienteFalso({ linhas: LINHAS });

    const zonas = await listarZonasDoProdutoDoTenant(cliente, 'prod-1', 'tenant-1');

    expect(zonas).toEqual([
      { zone_key: 'sola', svg_selector: '#sola' },
      { zone_key: 'cabedal', svg_selector: '#cabedal' },
    ]);
  });

  it('recusa antes de consultar quando o tenant da chave não veio', async () => {
    // `eq('tenant_id', '')` devolveria vazio, e vazio aqui significa "produto sem zona".
    const { cliente, pedido } = clienteFalso({ linhas: LINHAS });

    await expect(listarZonasDoProdutoDoTenant(cliente, 'prod-1', '  ')).rejects.toThrow(/tenant/);
    expect(pedido.tabela).toBe('');
  });

  it('recusa antes de consultar quando o product_id não veio', async () => {
    const { cliente, pedido } = clienteFalso({ linhas: LINHAS });

    await expect(listarZonasDoProdutoDoTenant(cliente, '', 'tenant-1')).rejects.toThrow(/produto/);
    expect(pedido.tabela).toBe('');
  });
});

describe('vazio e erro não são a mesma coisa', () => {
  it('produto sem zona marcada devolve lista vazia, sem lançar', async () => {
    // É uma afirmação verdadeira, e quem decide o que fazer com ela é o handler.
    const { cliente } = clienteFalso({ linhas: [] });

    await expect(listarZonasDoProdutoDoTenant(cliente, 'prod-1', 'tenant-1')).resolves.toEqual([]);
  });

  it('erro do banco sobe e nunca vira lista vazia', async () => {
    // Devolver `[]` numa falha faria a API afirmar "este produto não tem zona marcada"
    // sobre um produto inteiro mapeado, e o handler decidiria em cima da mentira.
    const erroDoBanco = { code: '42501', message: 'permission denied for table product_zones' };
    const { cliente } = clienteFalso({ error: erroDoBanco });

    const falha = await capturarFalha(() =>
      listarZonasDoProdutoDoTenant(cliente, 'prod-1', 'tenant-1'),
    );

    expect(falha).toBe(erroDoBanco);
  });
});

describe('o retorno serve ao motor sem adaptador', () => {
  it('é atribuível a Zona[] de gerarVarianteDeCor (checagem de compilação)', async () => {
    // Se um dia o motor exigir mais um campo, ou este módulo parar de trazer um, o erro
    // aparece aqui em `tsc`, não em produção, com a variante saindo sem uma zona.
    const { cliente } = clienteFalso({ linhas: LINHAS });

    const zonas: Zona[] = [...(await listarZonasDoProdutoDoTenant(cliente, 'prod-1', 'tenant-1'))];

    expect(zonas[0]?.zone_key).toBe('sola');
  });
});

describe('guarda de fonte', () => {
  it('o filtro de tenant continua no fonte, e `select(\'*\')` continua fora', async () => {
    // Esta guarda existe porque a anterior pode ser desfeita junto: uma refatoração que
    // remova o `.eq('tenant_id', ...)` e "conserte" o cliente falso na mesma passada
    // deixaria os testes de comportamento verdes. Ler o fonte não tem como ser ajustado
    // junto sem que a remoção fique explícita no diff.
    const fonte = readFileSync(new URL('./listarZonasDoProdutoDoTenant.ts', import.meta.url), 'utf8');

    expect(fonte).toContain(".eq('tenant_id'");
    expect(fonte).toContain(".eq('product_id'");
    expect(fonte).toContain(".order('created_at'");
    expect(fonte).not.toContain("select('*')");
    expect(fonte).not.toContain('select(`*`)');
  });
});
