// Defeito achado na passada de navegador da Etapa 4, com a suíte inteira verde: marcar mais
// um ilhós numa zona já existente APAGAVA o `label` gravado.
//
// Como acontecia: o formulário volta vazio depois de salvar, e a tela mandava
// `label: null` para `marcarZona`. `null` ali significa "apague esta coluna" — semântica
// correta e documentada —, então o UPDATE limpava o rótulo que um colega tinha definido.
// Ninguém veria: a zona continua funcionando, só perde o nome legível.
//
// A distinção que conserta é entre "campo vazio porque não mexi" e "campo vazio porque quero
// apagar", e ela só existe quando a zona já existe.

import { describe, expect, it } from 'vitest';
import { preservarOuLimpar } from './EditorDeZonas';

describe('campo vazio numa zona que já existe', () => {
  it('preserva o que está gravado em vez de apagar', () => {
    // `undefined` é o que `marcarZona` lê como "não mexi nisso".
    expect(preservarOuLimpar('', true)).toBeUndefined();
    expect(preservarOuLimpar('   ', true)).toBeUndefined();
  });

  it('em zona nova, vazio é ausência mesmo — não há nada a preservar', () => {
    expect(preservarOuLimpar('', false)).toBeNull();
    expect(preservarOuLimpar('   ', false)).toBeNull();
  });

  it('texto digitado vale nos dois casos, sem espaço sobrando', () => {
    expect(preservarOuLimpar('  Ilhós  ', true)).toBe('Ilhós');
    expect(preservarOuLimpar('Ilhós', false)).toBe('Ilhós');
  });
});
