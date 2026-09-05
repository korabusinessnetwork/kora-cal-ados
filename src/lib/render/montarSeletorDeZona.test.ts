// Fonte única do formato de `svg_selector`. Se este teste mudar, todo seletor já gravado
// no banco muda de significado — é por isso que ele existe.

import { describe, expect, it } from 'vitest';
import { ErroDeVariante } from './erros';
import { montarSeletorDeZona } from './montarSeletorDeZona';

describe('montar seletor de zona', () => {
  it('um elemento vira "#id"', () => {
    expect(montarSeletorDeZona(['zona-sola'])).toBe('#zona-sola');
  });

  it('vários elementos viram lista separada por vírgula, na ordem marcada', () => {
    expect(montarSeletorDeZona(['ilhos-1', 'ilhos-2', 'ilhos-3'])).toBe(
      '#ilhos-1, #ilhos-2, #ilhos-3',
    );
  });

  it('NUNCA monta prefixo — id exato, sempre', () => {
    // `[id^="ilhos"]` capturaria uma zona futura `ilhos-lateral` e pintaria o lugar
    // errado em silêncio (ADR-005, decisão 2).
    const seletor = montarSeletorDeZona(['ilhos', 'ilhos-2']);

    expect(seletor).not.toContain('^=');
    expect(seletor).toBe('#ilhos, #ilhos-2');
  });

  it('id repetido no clique não duplica o seletor', () => {
    expect(montarSeletorDeZona(['painel', 'painel'])).toBe('#painel');
  });

  it('zona sem elemento é recusada', () => {
    expect(() => montarSeletorDeZona([])).toThrow(
      expect.objectContaining({ codigo: 'ZONA_NAO_ENCONTRADA' }),
    );
  });

  it('id que quebra o seletor é recusado, não escapado', () => {
    // Chegar aqui significa SVG que não passou pela normalização: o problema é o arquivo,
    // e escapar mascararia isso gravando um seletor frágil no banco.
    expect(() => montarSeletorDeZona(['zona.sola'])).toThrow(ErroDeVariante);
    expect(() => montarSeletorDeZona(['zona sola'])).toThrow(
      expect.objectContaining({ codigo: 'SVG_NAO_NORMALIZAVEL' }),
    );
  });
});
