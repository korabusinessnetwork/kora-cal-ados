// `POST /api/v1/modelo-de-linguagem/gerar?tenant=<uuid>`, o prompt da pessoa vai ao fornecedor da
// marca e o texto dele volta (D13). ORQUESTRA e NÃO DECIDE.
//
// Qualquer membro da marca gera; só o owner configura e vê o gasto (D13, item 5).
//
// POR QUE ESTA ROTA NÃO É UM PROXY. O corpo aceita `forma_id` e `prompt`, e mais nada. A instrução
// e o catálogo são montados AQUI, no servidor, a partir do acervo. Se a instrução viesse do
// navegador, quem abrisse o console teria a chave da marca como um modelo de linguagem de uso geral,
// pago pela marca, e o registro de uso mostraria "composição" para qualquer coisa.
//
// A RESPOSTA É TEXTO CRU DO MODELO, e não uma composição pronta. Quem transforma texto em calçado é
// `validarComposicao`, o guarda do ADR-008, e ele roda na tela sobre o mesmo acervo. Devolver
// composição daqui criaria um segundo caminho até o palco, e o ADR-008 tem um só.
//
// TODA chamada vira uma linha de uso, inclusive as que falharam: é o que os três limites contam, e
// um laço de erro é justamente o caso em que eles precisam segurar.

import type { SupabaseClient } from '@supabase/supabase-js';

import { catalogoDeProva } from '../../../src/lib/acervo/acervoDeProva';
import { TAMANHO_MAXIMO_DO_PROMPT } from '../../../src/lib/composicao/gerarComposicaoPorPrompt';
import { calcularCustoEstimado } from '../../../src/lib/modeloDeLinguagem/calcularCustoEstimado';
import { ehApiPropria } from '../../../src/lib/modeloDeLinguagem/fornecedoresDeModeloDeLinguagem';
import type { RespostaDaGeracao } from '../../../src/lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import { autenticarSessaoDoUsuario } from '../../_lib/autenticarSessaoDoUsuario';
import {
  chamarFornecedorDeModeloDeLinguagem,
  type Buscador,
} from '../../_lib/chamarFornecedorDeModeloDeLinguagem';
import { lerChaveDeCifra } from '../../_lib/cifraDaChaveDoFornecedor';
import { criarClienteDeServico } from '../../_lib/clienteDeServico';
import { carregarConfiguracaoParaUso } from '../../_lib/configuracaoDoModeloDeLinguagem';
import { conferirLimitesDeUso } from '../../_lib/limitesDoModeloDeLinguagem';
import {
  acharForma,
  exigirMetodo,
  lerCorpoJson,
  lerTenantDaUrl,
  montarInstrucaoComCatalogo,
} from '../../_lib/pedidoDoModeloDeLinguagem';
import { registrarUsoDoModeloDeLinguagem } from '../../_lib/registrarUsoDoModeloDeLinguagem';
import { respostaDeErro, respostaDeSucessoEmJson } from '../../_lib/respostaDaApi';
import { FalhaDaApi } from '../../_lib/tiposDaApi';
import { criarFalhaDeTransporte, traduzirParaFalhaDaApi } from '../../_lib/traduzirParaFalhaDaApi';
import { verificarEnderecoPublico } from '../../_lib/verificarEnderecoPublico';

/** O `fetch` entra por parâmetro só para o teste rodar sem rede, como o cliente Supabase. */
export default {
  async fetch(pedido: Request, clienteInjetado?: SupabaseClient, buscar?: Buscador): Promise<Response> {
    try {
      exigirMetodo(pedido, ['POST']);
      const tenantId = lerTenantDaUrl(pedido);
      const cliente = clienteInjetado ?? criarClienteDeServico();
      // `membro` e não `owner`: compor calçado é o trabalho do time da marca.
      const sessao = await autenticarSessaoDoUsuario(cliente, pedido, tenantId, 'membro');

      const corpo = (await lerCorpoJson(pedido)) as { forma_id?: unknown; prompt?: unknown };
      const catalogo = catalogoDeProva();
      const forma = acharForma(catalogo, corpo.forma_id);
      const prompt = lerPrompt(corpo.prompt);

      const configuracao = await carregarConfiguracaoParaUso(cliente, tenantId, lerChaveDeCifra());
      await conferirLimitesDeUso(cliente, tenantId, configuracao.tetoMensalUsd);
      // De novo aqui, mesmo tendo rodado ao gravar: o DNS do endereço pode ter mudado depois.
      if (ehApiPropria(configuracao.fornecedor)) await verificarEnderecoPublico(configuracao.enderecoBase);

      try {
        const resposta = await chamarFornecedorDeModeloDeLinguagem(
          {
            enderecoBase: configuracao.enderecoBase,
            chave: configuracao.chave,
            modelo: configuracao.modelo,
            instrucao: montarInstrucaoComCatalogo(forma, catalogo),
            prompt,
          },
          buscar,
        );

        const custo = calcularCustoEstimado(resposta.tokensDeEntrada, resposta.tokensDeSaida, configuracao.preco);
        await registrarUsoDoModeloDeLinguagem(cliente, {
          tenantId,
          usuarioId: sessao.usuarioId,
          fornecedor: configuracao.fornecedor,
          modelo: configuracao.modelo,
          origem: 'geracao',
          sucesso: true,
          tokensDeEntrada: resposta.tokensDeEntrada,
          tokensDeSaida: resposta.tokensDeSaida,
          custoEstimadoUsd: custo,
        });

        const dados: RespostaDaGeracao = {
          texto: resposta.texto,
          fornecedor: configuracao.fornecedor,
          nome_do_fornecedor: configuracao.nomeDoFornecedor,
          modelo: configuracao.modelo,
          custo_estimado_usd: custo,
        };
        return respostaDeSucessoEmJson(dados);
      } catch (erroDoFornecedor) {
        // A tentativa que o fornecedor recusou consumiu cota dele e tempo nosso: entra no registro,
        // com o código NOSSO, nunca com a mensagem dele.
        const falha = traduzirParaFalhaDaApi(erroDoFornecedor);
        await registrarUsoDoModeloDeLinguagem(cliente, {
          tenantId,
          usuarioId: sessao.usuarioId,
          fornecedor: configuracao.fornecedor,
          modelo: configuracao.modelo,
          origem: 'geracao',
          sucesso: false,
          codigoDeErro: falha.codigo,
          tokensDeEntrada: 0,
          tokensDeSaida: 0,
          custoEstimadoUsd: 0,
        });
        throw falha;
      }
    } catch (erro) {
      return respostaDeErro(erro instanceof FalhaDaApi ? erro : traduzirParaFalhaDaApi(erro));
    }
  },
};

/**
 * O prompt, conferido antes de a chamada acontecer.
 *
 * As mesmas duas recusas de `gerarComposicaoPorPrompt`, e não uma delegação a ele, porque aqui elas
 * significam outra coisa: lá evitam gastar uma chamada, aqui são a única barreira entre um corpo de
 * rede e o que vai dentro do pedido ao fornecedor.
 */
function lerPrompt(valor: unknown): string {
  const prompt = typeof valor === 'string' ? valor.trim() : '';
  if (prompt === '') {
    throw criarFalhaDeTransporte('CORPO_INVALIDO', 'Envie "prompt" com a descrição do calçado.');
  }
  if (prompt.length > TAMANHO_MAXIMO_DO_PROMPT) {
    throw criarFalhaDeTransporte(
      'CORPO_INVALIDO',
      `O prompt tem ${prompt.length} caracteres, e o limite é ${TAMANHO_MAXIMO_DO_PROMPT}.`,
    );
  }
  return prompt;
}
