// A configuração do fornecedor de uma marca, lida e gravada com `service_role` (D13).
//
// Duas saídas diferentes de propósito, e a diferença é a regra de segurança inteira:
// `carregarConfiguracaoVisivel` devolve o que pode ir para a tela (sem a chave, só o final dela), e
// `carregarConfiguracaoParaUso` devolve o que só existe dentro da função, com a chave decifrada.
// Uma função só, com um parâmetro "incluir a chave", acabaria com a chave na resposta no dia em que
// alguém passasse o parâmetro errado.

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  ehApiPropria,
  fornecedorPorId,
  type IdDoFornecedor,
} from '../../src/lib/modeloDeLinguagem/fornecedoresDeModeloDeLinguagem';
import type { PrecoPorMilhaoDeTokens } from '../../src/lib/modeloDeLinguagem/calcularCustoEstimado';
import type { ConfiguracaoPedida } from '../../src/lib/modeloDeLinguagem/validarConfiguracaoDoFornecedor';
import type { ConfiguracaoDoFornecedorVisivel } from '../../src/lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import { cifrarChaveDoFornecedor, decifrarChaveDoFornecedor, finalDaChave } from './cifraDaChaveDoFornecedor';
import { criarFalhaDeTransporte } from './traduzirParaFalhaDaApi';

export const TABELA_DA_CONFIGURACAO = 'tenant_modelos_de_linguagem';

/** Campos explícitos, nunca `select *` (CLAUDE.md). A chave cifrada só entra na leitura de uso. */
const CAMPOS_VISIVEIS =
  'fornecedor, modelo, endereco, preco_entrada_por_milhao, preco_saida_por_milhao, teto_mensal_usd, final_da_chave, updated_at';

export interface ConfiguracaoParaUso {
  fornecedor: IdDoFornecedor;
  nomeDoFornecedor: string;
  modelo: string;
  enderecoBase: string;
  chave: string;
  preco: PrecoPorMilhaoDeTokens;
  tetoMensalUsd: number | null;
}

export async function carregarConfiguracaoVisivel(
  cliente: SupabaseClient,
  tenantId: string,
): Promise<ConfiguracaoDoFornecedorVisivel | null> {
  const { data, error } = await cliente
    .from(TABELA_DA_CONFIGURACAO)
    .select(CAMPOS_VISIVEIS)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler a configuração do modelo de linguagem: ${error.message}`);
  if (!data) return null;

  const linha = data as unknown as ConfiguracaoDoFornecedorVisivel;
  return {
    ...linha,
    // `numeric` chega como texto pelo PostgREST quando é grande; a tela espera número.
    preco_entrada_por_milhao: Number(linha.preco_entrada_por_milhao),
    preco_saida_por_milhao: Number(linha.preco_saida_por_milhao),
    teto_mensal_usd: linha.teto_mensal_usd === null ? null : Number(linha.teto_mensal_usd),
  };
}

/** A configuração pronta para chamar o fornecedor. Sem configuração, recusa com o código do contrato. */
export async function carregarConfiguracaoParaUso(
  cliente: SupabaseClient,
  tenantId: string,
  chaveDeCifra: Buffer,
): Promise<ConfiguracaoParaUso> {
  const { data, error } = await cliente
    .from(TABELA_DA_CONFIGURACAO)
    .select(`${CAMPOS_VISIVEIS}, chave_cifrada`)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler a configuração do modelo de linguagem: ${error.message}`);
  if (!data) throw criarFalhaDeTransporte('FORNECEDOR_NAO_CONFIGURADO');

  const linha = data as unknown as ConfiguracaoDoFornecedorVisivel & { chave_cifrada: string };
  const fornecedor = fornecedorPorId(linha.fornecedor);
  if (fornecedor === undefined) {
    // Linha gravada com fornecedor que não existe mais na lista: é dado do tenant que precisa ser
    // regravado, não erro nosso, e seguir sem endereço não daria chamada nenhuma.
    throw criarFalhaDeTransporte(
      'FORNECEDOR_NAO_CONFIGURADO',
      'O fornecedor gravado não existe mais na lista. Escolha um fornecedor de novo em "Fornecedor de modelo de linguagem".',
    );
  }

  const enderecoBase = ehApiPropria(fornecedor.id) ? (linha.endereco ?? '') : (fornecedor.enderecoBase ?? '');
  if (enderecoBase === '') throw criarFalhaDeTransporte('FORNECEDOR_NAO_CONFIGURADO');

  return {
    fornecedor: fornecedor.id,
    nomeDoFornecedor: fornecedor.nome,
    modelo: linha.modelo,
    enderecoBase,
    chave: decifrarChaveDoFornecedor(linha.chave_cifrada, chaveDeCifra),
    preco: {
      entrada: Number(linha.preco_entrada_por_milhao),
      saida: Number(linha.preco_saida_por_milhao),
    },
    tetoMensalUsd: linha.teto_mensal_usd === null ? null : Number(linha.teto_mensal_usd),
  };
}

/**
 * Grava a configuração e devolve o que a tela pode ver.
 *
 * Sem chave no pedido, mantém a que já está gravada. Se não há nenhuma gravada, recusa: uma
 * configuração sem chave não chamaria fornecedor nenhum, e ficaria parecendo pronta na tela.
 */
export async function gravarConfiguracao(
  cliente: SupabaseClient,
  tenantId: string,
  usuarioId: string,
  pedida: ConfiguracaoPedida,
  chaveDeCifra: Buffer,
): Promise<ConfiguracaoDoFornecedorVisivel> {
  const atual = await carregarConfiguracaoVisivel(cliente, tenantId);

  let chaveCifrada: string | null = null;
  let final = atual?.final_da_chave ?? '';
  if (pedida.chave !== null) {
    chaveCifrada = cifrarChaveDoFornecedor(pedida.chave, chaveDeCifra);
    final = finalDaChave(pedida.chave);
  } else if (atual === null) {
    throw criarFalhaDeTransporte('CORPO_INVALIDO', 'Cole a chave do fornecedor para salvar a configuração.');
  }

  const linha = {
    tenant_id: tenantId,
    fornecedor: pedida.fornecedor,
    modelo: pedida.modelo,
    endereco: pedida.endereco,
    preco_entrada_por_milhao: pedida.precoEntradaPorMilhao,
    preco_saida_por_milhao: pedida.precoSaidaPorMilhao,
    teto_mensal_usd: pedida.tetoMensalUsd,
    final_da_chave: final,
    updated_by: usuarioId,
    updated_at: new Date().toISOString(),
    // A chave cifrada só entra no `upsert` quando existe uma nova, para não apagar a gravada.
    ...(chaveCifrada === null ? {} : { chave_cifrada: chaveCifrada }),
  };

  const { error } = await cliente.from(TABELA_DA_CONFIGURACAO).upsert(linha, { onConflict: 'tenant_id' });
  if (error) throw new Error(`Falha ao gravar a configuração do modelo de linguagem: ${error.message}`);

  const gravada = await carregarConfiguracaoVisivel(cliente, tenantId);
  if (gravada === null) throw new Error('A configuração foi gravada e não foi encontrada em seguida.');
  return gravada;
}

/** Apaga a configuração. O uso já registrado fica: é o histórico de gasto da marca. */
export async function apagarConfiguracao(cliente: SupabaseClient, tenantId: string): Promise<void> {
  const { error } = await cliente.from(TABELA_DA_CONFIGURACAO).delete().eq('tenant_id', tenantId);
  if (error) throw new Error(`Falha ao apagar a configuração do modelo de linguagem: ${error.message}`);
}
