// Do formulário (texto) ao corpo do `PUT` (números e `null`), conferido ANTES de sair da tela.
//
// A conferência é a mesma função que o servidor roda, `validarConfiguracaoDoFornecedor`, e não uma
// segunda regra escrita aqui. Duas regras divergiriam, e a tela aprovaria o que o servidor recusa,
// que é o pior formato de erro: a pessoa já clicou em salvar achando que estava certo. O servidor
// continua conferindo tudo de novo; isto aqui é prevenção, não guarda.
//
// A única regra que só existe na tela é a da primeira chave: o validador aceita `chave: null` como
// "manter a gravada", e é o servidor que recusa quando não há gravada. Dizer isso antes do clique
// custa uma linha.

import { ehApiPropria, fornecedorPorId } from '../../lib/modeloDeLinguagem/fornecedoresDeModeloDeLinguagem';
import { validarConfiguracaoDoFornecedor } from '../../lib/modeloDeLinguagem/validarConfiguracaoDoFornecedor';
import type { CorpoDaConfiguracao } from './hooks/useConfiguracaoDoFornecedor';

/** O formulário como a pessoa digitou: tudo texto. */
export interface CamposDoFormulario {
  fornecedor: string;
  modelo: string;
  chave: string;
  endereco: string;
  precoEntrada: string;
  precoSaida: string;
  teto: string;
}

export type CorpoMontado = { valido: true; corpo: CorpoDaConfiguracao } | { valido: false; motivos: string[] };

export function montarCorpoDaConfiguracao(campos: CamposDoFormulario, temChaveGravada: boolean): CorpoMontado {
  const fornecedor = fornecedorPorId(campos.fornecedor);
  const apiPropria = fornecedor !== undefined && ehApiPropria(fornecedor.id);
  const chave = campos.chave.trim();

  const corpo: CorpoDaConfiguracao = {
    fornecedor: campos.fornecedor,
    modelo: campos.modelo.trim(),
    chave: chave === '' ? null : chave,
    endereco: apiPropria ? campos.endereco.trim() : null,
    preco_entrada_por_milhao: apiPropria ? lerNumero(campos.precoEntrada) : null,
    preco_saida_por_milhao: apiPropria ? lerNumero(campos.precoSaida) : null,
    teto_mensal_usd: campos.teto.trim() === '' ? null : lerNumero(campos.teto),
  };

  const motivos: string[] = [];
  const resultado = validarConfiguracaoDoFornecedor(corpo);
  if (!resultado.valida) motivos.push(...resultado.motivos);
  if (corpo.chave === null && !temChaveGravada) {
    motivos.push('Cole a chave que você criou no site do fornecedor.');
  }

  return motivos.length > 0 ? { valido: false, motivos } : { valido: true, corpo };
}

/**
 * Número digitado em português ou em inglês. `0,40` e `0.40` são o mesmo preço, e recusar a vírgula
 * num produto em português seria erro de tela, não de quem digitou.
 *
 * Texto que não é número vira `NaN`, e não `null`: `null` significa "não informado" para o teto, e
 * um teto digitado errado não pode ser salvo em silêncio como "sem teto".
 */
function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (limpo === '') return null;
  return /^\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : Number.NaN;
}
