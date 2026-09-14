// O que o owner envia para configurar o fornecedor, conferido antes de tocar o banco (CLAUDE.md,
// "sempre validar inputs do usuário antes de qualquer operação no banco").
//
// Roda nos dois lados, com a mesma função: a tela usa para desabilitar o "Salvar" e dizer o que
// falta antes de mandar (prevenção vale mais que mensagem de erro), e o servidor usa porque a tela
// não é guarda de nada. Por isso devolve TODOS os motivos, e não o primeiro: a tela mostra a lista.
//
// A chave é opcional de propósito. Ela nunca volta ao navegador, então a tela não tem como reenviar
// a chave gravada; "trocar só o modelo" é mandar sem chave, e o servidor mantém a que já existe.
// Primeira configuração sem chave é recusada no servidor, que é quem sabe se já existe uma.

import { validarEnderecoDaApiPropria } from './validarEnderecoDaApiPropria';
import { ehApiPropria, fornecedorPorId, type IdDoFornecedor } from './fornecedoresDeModeloDeLinguagem';

export interface ConfiguracaoPedida {
  fornecedor: IdDoFornecedor;
  modelo: string;
  /** `null` é "manter a chave gravada". */
  chave: string | null;
  /** Só na API própria; nos fornecedores da lista o endereço é o do catálogo. */
  endereco: string | null;
  precoEntradaPorMilhao: number;
  precoSaidaPorMilhao: number;
  tetoMensalUsd: number | null;
}

export type ResultadoDaConfiguracao = { valida: true; configuracao: ConfiguracaoPedida } | { valida: false; motivos: string[] };

/** Nome de modelo é identificador: letras, números e `.-_:/@`. Espaço e aspas não existem em nenhum. */
const MODELO = /^[A-Za-z0-9._:/@-]{1,200}$/;
/** Chave de fornecedor é um token sem espaço. O mínimo pega o campo colado pela metade. */
const CHAVE = /^[\x21-\x7E]{16,500}$/;
export const PRECO_MAXIMO_POR_MILHAO = 1000;
export const TETO_MENSAL_MAXIMO = 100_000;

export function validarConfiguracaoDoFornecedor(entrada: unknown): ResultadoDaConfiguracao {
  if (entrada === null || typeof entrada !== 'object' || Array.isArray(entrada)) {
    return { valida: false, motivos: ['Envie a configuração como um objeto JSON.'] };
  }
  const campos = entrada as Record<string, unknown>;
  const motivos: string[] = [];

  const fornecedor = fornecedorPorId(campos.fornecedor);
  if (fornecedor === undefined) motivos.push('Escolha um fornecedor da lista.');

  const modelo = typeof campos.modelo === 'string' ? campos.modelo.trim() : '';
  if (!MODELO.test(modelo)) {
    motivos.push('Informe o nome do modelo, sem espaços, como o fornecedor escreve (por exemplo llama-3.3-70b-versatile).');
  }

  let chave: string | null = null;
  if (campos.chave !== undefined && campos.chave !== null && campos.chave !== '') {
    chave = typeof campos.chave === 'string' ? campos.chave.trim() : '';
    if (!CHAVE.test(chave)) motivos.push('A chave precisa ter de 16 a 500 caracteres, sem espaços.');
  }

  const apiPropria = fornecedor !== undefined && ehApiPropria(fornecedor.id);

  let endereco: string | null = null;
  let precoEntrada = 0;
  let precoSaida = 0;
  if (apiPropria) {
    const resultado = validarEnderecoDaApiPropria(campos.endereco);
    if (resultado.valido) endereco = resultado.endereco;
    else motivos.push(resultado.motivo);

    precoEntrada = lerPreco(campos.preco_entrada_por_milhao, 'entrada', motivos);
    precoSaida = lerPreco(campos.preco_saida_por_milhao, 'saída', motivos);
  }

  let teto: number | null = null;
  if (campos.teto_mensal_usd !== undefined && campos.teto_mensal_usd !== null && campos.teto_mensal_usd !== '') {
    const valor = campos.teto_mensal_usd;
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || valor > TETO_MENSAL_MAXIMO) {
      motivos.push(`O teto mensal precisa ser um valor em dólar maior que zero e até ${TETO_MENSAL_MAXIMO}.`);
    } else {
      teto = arredondar(valor, 2);
    }
  }

  if (motivos.length > 0 || fornecedor === undefined) return { valida: false, motivos };

  return {
    valida: true,
    configuracao: {
      fornecedor: fornecedor.id,
      modelo,
      chave,
      endereco,
      precoEntradaPorMilhao: precoEntrada,
      precoSaidaPorMilhao: precoSaida,
      tetoMensalUsd: teto,
    },
  };
}

function lerPreco(valor: unknown, qual: 'entrada' | 'saída', motivos: string[]): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > PRECO_MAXIMO_POR_MILHAO) {
    motivos.push(
      `Informe o preço de ${qual} em dólar por milhão de tokens, de 0 a ${PRECO_MAXIMO_POR_MILHAO}, como o fornecedor publica.`,
    );
    return 0;
  }
  return arredondar(valor, 6);
}

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}
