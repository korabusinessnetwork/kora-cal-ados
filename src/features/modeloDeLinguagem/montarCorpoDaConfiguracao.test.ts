import { describe, expect, it } from 'vitest';

import { montarCorpoDaConfiguracao, type CamposDoFormulario } from './montarCorpoDaConfiguracao';

const CHAVE = 'gsk_uma-chave-de-teste-longa';

const campos = (extras: Partial<CamposDoFormulario> = {}): CamposDoFormulario => ({
  fornecedor: 'groq',
  modelo: 'llama-3.3-70b-versatile',
  chave: CHAVE,
  endereco: '',
  precoEntrada: '',
  precoSaida: '',
  teto: '',
  ...extras,
});

describe('montarCorpoDaConfiguracao', () => {
  it('fornecedor da lista vira corpo sem endereço e sem preço, mesmo com os campos preenchidos', () => {
    // Os campos da API própria podem ter ficado preenchidos de antes da troca de fornecedor. Mandá-los
    // faria o servidor gravar preço num fornecedor grátis.
    const montado = montarCorpoDaConfiguracao(
      campos({ endereco: 'https://api.exemplo.com/v1', precoEntrada: '3', precoSaida: '9' }),
      false,
    );

    expect(montado).toEqual({
      valido: true,
      corpo: {
        fornecedor: 'groq',
        modelo: 'llama-3.3-70b-versatile',
        chave: CHAVE,
        endereco: null,
        preco_entrada_por_milhao: null,
        preco_saida_por_milhao: null,
        teto_mensal_usd: null,
      },
    });
  });

  it('API própria aceita preço com vírgula', () => {
    const montado = montarCorpoDaConfiguracao(
      campos({ fornecedor: 'api_propria', modelo: 'gpt-4.1-mini', endereco: 'https://api.exemplo.com/v1', precoEntrada: '0,40', precoSaida: '1.6', teto: '25,5' }),
      false,
    );

    expect(montado.valido && montado.corpo).toMatchObject({
      endereco: 'https://api.exemplo.com/v1',
      preco_entrada_por_milhao: 0.4,
      preco_saida_por_milhao: 1.6,
      teto_mensal_usd: 25.5,
    });
  });

  it('chave vazia sem chave gravada é recusada antes do clique chegar ao servidor', () => {
    const montado = montarCorpoDaConfiguracao(campos({ chave: '   ' }), false);

    expect(montado.valido).toBe(false);
    expect(!montado.valido && montado.motivos).toContain('Cole a chave que você criou no site do fornecedor.');
  });

  it('chave vazia COM chave gravada significa manter a gravada', () => {
    const montado = montarCorpoDaConfiguracao(campos({ chave: '' }), true);

    expect(montado.valido && montado.corpo.chave).toBeNull();
  });

  it('teto digitado errado não vira "sem teto" em silêncio', () => {
    const montado = montarCorpoDaConfiguracao(campos({ teto: 'vinte' }), false);

    expect(montado.valido).toBe(false);
    expect(!montado.valido && montado.motivos.join(' ')).toMatch(/teto mensal/);
  });

  it('usa a MESMA regra do servidor: endereço interno e preço faltando voltam juntos', () => {
    const montado = montarCorpoDaConfiguracao(
      campos({ fornecedor: 'api_propria', endereco: 'http://localhost:8080/v1', precoEntrada: '', precoSaida: '' }),
      true,
    );

    expect(montado.valido).toBe(false);
    const motivos = !montado.valido ? montado.motivos.join(' ') : '';
    expect(motivos).toMatch(/https/);
    expect(motivos).toMatch(/preço de entrada/);
    expect(motivos).toMatch(/preço de saída/);
  });
});
