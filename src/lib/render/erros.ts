// Códigos de erro do motor de render. São contrato de API (entram no envelope de
// resposta, ver memory/patterns.md) — mudar um código quebra cliente, então não muda.

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
  | 'MODELO_3D_NAO_NORMALIZAVEL';

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
