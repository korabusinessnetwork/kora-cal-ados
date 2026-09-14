-- Kora Calçados, chave de API por tenant (tabela `tenant_api_keys`)
-- Responde ao ADR-006 (docs/08_DECISOES/adr-006-autenticacao-da-api-de-variante.md):
--   D1, a credencial é do TENANT; o banco guarda só `prefixo` em claro + `hash` do segredo
--   D2, o hash é SHA-256 (a chave tem 32 bytes aleatórios; não há dicionário a atacar)
--   D4, revogar é preencher `revoked_at`, nunca apagar a linha; só owner cria e revoga
-- O formato da chave vive num lugar só: api/_lib/formatoDaChaveDeApi.ts.
--
-- ⚠️ ESTE SQL AINDA NÃO FOI EXECUTADO em nenhum banco, nem local (não há Postgres local,
--    sem Docker) nem no projeto Supabase real. Nada aqui está provado contra um servidor:
--    o que fecha esta migration é rodar as consultas de conferência do fim do arquivo
--    depois de aplicá-la.

-- ── 1. Tabela ───────────────────────────────────────────────────────────
-- `prefixo` é a metade pública da chave: a autenticação da API recebe
-- kora_<ambiente>_<prefixo>_<segredo>, procura a linha PELO PREFIXO e só então compara o
-- hash em tempo constante. É por isso que ele é `unique`, dois tenants com o mesmo
-- prefixo tornariam ambígua justamente a busca que decide o isolamento, e o `unique` já
-- cria o índice que essa busca usa a cada chamada da API.
--
-- `hash` guarda o SHA-256 do segredo, nunca a chave. Vazamento do dump não vira acesso.
-- `created_by` é `on delete set null` de propósito: o funcionário que criou a chave pode
-- sair da empresa sem derrubar a integração do cliente (ADR-006, Contexto).
create table tenant_api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  prefixo text not null unique,
  hash text not null,
  label text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- Padrão das demais tabelas do schema: toda tabela com `tenant_id` tem índice nele,
-- porque toda policy filtra por ele.
create index tenant_api_keys_tenant_id_idx on tenant_api_keys(tenant_id);

alter table tenant_api_keys enable row level security;

-- ── 2. Privilégios de coluna, o `hash` não pode sair daqui ─────────────
-- RLS filtra LINHA, não COLUNA. Só com policy, um owner logado leria o hash de todas as
-- chaves do próprio tenant com um `select *` pelo PostgREST, e hash vazado é ataque
-- offline contra a credencial que atende o cliente. O que impede isso é privilégio de
-- coluna, não policy.
--
-- A ORDEM ABAIXO IMPORTA. O Supabase mantém `alter default privileges` no schema public
-- concedendo tudo a `anon` e `authenticated`, então esta tabela JÁ NASCE com select,
-- insert, update e delete no nível de TABELA para esses papéis. E privilégio de tabela
-- não é reduzido por grant de coluna: quem tem select na tabela lê qualquer coluna dela,
-- inclusive as que ficarem de fora de um `grant select (...)` posterior. Por isso é
-- preciso REVOGAR primeiro e só depois conceder as colunas permitidas.
--
-- `service_role` fica de fora do revoke de propósito: é ele quem insere a chave pelo
-- script de criação (mesmo caminho de `tenants`, provisionado por script na Fase 1) e
-- quem grava `last_used_at` fire-and-forget durante a chamada da API.
revoke all on table tenant_api_keys from anon, authenticated, public;

-- Consequência desejada, e que precisa estar escrita: `select *` nesta tabela passa a
-- responder "permission denied" para `authenticated`. O front lê por lista explícita de
-- campos, o que o CLAUDE.md já exige de toda tabela sensível.
grant select (id, tenant_id, prefixo, label, created_by, created_at, last_used_at, revoked_at)
  on table tenant_api_keys to authenticated;

