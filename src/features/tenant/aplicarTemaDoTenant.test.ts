// `tema` é jsonb livre editável pelo owner do tenant. Estes testes existem para garantir
// que dado ruim vindo do banco degrada para o token neutro, nunca derruba o app nem
// injeta CSS arbitrário.

import { describe, it, expect } from 'vitest';
import { lerTemaDoTenant } from './aplicarTemaDoTenant';

describe('lerTemaDoTenant', () => {
  it('traduz chave conhecida com cor hex válida', () => {
    expect(lerTemaDoTenant({ cor_primaria: '#C0392B' })).toEqual([['--cor-primaria', '#C0392B']]);
  });

  it('aceita hex de 3 dígitos e apara espaço', () => {
    expect(lerTemaDoTenant({ cor_texto: '  #f00 ' })).toEqual([['--cor-texto', '#f00']]);
  });

  it('devolve vazio para tema nulo, indefinido ou vazio', () => {
    expect(lerTemaDoTenant(null)).toEqual([]);
    expect(lerTemaDoTenant(undefined)).toEqual([]);
    expect(lerTemaDoTenant({})).toEqual([]);
  });

  it('ignora chave desconhecida em vez de virar token novo', () => {
    expect(lerTemaDoTenant({ cor_inventada: '#000000', '--injetado': '#000000' })).toEqual([]);
  });

  it('ignora valor que não é cor hex', () => {
    const tema = {
      cor_primaria: 'red',
      cor_borda: 'url(javascript:alert(1))',
      cor_texto: 42,
      cor_texto_suave: null,
    };

    expect(lerTemaDoTenant(tema)).toEqual([]);
  });

  it('mantém as chaves válidas mesmo quando outras são inválidas', () => {
    const tema = { cor_primaria: '#111111', cor_borda: 'nao-e-cor' };

    expect(lerTemaDoTenant(tema)).toEqual([['--cor-primaria', '#111111']]);
  });
});
