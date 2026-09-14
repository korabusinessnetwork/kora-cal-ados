// `GET /api/v1/modelo-de-linguagem/em-uso?tenant=<uuid>`, quem responde o prompt da marca (D13).
//
// Qualquer membro: é o que a tela "Compor calçado" precisa para dizer, ANTES de gerar, quem vai
// responder e se é IA (regra de transparência de `memory/restrictions.md`). O membro não pode ler
// `configuracao`, que é do owner, então esta rota devolve só três campos: fornecedor, nome e modelo.
// Sem preço, sem teto, sem o final da chave. Cada campo a mais aqui é dado do owner vazando para o
// time inteiro.

import type { SupabaseClient } from '@supabase/supabase-js';

import { fornecedorPorId } from '../../../src/lib/modeloDeLinguagem/fornecedoresDeModeloDeLinguagem';
import type { FornecedorEmUso } from '../../../src/lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import { autenticarSessaoDoUsuario } from '../../_lib/autenticarSessaoDoUsuario';
import { criarClienteDeServico } from '../../_lib/clienteDeServico';
import { carregarConfiguracaoVisivel } from '../../_lib/configuracaoDoModeloDeLinguagem';
import { exigirMetodo, lerTenantDaUrl } from '../../_lib/pedidoDoModeloDeLinguagem';
import { respostaDeErro, respostaDeSucessoEmJson } from '../../_lib/respostaDaApi';
import { traduzirParaFalhaDaApi } from '../../_lib/traduzirParaFalhaDaApi';

export default {
  async fetch(pedido: Request, clienteInjetado?: SupabaseClient): Promise<Response> {
    try {
      exigirMetodo(pedido, ['GET']);
      const tenantId = lerTenantDaUrl(pedido);
      const cliente = clienteInjetado ?? criarClienteDeServico();
      await autenticarSessaoDoUsuario(cliente, pedido, tenantId, 'membro');

      const configuracao = await carregarConfiguracaoVisivel(cliente, tenantId);
      // Montado campo a campo, e não com `...configuracao`: um espalhamento levaria junto qualquer
      // coluna que um dia entrar em `CAMPOS_VISIVEIS`, e esta resposta vai para todo membro.
      const emUso: FornecedorEmUso | null = configuracao
        ? {
            fornecedor: configuracao.fornecedor,
            nome_do_fornecedor: fornecedorPorId(configuracao.fornecedor)?.nome ?? configuracao.fornecedor,
            modelo: configuracao.modelo,
          }
        : null;

      return respostaDeSucessoEmJson({ fornecedor_em_uso: emUso });
    } catch (erro) {
      return respostaDeErro(traduzirParaFalhaDaApi(erro));
    }
  },
};