-- Revogar é preencher `revoked_at` (ADR-006, D4). Nenhuma outra coluna é escrevível pelo
-- app: sem privilégio em `hash` nem em `tenant_id`, um update malicioso não consegue
-- trocar o segredo de uma chave nem empurrá-la para outro tenant.
grant update (revoked_at) on table tenant_api_keys to authenticated;

-- `anon` não recebe nada de volta: quem não fez login não tem o que ver aqui.

-- ── 3. Policies, só owner, e só ler e revogar ──────────────────────────
-- Só owner, não membro (ADR-006, D4): a chave é a credencial comercial da marca, e quem
-- pode criá-la e derrubá-la é quem responde pelo contrato. `auth_owner_tenant_ids()` é o
-- helper `security definer` que já existe (20260812_correcao_rls_e_storage.sql).
create policy "owner le chaves de api do proprio tenant"
  on tenant_api_keys for select to authenticated
  using (tenant_id in (select auth_owner_tenant_ids()));

-- `using` decide QUAIS linhas o update pode mirar; `with check` decide COMO a linha pode
-- ficar depois. Os dois são necessários: sem `with check`, mudar o `tenant_id` de uma
-- chave ainda seria barrado pelo privilégio de coluna, mas a defesa dependeria só disso,
-- bastaria alguém ampliar o grant um dia para a chave passar a poder ser empurrada para
-- outro tenant sem que nenhuma policy reclamasse.
create policy "owner revoga chave de api do proprio tenant"
  on tenant_api_keys for update to authenticated
  using (tenant_id in (select auth_owner_tenant_ids()))
  with check (tenant_id in (select auth_owner_tenant_ids()));

-- INSERT ausente de propósito: a chave é gerada por script com `service_role`, porque o
-- segredo em claro existe uma única vez, no retorno da criação (ADR-006, D1).
--
-- DELETE ausente de propósito, e nem para o owner: chave apagada leva embora a resposta
-- para "quem estava usando isto quando aconteceu" (ADR-006, D4). Aqui há duas travas
-- somadas, `authenticated` não tem o privilégio de delete (revogado na seção 2) e não
-- existe policy que o permitisse se tivesse.

-- ── 4. Conferência depois de aplicar (rodar como um owner autenticado) ──
-- Nada abaixo é executado por esta migration; é o roteiro que prova as três propriedades
-- que sustentam a segurança dela. Rodar no contexto de um owner de um tenant que já tenha
-- ao menos uma chave, no SQL editor do Supabase, `set local role authenticated` mais
-- `set local request.jwt.claims` reproduzem esse contexto.
--
-- (a) O owner lê a chave, mas nunca o hash:
--     select id, prefixo from tenant_api_keys;
--     -- esperado: as chaves do próprio tenant, e só elas
--     select hash from tenant_api_keys;
--     -- esperado: ERRO permission denied for table tenant_api_keys (privilégio de
--     -- coluna). `select *` falha do mesmo jeito, e é para falhar.
--
-- (b) Delete não acontece, nem para o owner:
--     delete from tenant_api_keys where id = '<id de uma chave do proprio tenant>';
--     -- esperado: ERRO permission denied, o privilégio foi revogado na seção 2. Se um
--     -- dia alguém reconceder o privilégio de delete, este mesmo comando passa a
--     -- responder DELETE 0 (zero linhas afetadas), porque continua não havendo policy de
--     -- delete. Qualquer resultado que não seja erro ou 0 linhas é regressão.
--
-- (c) Update só serve para revogar:
--     update tenant_api_keys set revoked_at = now() where id = '<id da propria chave>';
--     -- esperado: UPDATE 1
--     update tenant_api_keys set label = 'x' where id = '<id da propria chave>';
--     update tenant_api_keys set hash  = 'x' where id = '<id da propria chave>';
--     -- esperado nas duas: ERRO permission denied (sem privilégio nessas colunas)
--
-- (d) Isolamento entre marcas, que é o motivo de tudo isto
--     (docs/11_SEGURANCA/multi-tenancy-rls.md): no contexto de um owner do tenant A,
--     nenhuma linha do tenant B aparece em (a) e nenhum update de (c) alcança linha do
--     tenant B.
