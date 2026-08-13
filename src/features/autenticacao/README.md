# src/features/autenticacao — sessão do usuário

O que vive aqui: login, logout, estado da sessão e o bloqueio de rota sem sessão. O que
**não** vive aqui: qual tenant o usuário pertence e o tema dele (`src/features/tenant/`),
e criação de usuário (é `scripts/provisionarTenant.ts` — não há cadastro self-serve na
Fase 1).

| Arquivo | Papel |
|---|---|
| `AutenticacaoContext.tsx` | Estado da sessão, `entrar`, `sair`; assina `onAuthStateChange` |
| `components/TelaDeLogin.tsx` | Formulário de e-mail/senha, com estado de erro e envio |
| `components/RotaProtegida.tsx` | Não renderiza o filho sem sessão; mostra o login |

**Isto não é a barreira de segurança.** Quem impede um tenant de ler dado de outro é a
RLS no Postgres (`supabase/schema.sql`), provada por `supabase/tests/isolamento.test.ts`.
O bloqueio de rota aqui é ergonomia: evita tela quebrada, não evita vazamento.
