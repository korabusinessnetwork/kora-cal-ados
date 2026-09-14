// Os três limites que protegem a marca da conta surpresa e a Kora do uso da função como proxy (D13).
//
//   por minuto  , alguém segurando o botão, ou um script;
//   por dia     , o mesmo, esticado;
//   teto mensal , o valor em dólar que o owner escolheu, que é o único dos três que a marca define.
//
// Por que no nosso servidor, se o fornecedor já tem limite: o limite do fornecedor protege o
// fornecedor, não a marca. Com API própria paga, o fornecedor aceita tudo e cobra tudo. E a chave
// fica aqui: sem limite nosso, qualquer pessoa da marca poderia usar a chave da marca como um
// modelo de linguagem de uso geral, que é o que o endpoint `gerar` não é.
//
// Os três contam a MESMA tabela de uso, e por isso contam também as chamadas que falharam: uma
// tentativa que o fornecedor recusou consumiu tempo nosso e cota dele, e um laço de erro é
// justamente o caso em que o limite precisa segurar.

import type { SupabaseClient } from '@supabase/supabase-js';

import { limitesDoMes, mesEmUtc } from '../../src/lib/modeloDeLinguagem/resumirUsoDoMes';
import { criarFalhaDeTransporte } from './traduzirParaFalhaDaApi';

export const TABELA_DO_USO = 'uso_do_modelo_de_linguagem';
export const LIMITE_POR_MINUTO = 10;
export const LIMITE_POR_DIA = 300;

/** Confere os três limites, na ordem do mais barato para o mais caro de consultar. */
export async function conferirLimitesDeUso(
  cliente: SupabaseClient,
  tenantId: string,
  tetoMensalUsd: number | null,
  agora: Date = new Date(),
): Promise<void> {
  const desdeUmMinuto = new Date(agora.getTime() - 60_000).toISOString();
  if ((await contarChamadas(cliente, tenantId, desdeUmMinuto)) >= LIMITE_POR_MINUTO) {
    throw criarFalhaDeTransporte('LIMITE_DE_GERACOES');
  }

  const desdeUmDia = new Date(agora.getTime() - 24 * 60 * 60_000).toISOString();
  if ((await contarChamadas(cliente, tenantId, desdeUmDia)) >= LIMITE_POR_DIA) {
    throw criarFalhaDeTransporte(
      'LIMITE_DE_GERACOES',
      `Esta marca já fez ${LIMITE_POR_DIA} chamadas ao modelo de linguagem nas últimas 24 horas. Tente de novo amanhã.`,
    );
  }

  if (tetoMensalUsd !== null && (await gastoDoMes(cliente, tenantId, agora)) >= tetoMensalUsd) {
    throw criarFalhaDeTransporte('TETO_MENSAL_ATINGIDO');
  }
}

/** Quantas chamadas a marca fez desde um instante. `head: true` não traz linha nenhuma, só a conta. */
async function contarChamadas(cliente: SupabaseClient, tenantId: string, desde: string): Promise<number> {
  const { count, error } = await cliente
    .from(TABELA_DO_USO)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', desde);

  if (error) throw new Error(`Falha ao contar o uso do modelo de linguagem: ${error.message}`);
  return count ?? 0;
}

/**
 * O custo estimado somado no mês corrente, em UTC.
 *
 * Soma em código porque o volume do mês é limitado pelo limite diário acima, e porque uma função de
 * agregação no PostgREST exigiria uma view ou uma RPC, que é mais superfície de banco para manter.
 */
export async function gastoDoMes(cliente: SupabaseClient, tenantId: string, agora: Date = new Date()): Promise<number> {
  const { inicio, fim } = limitesDoMes(mesEmUtc(agora));
  const { data, error } = await cliente
    .from(TABELA_DO_USO)
    .select('custo_estimado_usd')
    .eq('tenant_id', tenantId)
    .gte('created_at', inicio)
    .lt('created_at', fim);

  if (error) throw new Error(`Falha ao somar o gasto do mês: ${error.message}`);

  const total = (data ?? []).reduce((soma, linha) => soma + Number((linha as { custo_estimado_usd: unknown }).custo_estimado_usd), 0);
  return Math.round(total * 1_000_000) / 1_000_000;
}
