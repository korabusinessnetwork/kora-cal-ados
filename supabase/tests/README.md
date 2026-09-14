# supabase/tests, teste de isolamento entre tenants

O que vive aqui: o teste que prova a promessa central do produto, marca concorrente não
vê coleção de outra. O que não vive aqui: teste de lógica pura (vai junto do código, em
`src/`).

| Arquivo | Papel |
|---|---|
| `ambiente.ts` | Monta o cenário (2 tenants concorrentes, 3 usuários) e limpa no fim. Usa `service_role` |
| `isolamento.test.ts` | As asserções: leitura cruzada, escrita cruzada, Storage, papel de membro, anônimo |
| `editorDeZonas.test.ts` | O caminho do editor contra o banco real: gravar zona, reler, e o que a RLS recusa |
| `chaveDeApi.test.ts` | `tenant_api_keys`: o `hash` que nem o dono lê, o delete que não existe, e a chave da concorrente |
| `modeloDeLinguagem.test.ts` | As duas tabelas da D13 (configuração do fornecedor e uso do modelo de linguagem): nem o owner lê ou grava pelo navegador, só o `service_role` da função |
| `apiDeVariante.test.ts` | A API de variante inteira sobre o banco real: o 200 que recolore só a zona pedida, o 404 do concorrente e os 409 de dado do tenant |
| `eloEditorApi.test.ts` | O elo: a zona gravada **pelo caminho do editor** é a zona que a API pinta, o princípio nº1 como asserção |

## Como rodar

