// `GET /api/v1/modelo-de-linguagem/uso?tenant=<uuid>&mes=AAAA-MM`, o painel de gasto do mês (D13).
//
// Só owner: gasto é dado financeiro da marca (D13, item 5).
//
// O mês é cortado em UTC, o mesmo corte que o teto mensal usa. Dois fusos diferentes fariam o painel
// mostrar abaixo do teto um mês que já está bloqueado, que é o pior jeito de a pessoa descobrir o
// limite. A tela diz que o corte é UTC.

import type { SupabaseClient } from '@supabase/supabase-js';

import { ehMesValido, limitesDoMes, mesEmUtc, resumirUsoDoMes } from '../../../src/lib/modeloDeLinguagem/resumirUsoDoMes';
import type { ChamadaRecente } from '../../../src/lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import { autenticarSessaoDoUsuario } from '../../_lib/autenticarSessaoDoUsuario';
import { criarClienteDeServico } from '../../_lib/clienteDeServico';
import { carregarConfiguracaoVisivel } from '../../_lib/configuracaoDoModeloDeLinguagem';
import { TABELA_DO_USO } from '../../_lib/limitesDoModeloDeLinguagem';
import { exigirMetodo, lerTenantDaUrl } from '../../_lib/pedidoDoModeloDeLinguagem';
import { respostaDeErro, respostaDeSucessoEmJson } from '../../_lib/respostaDaApi';
import { criarFalhaDeTransporte, traduzirParaFalhaDaApi } from '../../_lib/traduzirParaFalhaDaApi';

/** Teto de linhas lidas de um mês. Ver o comentário no `.limit` abaixo. */
const LIMITE_DE_LINHAS = 5000;

/** Campos explícitos, nunca `select *` (CLAUDE.md). É também o que a tela recebe, campo a campo. */
const CAMPOS =
  'created_at, fornecedor, modelo, origem, sucesso, tokens_de_entrada, tokens_de_saida, custo_estimado_usd';

export default {
  async fetch(pedido: Request, clienteInjetado?: SupabaseClient): Promise<Response> {
    try {
      exigirMetodo(pedido, ['GET']);
      const tenantId = lerTenantDaUrl(pedido);
      const cliente = clienteInjetado ?? criarClienteDeServico();
      await autenticarSessaoDoUsuario(cliente, pedido, tenantId, 'owner');

      const pedidoDeMes = new URL(pedido.url).searchParams.get('mes');
      if (pedidoDeMes !== null && !ehMesValido(pedidoDeMes)) {
        throw criarFalhaDeTransporte('CORPO_INVALIDO', 'O mês precisa estar no formato AAAA-MM.');
      }
      const mes = pedidoDeMes ?? mesEmUtc(new Date());
      const { inicio, fim } = limitesDoMes(mes);

      const { data, error } = await cliente
        .from(TABELA_DO_USO)
        .select(CAMPOS)
        .eq('tenant_id', tenantId)
        .gte('created_at', inicio)
        .lt('created_at', fim)
        .order('created_at', { ascending: false })
        // Teto de linhas: o limite diário segura o mês em algumas milhares, e um mês fora da curva
        // não pode virar uma resposta de megabytes. O resumo continua certo até este teto, e a tela
        // diz quando ele foi alcançado.
        .limit(LIMITE_DE_LINHAS);

      if (error) throw new Error(`Falha ao ler o uso do modelo de linguagem: ${error.message}`);

      const chamadas = (data ?? []) as unknown as ChamadaRecente[];
      const configuracao = await carregarConfiguracaoVisivel(cliente, tenantId);

      return respostaDeSucessoEmJson({
        ...resumirUsoDoMes(mes, chamadas, configuracao?.teto_mensal_usd ?? null),
        completo: chamadas.length < LIMITE_DE_LINHAS,
      });
    } catch (erro) {
      return respostaDeErro(traduzirParaFalhaDaApi(erro));
    }
  },
};
