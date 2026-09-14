import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { registrarUsoDoModeloDeLinguagem, type UsoAGravar } from './registrarUsoDoModeloDeLinguagem';

const USO: UsoAGravar = {
  tenantId: 'tenant-1',
  usuarioId: 'usuario-1',
  fornecedor: 'groq',
  modelo: 'llama-3.3-70b-versatile',
  origem: 'geracao',
  sucesso: true,
  tokensDeEntrada: 1200,
  tokensDeSaida: 300,
  custoEstimadoUsd: 0.00036,
};

function bancoFalso(erro: { message: string } | null = null) {
  const inseridas: Record<string, unknown>[] = [];
  const cliente = {
    from(tabela: string) {
      return {
        insert(linha: Record<string, unknown>) {
          inseridas.push({ ...linha, __tabela: tabela });
          return Promise.resolve({ error: erro });
        },
      };
    },
  };
  return { cliente: cliente as unknown as SupabaseClient, inseridas };
}

describe('registrarUsoDoModeloDeLinguagem', () => {
  it('grava a linha com as colunas do banco, e é aguardada (não é fire-and-forget)', async () => {
    const { cliente, inseridas } = bancoFalso();

    const retorno = registrarUsoDoModeloDeLinguagem(cliente, USO);
    // Aguardada de propósito, ao contrário de `registrarUsoDaChave`: é esta linha que os três
    // limites contam. Perdida, o teto de gasto para de enxergar a chamada que acabou de sair.
    expect(retorno).toBeInstanceOf(Promise);
    await retorno;

    expect(inseridas[0]).toEqual({
      __tabela: 'uso_do_modelo_de_linguagem',
      tenant_id: 'tenant-1',
      usuario_id: 'usuario-1',
      fornecedor: 'groq',
      modelo: 'llama-3.3-70b-versatile',
      origem: 'geracao',
      sucesso: true,
      codigo_de_erro: null,
      tokens_de_entrada: 1200,
      tokens_de_saida: 300,
      custo_estimado_usd: 0.00036,
    });
  });

  it('não grava prompt nem resposta, que são conteúdo da marca', async () => {
    const { cliente, inseridas } = bancoFalso();
    await registrarUsoDoModeloDeLinguagem(cliente, USO);

    const colunas = Object.keys(inseridas[0] ?? {});
    expect(colunas).not.toContain('prompt');
    expect(colunas).not.toContain('resposta');
  });

  it('a falha registra o código nosso, nunca a mensagem do fornecedor', async () => {
    const { cliente, inseridas } = bancoFalso();
    await registrarUsoDoModeloDeLinguagem(cliente, {
      ...USO,
      sucesso: false,
      codigoDeErro: 'FORNECEDOR_NO_LIMITE',
      tokensDeEntrada: 0,
      tokensDeSaida: 0,
      custoEstimadoUsd: 0,
    });

    expect(inseridas[0]?.codigo_de_erro).toBe('FORNECEDOR_NO_LIMITE');
    expect(inseridas[0]?.sucesso).toBe(false);
  });

  it('erro do banco avisa alto e não derruba a geração que já aconteceu', async () => {
    const { cliente } = bancoFalso({ message: 'connection reset' });
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(registrarUsoDoModeloDeLinguagem(cliente, USO)).resolves.toBeUndefined();

    expect(avisos).toHaveBeenCalledWith(expect.stringContaining('Falha ao registrar o uso'));
    avisos.mockRestore();
  });
});
