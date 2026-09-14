// O que este arquivo prova: que a tabela `tenant_api_keys` guarda a credencial comercial
// das marcas sem que nem o dono dela consiga ler o hash, sem que ninguém consiga apagar
// uma linha, e sem que uma marca alcance a chave da concorrente.
//
// Nada disto é verificável com cliente falso. As três regras são do POSTGRES, duas são
// privilégio de coluna e uma é ausência de policy, e privilégio não existe em mock: um
// teste unitário com cliente falso passaria igual num banco onde o `revoke` nunca rodou.
// Por isso este arquivo só roda contra um projeto Supabase real e, sem ambiente, PULA em
// vez de passar em falso.
//
// A migration que ele confere é `20260908_chave_de_api_por_tenant.sql`.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  admin,
  anonimo,
  limpar,
  montarCenario,
  semearChavesDaApi,
  temAmbiente,
  type Cenario,
  type ChavesDoCenario,
} from './ambiente';

/** As colunas que um owner PODE ler. `hash` está fora, e é o ponto do arquivo. */
const CAMPOS_PERMITIDOS = 'id, tenant_id, prefixo, label, created_by, created_at, revoked_at';

describe.skipIf(!temAmbiente)('tenant_api_keys, isolamento e privilégio de coluna', () => {
  let cenario: Cenario;
  let chaves: ChavesDoCenario;

  beforeAll(async () => {
    cenario = await montarCenario();
    chaves = await semearChavesDaApi(cenario);
  }, 60_000);

  afterAll(async () => {
    // As chaves somem junto com os tenants: `tenant_id` é `on delete cascade`.
    if (cenario) await limpar(cenario);
  }, 60_000);

  describe('o hash não sai do banco', () => {
    it('o owner lê as próprias chaves pelos campos permitidos', async () => {
      const { data, error } = await cenario.clienteA
        .from('tenant_api_keys')
        .select(CAMPOS_PERMITIDOS);

      expect(error).toBeNull();
      expect(data?.map((linha) => linha['prefixo']).sort()).toEqual(
        [chaves.ativaDeA.prefixo, chaves.revogadaDeA.prefixo].sort(),
      );
    });

    it('e falha ao pedir o hash, mesmo sendo dono da linha', async () => {
      // Esta é a regra que policy nenhuma implementaria: RLS filtra LINHA, não COLUNA.
      // Sem o privilégio de coluna, o owner leria o hash de todas as chaves do próprio
      // tenant pelo PostgREST, e hash vazado é ataque offline contra a credencial que
      // atende o cliente.
      const { data, error } = await cenario.clienteA.from('tenant_api_keys').select('prefixo, hash');

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it('e `select *` falha pelo mesmo motivo, o que é desejado', async () => {
      // Consequência aceita de propósito: o CLAUDE.md já proíbe `select *` em tabela
      // sensível, então esta tabela apenas passa a cobrar a regra em vez de confiar nela.
      const { data, error } = await cenario.clienteA.from('tenant_api_keys').select('*');

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe('quem enxerga a chave', () => {
    it('membro do tenant não vê chave nenhuma, só owner', async () => {
      // ADR-006 D4: a chave é a credencial comercial da marca, e quem responde por ela é
      // quem responde pelo contrato. Aqui não há erro, há conjunto vazio: a policy filtra
      // linha, e para o membro nenhuma linha passa.
      const { data, error } = await cenario.clienteMembroA
        .from('tenant_api_keys')
        .select(CAMPOS_PERMITIDOS);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('o owner da marca concorrente não alcança a chave alheia', async () => {
      const { data, error } = await cenario.clienteB
        .from('tenant_api_keys')
        .select(CAMPOS_PERMITIDOS);

      expect(error).toBeNull();
      // Vê a própria, e só a própria. Este é o requisito comercial inteiro numa linha.
      expect(data?.map((linha) => linha['prefixo'])).toEqual([chaves.ativaDeB.prefixo]);
    });

    it('quem não fez login não vê nada', async () => {
      const { data } = await anonimo().from('tenant_api_keys').select(CAMPOS_PERMITIDOS);

      expect(data ?? []).toEqual([]);
    });
  });

  describe('revogar é a única escrita, e apagar não existe', () => {
    it('o owner preenche `revoked_at` da própria chave', async () => {
      const quando = new Date().toISOString();
      const { error } = await cenario.clienteA
        .from('tenant_api_keys')
        .update({ revoked_at: quando })
        .eq('id', chaves.ativaDeA.id);

      expect(error).toBeNull();

      const conferencia = await admin()
        .from('tenant_api_keys')
        .select('revoked_at')
        .eq('id', chaves.ativaDeA.id)
        .single();

      expect(conferencia.data?.['revoked_at']).not.toBeNull();
    });

    it.each([
      ['label', { label: 'sequestrada' }],
      ['hash', { hash: 'a'.repeat(64) }],
      ['tenant_id', { tenant_id: '00000000-0000-0000-0000-000000000000' }],
      ['prefixo', { prefixo: 'deadbeef' }],
    ])('e não consegue escrever em `%s`', async (_coluna, alteracao) => {
      // Trocar o `hash` seria substituir o segredo de uma chave viva; trocar o `tenant_id`
      // seria empurrar a credencial para outra marca. Nenhuma das duas é barrada por
      // policy, as duas são barradas por não haver privilégio de coluna.
      const { error } = await cenario.clienteA
        .from('tenant_api_keys')
        .update(alteracao)
        .eq('id', chaves.revogadaDeA.id);

      expect(error).not.toBeNull();
    });

    it('e não consegue apagar a linha, nem sendo owner', async () => {
      // ADR-006 D4: chave apagada leva embora a resposta para "quem estava usando isto
      // quando aconteceu". Há DUAS travas somadas, `authenticated` não tem o privilégio
      // de delete, e não existe policy que o permitisse se tivesse. Por isso o esperado
      // aqui é ERRO, e não "zero linhas": a primeira trava responde antes da segunda.
      const { error } = await cenario.clienteA
        .from('tenant_api_keys')
        .delete()
        .eq('id', chaves.revogadaDeA.id);

      expect(error).not.toBeNull();

      // E a contraprova que importa: a linha continua lá.
      const sobreviveu = await admin()
        .from('tenant_api_keys')
        .select('id')
        .eq('id', chaves.revogadaDeA.id)
        .maybeSingle();

      expect(sobreviveu.data?.['id']).toBe(chaves.revogadaDeA.id);
    });
  });
});
