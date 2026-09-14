// O que este arquivo prova: que as duas tabelas da D13, a configuração do fornecedor de modelo de
// linguagem (com a chave do fornecedor cifrada) e o uso do modelo de linguagem (gasto da marca),
// não têm caminho nenhum a partir do navegador. Nem o owner da própria marca lê ou grava.
//
// Mesmo motivo de `chaveDeApi.test.ts` para rodar contra banco de verdade: a regra é ausência de
// policy mais `revoke`, e privilégio não existe em cliente falso. Sem ambiente, PULA.
//
// A migration que ele confere é `20260914_modelo_de_linguagem_por_tenant.sql`.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anonimo, limpar, montarCenario, temAmbiente, type Cenario } from './ambiente';

const CAMPOS_DA_CONFIGURACAO = 'tenant_id, fornecedor, modelo, final_da_chave, teto_mensal_usd';
const CAMPOS_DO_USO = 'id, tenant_id, fornecedor, modelo, origem, sucesso, custo_estimado_usd';

describe.skipIf(!temAmbiente)('modelo de linguagem por tenant, sem caminho do navegador', () => {
  let cenario: Cenario;

  beforeAll(async () => {
    cenario = await montarCenario();
    const banco = admin();

    // A chave "cifrada" daqui é texto qualquer: o que se confere é quem alcança a coluna, e não a
    // cifra, que tem os testes dela em `api/_lib/`.
    const configuracao = await banco.from('tenant_modelos_de_linguagem').insert({
      tenant_id: cenario.tenantA,
      fornecedor: 'groq',
      modelo: 'llama-3.3-70b-versatile',
      chave_cifrada: 'v1:cifra-de-teste',
      final_da_chave: '1234',
      teto_mensal_usd: 10,
    });
    if (configuracao.error) throw configuracao.error;

    const uso = await banco.from('uso_do_modelo_de_linguagem').insert({
      tenant_id: cenario.tenantA,
      fornecedor: 'groq',
      modelo: 'llama-3.3-70b-versatile',
      origem: 'teste',
      sucesso: true,
    });
    if (uso.error) throw uso.error;
  }, 60_000);

  afterAll(async () => {
    // As duas tabelas somem junto com os tenants: `tenant_id` é `on delete cascade`.
    if (cenario) await limpar(cenario);
  }, 60_000);

  it('o service_role, que é o que a função usa, lê as duas', async () => {
    const banco = admin();
    const configuracao = await banco.from('tenant_modelos_de_linguagem').select(CAMPOS_DA_CONFIGURACAO).eq('tenant_id', cenario.tenantA);
    const uso = await banco.from('uso_do_modelo_de_linguagem').select(CAMPOS_DO_USO).eq('tenant_id', cenario.tenantA);

    // Sem esta, as recusas abaixo passariam também num banco onde a linha nem foi gravada.
    expect(configuracao.error).toBeNull();
    expect(configuracao.data).toHaveLength(1);
    expect(uso.error).toBeNull();
    expect(uso.data).toHaveLength(1);
  });

  describe.each([
    ['o owner da própria marca', () => cenario.clienteA],
    ['o membro da própria marca', () => cenario.clienteMembroA],
    ['o owner da concorrente', () => cenario.clienteB],
    ['o anônimo', () => anonimo()],
  ])('%s', (_quem, cliente) => {
    it('não lê a configuração, nem a chave cifrada', async () => {
      // Erro, e não lista vazia: é o `revoke`. Lista vazia seria só a RLS, e pareceria "nada
      // configurado" para quem estivesse depurando.
      const { data, error } = await cliente().from('tenant_modelos_de_linguagem').select('tenant_id, chave_cifrada');

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it('não lê o uso do mês', async () => {
      const { data, error } = await cliente().from('uso_do_modelo_de_linguagem').select(CAMPOS_DO_USO);

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it('não grava configuração', async () => {
      const { error } = await cliente().from('tenant_modelos_de_linguagem').upsert({
        tenant_id: cenario.tenantA,
        fornecedor: 'groq',
        modelo: 'outro',
        chave_cifrada: 'v1:trocada',
        final_da_chave: '9999',
      });

      expect(error).not.toBeNull();
      const { data } = await admin().from('tenant_modelos_de_linguagem').select('final_da_chave').eq('tenant_id', cenario.tenantA).single();
      expect(data?.final_da_chave).toBe('1234');
    });

    it('não apaga o gasto', async () => {
      await cliente().from('uso_do_modelo_de_linguagem').delete().eq('tenant_id', cenario.tenantA);

      const { data } = await admin().from('uso_do_modelo_de_linguagem').select('id').eq('tenant_id', cenario.tenantA);
      expect(data).toHaveLength(1);
    });
  });
});
