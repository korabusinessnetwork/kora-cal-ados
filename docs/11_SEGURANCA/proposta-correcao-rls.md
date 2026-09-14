# Proposta, correção de RLS, onboarding e Storage

**Status**: Aplicado e provado (2026-09-05)
**Data**: 2026-08-12
**Referente a**: `supabase/migrations/20260812_schema_inicial.sql`
**Bugs**: BUG-006, BUG-007, BUG-008, BUG-009 (`memory/bugs.md`)

> ✅ Decisões tomadas (2026-08-12): **1(a)** tenant provisionado por script com
> `service_role` na Fase 1 · **2(b)** membro cria e edita, só owner apaga e gerencia
> membros · **3** URL assinada com 300s.
>
> O SQL virou `supabase/migrations/20260812_correcao_rls_e_storage.sql`, e as asserções
> viraram `supabase/tests/isolamento.test.ts`.
>
> ✅ **Aplicado em 2026-09-05** num projeto Supabase real (free tier, sem custo, ver
> `memory/restrictions.md`): as duas migrations estão no banco e
> `supabase/tests/isolamento.test.ts` roda **8/8 verde** contra ele, incluindo a asserção
> específica do `42P17` do BUG-006. BUG-006..009 fechados.
>
> A regra que gerou o aviso anterior continua: SQL revisado não é SQL provado, o que
> prova é o teste rodando contra banco de verdade.

---

## Diagnóstico

### 1. Recursão infinita na policy de `tenant_members` (BUG-006, bloqueante)

```sql
create or replace function auth_tenant_ids() ... language sql stable as $$
  select tenant_id from tenant_members where user_id = auth.uid()
$$;

create policy "membro so ve membros do proprio tenant"
  on tenant_members for select
  using (tenant_id in (select auth_tenant_ids()));   -- ← relê tenant_members
```

Sem `security definer`, a função roda com os privilégios de quem chama, então o `select`
dentro dela **também passa pela RLS de `tenant_members`**, que chama a função de novo.
É o padrão que o Postgres aborta com `42P17: infinite recursion detected in policy for
relation "tenant_members"`.

**Confiança alta, não reproduzido**: sem Docker nesta máquina, `supabase start` não sobe
um Postgres local. Reproduzível em 5 minutos assim que houver Docker ou um projeto
Supabase de teste, e o teste de isolamento (abaixo) prova junto.

### 2. Falta o caminho de escrita (BUG-007)

Só existem policies de `select` em `tenants` e `tenant_members`, e nenhuma de `insert`
em lugar nenhum das duas. Consequência prática: **não há como criar um tenant, convidar
um membro nem editar o tema white-label**, o produto não sai do zero. O `update` de
`tenants` é justamente o que ADR-002 promete (identidade por tenant).

### 3. `papel` decorativo (BUG-009)

`tenant_members.papel` (`owner`/`membro`) está modelado, mas nenhuma policy o consulta:
hoje todo membro teria escrita total, incluindo apagar produto de outro colega.

### 4. Storage sem policy (BUG-008)

`docs/11_SEGURANCA/multi-tenancy-rls.md` exige bucket privado, path particionado por
tenant e URL assinada. Nada disso existe na migration, o isolamento do asset-base
dependeria só de a URL não ser adivinhada.

---

## Decisões (tomadas em 2026-08-12)

| # | Questão | Opções | Decisão, foi a recomendação |
|---|---|---|---|
| 1 | Como nasce um tenant na Fase 1? | (a) você provisiona por script com `service_role`; (b) função `security definer` que cria tenant + membro `owner` numa transação | **(a)**, venda é manual/contrato; self-serve é Fase 3, e (b) abre superfície de ataque que não precisa existir ainda |
| 2 | O que `membro` **não** pode fazer? | (a) nada, membro = owner na prática; (b) membro cria/edita produto, zona e variante, mas só `owner` apaga produto e gerencia membros | **(b)**, apagar produto destrói o trabalho de mapeamento de zonas do time inteiro |
| 3 | TTL da URL assinada do asset-base | 60s / 300s / 3600s | **300s**, cobre carregar o editor sem deixar link vivo circulando |

O SQL abaixo assume **1(a) + 2(b) + 3(300s)**. Se você decidir diferente, ajusto.

---

## SQL

> **A versão que vale é `supabase/migrations/20260812_correcao_rls_e_storage.sql`.** O
> bloco abaixo é o raciocínio que originou a migration; ao mudar a policy, mude na
> migration, este documento é histórico da decisão, não fonte de verdade.
>
> Correção encontrada ao escrever a migration: `select auth_tenant_ids()::text` **não
> compila**, Postgres só aceita função que retorna conjunto no topo do SELECT, e o cast
> em volta quebra isso. A forma correta é `select t::text from auth_tenant_ids() t`.

