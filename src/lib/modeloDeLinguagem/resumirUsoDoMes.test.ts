import { describe, expect, it } from 'vitest';

import { QUANTIDADE_DE_RECENTES, ehMesValido, limitesDoMes, mesEmUtc, resumirUsoDoMes } from './resumirUsoDoMes';
import type { ChamadaRecente } from './tiposDoModeloDeLinguagem';

function chamada(parcial: Partial<ChamadaRecente>): ChamadaRecente {
  return {
    created_at: '2026-09-10T12:00:00.000Z',
    fornecedor: 'groq',
    modelo: 'llama-3.3-70b-versatile',
    origem: 'geracao',
    sucesso: true,
    tokens_de_entrada: 100,
    tokens_de_saida: 50,
    custo_estimado_usd: 0,
    ...parcial,
  };
}

describe('resumirUsoDoMes', () => {
  it('mês sem chamada é tudo zero, com as listas vazias', () => {
    expect(resumirUsoDoMes('2026-09', [], null)).toEqual({
      mes: '2026-09',
      totais: { chamadas: 0, falhas: 0, tokens_de_entrada: 0, tokens_de_saida: 0, custo_estimado_usd: 0 },
      teto_mensal_usd: null,
      por_modelo: [],
      por_dia: [],
      recentes: [],
    });
  });

  it('soma totais, conta falhas, agrupa por modelo e por dia, e arredonda a soma do custo', () => {
    const resumo = resumirUsoDoMes(
      '2026-09',
      [
        chamada({ fornecedor: 'api_propria', modelo: 'gpt', custo_estimado_usd: 0.1, created_at: '2026-09-02T10:00:00.000Z' }),
        chamada({ fornecedor: 'api_propria', modelo: 'gpt', custo_estimado_usd: 0.2, created_at: '2026-09-02T23:59:00.000Z' }),
        chamada({ sucesso: false, tokens_de_entrada: 0, tokens_de_saida: 0, created_at: '2026-09-01T08:00:00.000Z' }),
      ],
      5,
    );

    expect(resumo.totais).toEqual({ chamadas: 3, falhas: 1, tokens_de_entrada: 200, tokens_de_saida: 100, custo_estimado_usd: 0.3 });
    expect(resumo.teto_mensal_usd).toBe(5);
    // Quem gastou mais vem primeiro.
    expect(resumo.por_modelo.map(({ modelo, chamadas, custo_estimado_usd }) => [modelo, chamadas, custo_estimado_usd])).toEqual([
      ['gpt', 2, 0.3],
      ['llama-3.3-70b-versatile', 1, 0],
    ]);
    // Dia em ordem de calendário.
    expect(resumo.por_dia.map(({ dia, chamadas }) => [dia, chamadas])).toEqual([
      ['2026-09-01', 1],
      ['2026-09-02', 2],
    ]);
  });

  it('mesmo nome de modelo em fornecedores diferentes são linhas diferentes', () => {
    const resumo = resumirUsoDoMes('2026-09', [chamada({ fornecedor: 'groq' }), chamada({ fornecedor: 'openrouter' })], null);
    expect(resumo.por_modelo).toHaveLength(2);
  });

  it('custo que chega como texto do banco entra na soma', () => {
    const resumo = resumirUsoDoMes('2026-09', [chamada({ custo_estimado_usd: '0.5' as unknown as number })], null);
    expect(resumo.totais.custo_estimado_usd).toBe(0.5);
  });

  it('as recentes vêm da mais nova para a mais velha, cortadas no máximo', () => {
    const muitas = Array.from({ length: QUANTIDADE_DE_RECENTES + 5 }, (_, i) =>
      chamada({ created_at: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString() }),
    );
    const resumo = resumirUsoDoMes('2026-09', muitas, null);

    expect(resumo.recentes).toHaveLength(QUANTIDADE_DE_RECENTES);
    expect(resumo.recentes[0]?.created_at).toBe(new Date(Date.UTC(2026, 8, 1, 0, QUANTIDADE_DE_RECENTES + 4)).toISOString());
  });
});

describe('o corte do mês, em UTC', () => {
  it('mesEmUtc usa UTC, e não o fuso da máquina', () => {
    expect(mesEmUtc(new Date('2026-09-30T23:30:00-03:00'))).toBe('2026-10');
  });

  it('limitesDoMes vai do primeiro instante do mês ao do mês seguinte, virando o ano', () => {
    expect(limitesDoMes('2026-12')).toEqual({ inicio: '2026-12-01T00:00:00.000Z', fim: '2027-01-01T00:00:00.000Z' });
  });

  it('ehMesValido recusa o que não é AAAA-MM plausível', () => {
    expect(ehMesValido('2026-09')).toBe(true);
    for (const texto of ['2026-13', '2026-9', '1999-01', "2026-09' or 1=1", '', null]) {
      expect(ehMesValido(texto), String(texto)).toBe(false);
    }
  });
});
