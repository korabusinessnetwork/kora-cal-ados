# scripts — operações administrativas fora do app

O que vive aqui: script de operação que roda em Node, na máquina de quem opera o produto.
O que **não** vive aqui: qualquer coisa importada por `src/` — o que está aqui usa
`service_role` e **nunca** pode virar bundle do navegador.

| Arquivo | Papel |
|---|---|
| `provisionarTenant.ts` | Cria a marca e seu primeiro owner; imprime a senha inicial |

## Por que provisionamento é script, e não tela

`tenants` não tem policy de INSERT para usuário autenticado — criar marca é operação de
`service_role`. A decisão é de 2026-08-12 (`memory/decisions.md`): a venda da Fase 1 é
manual/contrato, então não existe self-serve a proteger. Quando houver, isto vira fluxo de
produto e o script sai de cena.

## A chave que passa por aqui

`SUPABASE_SERVICE_ROLE_KEY` ignora RLS por completo. Ela é lida de `process.env` (nunca de
`import.meta.env`, que expõe no bundle) e não aparece em nenhum arquivo sob `src/`.

```bash
npm run provisionar-tenant -- "Nome da Marca" "slug-da-marca" "owner@marca.com"
```

A senha inicial é aleatória e impressa uma vez. Entregue por canal seguro e peça a troca no
primeiro acesso — senha combinada por e-mail é o jeito mais comum de vazar acesso.
