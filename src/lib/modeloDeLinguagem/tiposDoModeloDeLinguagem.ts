// O que atravessa a rede entre a tela e `api/v1/modelo-de-linguagem/`, em tipos. Nenhum comportamento.
//
// Mora aqui, e não em `api/`, porque os dois lados leem o mesmo formato: um tipo de cada lado
// divergiria no primeiro campo renomeado, e a tela mostraria `undefined` sem erro de compilação.
// Os nomes dos campos são `snake_case` porque são o JSON da API, como as colunas do banco.

import type { IdDoFornecedor } from './fornecedoresDeModeloDeLinguagem';

/** A configuração como a tela a vê. Não tem chave: só o final dela (D13, item 4). */
export interface ConfiguracaoDoFornecedorVisivel {
  fornecedor: IdDoFornecedor;
  modelo: string;
  endereco: string | null;
  preco_entrada_por_milhao: number;
  preco_saida_por_milhao: number;
  teto_mensal_usd: number | null;
  final_da_chave: string;
  updated_at: string;
}

/** A resposta de `gerar`: o texto cru do modelo, que a tela passa pelo guarda, e o que custou. */
export interface RespostaDaGeracao {
  texto: string;
  fornecedor: IdDoFornecedor;
  nome_do_fornecedor: string;
  modelo: string;
  custo_estimado_usd: number;
}

/** A resposta de `testar`: deu certo, e com qual modelo. Falha volta no envelope de erro. */
export interface RespostaDoTeste {
  ok: true;
  modelo: string;
  milissegundos: number;
}

export interface TotaisDoUso {
  chamadas: number;
  falhas: number;
  tokens_de_entrada: number;
  tokens_de_saida: number;
  custo_estimado_usd: number;
}

export interface UsoPorModelo extends TotaisDoUso {
  fornecedor: IdDoFornecedor;
  modelo: string;
}

export interface UsoPorDia extends TotaisDoUso {
  /** `AAAA-MM-DD`, em UTC, o mesmo fuso em que o mês é cortado. */
  dia: string;
}

export interface ChamadaRecente {
  created_at: string;
  fornecedor: IdDoFornecedor;
  modelo: string;
  origem: OrigemDoUso;
  sucesso: boolean;
  tokens_de_entrada: number;
  tokens_de_saida: number;
  custo_estimado_usd: number;
}

export type OrigemDoUso = 'geracao' | 'teste';

/** O painel de gasto de um mês. */
export interface ResumoDoUsoDoMes {
  /** `AAAA-MM`, em UTC. */
  mes: string;
  totais: TotaisDoUso;
  teto_mensal_usd: number | null;
  por_modelo: UsoPorModelo[];
  por_dia: UsoPorDia[];
  recentes: ChamadaRecente[];
}
