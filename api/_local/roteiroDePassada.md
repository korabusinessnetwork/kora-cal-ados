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

Precisa de um produto com as zonas de defeito marcadas — dois estados que **o editor se
recusa a criar** e que o banco pode ter mesmo assim. `npm run semear-zonas` grava as duas no
produto de demonstração: `detalhe-gradiente` (o retângulo pintado com `url(#brilho)`) e
`sobreposta`, que aponta para o **primeiro elemento da zona `ilhos`** de propósito.

| # | Corpo | Esperado |
|---|---|---|
| 14 | `-d '{"detalhe-gradiente":"#C0392B"}'` | `409` `ZONA_NAO_RECOLORIVEL` |
| 15 | `-d '{"sobreposta":"#C0392B","ilhos":"#1F6F5C"}'` | `409` `ZONAS_SOBREPOSTAS` |
| 16 | `zone_key` cujo `svg_selector` não resolve nada | `409` `ZONA_NAO_ENCONTRADA` — o **mesmo código** do passo 13, com status diferente |

A mensagem destes três termina com a orientação de que o conserto é **no editor de zonas** e
que repetir a chamada não resolve. É metade do valor do 409: sem ela, um cliente com retry
reprocessa em laço um `svg_selector` que nunca conserta sozinho.

O passo 15 só falha se as duas zonas do par forem pedidas **juntas**. Pedir `sobreposta`
sozinha devolve `200`: a recusa é sobre o conjunto do pedido, não sobre a zona. Na passada de
2026-09-08 eu perdi duas tentativas mandando `sobreposta` com `sola` e com `cadarco` — as duas
deram `200`, corretamente, porque `sobreposta` divide elemento com `ilhos` e com mais ninguém.
Confira em `product_zones` **qual** é o par antes de montar o corpo.

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

## Bloco 6b — o elo com o editor, que é o único passo que exige DUAS janelas

Este é o resíduo que `supabase/tests/eloEditorApi.test.ts` **não** alcança: aquele teste
percorre editor → API por inteiro, mas o lado do editor roda em **jsdom**. O que ninguém
verifica automaticamente é se o **Chrome** resolve `#a, #b` nos mesmos elementos que o jsdom
resolve.

O risco é pequeno e vale dizer por quê, para ninguém superestimar o passo: o seletor é uma
lista de ids exatos — a forma mais simples de seletor que existe — e o editor **não cunha
id** (ADR-005: ele é somente-leitura sobre o canônico, e os ids nascem em `normalizarSvg`, no
provisionamento, em Node). Editor e API leem o mesmo arquivo com os mesmos ids. Mas pequeno
não é zero, e é o único ponto do produto onde duas implementações de DOM leem a mesma string.

Com `npm run dev` numa janela e o servidor da API na outra:

| # | Passo | O que conferir |
|---|---|---|
| 19 | No editor, abrir o modelo e marcar uma zona **nova**, com **dois elementos**, e salvar | a zona aparece na lista com os dois |
| 20 | Recarregar a página | a zona continua lá, com os dois elementos |
| 21 | `select zone_key, svg_selector from product_zones` daquele produto | o seletor é `#a, #b` — ids exatos, sem prefixo |
| 22 | `POST` na API com aquela `zone_key` | `200`, e **os dois** elementos saem na cor pedida |
| 23 | Abrir o SVG devolvido ao lado da tela do editor | o que ficou colorido é o que estava destacado no editor — mesmos elementos, nenhum a mais |

O passo 23 é o princípio nº1 conferido com o olho: "cor no editor = cor na API". Se algum dia
ele falhar, o suspeito não é o motor (ele é o mesmo módulo dos dois lados) — é o Chrome e o
jsdom discordando sobre a mesma lista de ids.

**Estado:** ⏳ não percorrido. Os passos 19–23 precisam de alguém no navegador; o resto do
elo já está coberto por teste automatizado desde 2026-09-09.

## Bloco 7 — o log, que é onde a chave vaza

Com o servidor local ainda no terminal, olhe **todas** as linhas que ele imprimiu:

- [ ] **zero** ocorrências da chave inteira — só o prefixo de 8 caracteres pode aparecer
      (`grep -c 'kora_live\|kora_test'` tem de dar `0`)
- [ ] nenhum `rota=` com `?` — `logDaRequisicao` remove a query string, e é exatamente ali que
      uma chave mal colada pela query apareceria
- [ ] nenhum hash, nenhum `base_asset_path` (ele contém o `tenant_id`)

## Medição de tempo — o que a passada de 2026-09-08 mediu, e por que o resultado assusta à toa

O passo 4 tem um irmão que não é um `curl` só: **medir**. O ADR-006 D1 promete que o tempo de
resposta não diz se um prefixo existe. Isso é afirmação sobre relógio, e relógio se mede.

