# Passada dirigida na API de variante — o roteiro

Por que este arquivo existe: `memory/learnings.md` registra três vezes que **suíte verde não
prova o que a interface entrega**. Na Fase 1 a passada em Chrome achou defeitos que a suíte
inteira não achou. Aqui o "usuário" é um programa, então a interface é HTTP — e a passada é
`curl`.

O passo que nenhum teste substitui é o **17**: abrir o SVG da resposta no navegador e conferir
**com o olho** que a sola mudou e que **nada mais** mudou. Um seletor que capturasse o calçado
inteiro passa em toda asserção de status; ele só aparece no olho.

## Antes de começar

```bash
npm run api:local          # sobe em http://localhost:3210
npm run criar-chave        # imprime a chave em claro UMA vez — copie
```

Guarde as chaves em variáveis de shell; nunca as cole num arquivo do repositório:

```bash
CHAVE='kora_test_...'          # chave ativa do tenant A
CHAVE_B='kora_test_...'        # chave de OUTRO tenant, para o bloco 3
CHAVE_REVOGADA='kora_test_...' # criada e depois passada por `npm run revogar-chave`
PRODUTO='...'                  # id de um produto do tenant A, com zonas marcadas
API="http://localhost:3210/api/v1/products"
```

## Bloco 1 — transporte (não precisa de chave válida)

| # | Comando | Esperado |
|---|---|---|
| 1 | `curl -i "$API/$PRODUTO/variants"` | `405`, header `Allow: POST`, `METODO_NAO_PERMITIDO` |
| 2 | POST sem header `Authorization` | `401` `CHAVE_AUSENTE` + `Cache-Control: no-store` |
| 3 | POST com `Authorization: Bearer nada` | `401` `CHAVE_INVALIDA` |
| 4 | POST com uma chave de formato válido e prefixo inexistente | `401` `CHAVE_INVALIDA`, **corpo idêntico ao do passo 3** |

O passo 4 é o que carrega peso: formato válido com prefixo inexistente tem de responder **a
mesma coisa** que lixo sem formato nenhum. Diferença aqui é o oráculo que o ADR-006 D1 fecha.
Compare de verdade, não a olho:

```bash
sem_ts() { sed 's/"timestamp":"[^"]*"/"timestamp":"X"/'; }
pedir() {
  curl -s -X POST "$API/$PRODUTO/variants" -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' -d '{"sola":"#C0392B"}' | sem_ts
}
diff <(pedir 'nada') <(pedir "kora_test_deadbeef_kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk")
```

Saída esperada: **nada**. O `sed` neutraliza só o `timestamp`, que muda por definição — o
resto tem de bater byte a byte.

## Bloco 2 — a chave

| # | Comando | Esperado |
|---|---|---|
| 5 | `diff <(pedir "$CHAVE_REVOGADA") <(pedir 'nada')` | `401` e **saída vazia**: revogada responde igual a inventada |
| 6 | POST em `"$API/$PRODUTO/variants?api_key=$CHAVE"` **com** `Authorization: Bearer $CHAVE` junto | `401` `CHAVE_AUSENTE` — o header válido **não chega a ser lido** |
| 7 | `curl -s "$SUPABASE_URL/rest/v1/products?select=id" -H "apikey: $CHAVE"` | erro do Supabase: a chave de API **não abre o banco** |

O passo 5 é o mesmo requisito do 4 por outro caminho: se a revogada respondesse diferente,
quem sonda saberia que aquele prefixo já existiu.

O passo 7 é a separação que sustenta o produto inteiro. Se a chave de integração fosse aceita
pelo Supabase, o cliente teria leitura do banco pela porta do front — e o que a nossa função
filtra deixaria de importar.

## Bloco 3 — a marca concorrente

| # | Comando | Esperado |
|---|---|---|
| 8 | `$CHAVE_B` pedindo o produto de A | `404` `PRODUTO_NAO_ENCONTRADO` |
| 9 | `$CHAVE_B` num id inventado (`00000000-0000-4000-8000-000000000000`) | `404`, corpo **idêntico** ao do passo 8 |

Mesmo `diff` do bloco 1. **Nunca** `403`: confirmar que o id existe já é vazamento entre
concorrentes (ADR-006 D3). E o corpo do 8 não pode conter `<svg` nem nome de zona nenhum.

## Bloco 4 — o pedido errado (quem conserta é o cliente)

| # | Corpo / query | Esperado |
|---|---|---|
| 10 | `-d '{}'` | `400` `CORPO_INVALIDO` |
| 11 | `?format=png` | `400` `FORMATO_NAO_SUPORTADO` — nunca ignorado em silêncio |
| 12 | `-d '{"sola":"vermelho"}'` | `422` `COR_INVALIDA` |
| 13 | `-d '{"bico":"#C0392B"}'` (zona que o produto não tem) | `422` `ZONA_NAO_ENCONTRADA`, e a mensagem **lista as zonas do produto** |