Precisa de um projeto Supabase real com as migrations aplicadas. Sem as variáveis
abaixo o teste **pula** (não passa em falso):

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm test
```

O projeto free tier do Supabase cobre isso, está dentro da restrição de custo
(`memory/restrictions.md`). Alternativa local: Docker Desktop + `supabase start`.

## Por que este teste existe separado

`docs/11_SEGURANCA/multi-tenancy-rls.md` trata isolamento como requisito de produto, não
item técnico: o dano de um vazamento aqui é competitivo (coleção não lançada indo pra
concorrente que também é cliente). Por isso o teste tenta o ataque real, pedir o recurso
alheio pelo id direto, em vez de conferir se a policy "existe".

## Estado

✅ **Rodou verde (10/10) em 2026-09-05** contra um projeto Supabase real, com as duas
migrations aplicadas, os 8 primeiros são o que fechou BUG-006..009. O cenário é montado e
destruído a cada rodada (conferido: nenhum tenant ou usuário residual).

Desde a Etapa 3 o cenário sobe um **asset-base real** para o Storage, em vez de gravar um
caminho inventado. A diferença é grande: com caminho falso, a recusa ao concorrente podia
ser "não achei" em vez de "não é seu". Os dois casos novos vieram daí, o dono baixa o
próprio arquivo e recebe o canônico, e o **canário do ADR-005**
(`normalizarSvg(baixado) === baixado`) fica vermelho se a ordem de cunhagem de id mudar,
antes de qualquer `svg_selector` gravado repointar em silêncio.

Rodar: `npm run test:banco`.

✅ **`chaveDeApi.test.ts` rodou verde em 2026-09-08**, junto com `apiDeVariante.test.ts`,
depois de a migration `20260908_chave_de_api_por_tenant.sql` ser aplicada ao projeto real:
`npm run test:banco` = **4 arquivos, 45 testes, todos passando**. Antes disso ele não pulava,
falhava, pular exigiria o ambiente ausente, e o ambiente estava presente. Continua valendo:
não confunda o verde do `npm test` com prova, porque lá ele é pulado por falta das variáveis,
como todos os daqui.

O que ele existe para provar é exatamente o que cliente falso não alcança: **privilégio de
coluna não existe em mock**. Um teste unitário de `criarChaveDeApi` passaria idêntico num
banco onde o `revoke` nunca rodou, e a diferença entre os dois bancos é o hash da
credencial comercial de todas as marcas ficar legível ou não.

Continua valendo a regra que criou este teste: SQL que não rodou não é correção provada.
Toda mudança futura em policy volta a passar por aqui antes de ser considerada feita.

## `apiDeVariante.test.ts`, por que ele não é redundante com o teste do handler

`api/v1/products/[productId]/_variants.test.ts` roda com cliente falso, e cliente falso
responde o que o teste mandou responder. Ele prova que o handler **pede** a coisa certa:
tabela, filtros, ordem dos passos. Não prova, e não tem como provar, que o que volta é a
coisa certa.

Só um banco de verdade prova que o `.eq('tenant_id', …)` de fato recorta a linha, que o
asset-base baixa do bucket privado com `service_role`, e que o `svg_selector` gravado pelo
editor resolve no arquivo canônico que está lá dentro. **Sob `service_role` não há RLS**, o
isolamento passa a ser código nosso, e código nosso é o que erra.

Dois testes daqui não olham status nenhum, e são os que mais importam:

- a variante devolvida é comparada **contra o canônico baixado do Storage**, exigindo que a
  cor da sola tenha sumido e a do cabedal tenha ficado idêntica. Sem a segunda metade, um
  seletor que capturasse o calçado inteiro passaria verde e só apareceria quando um cliente
  abrisse o arquivo;
- a chave de API é usada como credencial do Supabase e **precisa falhar**. Se fosse aceita, o
  cliente teria leitura do banco pela porta do front, e o que a nossa função filtra deixaria
  de importar.

✅ **Rodou verde em 2026-09-08**, na primeira vez que a migration existiu no banco. Um único
caso nasceu vermelho, e o defeito era do teste: ele afirmava que o corpo do 200 **começa** com
`<svg`, e um documento SVG legítimo pode começar com declaração XML ou comentário, o
asset-base do demo começa com um comentário do próprio arquivo. A asserção agora é `<svg`
presente e `</svg>` no fim, que é o contrato ("o documento inteiro, sem JSON em volta") e
ainda pega truncamento. Nenhum defeito de produto: o handler estava certo desde a Etapa 5.

O que ele **não** cobre: o olho. Nenhuma asserção aqui vê o desenho. Isso é
`api/_local/roteiroDePassada.md`, passo 17.

## `eloEditorApi.test.ts`, a diferença é **quem produziu o seletor**

`apiDeVariante.test.ts` monta os próprios `svg_selector` chamando `montarSeletorDeZona`
direto, e grava com `service_role`. Isso prova que a API **consome** o formato. Não prova
duas coisas:

1. que o que o editor **produz** é aquele formato, entre o clique e a coluna passam
   `marcarZona` (sobreposição, elemento inexistente, contorno `fill="none"`, preservação de
   `label`) e `gravarZonaNoBanco` (INSERT × UPDATE sob `unique (product_id, zone_key)`);
2. que a linha que a **RLS deixa o dono gravar** é a linha que a **`service_role` lê**
   depois. São dois caminhos de privilégio diferentes sobre a mesma linha, e até 2026-09-09
   nenhum teste atravessava os dois.

Por isso aqui a zona nasce pelo caminho de verdade, com `cenario.clienteA` (o dono
autenticado, atravessando a RLS como o navegador atravessa), e só depois a API é chamada.
Nenhum `svg_selector` é escrito à mão neste arquivo, e nenhum `insert` direto em
`product_zones` acontece.

A asserção que carrega o peso não é o status: é **`idsQueMudaram`**, que compara o SVG
devolvido com o canônico linha a linha e exige que os elementos alterados sejam exatamente
os da zona pedida. Um `svg_selector` que capturasse o calçado inteiro devolveria `200` com o
desenho destruído, e passaria em qualquer asserção de código de resposta.

✅ **Rodou verde em 2026-09-09**, e foi **verificado por mutação**, que neste projeto é o
que separa guarda de decoração:

| Mutação no código de produção | O que caiu |
|---|---|
| `montarSeletorDeZona` devolve só o primeiro id | zona de vários elementos, e os dois casos de UPDATE |
| `marcarZona` deixa de preservar `label` ausente (o BUG-014) | os dois casos de UPDATE |
| `montarSeletorDeZona` acrescenta `#zona-sola` ao seletor | **os três casos novos**, mais 6 de outros arquivos |

A terceira é a que importa: ela é a "zona que pega demais", e sem `idsQueMudaram` ela
passaria verde.

**O que este teste não alcança:** que o Chrome resolva `#a, #b` nos mesmos elementos que o
jsdom resolve. Está registrado como passo de olho em `api/_local/roteiroDePassada.md`, não
como código.
