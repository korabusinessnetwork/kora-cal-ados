// Quem está chamando `api/v1/modelo-de-linguagem/`: a pessoa logada, e o papel dela naquela marca.
//
// É o irmão de `autenticarChaveDeApi.ts`, para a OUTRA porta da API. Lá quem chama é o sistema de
// um cliente, com chave de API, e o tenant sai da chave. Aqui quem chama é a nossa própria tela, com
// o token de sessão do Supabase, e a pessoa pode ser de mais de uma marca: por isso o tenant vem no
// pedido e PRECISA ser conferido contra `tenant_members`. Sem essa conferência, qualquer pessoa
// logada configuraria o fornecedor de qualquer marca, porque a consulta sai com `service_role` e a
// RLS não recusa nada aqui.
//
// Duas checagens, nesta ordem, e as duas obrigatórias:
//   1. o token é de uma sessão válida (quem o Supabase diz que é);
//   2. essa pessoa é membro daquele tenant, e o papel dela é o que a ação exige.

import type { SupabaseClient } from '@supabase/supabase-js';
import { criarFalhaDeTransporte } from './traduzirParaFalhaDaApi';

export type PapelNoTenant = 'owner' | 'membro';

export interface SessaoDoUsuario {
  usuarioId: string;
  tenantId: string;
  papel: PapelNoTenant;
}

/** O token de `Authorization: Bearer <token>`, ou `null`. Mesmo formato da chave de API. */
export function lerTokenDaSessao(pedido: Request): string | null {
  const cabecalho = pedido.headers.get('authorization') ?? '';
  const achado = /^Bearer\s+(.+)$/i.exec(cabecalho.trim());
  const token = achado?.[1]?.trim() ?? '';
  return token === '' ? null : token;
}

/**
 * A sessão conferida, ou lança `FalhaDaApi`.
 *
 * `papelExigido` é `'owner'` nas ações de configuração e de gasto, e `'membro'` em gerar: qualquer
 * pessoa da marca compõe calçado, só o dono mexe na chave e vê quanto custou (D13, item 5).
 */
export async function autenticarSessaoDoUsuario(
  cliente: SupabaseClient,
  pedido: Request,
  tenantId: string,
  papelExigido: PapelNoTenant,
): Promise<SessaoDoUsuario> {
  const token = lerTokenDaSessao(pedido);
  if (token === null) throw criarFalhaDeTransporte('SESSAO_AUSENTE');

  if (!ehUuid(tenantId)) throw criarFalhaDeTransporte('SEM_PERMISSAO');

  // `getUser(token)` valida o token no Supabase; não é leitura de JWT sem conferir assinatura.
  const { data, error } = await cliente.auth.getUser(token);
  const usuarioId = data?.user?.id ?? '';
  if (error || usuarioId === '') throw criarFalhaDeTransporte('SESSAO_INVALIDA');

  const membro = await cliente
    .from('tenant_members')
    // Campos explícitos, nunca `select *` (CLAUDE.md).
    .select('papel')
    .eq('tenant_id', tenantId)
    .eq('user_id', usuarioId)
    .maybeSingle();

  if (membro.error) throw new Error(`Falha ao conferir o papel do usuário no tenant: ${membro.error.message}`);

  const papel = membro.data?.papel;
  if (papel !== 'owner' && papel !== 'membro') throw criarFalhaDeTransporte('SEM_PERMISSAO');
  // Owner pode tudo que membro pode; membro não faz o que é de owner.
  if (papelExigido === 'owner' && papel !== 'owner') throw criarFalhaDeTransporte('SEM_PERMISSAO');

  return { usuarioId, tenantId, papel };
}

/**
 * O tenant chega da URL, então é entrada de rede. Conferir o formato antes da consulta evita mandar
 * texto arbitrário para um filtro de coluna `uuid`, que responderia erro de banco (e um 500 nosso)
 * em vez do 403 que o caso merece.
 */
export function ehUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
}
