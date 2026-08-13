# src/lib/supabase — acesso ao Supabase no navegador

O que vive aqui: a construção do cliente Supabase do front. O que **não** vive aqui:
consulta de domínio (mora no hook da feature, ex.: `src/features/produtos/hooks/`) e
qualquer uso de `service_role` (mora em `scripts/`, fora do bundle).

| Arquivo | Papel |
|---|---|
| `cliente.ts` | Cliente único, criado a partir de `import.meta.env.VITE_SUPABASE_*` |

O isolamento entre tenants é responsabilidade da RLS no banco, não do front — o cliente
daqui autentica, mas nunca é a barreira de segurança. Ver `docs/11_SEGURANCA/`.
