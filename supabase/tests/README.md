# supabase/tests — teste de isolamento entre tenants

O que vive aqui: o teste que prova a promessa central do produto — marca concorrente não
vê coleção de outra. O que não vive aqui: teste de lógica pura (vai junto do código, em
`src/`).

| Arquivo | Papel |
|---|---|
| `ambiente.ts` | Monta o cenário (2 tenants concorrentes, 3 usuários) e limpa no fim. Usa `service_role` |
| `isolamento.test.ts` | As asserções: leitura cruzada, escrita cruzada, Storage, papel de membro, anônimo |

## Como rodar

Precisa de um projeto Supabase real com as duas migrations aplicadas. Sem as variáveis
abaixo o teste **pula** (não passa em falso):

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm test
```

O projeto free tier do Supabase cobre isso — está dentro da restrição de custo
(`memory/restrictions.md`). Alternativa local: Docker Desktop + `supabase start`.

## Por que este teste existe separado

`docs/11_SEGURANCA/multi-tenancy-rls.md` trata isolamento como requisito de produto, não
item técnico: o dano de um vazamento aqui é competitivo (coleção não lançada indo pra
concorrente que também é cliente). Por isso o teste tenta o ataque real — pedir o recurso
alheio pelo id direto — em vez de conferir se a policy "existe".

## Estado

✅ **Rodou verde (8/8) em 2026-09-05** contra um projeto Supabase real, com as duas
migrations aplicadas — é o que fechou BUG-006..009. O cenário é montado e destruído a cada
rodada (conferido: nenhum tenant ou usuário residual).

Continua valendo a regra que criou este teste: SQL que não rodou não é correção provada.
Toda mudança futura em policy volta a passar por aqui antes de ser considerada feita.
