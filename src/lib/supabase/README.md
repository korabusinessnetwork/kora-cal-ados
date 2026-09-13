# src/lib/supabase — acesso ao Supabase pelo navegador

O que vive aqui: **como o front se conecta**. O que **não** vive aqui: consulta de
domínio (isso mora na feature que precisa dela, ex.: `src/features/sessao/`).

| Arquivo | Papel |
|---|---|
| `configuracaoDoSupabase.ts` | Lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, ou lança dizendo o que escrever no `.env.local` |
| `cliente.ts` | O cliente único do app (`clienteSupabase()`), criado na primeira chamada |

Entrada: `clienteSupabase()`.

## Um cliente só

Cada `createClient` monta o próprio listener de auth e a própria cópia da sessão. Dois
clientes divergem no refresh do token — um acha que está logado, o outro não — e o sintoma
aparece como "sumiu meu login ao trocar de tela", caríssimo de diagnosticar.

## Nunca a service_role

A anon key é feita para ir ao navegador: ela não dá acesso a nada sozinha, porque quem
decide o que cada usuário lê é a **RLS** (`docs/11_SEGURANCA/multi-tenancy-rls.md`). A
service_role é o oposto — ignora RLS por definição — e no bundle entregaria os dados de
todos os tenants, incluindo os concorrentes, a qualquer visitante do DevTools.

`configuracaoDoSupabase.ts` **recusa explicitamente** uma chave cujo `role` seja
`service_role`, em vez de confiar na convenção do nome da variável. Chave que não é JWT
(formato `sb_publishable_…`) passa: quem valida a chave de verdade é o servidor.

Código que precisa de service_role (provisionamento, testes de isolamento) vive em
`supabase/`, fora de `src/` — nada em `src/` vai para o servidor.

## Configuração ausente derruba o app de propósito

Sem `.env.local`, `../../features/AreaProtegida.tsx` desenha uma tela dizendo o que fazer. A
alternativa, subir com URL vazia, daria uma tela de login que recusa toda senha sem explicar por
quê. A conferência mora lá, e não no `App.tsx`, porque é o `import()` tardio da área protegida que
mantém o cliente de banco fora do chunk que todo mundo baixa: conferir no `App.tsx` obrigaria o
chunk principal a importar este diretório.
