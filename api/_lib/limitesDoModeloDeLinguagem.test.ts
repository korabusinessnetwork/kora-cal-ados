import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { LIMITE_POR_DIA, LIMITE_POR_MINUTO, conferirLimitesDeUso, gastoDoMes } from './limitesDoModeloDeLinguagem';
import { FalhaDaApi } from './tiposDaApi';

const TENANT = 'tenant-1';
const AGORA = new Date('2026-09-14T12:00:00.000Z');

interface Chamada {
  created_at: string;
  tenant_id: string;
  custo_estimado_usd: number;
}

/** Banco falso que APLICA os filtros: sem isso, tirar o `.eq('tenant_id')` passaria verde. */
function bancoFalso(chamadas: Chamada[]) {
  const consultas: Array<{ campos: string; head: boolean; filtros: Array<[string, unknown, unknown]> }> = [];

  const cliente = {
    from() {
      return {
        select(campos: string, opcoes?: { count?: string; head?: boolean }) {
          const filtros: Array<[string, unknown, unknown]> = [];
          consultas.push({ campos, head: opcoes?.head === true, filtros });

          const linhas = () =>
            chamadas.filter((chamada) =>
              filtros.every(([operador, coluna, valor]) => {
                const atual = (chamada as unknown as Record<string, unknown>)[coluna as string];
                if (operador === 'eq') return atual === valor;
                if (operador === 'gte') return String(atual) >= String(valor);
                return String(atual) < String(valor);
              }),
            );

          const encadeador = {
            eq(coluna: string, valor: unknown) {
              filtros.push(['eq', coluna, valor]);
              return encadeador;
            },
            gte(coluna: string, valor: unknown) {
              filtros.push(['gte', coluna, valor]);
              return opcoes?.head === true ? Promise.resolve({ count: linhas().length, error: null }) : encadeador;
            },
            lt(coluna: string, valor: unknown) {
              filtros.push(['lt', coluna, valor]);
              return Promise.resolve({ data: linhas(), error: null });
            },
          };
          return encadeador;
        },
      };
    },
  };

  return { cliente: cliente as unknown as SupabaseClient, consultas };
}

function chamadasEm(quantidade: number, minutosAtras: number, custo = 0, tenant = TENANT): Chamada[] {
  return Array.from({ length: quantidade }, () => ({
    tenant_id: tenant,
    created_at: new Date(AGORA.getTime() - minutosAtras * 60_000).toISOString(),
    custo_estimado_usd: custo,
  }));
}

async function codigoAoConferir(chamadas: Chamada[], teto: number | null = null) {
  const { cliente } = bancoFalso(chamadas);
  try {
    await conferirLimitesDeUso(cliente, TENANT, teto, AGORA);
    return null;
  } catch (erro) {
    if (erro instanceof FalhaDaApi) return erro.codigo;
    throw erro;
  }
}

describe('conferirLimitesDeUso', () => {
  it('deixa passar quando está tudo abaixo dos limites', async () => {
    expect(await codigoAoConferir(chamadasEm(LIMITE_POR_MINUTO - 1, 0))).toBeNull();
  });

  it('segura no limite por minuto, e as chamadas mais velhas que um minuto não contam', async () => {
    expect(await codigoAoConferir(chamadasEm(LIMITE_POR_MINUTO, 0))).toBe('LIMITE_DE_GERACOES');
    expect(await codigoAoConferir(chamadasEm(LIMITE_POR_MINUTO, 2))).toBeNull();
  });

  it('segura no limite por dia, com as chamadas espalhadas nas 24 horas', async () => {
    expect(await codigoAoConferir(chamadasEm(LIMITE_POR_DIA, 120))).toBe('LIMITE_DE_GERACOES');
  });

  it('chamada de outra marca não conta para o limite desta', async () => {
    // O filtro por tenant é o isolamento aqui: sem ele, uma marca movimentada bloquearia a outra.
    expect(await codigoAoConferir(chamadasEm(LIMITE_POR_DIA, 120, 0, 'outro-tenant'))).toBeNull();
  });

  it('segura no teto mensal, e só quando existe teto', async () => {
    const gastas = chamadasEm(3, 120, 2);
    expect(await codigoAoConferir(gastas, 5)).toBe('TETO_MENSAL_ATINGIDO');
    expect(await codigoAoConferir(gastas, 10)).toBeNull();
    expect(await codigoAoConferir(gastas, null)).toBeNull();
  });

  it('conta também as chamadas que falharam, que é onde um laço de erro apareceria', async () => {
    // A tabela registra sucesso e falha, e a contagem não filtra por sucesso, de propósito.
    const { cliente, consultas } = bancoFalso(chamadasEm(LIMITE_POR_MINUTO, 0));
    await conferirLimitesDeUso(cliente, TENANT, null, AGORA).catch(() => undefined);

    expect(consultas[0]?.filtros.some(([, coluna]) => coluna === 'sucesso')).toBe(false);
    // Contagem sem trazer linha: `head` ligado.
    expect(consultas[0]?.head).toBe(true);
  });
});

describe('gastoDoMes', () => {
  it('soma só o mês corrente em UTC, e arredonda na precisão da coluna', async () => {
    const { cliente } = bancoFalso([
      ...chamadasEm(2, 60, 0.1),
      { tenant_id: TENANT, created_at: '2026-08-31T23:59:00.000Z', custo_estimado_usd: 99 },
    ]);

    expect(await gastoDoMes(cliente, TENANT, AGORA)).toBe(0.2);
  });

  it('mês sem chamada é zero', async () => {
    const { cliente } = bancoFalso([]);
    expect(await gastoDoMes(cliente, TENANT, AGORA)).toBe(0);
  });
});
