// Grava uma zona marcada no editor. INSERT e UPDATE são caminhos separados de propósito.
//
// A decisão que este arquivo carrega: `unique (product_id, zone_key)` significa que
// "adicionar mais um elemento à zona sola" é UPDATE do `svg_selector` da linha existente,
// nunca uma segunda linha. Gravar tudo por uma chamada única e cega, que insere ou
// sobrescreve conforme a chave já exista, seria mais curto e apagaria em silêncio o
// mapeamento que um colega acabou de salvar — INSERT e UPDATE significam coisas
// diferentes, e a diferença é quem some. `gravarZonaNoBanco.test.ts` tem um teste que lê
// este fonte e falha se essa chamada única voltar numa refatoração; o comentário sozinho
// não segura a regra.
//
// Duas pessoas criando a mesma `zone_key` ao mesmo tempo esbarram na unique e voltam com
// Postgres 23505. Isso é o comportamento CERTO — a segunda gravação seria destrutiva —,
// então ele é traduzido para uma frase acionável em vez de contornado.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZonaDoProduto, ZonaParaGravar } from './tiposDeZona';

const CAMPOS = 'id, product_id, tenant_id, zone_key, svg_selector, label, cor_default';

/** Violação de unique no Postgres. Aqui é sempre `(product_id, zone_key)`. */
const UNIQUE_VIOLADA = '23505';

/** Nenhuma linha voltou de um `.single()` do PostgREST. */
const NENHUMA_LINHA = 'PGRST116';

export interface PedidoDeGravacao {
  tenantId: string;
  productId: string;
  zona: ZonaParaGravar;
}

export async function gravarZonaNoBanco(
  cliente: SupabaseClient,
  pedido: PedidoDeGravacao,
): Promise<ZonaDoProduto> {
  const { tenantId, productId, zona } = pedido;

  // Prevenção de erro > mensagem de erro: campo vazio aqui viraria uma linha inútil no
  // banco (ou, no caso do tenant, uma linha órfã que a RLS esconde de todo mundo).
  if (!tenantId.trim()) throw new Error('Não dá para gravar uma zona sem tenant ativo.');
  if (!productId.trim()) throw new Error('Não dá para gravar uma zona sem o id do produto.');
  if (!zona.zone_key.trim()) throw new Error('A zona precisa de uma zone_key.');
  if (!zona.svg_selector.trim()) throw new Error('A zona precisa de pelo menos um elemento marcado.');

  return zona.idExistente === null
    ? await inserirZona(cliente, tenantId, productId, zona)
    : await atualizarZona(cliente, productId, zona.idExistente, zona);
}

async function inserirZona(
  cliente: SupabaseClient,
  tenantId: string,
  productId: string,
  zona: ZonaParaGravar,
): Promise<ZonaDoProduto> {
  // `tenant_id` vai explícito mesmo com a RLS: a coluna é `not null` e a policy só decide
  // se o INSERT passa, não preenche nada.
  const { data, error } = await cliente
    .from('product_zones')
    .insert({
      product_id: productId,
      tenant_id: tenantId,
      zone_key: zona.zone_key,
      svg_selector: zona.svg_selector,
      label: zona.label,
      cor_default: zona.cor_default,
    })
    .select(CAMPOS)
    .single();

  if (error) throw traduzir(error, zona.zone_key);
  if (!data) throw new Error(`A zona "${zona.zone_key}" não foi gravada. Tente de novo.`);

  return data as ZonaDoProduto;
}

async function atualizarZona(
  cliente: SupabaseClient,
  productId: string,
  idExistente: string,
  zona: ZonaParaGravar,
): Promise<ZonaDoProduto> {
  // `zone_key` e `product_id` ficam de fora do UPDATE: a identidade da linha não muda por
  // edição de zona. Trocar a `zone_key` de uma linha existente renomearia a chave pública
  // da API por baixo de um cliente que já integra com ela.
  const { data, error } = await cliente
    .from('product_zones')
    .update({
      svg_selector: zona.svg_selector,
      label: zona.label,
      cor_default: zona.cor_default,
    })
    .eq('id', idExistente)
    // O segundo filtro existe para um id vindo de outra tela (ou de estado velho) não
    // conseguir reescrever a zona de OUTRO produto — a RLS deixaria passar, porque os
    // dois produtos podem ser do mesmo tenant.
    .eq('product_id', productId)
    .select(CAMPOS)
    .single();

  if (error) {
    if (codigoDe(error) === NENHUMA_LINHA) throw zonaSumiu(zona.zone_key);
    throw traduzir(error, zona.zone_key);
  }

  // Zero linha afetada com sucesso aparente: alguém apagou a zona, ou o id é de outro
  // produto. Fingir sucesso deixaria a marcação só na tela de quem gravou.
  if (!data) throw zonaSumiu(zona.zone_key);

  return data as ZonaDoProduto;
}

function zonaSumiu(zoneKey: string): Error {
  return new Error(
    `A zona "${zoneKey}" não existe mais neste produto — recarregue a página para ver a versão atual.`,
  );
}

function codigoDe(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

/**
 * Traduz o erro do banco para uma frase que diz o que fazer. O objeto cru do Supabase
 * nunca sai daqui — ele carrega detalhe de schema ("duplicate key value violates unique
 * constraint product_zones_product_id_zone_key_key") que não ajuda ninguém na tela e não
 * deve ser logado.
 */
function traduzir(error: unknown, zoneKey: string): Error {
  if (codigoDe(error) === UNIQUE_VIOLADA) {
    return new Error(
      `A zona "${zoneKey}" já foi marcada — recarregue a página para ver a marcação atual antes de editar.`,
    );
  }

  return new Error(
    `Não foi possível gravar a zona "${zoneKey}". Tente de novo; se continuar, recarregue a página.`,
  );
}
