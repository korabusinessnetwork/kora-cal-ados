import { describe, expect, it } from 'vitest';

import {
  FORNECEDORES_DE_MODELO_DE_LINGUAGEM,
  ehApiPropria,
  fornecedorPorId,
} from './fornecedoresDeModeloDeLinguagem';
import { validarEnderecoDaApiPropria } from './validarEnderecoDaApiPropria';

describe('a lista de fornecedores', () => {
  it('tem ids únicos, e a API própria é a única sem endereço e sem link', () => {
    const ids = FORNECEDORES_DE_MODELO_DE_LINGUAGEM.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);

    const semEndereco = FORNECEDORES_DE_MODELO_DE_LINGUAGEM.filter(({ enderecoBase }) => enderecoBase === null);
    expect(semEndereco.map(({ id }) => id)).toEqual(['api_propria']);
    expect(FORNECEDORES_DE_MODELO_DE_LINGUAGEM.filter(({ linkDaChave }) => linkDaChave === null).map(({ id }) => id)).toEqual([
      'api_propria',
    ]);
  });

  it('todo endereço fixo passaria na mesma guarda que a API própria, e já está normalizado', () => {
    // Se um endereço da lista não passasse, a lista seria um jeito de contornar a guarda.
    for (const { enderecoBase } of FORNECEDORES_DE_MODELO_DE_LINGUAGEM) {
      if (enderecoBase === null) continue;
      expect(validarEnderecoDaApiPropria(enderecoBase)).toEqual({ valido: true, endereco: enderecoBase });
    }
  });

  it('todo fornecedor da lista tem link https para criar a chave, modelo sugerido e o plano grátis dito', () => {
    for (const fornecedor of FORNECEDORES_DE_MODELO_DE_LINGUAGEM) {
      if (ehApiPropria(fornecedor.id)) continue;
      expect(fornecedor.linkDaChave).toMatch(/^https:\/\//);
      expect(fornecedor.modelosSugeridos.length).toBeGreaterThan(0);
      expect(fornecedor.planoGratis).toBeTruthy();
    }
  });

  it('tem ao menos seis fornecedores grátis, que é o que o pedido de "várias APIs grátis" pede', () => {
    expect(FORNECEDORES_DE_MODELO_DE_LINGUAGEM.filter(({ id }) => !ehApiPropria(id)).length).toBeGreaterThanOrEqual(6);
  });

  it('fornecedorPorId recusa o que não está na lista, inclusive nome de propriedade do objeto', () => {
    expect(fornecedorPorId('groq')?.nome).toBe('Groq');
    expect(fornecedorPorId('pollinations')).toBeUndefined();
    expect(fornecedorPorId('constructor')).toBeUndefined();
    expect(fornecedorPorId('__proto__')).toBeUndefined();
    expect(fornecedorPorId(42)).toBeUndefined();
  });
});