No 13, leia a mensagem inteira. Ela **não** pode mandar corrigir no editor — o pedido é que
está errado. E ela **precisa** trazer a lista: sem ela, quem integra fica adivinhando o nome
da zona.

## Bloco 5 — o dado do tenant errado (o pedido está certo)

Precisa de um produto com as zonas de defeito marcadas. `npm run semear-zonas` grava as zonas
do demo; a de gradiente é `detalhe`.

| # | Corpo | Esperado |
|---|---|---|
| 14 | `-d '{"detalhe":"#C0392B"}'` | `409` `ZONA_NAO_RECOLORIVEL` |
| 15 | duas `zone_key` apontando o mesmo elemento | `409` `ZONAS_SOBREPOSTAS` |
| 16 | `zone_key` cujo `svg_selector` não resolve nada | `409` `ZONA_NAO_ENCONTRADA` — o **mesmo código** do passo 13, com status diferente |

A mensagem destes três termina com a orientação de que o conserto é **no editor de zonas** e
que repetir a chamada não resolve. É metade do valor do 409: sem ela, um cliente com retry
reprocessa em laço um `svg_selector` que nunca conserta sozinho.

O par 13 × 16 é o ponto mais fácil de contradizer do projeto. Rode os dois **na mesma
passada**, um atrás do outro, e compare as duas mensagens lado a lado.

## Bloco 6 — o 200, e o olho

```bash
# 17
curl -s -X POST "$API/$PRODUTO/variants" \
  -H "Authorization: Bearer $CHAVE" -H 'Content-Type: application/json' \
  -d '{"sola":"#C0392B"}' -o "$TEMP/variante.svg"
```

Abra o arquivo **no navegador** (`start "$TEMP/variante.svg"` no Windows, `xdg-open` no
Linux) — não no terminal:

- [ ] a sola está vermelha
- [ ] cabedal, logo, cadarços, língua e biqueira estão **exatamente** como no modelo original
- [ ] o desenho não perdeu nenhuma parte, nenhum contorno ficou preto
- [ ] o arquivo abre sozinho, sem depender de nada externo

Abra o canônico ao lado para comparar. É a única forma de pegar seletor que captura demais.

```bash
# 18 — os cabeçalhos do 200
curl -sD - -o /dev/null -X POST "$API/$PRODUTO/variants" \
  -H "Authorization: Bearer $CHAVE" -H 'Content-Type: application/json' \
  -d '{"sola":"#C0392B"}'
```

`Content-Type: image/svg+xml; charset=utf-8` e `Cache-Control: no-store`. O `no-store` não é
enfeite: variante cacheada por um CDN depois de a zona ser remarcada é o mesmo calçado errado,
num lugar onde ninguém olha.

## Bloco 7 — o log, que é onde a chave vaza

Com o servidor local ainda no terminal, olhe **todas** as linhas que ele imprimiu:

- [ ] **zero** ocorrências da chave inteira — só o prefixo de 8 caracteres pode aparecer
      (`grep -c 'kora_live\|kora_test'` tem de dar `0`)
- [ ] nenhum `rota=` com `?` — `logDaRequisicao` remove a query string, e é exatamente ali que
      uma chave mal colada pela query apareceria
- [ ] nenhum hash, nenhum `base_asset_path` (ele contém o `tenant_id`)

## O que já foi feito, e o que falta

| Passo | Estado |
|---|---|
| 1, 2, 3, 4, 6 | ✅ observados em 2026-09-08 contra `npm run api:local` |
| Bloco 7 | ✅ observado na mesma passada: zero ocorrências de `kora_live` no log, `rota=` sem query |
| 5, 7, 8, 9, 10–18 | ⏳ **bloqueados**: dependem de uma chave válida, e a migration `supabase/migrations/20260908_chave_de_api_por_tenant.sql` ainda não foi aplicada ao projeto real |

Enquanto a tabela `tenant_api_keys` não existir, uma chave de formato válido responde `500
FALHA_INTERNA` em vez de `401 CHAVE_INVALIDA`: o erro de tabela ausente sobe como falha
interna. Aplicada a migration, refaça o roteiro **do passo 1**, não a partir do 5 — o
comportamento dos primeiros muda quando a tabela passa a existir.

## Ligações

- [`README.md`](README.md) — o servidor local e a lista do que ele **não** prova
- `../../docs/07_APIS/endpoints.md` — o contrato que este roteiro exercita
- `../../supabase/tests/apiDeVariante.test.ts` — as mesmas garantias como teste automatizado,
  contra o banco real. Ele cobre status, corpo e cabeçalhos; **não** cobre o passo 17
