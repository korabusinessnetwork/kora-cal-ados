// A única porta da tela para as rotas `/api/v1/modelo-de-linguagem/*` (D13).
//
// Por que a tela fala com a API e não com o banco, como o resto de `features/`: as duas tabelas da
// D13 não têm política de RLS nenhuma. `authenticated` não lê uma linha delas, de propósito, porque
// a chave cifrada mora ali e o gasto é dado financeiro que só o owner vê. Quem lê é a função
// serverless, com `service_role`, depois de conferir a sessão e o papel. Uma consulta direta daqui
// voltaria vazia e pareceria "nada configurado", que é a mentira mais cara que esta tela pode contar.
//
// O token vai no `Authorization`, e só ele. Ele é lido da sessão a cada chamada, e não guardado,
// porque o Supabase o renova sozinho e um token guardado vence no meio do uso.
//
// O endereço é RELATIVO (`/api/v1/...`). Em produção a tela e a função moram no mesmo domínio da
// Vercel; em desenvolvimento o Vite repassa `/api` ao `npm run api:local` (`vite.config.ts`). Não há
// URL de API escrita aqui, nem precisa haver variável de ambiente para ela.

import type { SupabaseClient } from '@supabase/supabase-js';

export const CAMINHO_DA_API = '/api/v1/modelo-de-linguagem';

/** A recusa da API, com o código do contrato e a mensagem já em português. */
export class FalhaDaApiDoModelo extends Error {
  constructor(
    readonly codigo: string,
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem);
    this.name = 'FalhaDaApiDoModelo';
  }
}

export type RotaDoModeloDeLinguagem = 'configuracao' | 'testar' | 'gerar' | 'uso' | 'em-uso';

export interface OpcoesDaChamada {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  corpo?: unknown;
  /** Parâmetros além do `tenant`, como o `mes` do painel de gasto. */
  busca?: Record<string, string>;
}

export interface DependenciasDaChamada {
  /** O token da sessão atual, ou `null` sem sessão. */
  lerToken: () => Promise<string | null>;
  buscar?: typeof fetch;
}

export type ChamadorDaApi = <T>(
  rota: RotaDoModeloDeLinguagem,
  tenantId: string,
  opcoes?: OpcoesDaChamada,
) => Promise<T>;

/** O leitor de token de verdade, a partir do cliente Supabase da tela. */
export function lerTokenDoCliente(cliente: SupabaseClient): () => Promise<string | null> {
  return async () => {
    const { data } = await cliente.auth.getSession();
    return data.session?.access_token ?? null;
  };
}

export function criarChamadorDaApi({ lerToken, buscar = fetch }: DependenciasDaChamada): ChamadorDaApi {
  return async <T>(rota: RotaDoModeloDeLinguagem, tenantId: string, opcoes: OpcoesDaChamada = {}) => {
    const token = await lerToken();
    if (token === null) {
      throw new FalhaDaApiDoModelo('SESSAO_AUSENTE', 'Sua sessão terminou. Entre de novo para continuar.', 401);
    }

    const parametros = new URLSearchParams({ tenant: tenantId, ...opcoes.busca });
    const cabecalhos: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (opcoes.corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

    let resposta: Response;
    try {
      resposta = await buscar(`${CAMINHO_DA_API}/${rota}?${parametros.toString()}`, {
        method: opcoes.metodo ?? 'GET',
        headers: cabecalhos,
        body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      });
    } catch {
      throw new FalhaDaApiDoModelo('SEM_CONEXAO', 'Não foi possível falar com o servidor. Confira a conexão e tente de novo.', 0);
    }

    return lerEnvelope<T>(resposta);
  };
}

/**
 * O envelope `{ data, error, meta }` do contrato, já desembrulhado.
 *
 * Resposta que não é o envelope vira uma falha própria, com o que fazer escrito. É o caso de rodar
 * `npm run dev` sem `npm run api:local`: o Vite devolve a página do app no lugar do JSON, e um
 * "Unexpected token <" na tela não diz a ninguém que falta subir a API.
 */
async function lerEnvelope<T>(resposta: Response): Promise<T> {
  let lido: unknown = null;
  try {
    lido = await resposta.json();
  } catch {
    lido = null;
  }

  if (lido === null || typeof lido !== 'object' || !('data' in lido)) {
    throw new FalhaDaApiDoModelo(
      'API_INDISPONIVEL',
      'O servidor não respondeu no formato esperado. Em desenvolvimento, confira se `npm run api:local` está rodando.',
      resposta.status,
    );
  }

  const envelope = lido as { data: T | null; error?: { code?: string; message?: string } | null };
  if (!resposta.ok || envelope.error) {
    throw new FalhaDaApiDoModelo(
      envelope.error?.code ?? 'ERRO_DESCONHECIDO',
      envelope.error?.message ?? 'O servidor recusou o pedido.',
      resposta.status,
    );
  }

  return envelope.data as T;
}

/** A mensagem de qualquer falha, pronta para a tela. Nunca o objeto de erro cru. */
export function mensagemDaFalha(falha: unknown): string {
  if (falha instanceof FalhaDaApiDoModelo) return falha.message;
  return 'Algo deu errado ao falar com o servidor. Tente de novo.';
}
