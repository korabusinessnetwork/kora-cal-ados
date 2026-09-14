// `GET|PUT|DELETE /api/v1/modelo-de-linguagem/configuracao?tenant=<uuid>`, a configuração do
// fornecedor de uma marca (D13). ORQUESTRA e NÃO DECIDE, como a rota de variante: toda regra mora em
// `api/_lib/` e em `src/lib/modeloDeLinguagem/`, cada uma com teste próprio.
//
// Só owner, nos três métodos: a chave é gasto e é credencial (D13, item 5).
//
// A chave NUNCA volta na resposta, em método nenhum. O que volta é o final dela, e é o que a tela
// mostra. Esta é a propriedade que `_modeloDeLinguagem.test.ts` confere procurando a chave no corpo.

import type { SupabaseClient } from '@supabase/supabase-js';

import { validarConfiguracaoDoFornecedor } from '../../../src/lib/modeloDeLinguagem/validarConfiguracaoDoFornecedor';
import { autenticarSessaoDoUsuario } from '../../_lib/autenticarSessaoDoUsuario';
import { lerChaveDeCifra } from '../../_lib/cifraDaChaveDoFornecedor';
import { criarClienteDeServico } from '../../_lib/clienteDeServico';
import {
  apagarConfiguracao,
  carregarConfiguracaoVisivel,
  gravarConfiguracao,
} from '../../_lib/configuracaoDoModeloDeLinguagem';
import { exigirMetodo, lerCorpoJson, lerTenantDaUrl } from '../../_lib/pedidoDoModeloDeLinguagem';
import { respostaDeErro, respostaDeSucessoEmJson } from '../../_lib/respostaDaApi';
import { criarFalhaDeTransporte, traduzirParaFalhaDaApi } from '../../_lib/traduzirParaFalhaDaApi';
import { verificarEnderecoPublico } from '../../_lib/verificarEnderecoPublico';

const METODOS = ['GET', 'PUT', 'DELETE'];

export default {
  async fetch(pedido: Request, clienteInjetado?: SupabaseClient): Promise<Response> {
    try {
      const metodo = exigirMetodo(pedido, METODOS);
      const tenantId = lerTenantDaUrl(pedido);
      const cliente = clienteInjetado ?? criarClienteDeServico();
      const sessao = await autenticarSessaoDoUsuario(cliente, pedido, tenantId, 'owner');

      if (metodo === 'GET') {
        return respostaDeSucessoEmJson({ configuracao: await carregarConfiguracaoVisivel(cliente, tenantId) });
      }

      if (metodo === 'DELETE') {
        await apagarConfiguracao(cliente, tenantId);
        // O uso já registrado FICA: é o histórico de gasto da marca, e apagá-lo junto faria o
        // painel do mês mudar de número por causa de uma troca de fornecedor.
        return respostaDeSucessoEmJson({ configuracao: null });
      }

      const resultado = validarConfiguracaoDoFornecedor(await lerCorpoJson(pedido));
      if (!resultado.valida) {
        throw criarFalhaDeTransporte('CORPO_INVALIDO', resultado.motivos.join(' '));
      }

      // A guarda de DNS roda ao GRAVAR, e não só ao usar: é aqui que a pessoa está olhando a tela e
      // consegue corrigir o endereço. Ao usar ela roda de novo, porque o DNS pode mudar depois.
      if (resultado.configuracao.endereco !== null) {
        await verificarEnderecoPublico(resultado.configuracao.endereco);
      }

      const configuracao = await gravarConfiguracao(
        cliente,
        tenantId,
        sessao.usuarioId,
        resultado.configuracao,
        lerChaveDeCifra(),
      );
      return respostaDeSucessoEmJson({ configuracao });
    } catch (erro) {
      return respostaDeErro(traduzirParaFalhaDaApi(erro));
    }
  },
};
