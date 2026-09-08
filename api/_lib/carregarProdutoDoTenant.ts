// O produto pedido, buscado por `(id, tenant_id da chave)`.
//
// POR QUE ESTE MÓDULO EXISTE SEPARADO DO QUE O EDITOR JÁ FAZ:
// `src/features/produtos/listarProdutos.ts` também filtra por tenant, mas lá o filtro é
// conveniência — quem de fato recusa o produto da marca concorrente é a RLS do Postgres,
// porque o front consulta com a chave `anon` carregando o JWT do usuário. Aqui a consulta
// sai com `service_role`, que **bypassa a RLS**: não existe segunda linha de defesa. O
// segundo filtro da consulta abaixo, o de tenant, É o isolamento entre marcas concorrentes.
// Sem ele, qualquer marca com chave válida lê o produto de qualquer outra sabendo só o id —
// e o código pareceria correto, porque ficaria idêntico ao do editor, que funciona.
//
// Por isso os dois filtros não são confiados à memória: `carregarProdutoDoTenant.test.ts`
// afirma a forma do pedido e ainda lê o próprio fonte atrás desse filtro como texto cru. Daí
// a regra de escrita deste arquivo: a chamada de filtro por tenant aparece UMA vez, no
// código, e nunca citada em comentário — uma segunda ocorrência em prosa faria a guarda
// continuar verde depois de alguém apagar a linha de verdade.

import type { SupabaseClient } from '@supabase/supabase-js';
import { criarFalhaDeTransporte } from './traduzirParaFalhaDaApi';

/**
 * O produto como a API o usa. O tipo mora aqui, e não num arquivo de tipos compartilhado,
 * porque ele é o retorno desta função: quem precisa do tipo já importa a função.
 */
export interface ProdutoDoTenant {
  readonly id: string;
  readonly tenant_id: string;
  readonly nome: string;
  /**
   * Caminho no Storage **como foi gravado**, usado como veio.
   *
   * Nunca remontar a partir de `tenant_id`/`id`: a convenção
   * `tenants/{tenant_id}/products/{id}/base.svg` passaria a existir em dois lugares (aqui e
   * no provisionamento), e no dia em que ela mudasse num deles a API baixaria o arquivo
   * errado — ou o de outra marca — em vez de falhar. Caminho lido do banco falha alto: o
   * download não acha o objeto. Caminho remontado acerta um objeto qualquer em silêncio.
   */
  readonly base_asset_path: string;
}

export async function carregarProdutoDoTenant(
  cliente: SupabaseClient,
  productId: string,
  tenantId: string,
): Promise<ProdutoDoTenant> {
  // As duas entradas em branco têm tratamentos DIFERENTES porque têm origens diferentes.
  //
  // `tenantId` vem da chave de API já autenticada (ADR-006 D3). Em branco aqui significa que
  // `autenticarChaveDeApi` devolveu lixo, ou que alguém chamou esta função fora do fluxo —
  // é defeito nosso, não pedido inválido do integrador. Vira `Error`, que o handler traduz
  // para `FALHA_INTERNA`/500, e não 404: um 404 diria ao integrador que o produto dele não
  // existe quando o problema é nosso, e o defeito viveria escondido no número de 404 do dia.
  // Pior ainda seria seguir para a consulta: filtrar por tenant vazio não filtra nada de
  // útil e transforma a garantia de isolamento numa consulta sem dono.
  if (tenantId.trim() === '') {
    throw new Error(
      'carregarProdutoDoTenant recebeu tenantId em branco. O tenant sai sempre da chave de API autenticada (ADR-006 D3); em branco é defeito de quem chamou, não pedido inválido.',
    );
  }

  // `productId` vem do segmento da URL — entrada de rede, do mesmo lugar de onde vem um id
  // inexistente. Em branco é só mais um id que não temos, e a resposta é a mesma dos outros:
  // 404. Tratá-lo como erro de programação daria 500 para um pedido malformado do cliente.
  if (productId.trim() === '') {
    throw criarFalhaDeTransporte('PRODUTO_NAO_ENCONTRADO');
  }

  const { data, error } = await cliente
    .from('products')
    // Campos explícitos, nunca o coringa (CLAUDE.md): pedir `*` traria coluna nova para
    // dentro da resposta da API sem ninguém decidir que ela pode sair daqui.
    //
    // O literal que o coringa formaria não aparece em lugar nenhum deste arquivo, nem em
    // comentário, de propósito: a guarda de fonte do teste procura por ele como texto cru, e
    // um exemplo escrito num comentário a faria falhar sem haver defeito nenhum no código.
    .select('id, tenant_id, nome, base_asset_path')
    .eq('id', productId)
    // O filtro que substitui a RLS. Ver o cabeçalho deste arquivo antes de remover.
    .eq('tenant_id', tenantId)
    // `maybeSingle` e não `single`: sem linha, `single` devolve o erro PGRST116 e obrigaria
    // este arquivo a distinguir "não achou" de "banco falhou" por código de string. Com
    // `maybeSingle`, ausência é `data: null` e erro é erro — a distinção de que as duas
    // regras abaixo dependem.
    .maybeSingle();

  // Erro do banco NÃO vira 404. Um 404 é uma afirmação sobre o dado ("este produto não
  // existe para você"), e Postgres fora do ar não autoriza essa afirmação — o produto pode
  // muito bem existir. Sobe como veio, e não traduzido aqui para `FALHA_INTERNA`, por dois
  // motivos: `traduzirParaFalhaDaApi` já converte qualquer erro desconhecido em
  // `FALHA_INTERNA` com mensagem fixa (nada vaza para o cliente), e traduzir aqui descartaria
  // antes da hora o detalhe do Postgres de que a linha de log precisa para alguém descobrir
  // o que quebrou.
  if (error) throw error;

  // Ausente e alheio saem EXATAMENTE iguais, e é o mesmo `throw` de propósito. Produto de
  // outra marca chega aqui como `data: null` porque o segundo filtro não casou — não há como
  // este ponto saber qual dos dois casos ocorreu, e essa impossibilidade é a garantia. Um
  // 403 (ou uma mensagem diferente, ou um tempo de resposta diferente) confirmaria que o id
  // existe, e marcas concorrentes convivem neste sistema: confirmar a existência do id já é
  // vazamento (ADR-006 D3).
  //
  // A mensagem é a da tabela (`Produto não encontrado.`), sem eco do `productId`: ecoar o id
  // que o próprio integrador enviou não vazaria nada, mas também não diz nada que ele não
  // saiba — ele o escreveu na URL. Mensagem própria só quando há detalhe acionável a dar.
  if (!data) {
    throw criarFalhaDeTransporte('PRODUTO_NAO_ENCONTRADO');
  }

  return data as unknown as ProdutoDoTenant;
}
