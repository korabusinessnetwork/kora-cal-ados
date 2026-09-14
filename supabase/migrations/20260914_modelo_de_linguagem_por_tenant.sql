-- Kora Calçados, fornecedor de modelo de linguagem por tenant e o uso dele (D13)
-- Decisão inteira em .full-auto/DECISOES.md, D13. Termos no glossário: fornecedor de modelo de
-- linguagem, chave do fornecedor, API própria, uso do modelo de linguagem, custo estimado, teto mensal.
--
-- A regra que manda neste arquivo: as duas tabelas NÃO têm policy nenhuma e NÃO têm privilégio
-- nenhum para `anon` e `authenticated`. Todo acesso passa por `api/v1/modelo-de-linguagem/`, com
-- `service_role`, depois de a função conferir a sessão e o papel da pessoa no tenant.
--
-- Por que não o padrão de `tenant_api_keys` (policy de owner mais grant de coluna): lá o navegador
-- precisa ler a lista de chaves, e o que não pode sair é só o hash. Aqui o navegador não precisa
-- ler nada que a função não possa entregar, e a coluna sensível é uma chave DECIFRÁVEL, de um
-- terceiro, que custa dinheiro à marca. Zero caminho do navegador até a tabela é mais simples de
-- provar que "o caminho existe, mas a coluna tal está fora do grant", e não depende de ninguém
-- lembrar do revoke antes do grant na próxima coluna nova.

-- ── 1. A configuração, uma por tenant ─────────────────────────────────────
-- `tenant_id` é a chave primária: uma marca tem um fornecedor configurado por vez. Trocar de
-- fornecedor é regravar a linha, e o histórico de gasto não se perde porque mora na outra tabela.
--
-- `chave_cifrada` é AES-256-GCM, cifrada na função com `CHAVE_DE_CIFRA_DOS_FORNECEDORES`, que não
-- está no banco. Um dump desta tabela sozinho não entrega chave nenhuma.
-- `final_da_chave` são os 4 últimos caracteres em claro, que é o que a tela mostra para a pessoa
-- reconhecer qual chave está gravada sem a chave voltar ao navegador.
create table tenant_modelos_de_linguagem (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  fornecedor text not null check (
    fornecedor in ('groq', 'gemini', 'cerebras', 'mistral', 'openrouter', 'sambanova', 'github_models', 'api_propria')
  ),
  modelo text not null check (char_length(modelo) between 1 and 200),
  -- Endereço só existe na API própria; nos outros o endereço é fixo no código. O `check` impede a
  -- linha incoerente em que um "groq" carrega endereço, que a função ignoraria em silêncio.
  endereco text check (endereco is null or char_length(endereco) <= 300),
  chave_cifrada text not null,
  final_da_chave text not null check (char_length(final_da_chave) between 1 and 4),
  preco_entrada_por_milhao numeric(12, 6) not null default 0 check (preco_entrada_por_milhao >= 0),
  preco_saida_por_milhao numeric(12, 6) not null default 0 check (preco_saida_por_milhao >= 0),
  teto_mensal_usd numeric(12, 2) check (teto_mensal_usd is null or teto_mensal_usd > 0),
  -- `on delete set null` pelo mesmo motivo de `tenant_api_keys.created_by`: quem configurou pode
  -- sair da empresa sem derrubar a configuração da marca.
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint endereco_so_na_api_propria check ((fornecedor = 'api_propria') = (endereco is not null))
);

create index tenant_modelos_de_linguagem_updated_by_idx on tenant_modelos_de_linguagem(updated_by);

alter table tenant_modelos_de_linguagem enable row level security;

-- ── 2. O uso, uma linha por chamada ao fornecedor ─────────────────────────
-- Não guarda prompt nem resposta: são conteúdo da marca, e medir gasto não precisa deles.
-- `codigo_de_erro` é o código da API (`FORNECEDOR_NO_LIMITE`, ...), nunca a mensagem do
-- fornecedor, que pode trazer pedaço de chave ou de cabeçalho.
--
-- `fornecedor` e `modelo` são copiados, e não uma referência à configuração: a configuração muda,
-- e o gasto de ontem tem de continuar dizendo com qual modelo foi.
create table uso_do_modelo_de_linguagem (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  fornecedor text not null,
  modelo text not null,
  origem text not null check (origem in ('geracao', 'teste')),
  sucesso boolean not null,
  codigo_de_erro text,
  tokens_de_entrada integer not null default 0 check (tokens_de_entrada >= 0),
  tokens_de_saida integer not null default 0 check (tokens_de_saida >= 0),
  custo_estimado_usd numeric(12, 6) not null default 0 check (custo_estimado_usd >= 0)
);

-- As três consultas desta tabela filtram por tenant e por janela de tempo: o limite por minuto, o
-- limite por dia e a soma do mês. O índice composto na ordem (tenant, instante) serve às três, e
-- lidera `tenant_id`, que é o que a guarda de chave estrangeira cobra.
create index uso_do_modelo_de_linguagem_tenant_id_created_at_idx
  on uso_do_modelo_de_linguagem(tenant_id, created_at desc);
create index uso_do_modelo_de_linguagem_usuario_id_idx on uso_do_modelo_de_linguagem(usuario_id);

alter table uso_do_modelo_de_linguagem enable row level security;

-- ── 3. Privilégios, nenhum para quem chega pelo navegador ──────────────────
-- O Supabase concede tudo a `anon` e `authenticated` por `alter default privileges` no schema
-- public, então as duas tabelas NASCEM legíveis e escrevíveis por esses papéis no nível de
-- privilégio. A RLS ligada sem policy já recusa toda linha; o revoke é a segunda trava, e é ele que
-- faz a tentativa responder "permission denied" em vez de uma lista vazia que pareceria "não tem
-- configuração". `service_role` fica de fora de propósito: é quem a função usa.
revoke all on table tenant_modelos_de_linguagem from anon, authenticated, public;
revoke all on table uso_do_modelo_de_linguagem from anon, authenticated, public;
revoke all on sequence uso_do_modelo_de_linguagem_id_seq from anon, authenticated, public;

-- Nenhuma policy, de propósito. Uma policy de owner aqui abriria o caminho do navegador até a
-- chave cifrada, que é exatamente o que a seção de abertura deste arquivo descarta.

-- ── 4. Conferência depois de aplicar ──────────────────────────────────────
-- Provado por `supabase/tests/modeloDeLinguagem.test.ts` com banco de verdade: um usuário
-- autenticado, owner do tenant, não lê nem grava nenhuma das duas tabelas, e o `service_role` lê.