```sql
-- Kora Calçados, correção de RLS, papéis e Storage

-- ── 1. Helper sem recursão ───────────────────────────────────────────────
-- security definer: a função roda com o dono, então o select interno NÃO reaplica a
-- RLS de tenant_members (que chama esta mesma função), sem isso, erro 42P17.
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

-- Mesma ideia, mas só os tenants onde o usuário é owner.
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

-- ── 2. Policies antigas saem (eram sem role e sem papel) ────────────────
drop policy if exists "membro so ve seu(s) tenant(s)"            on tenants;
drop policy if exists "membro so ve membros do proprio tenant"   on tenant_members;
drop policy if exists "membro so acessa produtos do proprio tenant" on products;
drop policy if exists "membro so acessa zonas do proprio tenant"    on product_zones;
drop policy if exists "membro so acessa variantes do proprio tenant" on variants;

-- ── 3. tenants ──────────────────────────────────────────────────────────
-- INSERT ausente de propósito: na Fase 1 o tenant é provisionado por script com
-- service_role (venda manual). Self-serve entra na Fase 3, com ADR próprio.
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

-- ── 5. products, membro cria/edita, só owner apaga ─────────────────────
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

create policy "owner apaga produto"
  on products for delete to authenticated
  using (tenant_id in (select auth_owner_tenant_ids()));

-- ── 6. product_zones e variants, mesmo padrão ──────────────────────────
create policy "membro le zonas do proprio tenant"
  on product_zones for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));

create policy "membro escreve zonas do proprio tenant"
  on product_zones for insert to authenticated
  with check (tenant_id in (select auth_tenant_ids()));

create policy "membro edita zonas do proprio tenant"
  on product_zones for update to authenticated
  using (tenant_id in (select auth_tenant_ids()))
  with check (tenant_id in (select auth_tenant_ids()));

create policy "owner apaga zona"
  on product_zones for delete to authenticated
  using (tenant_id in (select auth_owner_tenant_ids()));

create policy "membro le variantes do proprio tenant"
  on variants for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));

create policy "membro cria variante no proprio tenant"
  on variants for insert to authenticated
  with check (tenant_id in (select auth_tenant_ids()));

create policy "owner apaga variante"
  on variants for delete to authenticated
  using (tenant_id in (select auth_owner_tenant_ids()));

-- ── 7. Storage, bucket privado particionado por tenant ─────────────────
-- Path canônico: tenants/{tenant_id}/products/{product_id}/base.svg
-- foldername(name) => {tenants, <tenant_id>, products, <product_id>}
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

create policy "owner apaga asset do proprio tenant"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assets-base'
    and (storage.foldername(name))[1] = 'tenants'
    and (storage.foldername(name))[2] in (select t::text from auth_owner_tenant_ids() t)
  );
```

**Nota sobre o Storage**: a comparação é `text` contra `uuid::text` de propósito, se o
path vier malformado, a policy nega em vez de estourar erro de cast.

---

## Teste de isolamento (vira CI, hoje é o gate manual)

`docs/11_SEGURANCA/multi-tenancy-rls.md` já exige este teste antes de qualquer release.
Roteiro mínimo, com dois usuários reais em tenants diferentes:

1. Usuário A cria produto + zona no tenant A.
2. Usuário B (tenant B) tenta `select` do `product_id` de A **por id direto** → 0 linhas.
3. Usuário B tenta `insert` de zona com `tenant_id` de A → negado pelo `with check`.
4. Usuário B pede URL assinada do `base.svg` de A → negado.
5. Membro (não-owner) do tenant A tenta apagar produto → negado.
6. Anônimo (só `anon key`, sem sessão) tenta qualquer leitura → 0 linhas.

Cada passo vira teste automatizado quando houver ambiente Supabase, é o mesmo teste que
prova a correção do BUG-006 (se a recursão existir, o passo 1 já explode com 42P17).

---

## Fora desta proposta (registrado pra não sumir)

- `variants` não tem índice para lookup de cache por `zone_colors`, só faz sentido
  decidir quando o padrão de reuso ficar claro (hoje a API pode gerar on-the-fly).
- `supabase/schema.sql` continua um stub apontando para a migration (BUG-010), decidir
  se o snapshot volta a ser gerado ou se `CLAUDE.md`/`docs/04_MODELAGEM` passam a apontar
  para `supabase/migrations/` como fonte de verdade.
