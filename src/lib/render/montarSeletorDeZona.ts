// A ÚNICA fonte do formato de `product_zones.svg_selector` (ADR-005, decisão 2).
//
// Lista de ids exatos (`#zona-sola, #zona-sola-2`), nunca prefixo: `[id^="zona-sola"]`
// capturaria uma zona futura `zona-sola-lateral` e pintaria o lugar errado sem avisar,
// o CLAUDE.md proíbe exatamente esse modo de falha.
//
// Ninguém monta essa string à mão em outro arquivo. Se o formato mudar, muda aqui.

import { ErroDeVariante } from './erros';

const ID_SEGURO = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** Ids dos elementos marcados → o seletor que vai para o banco. Ordem preservada. */
export function montarSeletorDeZona(ids: string[]): string {
  const unicos = [...new Set(ids)];

  if (unicos.length === 0) {
    throw new ErroDeVariante(
      'ZONA_NAO_ENCONTRADA',
      'Uma zona precisa de pelo menos um elemento marcado.',
    );
  }

  for (const id of unicos) {
    if (!ID_SEGURO.test(id)) {
      // A normalização garante id seguro. Chegar aqui significa SVG que não passou por ela.
      throw new ErroDeVariante(
        'SVG_NAO_NORMALIZAVEL',
        `O id "${id}" não é endereçável por seletor. O SVG não passou pela normalização.`,
      );
    }
  }

  return unicos.map((id) => `#${id}`).join(', ');
}
