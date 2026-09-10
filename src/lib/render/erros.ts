// Códigos de erro do motor de domínio. São contrato de API (entram no envelope de
// resposta, ver memory/patterns.md).
//
// A promessa deste arquivo é sobre **mudar**, não sobre crescer: renomear ou reaproveitar um
// código quebra o cliente que compara com a string, então isso não acontece. Acrescentar um
// código não quebra ninguém, e acontece sempre que aparece um conserto que os existentes não
// ensinam — foi assim com os dois de modelo 3D (ADR-007) e com os quatro de composição
// (ADR-008). O que segura o acréscimo de virar 500 surpresa é o `Record<CodigoDeErro, ...>`
// de `api/_lib/traduzirParaFalhaDaApi.ts`: código sem status é erro de compilação.
//
// "Render" saiu do nome porque deixou de ser verdade: composição não desenha nada, e ainda
// assim recusa pelo mesmo motivo e pela mesma classe de erro.

export type CodigoDeErro =
  | 'ZONA_NAO_ENCONTRADA'
  | 'COR_INVALIDA'
  | 'ZONA_NAO_RECOLORIVEL'
  | 'SVG_INVALIDO'
  | 'SVG_NAO_NORMALIZAVEL'
  | 'ZONAS_SOBREPOSTAS'
  | 'ZONE_KEY_INVALIDA'
  // Os gêmeos tridimensionais de SVG_INVALIDO / SVG_NAO_NORMALIZAVEL (ADR-007). Códigos
  // próprios e não reuso dos de SVG: a mensagem de um e de outro ensina coisas diferentes
  // ("exporte com Presentation Attributes" x "exporte sem Draco"), e um integrador que
  // recebesse SVG_INVALIDO para um glTF procuraria o defeito no arquivo errado.
  | 'MODELO_3D_INVALIDO'
  | 'MODELO_3D_NAO_NORMALIZAVEL'
  // Os quatro da composição (ADR-008). Quatro e não um genérico pela mesma razão que fez
  // MODELO_3D_INVALIDO não reusar SVG_INVALIDO: cada um ensina um conserto diferente, e um
  // código único obrigaria quem integra a ler a mensagem para saber o que fazer.
  //
  // PECA_NAO_ENCONTRADA é o código do ADR-008 D1, e o mais importante dos quatro: é ele que
  // separa "a saída do modelo de linguagem vira escolha de arquivo" de uma vulnerabilidade.
  // O modelo NUNCA inventa peça — id fora do catálogo é recusa, nunca um calçado com um
  // buraco no lugar da sola.
  | 'PECA_NAO_ENCONTRADA'
  | 'COMPOSICAO_INVALIDA'
  // Separado de COMPOSICAO_INVALIDA porque o conserto é outro: a peça existe e o id está
  // certo, o que não bate é o encaixe (ADR-008 D4). "Escolha peças da mesma forma" e
  // "corrija o id" mandam procurar em lugares diferentes.
  | 'FORMAS_MISTURADAS'
  | 'PARAMETRO_INVALIDO';

/**
 * Erro de qualquer etapa do motor. Existe para que "a zona não foi aplicada" seja
 * sempre uma falha explícita, nunca um aviso no log — princípio nº1 do CLAUDE.md:
 * a cor que sai daqui vira calçado fabricado.
 */
export class ErroDeVariante extends Error {
  readonly codigo: CodigoDeErro;

  constructor(codigo: CodigoDeErro, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeVariante';
    this.codigo = codigo;
  }
}
