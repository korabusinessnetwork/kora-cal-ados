# supabase/migrations, o banco em ordem de data

Cada arquivo é um passo aplicado ao banco, com a data no nome. O estado consolidado está em
[`../schema.sql`](../schema.sql), que é a fonte de verdade para leitura; estes arquivos são a
história de como se chegou lá.

| Arquivo | O que fez |
|---|---|
| `20260812_schema_inicial.sql` | As tabelas do editor de zonas, com RLS por tenant |
| `20260812_correcao_rls_e_storage.sql` | Ajuste das policies e do bucket dos SVGs base |
| `20260908_chave_de_api_por_tenant.sql` | `tenant_api_keys`, que é o que faz o `tenant_id` sair da chave e nunca do pedido (ADR-006) |
| `20260912_indice_em_chave_estrangeira.sql` | Índice em `tenant_members.user_id` e em `tenant_api_keys.created_by`, as duas que faltavam |
| `20260914_modelo_de_linguagem_por_tenant.sql` | `tenant_modelos_de_linguagem` e `uso_do_modelo_de_linguagem`, o fornecedor de modelo de linguagem de cada marca e o gasto dele (D13). As duas sem policy, só pela função serverless |

## As duas guardas que moram aqui, e por que elas moram aqui

As duas leem o TEXTO destes arquivos e reprovam antes de a migration chegar em banco nenhum.
Ficam ao lado do que vigiam, e não em `../tests/`, por uma diferença que importa: os testes de
`../tests/` falam com o Supabase de verdade e **pulam** numa máquina sem `.env.local`, e uma
guarda que pula não é guarda. Estas são funções puras sobre texto, rodam em `npm test` em
qualquer máquina, e cada uma tem contraprova sintética, um trecho de SQL que TEM de reprovar.

[`rlsEmTodaTabela.test.ts`](rlsEmTodaTabela.test.ts) reprova quando uma tabela nova aparece sem
`enable row level security`. Ele pega a ausência da RLS, e **não** julga se a policy está certa.
Policy frouxa continua sendo trabalho de quem revisa, e o teste de isolamento de
`../tests/isolamento.test.ts` é quem prova, com banco de verdade, que um tenant não enxerga o
outro.

[`indiceEmChaveEstrangeira.test.ts`](indiceEmChaveEstrangeira.test.ts) reprova quando uma coluna
`references` não tem índice que a **lidere**. "Lidere" e não "contenha" é o ponto inteiro: btree
composto só serve para busca que comece pela coluna da frente, e foi por confundir as duas coisas
que `tenant_members.user_id` ficou seis rodadas sem índice, escondido atrás do
`unique (tenant_id, user_id)`. Ela **não** afirma que o índice está sendo usado, o que exigiria
`explain` contra banco de verdade, e **não** julga índice sobrando.

Vale contar o que aconteceu na primeira vez que ela rodou: ela encontrou uma segunda coluna que eu
não tinha visto, `tenant_api_keys.created_by`, depois de eu ter lido a mesma migration duas vezes.
É por isso que a guarda vale mais que os índices que ela cobra.

As duas compartilham [`lerSql.ts`](lerSql.ts), que é onde mora "o SQL sem comentário" e "o nome
sem esquema". Módulo normal e não arquivo de teste de propósito: importar um `.test.ts` de outro
faz o vitest registrar os `describe` do importado dentro de quem importou, e os mesmos testes
passam a rodar duas vezes com dois nomes de arquivo.