```bash
K_EXISTE="kora_test_<prefixo REAL de uma chave>_$(printf 'k%.0s' {1..43})"   # segredo errado
K_NAO="kora_test_deadbeef_$(printf 'k%.0s' {1..43})"                          # prefixo que não existe
medir() {
  for i in $(seq 1 12); do
    curl -s -o /dev/null -w '%{time_total}\n' -X POST "$API/$PRODUTO/variants" \
      -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d '{"sola":"#C0392B"}'
  done | sort -n | awk '{v[NR]=$1} END {printf "mediana=%s\n", v[int(NR/2)+1]}'
}
medir "$K_EXISTE"; medir "$K_NAO"; medir 'nada'
```

Medido em 2026-09-08, 12 amostras cada:

| Chave enviada | mediana |
|---|---|
| prefixo que **existe**, segredo errado | 74,8 ms |
| prefixo que **não existe**, formato válido | 72,8 ms |
| lixo sem formato de chave | 12,8 ms |

**As duas primeiras são indistinguíveis, e é isso que o ADR-006 D1 exige.** A terceira é ~6×
mais rápida, e à primeira vista parece um vazamento — não é: ela separa "chave bem formada"
de "chave malformada", e o formato da chave está **publicado** em
`docs/07_APIS/autenticacao.md`. O atacante não aprende nada que já não estivesse no doc.

O que seria vazamento é a primeira linha destoar da segunda — aí o tempo diria quais prefixos
existem, e o prefixo é só 8 caracteres hex. Se um dia essas duas divergirem, o suspeito é uma
saída antecipada nova em `autenticarChaveDeApi.ts`: hoje a função consulta o banco, calcula o
hash e compara **mesmo quando já sabe que vai recusar**, de propósito.

## Observação da passada: recusa não registra prefixo no log

Toda linha de 401 sai com `prefixo=ausente`, inclusive quando a chave enviada tinha um prefixo
real. É consequência do desenho: o prefixo só existe depois que `autenticarChaveDeApi`
devolve, e ela não devolve nada quando recusa. Custo: com um cliente reclamando de 401, o log
não diz **qual** chave ele mandou. Não é defeito — é um trade-off que ninguém tinha escrito.

## O que já foi feito, e o que falta

Passada completa em **2026-09-08**, com a migration já aplicada, contra o Supabase real e o
produto de demonstração (`aurora-demo` / "Runner 2026"):

| Passo | Resultado observado |
|---|---|
| 1 GET | ✅ `405` + `allow: POST` |
| 2 sem chave | ✅ `401 CHAVE_AUSENTE` + `cache-control: no-store` |
| 3 × 4 lixo × formato válido inexistente | ✅ `diff` **vazio** — respostas idênticas |
| 5 revogada × inventada | ✅ `diff` **vazio** |
| 6 chave na query com header válido | ✅ `401 CHAVE_AUSENTE` — o header não é lido |
| 8 produto inexistente | ✅ `404 PRODUTO_NAO_ENCONTRADO` |
| 10 corpo vazio | ✅ `400 CORPO_INVALIDO` |
| 11 `?format=png` | ✅ `400 FORMATO_NAO_SUPORTADO` |
| 12 cor inválida | ✅ `422 COR_INVALIDA`, sem falar em editor |
| 13 zona inexistente | ✅ `422 ZONA_NAO_ENCONTRADA` + a lista das 6 zonas do produto |
| 14 gradiente | ✅ `409 ZONA_NAO_RECOLORIVEL` + a orientação de editor |
| 15 sobreposição (`sobreposta` + `ilhos`) | ✅ `409 ZONAS_SOBREPOSTAS` |
| 17 o 200 e o arquivo | ✅ SVG de 3.464 bytes, abre no navegador |
| 18 cabeçalhos | ✅ `image/svg+xml; charset=utf-8` + `no-store` |
| Bloco 7 log | ✅ 0 ocorrências do segredo, 0 `rota=` com query, 0 `base_asset_path`; só `prefixo=` de 8 caracteres |
| Medição de tempo | ✅ ver a seção acima |

**A prova mais forte do passo 17 não é o status: é o `diff`.** Comparando o canônico baixado
do Storage com a variante devolvida pela API, **duas linhas diferem — a mesma linha, antes e
depois** — e a única mudança dentro dela é `fill="#2E2E33"` → `fill="#C0392B"` no elemento
`zona-sola`. Todo o resto do documento é byte a byte igual. É a forma verificável de "mudou a
sola e **nada mais**".

```bash
diff canonico-original.svg variante-sola-vermelha.svg | grep -c '^[<>]'   # 2
```

Faltam: **7** (a chave de API contra o Supabase) e **9** (o 404 do concorrente comparado com
o de um id inventado) — os dois estão cobertos por `supabase/tests/apiDeVariante.test.ts`, que
roda verde contra o mesmo banco, e não foram repetidos à mão. **16** (seletor gravado que não
resolve) precisa de uma zona quebrada de propósito, que o produto de demonstração não tem —
também coberto pelo teste automatizado.

## Ligações

- [`README.md`](README.md) — o servidor local e a lista do que ele **não** prova
- `../../docs/07_APIS/endpoints.md` — o contrato que este roteiro exercita
- `../../supabase/tests/apiDeVariante.test.ts` — as mesmas garantias como teste automatizado,
  contra o banco real. Ele cobre status, corpo e cabeçalhos; **não** cobre o passo 17
