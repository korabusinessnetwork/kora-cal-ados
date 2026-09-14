-- Kora Calçados, correção de RLS, papéis e Storage
-- Fecha BUG-006 (recursão), BUG-007 (sem caminho de escrita), BUG-008 (Storage sem
-- policy) e BUG-009 (papel decorativo). Contexto e alternativas em
-- docs/11_SEGURANCA/proposta-correcao-rls.md.
--
-- Decisões aplicadas (2026-08-12): tenant é provisionado por script com service_role na
-- Fase 1 (venda manual) · membro cria e edita, só owner apaga e gerencia membros ·
-- URL assinada de asset com 300s.
--
-- APLICADA em 2026-09-05, no projeto Supabase real. Provado por
-- `supabase/tests/isolamento.test.ts` rodando 8/8 verde contra ele, que é exatamente o
-- que fecha BUG-006..009.
--
-- Este bloco dizia "AINDA NÃO FOI EXECUTADO em nenhum banco" até 2026-09-08, quatro dias
-- depois de deixar de ser verdade: o aviso foi escrito com a migration e ninguém o
-- reabriu ao aplicá-la. Ficou aqui como aviso de estado obsoleto, contradizendo o
-- `supabase/schema.sql`, que já registrava a aplicação. Migration é o histórico do banco;
-- quem a lê para saber o que está de pé no servidor era mandado embora com a resposta
-- errada. Ao aplicar uma migration, atualize o cabeçalho dela no mesmo commit.

-- ── 1. Helpers sem recursão ─────────────────────────────────────────────
-- security definer: a função roda com os privilégios do dono, então o select interno
-- NÃO reaplica a RLS de tenant_members, que chama esta mesma função. Sem isso,
-- Postgres aborta com 42P17 (infinite recursion detected in policy).
-- search_path fixo: security definer sem search_path é vetor de escalonamento.
create or replace function auth_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from tenant_members where user_id = auth.uid()
$$;

create or replace function auth_owner_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from tenant_members where user_id = auth.uid() and papel = 'owner'
$$;

revoke execute on function auth_tenant_ids(), auth_owner_tenant_ids() from public;
grant  execute on function auth_tenant_ids(), auth_owner_tenant_ids() to authenticated;

-- ── 2. Policies antigas saem (sem role explícita e sem papel) ───────────
drop policy if exists "membro so ve seu(s) tenant(s)"                on tenants;
drop policy if exists "membro so ve membros do proprio tenant"       on tenant_members;
drop policy if exists "membro so acessa produtos do proprio tenant"  on products;
drop policy if exists "membro so acessa zonas do proprio tenant"     on product_zones;
drop policy if exists "membro so acessa variantes do proprio tenant" on variants;

-- ── 3. tenants ──────────────────────────────────────────────────────────
-- INSERT ausente de propósito: na Fase 1 o tenant é provisionado por script com
-- service_role (venda manual/contrato). Self-serve entra na Fase 3, com ADR próprio.
create policy "membro le seu tenant"
  on tenants for select to authenticated
  using (id in (select auth_tenant_ids()));

create policy "owner edita tema do tenant"
  on tenants for update to authenticated
  using (id in (select auth_owner_tenant_ids()))
  with check (id in (select auth_owner_tenant_ids()));

-- ── 4. tenant_members ───────────────────────────────────────────────────
create policy "membro le membros do proprio tenant"
  on tenant_members for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));

create policy "owner convida membro"
  on tenant_members for insert to authenticated
  with check (tenant_id in (select auth_owner_tenant_ids()));

create policy "owner remove membro"
  on tenant_members for delete to authenticated
  using (tenant_id in (select auth_owner_tenant_ids()));

-- ── 5. products ─────────────────────────────────────────────────────────
create policy "membro le produtos do proprio tenant"
  on products for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));

create policy "membro cria produto no proprio tenant"
  on products for insert to authenticated
  with check (tenant_id in (select auth_tenant_ids()));

create policy "membro edita produto do proprio tenant"
  on products for update to authenticated
  using (tenant_id in (select auth_tenant_ids()))
  with check (tenant_id in (select auth_tenant_ids()));

-- Apagar produto destrói o mapeamento de zonas do time inteiro, só owner.
create policy "owner apaga produto"
  on products for delete to authenticated
  using (tenant_id in (select auth_owner_tenant_ids()));

-- ── 6. product_zones ────────────────────────────────────────────────────
create policy "membro le zonas do proprio tenant"
  on product_zones for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));

create policy "membro cria zona no proprio tenant"
  on product_zones for insert to authenticated
  with check (tenant_id in (select auth_tenant_ids()));

create policy "membro edita zona do proprio tenant"
  on product_zones for update to authenticated
  using (tenant_id in (select auth_tenant_ids()))
  with check (tenant_id in (select auth_tenant_ids()));

create policy "owner apaga zona"
  on product_zones for delete to authenticated
  using (tenant_id in (select auth_owner_tenant_ids()));

-- ── 7. variants ─────────────────────────────────────────────────────────
create policy "membro le variantes do proprio tenant"
  on variants for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));

create policy "membro cria variante no proprio tenant"
  on variants for insert to authenticated
  with check (tenant_id in (select auth_tenant_ids()));

create policy "owner apaga variante"
  on variants for delete to authenticated
  using (tenant_id in (select auth_owner_tenant_ids()));

-- ── 8. Storage, bucket privado particionado por tenant ─────────────────
-- Path canônico: tenants/{tenant_id}/products/{product_id}/base.svg
-- storage.foldername(name) => {tenants, <tenant_id>, products, <product_id>}
--
-- A comparação é text contra uuid::text de propósito: path malformado nega o acesso
-- em vez de estourar erro de cast.
--
-- O SRF aparece dentro de FROM (não `auth_tenant_ids()::text` no SELECT) porque
-- Postgres só aceita função que retorna conjunto no topo do SELECT, com um cast em
-- volta, o comando falha.
insert into storage.buckets (id, name, public)
values ('assets-base', 'assets-base', false)
on conflict (id) do nothing;

create policy "membro le asset do proprio tenant"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assets-base'
    and (storage.foldername(name))[1] = 'tenants'
    and (storage.foldername(name))[2] in (select t::text from auth_tenant_ids() t)
  );

create policy "membro sobe asset no proprio tenant"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assets-base'
    and (storage.foldername(name))[1] = 'tenants'
    and (storage.foldername(name))[2] in (select t::text from auth_tenant_ids() t)
  );

create policy "membro atualiza asset do proprio tenant"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'assets-base'
    and (storage.foldername(name))[1] = 'tenants'
    and (storage.foldername(name))[2] in (select t::text from auth_tenant_ids() t)
  );

create policy "owner apaga asset do proprio tenant"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assets-base'
    and (storage.foldername(name))[1] = 'tenants'
    and (storage.foldername(name))[2] in (select t::text from auth_owner_tenant_ids() t)
  );
