# src/features/tenant — tenant ativo e tema white-label

O que vive aqui: descobrir qual tenant o usuário logado opera e aplicar o tema dele sobre
os tokens. O que **não** vive aqui: sessão do usuário (`src/features/autenticacao/`),
criação de tenant (`scripts/provisionarTenant.ts`) e a definição dos tokens
(`src/estilos/tokens.css`).

| Arquivo | Papel |
|---|---|
| `TenantContext.tsx` | Carrega o tenant da sessão e expõe `{ tenant, estado }` |
| `aplicarTemaDoTenant.ts` | Função pura: `tenants.tema` → pares (token, valor) válidos |

## Duas coisas que não são acidente

**O `tenant_id` do front não é barreira de segurança.** Ele monta o path do Storage. Quem
impede um tenant de ler dado de outro é a RLS no Postgres, provada por
`supabase/tests/isolamento.test.ts`.

**Chave desconhecida no `tema` é ignorada.** `tema` é jsonb livre editável pelo owner; se
qualquer chave virasse custom property, o tema seria injeção de CSS arbitrário na
interface. A lista de chaves aceitas está em `TOKENS_DO_TENANT`.

## Limite conhecido

Usuário em mais de um tenant recebe o primeiro por `created_at`. O seletor de tenant não
existe nesta rodada — quando existir, é aqui que entra.
