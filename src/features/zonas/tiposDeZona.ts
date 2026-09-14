// Os tipos que a feature de zonas compartilha. Arquivo único de propósito: uma zona
// atravessa banco, motor de render e tela, e três definições ligeiramente diferentes do
// mesmo registro é como um campo passa a existir em um lugar e faltar no outro.
//
// `Zona` do motor (`src/lib/render/gerarVarianteDeCor.ts`) é o subconjunto que a geração
// precisa, `zone_key` + `svg_selector`. `ZonaDoProduto` é a linha inteira de
// `product_zones`. A primeira é estruturalmente compatível com a segunda, então dá para
// passar uma zona do banco direto para o motor sem conversão.

/** Uma linha de `product_zones`, como ela existe no banco. */
export interface ZonaDoProduto {
  id: string;
  product_id: string;
  tenant_id: string;
  /** Chave pública da API: o cliente manda `{"sola": "#C0392B"}`. */
  zone_key: string;
  /** Lista de ids exatos (`#a, #b`), montada só por `montarSeletorDeZona` (ADR-005). */
  svg_selector: string;
  label: string | null;
  cor_default: string | null;
}

/**
 * O que `marcarZona` devolve: a linha pronta para gravar, mais a informação de **como**
 * gravar. `unique (product_id, zone_key)` significa que "adicionar mais um elemento à
 * zona sola" é UPDATE da linha existente, nunca um segundo INSERT, e `upsert` cego é
 * proibido, porque apagaria o mapeamento que um colega acabou de gravar.
 */
export interface ZonaParaGravar {
  zone_key: string;
  svg_selector: string;
  label: string | null;
  cor_default: string | null;
  /** Id da linha a atualizar, ou `null` quando é zona nova (INSERT). */
  idExistente: string | null;
}
