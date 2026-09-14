-- Kora Calçados (codinome), migration inicial
-- Ver ADR-001 (stack) e ADR-002 (multi-tenant/RLS) em docs/08_DECISOES/
-- Convenção Kora: migrations em YYYYMMDD_descricao.sql

-- ── Tenants ──────────────────────────────────────────────────────────────
create table tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  tema jsonb not null default '{}'::jsonb,   -- cor_primaria, logo_url etc. (white-label)
  plano text not null default 'manual',      -- manual (Fase 1) | free | pro | enterprise (Fase 3+)
  status text not null default 'ativo',      -- ativo | suspenso | trial
  created_at timestamptz not null default now()
);

-- ── Membros (usuário ↔ tenant ↔ papel) ──────────────────────────────────
create table tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'membro',      -- owner | membro
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- ── Produtos (modelo de calçado) ─────────────────────────────────────────
create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nome text not null,
  base_asset_path text not null,   -- Storage: tenants/{tenant_id}/products/{id}/base.svg
  created_at timestamptz not null default now()
);
create index products_tenant_id_idx on products(tenant_id);

-- ── Zonas do produto (o "frame" endereçável, sola, cabedal, cadarço...) ─
create table product_zones (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,  -- desnormalizado p/ RLS direto
  zone_key text not null,          -- ex: 'sola', 'cabedal', 'cadarco', 'logo'
  svg_selector text not null,      -- seletor CSS; pode capturar N elementos (ADR-004)
  label text,
  cor_default text,
  created_at timestamptz not null default now(),
  unique (product_id, zone_key)
);
create index product_zones_tenant_id_idx on product_zones(tenant_id);
create index product_zones_product_id_idx on product_zones(product_id);

-- ── Variantes geradas (cache opcional, API pode gerar on-the-fly também) ─
create table variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  zone_colors jsonb not null,      -- {"sola": "#C0392B", "cabedal": "#111111"}
  rendered_path text,              -- Storage path, se persistido
  created_at timestamptz not null default now()
);
create index variants_tenant_id_idx on variants(tenant_id);
create index variants_product_id_idx on variants(product_id);

-- ── RLS, definition-of-done de toda tabela, sem exceção (ver ADR-002) ──
alter table tenants enable row level security;
alter table tenant_members enable row level security;
alter table products enable row level security;
alter table product_zones enable row level security;
alter table variants enable row level security;

-- Helper: tenant(s) do usuário autenticado
create or replace function auth_tenant_ids()
returns setof uuid
language sql stable
as $$
  select tenant_id from tenant_members where user_id = auth.uid()
$$;

create policy "membro so ve seu(s) tenant(s)"
  on tenants for select
  using (id in (select auth_tenant_ids()));

create policy "membro so ve membros do proprio tenant"
  on tenant_members for select
  using (tenant_id in (select auth_tenant_ids()));

create policy "membro so acessa produtos do proprio tenant"
  on products for all
  using (tenant_id in (select auth_tenant_ids()))
  with check (tenant_id in (select auth_tenant_ids()));

create policy "membro so acessa zonas do proprio tenant"
  on product_zones for all
  using (tenant_id in (select auth_tenant_ids()))
  with check (tenant_id in (select auth_tenant_ids()));

create policy "membro so acessa variantes do proprio tenant"
  on variants for all
  using (tenant_id in (select auth_tenant_ids()))
  with check (tenant_id in (select auth_tenant_ids()));

-- Nunca usar service_role no front, só em Edge Function/servidor.
-- Teste de isolamento obrigatório antes de qualquer feature sensível ir pra produção
-- (dois tenants, garantir que um não vê produto/zona/variante do outro).
