// Só hex é aceito como cor de variante (ADR-004, questão 3): nome CSS ("red") é
// ambíguo entre renderizadores, e o caminho futuro do setor (Pantone/RAL) converte
// para hex de qualquer forma.

import { ErroDeVariante } from './erros';

const HEX_CURTO = /^#[0-9a-fA-F]{3}$/;
const HEX_LONGO = /^#[0-9a-fA-F]{6}$/;

/**
 * Devolve a cor em `#RRGGBB` maiúsculo, ou lança `COR_INVALIDA`.
 * Aceita a forma curta (`#F00`) porque é inequívoca — expande para a longa.
 */
export function validarCor(valor: unknown, zoneKey: string): string {
  if (typeof valor !== 'string') {
    throw new ErroDeVariante(
      'COR_INVALIDA',
      `Cor da zona "${zoneKey}" precisa ser texto no formato #RRGGBB.`,
    );
  }

  const cor = valor.trim();

  if (HEX_LONGO.test(cor)) return cor.toUpperCase();

  if (HEX_CURTO.test(cor)) {
    const [, r, g, b] = cor;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  throw new ErroDeVariante(
    'COR_INVALIDA',
    `Cor "${cor}" da zona "${zoneKey}" não é um hex válido (esperado #RRGGBB).`,
  );
}
