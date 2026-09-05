// `zone_key` é a chave pública da API: o cliente escreve `{"sola": "#C0392B"}`.
// Aceitar acento ou espaço aqui vira problema de encoding no cliente do outro lado.

import { describe, expect, it } from 'vitest';
import { sugerirZoneKey, validarZoneKey } from './validarZoneKey';

describe('validar zone_key', () => {
  it('aceita slug minúsculo com hífen', () => {
    expect(validarZoneKey('cadarco-lateral')).toBe('cadarco-lateral');
  });

  it('apara espaço nas pontas', () => {
    expect(validarZoneKey('  sola  ')).toBe('sola');
  });

  it.each([
    ['Cadarço', 'acento e maiúscula'],
    ['zona sola', 'espaço no meio'],
    ['2-sola', 'começa com número'],
    ['-sola', 'começa com hífen'],
    ['sola_lateral', 'underscore'],
    ['', 'vazia'],
    ['   ', 'só espaço'],
  ])('recusa %j (%s)', (chave) => {
    expect(() => validarZoneKey(chave)).toThrow(
      expect.objectContaining({ codigo: 'ZONE_KEY_INVALIDA' }),
    );
  });

  it('recusa o que nem string é', () => {
    for (const valor of [undefined, null, 42, { zone_key: 'sola' }]) {
      expect(() => validarZoneKey(valor)).toThrow(
        expect.objectContaining({ codigo: 'ZONE_KEY_INVALIDA' }),
      );
    }
  });

  it('recusa chave longa demais', () => {
    expect(() => validarZoneKey('a'.repeat(41))).toThrow(
      expect.objectContaining({ codigo: 'ZONE_KEY_INVALIDA' }),
    );
    expect(validarZoneKey('a'.repeat(40))).toHaveLength(40);
  });

  it('a mensagem diz o que corrigir, não só que está errado', () => {
    // Prevenção de erro > mensagem de erro; quando sobra a mensagem, ela precisa ser acionável.
    expect(() => validarZoneKey('Cadarço')).toThrow(/minúscula, sem acento e sem espaço/);
  });
});

describe('sugerir zone_key a partir do rótulo digitado', () => {
  it.each([
    ['Cadarço', 'cadarco'],
    ['Sola externa', 'sola-externa'],
    ['  Logo  Lateral ', 'logo-lateral'],
    ['Ilhós #3', 'ilhos-3'],
    ['2ª camada', 'camada'],
  ])('%j vira %j', (rotulo, esperado) => {
    expect(sugerirZoneKey(rotulo)).toBe(esperado);
    // A sugestão nunca pode sair inválida: o time confirmaria uma chave que o banco recusa.
    expect(validarZoneKey(sugerirZoneKey(rotulo))).toBe(esperado);
  });

  it('é sugestão, não conserto: validar continua recusando o rótulo cru', () => {
    // Quem confirma a chave é o time, porque ela vira contrato com o cliente da API.
    expect(() => validarZoneKey('Cadarço')).toThrow();
  });
});
