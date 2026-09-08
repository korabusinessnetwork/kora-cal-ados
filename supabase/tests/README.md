# supabase/tests — teste de isolamento entre tenants

O que vive aqui: o teste que prova a promessa central do produto — marca concorrente não
vê coleção de outra. O que não vive aqui: teste de lógica pura (vai junto do código, em
`src/`).

| Arquivo | Papel |
|---|---|
| `ambiente.ts` | Monta o cenário (2 tenants concorrentes, 3 usuários) e limpa no fim. Usa `service_role` |
| `isolamento.test.ts` | As asserções: leitura cruzada, escrita cruzada, Storage, papel de membro, anônimo |
| `editorDeZonas.test.ts` | O caminho do editor contra o banco real: gravar zona, reler, e o que a RLS recusa |
| `chaveDeApi.test.ts` | `tenant_api_keys`: o `hash` que nem o dono lê, o delete que não existe, e a chave da concorrente |
| `apiDeVariante.test.ts` | A API de variante inteira sobre o banco real: o 200 que recolore só a zona pedida, o 404 do concorrente e os 409 de dado do tenant |

## Como rodar

Precisa de um projeto Supabase real com as migrations aplicadas. Sem as variáveis
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

✅ **Rodou verde (10/10) em 2026-09-05** contra um projeto Supabase real, com as duas
migrations aplicadas — os 8 primeiros são o que fechou BUG-006..009. O cenário é montado e
destruído a cada rodada (conferido: nenhum tenant ou usuário residual).

Desde a Etapa 3 o cenário sobe um **asset-base real** para o Storage, em vez de gravar um
caminho inventado. A diferença é grande: com caminho falso, a recusa ao concorrente podia
ser "não achei" em vez de "não é seu". Os dois casos novos vieram daí — o dono baixa o
próprio arquivo e recebe o canônico, e o **canário do ADR-005**
(`normalizarSvg(baixado) === baixado`) fica vermelho se a ordem de cunhagem de id mudar,
antes de qualquer `svg_selector` gravado repointar em silêncio.

Rodar: `npm run test:banco`.

⏳ **`chaveDeApi.test.ts` ainda NÃO rodou** — depende de
`20260908_chave_de_api_por_tenant.sql`, que está escrita e não aplicada. Enquanto a tabela
`tenant_api_keys` não existir, ele falha com tabela inexistente, e não pula: pular exigiria
o ambiente ausente, e o ambiente está presente. Não confunda o verde do `npm test` com
prova — lá ele é pulado por falta das variáveis, como todos os daqui.

O que ele existe para provar é exatamente o que cliente falso não alcança: **privilégio de
coluna não existe em mock**. Um teste unitário de `criarChaveDeApi` passaria idêntico num
banco onde o `revoke` nunca rodou, e a diferença entre os dois bancos é o hash da
credencial comercial de todas as marcas ficar legível ou não.

Continua valendo a regra que criou este teste: SQL que não rodou não é correção provada.
Toda mudança futura em policy volta a passar por aqui antes de ser considerada feita.

## `apiDeVariante.test.ts` — por que ele não é redundante com o teste do handler

`api/v1/products/[productId]/_variants.test.ts` roda com cliente falso, e cliente falso
responde o que o teste mandou responder. Ele prova que o handler **pede** a coisa certa:
tabela, filtros, ordem dos passos. Não prova, e não tem como provar, que o que volta é a
coisa certa.

Só um banco de verdade prova que o `.eq('tenant_id', …)` de fato recorta a linha, que o
asset-base baixa do bucket privado com `service_role`, e que o `svg_selector` gravado pelo
editor resolve no arquivo canônico que está lá dentro. **Sob `service_role` não há RLS** — o
isolamento passa a ser código nosso, e código nosso é o que erra.

Dois testes daqui não olham status nenhum, e são os que mais importam:

- a variante devolvida é comparada **contra o canônico baixado do Storage**, exigindo que a
  cor da sola tenha sumido e a do cabedal tenha ficado idêntica. Sem a segunda metade, um
  seletor que capturasse o calçado inteiro passaria verde e só apareceria quando um cliente
  abrisse o arquivo;
- a chave de API é usada como credencial do Supabase e **precisa falhar**. Se fosse aceita, o
  cliente teria leitura do banco pela porta do front, e o que a nossa função filtra deixaria
  de importar.

⏳ **Ele também ainda não rodou**, pela mesma migration ausente do `chaveDeApi.test.ts`: sem
`tenant_api_keys` não existe chave válida, e sem chave válida nenhum dos casos sai do 500.

O que ele **não** cobre: o olho. Nenhuma asserção aqui vê o desenho. Isso é
`api/_local/roteiroDePassada.md`, passo 17.
