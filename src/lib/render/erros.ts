// Códigos de erro do motor de render. São contrato de API (entram no envelope de
// resposta, ver memory/patterns.md) — mudar um código quebra cliente, então não muda.

export type CodigoDeErro =
  | 'ZONA_NAO_ENCONTRADA'
  | 'COR_INVALIDA'
  | 'ZONA_NAO_RECOLORIVEL'
  | 'SVG_INVALIDO'
  | 'SVG_NAO_NORMALIZAVEL'
  | 'ZONAS_SOBREPOSTAS'
  | 'ZONE_KEY_INVALIDA';

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
