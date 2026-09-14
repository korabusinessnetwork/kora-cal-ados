// `POST /api/v1/modelo-de-linguagem/testar?tenant=<uuid>`, o botão "Testar conexão" da tela (D13).
//
// Testa a configuração GRAVADA, e não uma configuração enviada no corpo. Assim o teste prova o que a
// marca vai usar de verdade (chave cifrada no banco, endereço, modelo), e não uma combinação que
// existiu só naquele clique. O preço de ter de salvar antes de testar é pequeno perto de um "testou
// e funcionou" que não corresponde ao que ficou gravado.
//
// O teste é uma chamada de verdade, minúscula: é a única forma de saber que a chave vale e que o
// modelo existe, porque nem todo fornecedor tem uma rota de listagem, e alguns respondem 200 nela
// com a chave errada. Ela entra no registro de uso com `origem: 'teste'`, para o painel de gasto não
// mentir: no plano grátis custa zero, e na API própria custa alguns centésimos de centavo.

import type { SupabaseClient } from '@supabase/supabase-js';

import { calcularCustoEstimado } from '../../../src/lib/modeloDeLinguagem/calcularCustoEstimado';
import { ehApiPropria } from '../../../src/lib/modeloDeLinguagem/fornecedoresDeModeloDeLinguagem';
import type { RespostaDoTeste } from '../../../src/lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import { autenticarSessaoDoUsuario } from '../../_lib/autenticarSessaoDoUsuario';
import { chamarFornecedorDeModeloDeLinguagem, type Buscador } from '../../_lib/chamarFornecedorDeModeloDeLinguagem';
import { lerChaveDeCifra } from '../../_lib/cifraDaChaveDoFornecedor';
import { criarClienteDeServico } from '../../_lib/clienteDeServico';
import { carregarConfiguracaoParaUso } from '../../_lib/configuracaoDoModeloDeLinguagem';
import { conferirLimitesDeUso } from '../../_lib/limitesDoModeloDeLinguagem';
import { exigirMetodo, lerTenantDaUrl } from '../../_lib/pedidoDoModeloDeLinguagem';
import { registrarUsoDoModeloDeLinguagem } from '../../_lib/registrarUsoDoModeloDeLinguagem';
import { respostaDeErro, respostaDeSucessoEmJson } from '../../_lib/respostaDaApi';
import { FalhaDaApi } from '../../_lib/tiposDaApi';
import { traduzirParaFalhaDaApi } from '../../_lib/traduzirParaFalhaDaApi';
import { verificarEnderecoPublico } from '../../_lib/verificarEnderecoPublico';

/** Curto de propósito: o que se quer saber é se a chave vale, não o que o modelo sabe responder. */
const INSTRUCAO_DO_TESTE = 'Responda apenas com a palavra OK.';
const PROMPT_DO_TESTE = 'teste de conexão';
const MAXIMO_DE_TOKENS_DO_TESTE = 5;

export default {
  async fetch(pedido: Request, clienteInjetado?: SupabaseClient, buscar?: Buscador): Promise<Response> {
    try {
      exigirMetodo(pedido, ['POST']);
      const tenantId = lerTenantDaUrl(pedido);
      const cliente = clienteInjetado ?? criarClienteDeServico();
      const sessao = await autenticarSessaoDoUsuario(cliente, pedido, tenantId, 'owner');

      const configuracao = await carregarConfiguracaoParaUso(cliente, tenantId, lerChaveDeCifra());
      await conferirLimitesDeUso(cliente, tenantId, configuracao.tetoMensalUsd);
      if (ehApiPropria(configuracao.fornecedor)) await verificarEnderecoPublico(configuracao.enderecoBase);

      const comecouEm = Date.now();
      try {
        const resposta = await chamarFornecedorDeModeloDeLinguagem(
          {
            enderecoBase: configuracao.enderecoBase,
            chave: configuracao.chave,
            modelo: configuracao.modelo,
            instrucao: INSTRUCAO_DO_TESTE,
            prompt: PROMPT_DO_TESTE,
            maximoDeTokens: MAXIMO_DE_TOKENS_DO_TESTE,
          },
          buscar,
        );

        await registrarUsoDoModeloDeLinguagem(cliente, {
          tenantId,
          usuarioId: sessao.usuarioId,
          fornecedor: configuracao.fornecedor,
          modelo: configuracao.modelo,
          origem: 'teste',
          sucesso: true,
          tokensDeEntrada: resposta.tokensDeEntrada,
          tokensDeSaida: resposta.tokensDeSaida,
          custoEstimadoUsd: calcularCustoEstimado(resposta.tokensDeEntrada, resposta.tokensDeSaida, configuracao.preco),
        });

        // O TEXTO da resposta não volta: o que a tela precisa saber é que deu certo. Devolvê-lo
        // seria um caminho de texto de terceiro para a tela sem passar por guarda nenhum.
        const dados: RespostaDoTeste = { ok: true, modelo: configuracao.modelo, milissegundos: Date.now() - comecouEm };
        return respostaDeSucessoEmJson(dados);
      } catch (erroDoFornecedor) {
        const falha = traduzirParaFalhaDaApi(erroDoFornecedor);
        await registrarUsoDoModeloDeLinguagem(cliente, {
          tenantId,
          usuarioId: sessao.usuarioId,
          fornecedor: configuracao.fornecedor,
          modelo: configuracao.modelo,
          origem: 'teste',
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
