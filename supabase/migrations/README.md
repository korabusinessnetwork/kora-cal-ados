# supabase/migrations, o banco em ordem de data

Cada arquivo é um passo aplicado ao banco, com a data no nome. O estado consolidado está em
[`../schema.sql`](../schema.sql), que é a fonte de verdade para leitura; estes arquivos são a
história de como se chegou lá.

| Arquivo | O que fez |
|---|---|
| `20260812_schema_inicial.sql` | As tabelas do editor de zonas, com RLS por tenant |
| `20260812_correcao_rls_e_storage.sql` | Ajuste das policies e do bucket dos SVGs base |
| `20260908_chave_de_api_por_tenant.sql` | `tenant_api_keys`, que é o que faz o `tenant_id` sair da chave e nunca do pedido (ADR-006) |

## O teste que mora aqui, e por que ele mora aqui

[`rlsEmTodaTabela.test.ts`](rlsEmTodaTabela.test.ts) lê o TEXTO destes arquivos e reprova quando
uma tabela nova aparece sem `enable row level security` e sem policy. Fica ao lado do que ele
vigia, e não em `../tests/`, por uma diferença que importa: os testes de `../tests/` falam com o
Supabase de verdade e **pulam** numa máquina sem `.env.local`, e uma guarda que pula não é guarda.
Este é função pura sobre texto, roda em `npm test` em qualquer máquina, e tem contraprova
sintética, um trecho de SQL que TEM de reprovar.

Ele pega a ausência da RLS, e **não** julga se a policy está certa. Policy frouxa continua sendo
trabalho de quem revisa, e o teste de isolamento de `../tests/isolamento.test.ts` é quem prova, com
banco de verdade, que um tenant não enxerga o outro.
