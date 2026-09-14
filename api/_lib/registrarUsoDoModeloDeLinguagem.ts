// Uma linha por chamada ao fornecedor, que é o que alimenta o painel de gasto e os limites (D13).
//
// Ao contrário de `registrarUsoDaChave`, esta escrita é AGUARDADA. A diferença não é de gosto:
// aquela atualiza uma coluna de estatística, e esta é o que conta para o limite por minuto, para o
// limite por dia e para o teto mensal. Escrita perdida ali atrasa um relatório; perdida aqui, os
// três limites deixam de enxergar a chamada que acabou de acontecer, e o teto de gasto vira uma
// linha que qualquer laço rápido atravessa.
//
// O que NÃO é gravado: o prompt e a resposta. São conteúdo da marca, e medir gasto não precisa
// deles. E a mensagem do fornecedor também não, só o código nosso: a mensagem dele pode trazer
// cabeçalho ou pedaço de chave (CLAUDE.md, nunca logar dado sensível).

import type { SupabaseClient } from '@supabase/supabase-js';

import type { IdDoFornecedor } from '../../src/lib/modeloDeLinguagem/fornecedoresDeModeloDeLinguagem';
import type { OrigemDoUso } from '../../src/lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import type { CodigoDeRespostaDaApi } from './tiposDaApi';
import { TABELA_DO_USO } from './limitesDoModeloDeLinguagem';

export interface UsoAGravar {
  tenantId: string;
  usuarioId: string;
  fornecedor: IdDoFornecedor;
  modelo: string;
  origem: OrigemDoUso;
  sucesso: boolean;
  codigoDeErro?: CodigoDeRespostaDaApi | null;
  tokensDeEntrada: number;
  tokensDeSaida: number;
  custoEstimadoUsd: number;
}

export async function registrarUsoDoModeloDeLinguagem(cliente: SupabaseClient, uso: UsoAGravar): Promise<void> {
  const { error } = await cliente.from(TABELA_DO_USO).insert({
    tenant_id: uso.tenantId,
    usuario_id: uso.usuarioId,
    fornecedor: uso.fornecedor,
    modelo: uso.modelo,
    origem: uso.origem,
    sucesso: uso.sucesso,
    codigo_de_erro: uso.codigoDeErro ?? null,
    tokens_de_entrada: uso.tokensDeEntrada,
    tokens_de_saida: uso.tokensDeSaida,
    custo_estimado_usd: uso.custoEstimadoUsd,
  });

  // Não lança: a geração já aconteceu, e transformá-la em erro faria a pessoa perder a composição
  // por causa do registro. Mas avisa alto, porque um registro que falha em silêncio é um teto de
  // gasto que para de contar sem ninguém saber.
  if (error) console.warn(`Falha ao registrar o uso do modelo de linguagem do tenant ${uso.tenantId}: ${error.message}`);
}
