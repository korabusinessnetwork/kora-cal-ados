import { describe, expect, it } from 'vitest';

import { validarConfiguracaoDoFornecedor } from './validarConfiguracaoDoFornecedor';

const CHAVE = 'gsk_abcdefghijklmnop1234';

function motivos(entrada: unknown): string[] {
  const resultado = validarConfiguracaoDoFornecedor(entrada);
  return resultado.valida ? [] : resultado.motivos;
}

describe('validarConfiguracaoDoFornecedor, fornecedor da lista', () => {
  it('aceita fornecedor, modelo e chave, e zera preço e endereço mesmo se vierem', () => {
    const resultado = validarConfiguracaoDoFornecedor({
      fornecedor: 'groq',
      modelo: ' llama-3.3-70b-versatile ',
      chave: CHAVE,
      endereco: 'https://outro.exemplo.com',
      preco_entrada_por_milhao: 99,
    });

    expect(resultado).toEqual({
      valida: true,
      configuracao: {
        fornecedor: 'groq',
        modelo: 'llama-3.3-70b-versatile',
        chave: CHAVE,
        endereco: null,
        precoEntradaPorMilhao: 0,
        precoSaidaPorMilhao: 0,
        tetoMensalUsd: null,
      },
    });
  });

  it('sem chave é "manter a gravada", e não recusa', () => {
    const resultado = validarConfiguracaoDoFornecedor({ fornecedor: 'gemini', modelo: 'gemini-2.5-flash', chave: '' });
    expect(resultado.valida && resultado.configuracao.chave).toBeNull();
  });

  it('modelo com barra, dois-pontos e arroba passa, que é como OpenRouter e GitHub escrevem', () => {
    expect(motivos({ fornecedor: 'openrouter', modelo: 'meta-llama/llama-3.3-70b-instruct:free' })).toEqual([]);
  });

  it('teto mensal é aceito e arredondado em centavos', () => {
    const resultado = validarConfiguracaoDoFornecedor({ fornecedor: 'groq', modelo: 'x', teto_mensal_usd: 10.456 });
    expect(resultado.valida && resultado.configuracao.tetoMensalUsd).toBe(10.46);
  });
});

describe('validarConfiguracaoDoFornecedor, API própria', () => {
  it('exige endereço válido e os dois preços, e devolve o endereço normalizado', () => {
    const resultado = validarConfiguracaoDoFornecedor({
      fornecedor: 'api_propria',
      modelo: 'gpt-4.1-mini',
      chave: CHAVE,
      endereco: 'https://api.exemplo.com/v1/',
      preco_entrada_por_milhao: 0.4,
      preco_saida_por_milhao: 1.6,
      teto_mensal_usd: 20,
    });

    expect(resultado.valida && resultado.configuracao).toMatchObject({
      endereco: 'https://api.exemplo.com/v1',
      precoEntradaPorMilhao: 0.4,
      precoSaidaPorMilhao: 1.6,
      tetoMensalUsd: 20,
    });
  });

  it('junta todos os motivos, e não só o primeiro', () => {
    const lista = motivos({ fornecedor: 'api_propria', modelo: 'modelo com espaço', endereco: 'http://10.0.0.1' });

    expect(lista).toHaveLength(4);
    expect(lista.join(' ')).toMatch(/nome do modelo/);
    expect(lista.join(' ')).toMatch(/https/);
    expect(lista.join(' ')).toMatch(/preço de entrada/);
    expect(lista.join(' ')).toMatch(/preço de saída/);
  });

  it('preço negativo, acima do máximo ou em texto é recusado', () => {
    const base = { fornecedor: 'api_propria', modelo: 'm', endereco: 'https://api.exemplo.com' };
    expect(motivos({ ...base, preco_entrada_por_milhao: -1, preco_saida_por_milhao: 1 })).toHaveLength(1);
    expect(motivos({ ...base, preco_entrada_por_milhao: 1, preco_saida_por_milhao: 5000 })).toHaveLength(1);
    expect(motivos({ ...base, preco_entrada_por_milhao: '1', preco_saida_por_milhao: 1 })).toHaveLength(1);
  });
});

describe('validarConfiguracaoDoFornecedor, entrada não confiável', () => {
  it('recusa o que não é objeto', () => {
    expect(motivos(null)).toEqual(['Envie a configuração como um objeto JSON.']);
    expect(motivos([])).toEqual(['Envie a configuração como um objeto JSON.']);
    expect(motivos('groq')).toEqual(['Envie a configuração como um objeto JSON.']);
  });

  it('recusa fornecedor fora da lista, chave curta ou com espaço, e teto zero', () => {
    expect(motivos({ fornecedor: 'pollinations', modelo: 'm' })).toEqual(['Escolha um fornecedor da lista.']);
    expect(motivos({ fornecedor: 'groq', modelo: 'm', chave: 'curta' })).toHaveLength(1);
    expect(motivos({ fornecedor: 'groq', modelo: 'm', chave: 'gsk_abc defghijklmnop123' })).toHaveLength(1);
    expect(motivos({ fornecedor: 'groq', modelo: 'm', chave: 12345678901234567 })).toHaveLength(1);
    expect(motivos({ fornecedor: 'groq', modelo: 'm', teto_mensal_usd: 0 })).toHaveLength(1);
  });
});
