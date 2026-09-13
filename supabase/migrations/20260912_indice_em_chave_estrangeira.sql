-- Kora Calçados (codinome) — índice nas duas chaves estrangeiras que não tinham
-- Ver ADR-002 (multi-tenant/RLS) e ADR-006 (chave de API por tenant) em docs/08_DECISOES/
-- Convenção Kora: migrations em YYYYMMDD_descricao.sql

-- ── 1. `tenant_members.user_id` ─────────────────────────────────────────
--
-- POR QUE ESTE É O MAIS IMPORTANTE DA PASTA
--
-- `auth_tenant_ids()` é esta consulta, e mais nada:
--
--   select tenant_id from tenant_members where user_id = auth.uid()
--
-- Ela filtra SÓ por `user_id`. E `user_id` não tinha índice: o que existia era o
-- `unique (tenant_id, user_id)` da criação da tabela, um btree com `tenant_id` NA FRENTE.
-- Índice composto só serve para busca que comece pela coluna da frente, então esse não
-- servia para esta, e a consulta varria a tabela inteira.
--
-- O tamanho do estrago vem de onde ela é chamada: `auth_tenant_ids()` aparece quinze vezes
-- nos predicados das políticas em vigor (`20260812_correcao_rls_e_storage.sql`), cobrindo as
-- seis tabelas mais as três políticas do Storage. Toda leitura autenticada de qualquer tabela
-- passa por ela. Como a função é `stable`, o Postgres a resolve uma vez por consulta, num
-- InitPlan, e não uma vez por linha: o custo é uma varredura inteira de `tenant_members` por
-- consulta, não por linha lida.
--
-- E é a dimensão errada que cresce. `tenant_members` tem uma linha por PESSOA POR TENANT, de
-- TODOS os tenants somados. Num SaaS B2B white-label com marcas concorrentes no mesmo banco
-- (docs/11_SEGURANCA/multi-tenancy-rls.md), isso quer dizer que abrir a lista de produtos de
-- uma marca pequena fica mais caro toda vez que uma marca grande contrata mais gente. O
-- isolamento entre tenants continua correto; o que vazava de um para o outro era o custo.

create index if not exists tenant_members_user_id_idx on tenant_members(user_id);

-- ── 2. `tenant_api_keys.created_by` ─────────────────────────────────────
--
-- Este NÃO é consultado por ninguém: não existe uma linha de código que filtre por
-- `created_by`, e o `grant select` desta tabela o inclui só para a tela poder mostrar quem
-- criou a chave. O motivo aqui é outro, e é o motivo clássico de se indexar chave
-- estrangeira: a AÇÃO REFERENCIAL.
--
-- `created_by` é `references auth.users(id) on delete set null`. Quando alguém apaga um
-- usuário, o Postgres precisa achar todas as linhas que apontam para ele para poder anular a
-- coluna, e sem índice isso é uma varredura inteira de `tenant_api_keys` por usuário apagado.
-- O mesmo vale para os `on delete cascade` das outras cinco, que já têm índice por outro
-- motivo e por isso nunca sofreram disso.
--
-- Foi a varredura de `indiceEmChaveEstrangeira.test.ts` que encontrou este, na primeira vez
-- que rodou, enquanto eu escrevia a guarda para o caso do `user_id`. Eu tinha lido a mesma
-- migration duas vezes e não tinha visto. É a razão de a guarda valer mais que os dois
-- índices que ela cobra.

create index if not exists tenant_api_keys_created_by_idx on tenant_api_keys(created_by);

-- ── Notas que valem para os dois ────────────────────────────────────────
--
-- `if not exists` porque esta migration pode encontrar o índice já criado à mão num banco que
-- alguém socorreu antes de ela existir, e uma migration que quebra nesse caso é uma migration
-- que ninguém aplica.
--
-- Sem `concurrently` de propósito: `create index concurrently` não roda dentro de bloco de
-- transação, e é o editor de SQL do Supabase que aplica estas migrations. As duas tabelas são
-- as menores do schema, e o bloqueio de escrita dura o que dura a construção do índice nelas.
-- Quando uma delas for grande o bastante para isso doer, a decisão muda, e aí ela vira
-- migration própria, sozinha no arquivo.
