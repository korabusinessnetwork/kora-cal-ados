# Endpoints da API de variante

> **Estado: contrato escrito, endpoint NÃO implementado.**
> Não existe função respondendo nesta rota. O que existe hoje é o **motor**
> (`src/lib/render/`, coberto por `npm test`) e o **contrato de autenticação**
> ([ADR-006](../08_DECISOES/adr-006-autenticacao-da-api-de-variante.md)).
> Este documento é a Etapa 1 — o contrato vem antes do código de propósito: rota, corpo e
> códigos de erro são a parte que não se troca depois do primeiro cliente integrado.
> Enquanto o handler não existir, **nada aqui pode ser lido como "isto funciona"**; leia como
> "isto é o que a implementação é obrigada a cumprir".

O contrato do endpoint morava, até agora, na seção "Fluxo — API (geração)" de
`docs/01_ARQUITETURA/overview.md`. Ele passa a morar aqui porque o `overview.md` responde
*como o sistema se encaixa*, e o contrato de um endpoint é outra pergunta — a que o cliente
da API lê.

---

## A rota

```
POST /api/v1/products/:productId/variants
```

**Só POST.** Qualquer outro método responde `405` com o header `Allow: POST` — recusa
explícita em vez de 404, porque 404 num método errado manda o integrador caçar um erro de
URL que não existe.

Três escolhas que valem o registro, porque cada uma custa caro se for revisitada depois:

- **Path em inglês, não `/produtos/:id/variantes`.** O corpo já é `{"sola": ...}` sob a
  coluna `zone_key`, que o glossário declara "chave pública da API e nunca é renomeada"
  (`docs/03_REGRAS_DE_NEGOCIO/glossario.md`). Path em português com corpo em inglês mistura
  dois idiomas dentro de uma requisição só. A prosa do projeto segue em português; o que o
  cliente digita, não.
- **`/v1` entra agora.** O custo hoje é um segmento de URL. O custo depois do primeiro
  cliente integrado é escolher entre fazer ele reescrever a integração ou carregar um alias
  sem versão para sempre.
- **Roteamento por sistema de arquivos da Vercel**, em
  `api/v1/products/[productId]/variants.ts`. **Não existe `vercel.json` e não vai existir**:
  a convenção zero-config já cobre esta rota, e um `vercel.json` criado por antecipação
  viraria uma segunda fonte de verdade sobre onde a rota mora — exatamente o tipo de
  divergência silenciosa que este diretório existe para evitar.

## O corpo do pedido

As cores vão no topo do objeto, **uma chave por `zone_key`**:

```json
{"sola": "#C0392B", "cabedal": "#111111"}
```

Não é `{"zone_colors": {...}, "format": "svg"}`. Essa forma apareceu num esboço de tela
(`PainelDaApi.tsx`) cujo próprio comentário dizia "a rota é proposta, não decisão" — nunca
foi decidida, e fica registrada aqui só para que ninguém a ressuscite achando que era.

**Regra: todo campo que não é cor vai para a query string, nunca para o topo do corpo.**
Escrita junto do contrato para não virar convenção implícita (CLAUDE.md: se "faz sentido
assim" e não está escrito, não existe). O motivo é concreto e não hipotético: o topo do corpo
é um espaço de nomes que **o tenant controla** — é ele quem cria as `zone_key` no editor. Um
campo `format` no corpo colidiria com uma zona chamada `format` no dia em que alguém a
criasse, e a colisão apareceria como cor não aplicada, não como erro de contrato. Query
string e corpo são espaços separados, e a separação é o que impede a colisão.

Corpo malformado, não-objeto, vazio ou acima do limite de tamanho → `CORPO_INVALIDO` 400.

## A resposta: sucesso é o artefato, erro é o envelope

### 200 — o SVG cru, sem envelope

```
HTTP/1.1 200 OK
Content-Type: image/svg+xml; charset=utf-8
Cache-Control: no-store

<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>
```

O corpo é byte a byte a saída de `gerarVarianteDeCor`. Isso abre exceção à regra de
`memory/patterns.md` ("sempre envelope, mesmo em sucesso"), e a exceção é deliberada — o
raciocínio, não só a conclusão:

1. **Envelopar exigiria escape e unescape de um documento inteiro.** O modo de falha desse
   round-trip (mojibake, BOM sobrando, sequência `\u` dentro de um `<text>`) é **mudança
   silenciosa do desenho** — a classe de defeito que o princípio nº1 do CLAUDE.md proíbe.
   Com o corpo nu não existe nenhuma transformação entre a saída do motor e o byte que o
   cliente grava em disco, então não há onde a mudança acontecer.
2. **O cliente é um ERP que quer um arquivo.** `curl -o modelo.svg` e `<img src="...">`
   funcionam com corpo nu e não funcionam com JSON.
3. **O `?format=png` de um dia** não caberia em JSON sem base64 — e base64 de imagem dentro
   de envelope é a mesma família de round-trip do item 1, com um terço a mais de tráfego.

`Cache-Control: no-store` **não é enfeite.** A decisão de 2026-09-08 de não cachear variante
em banco (`docs/01_ARQUITETURA/overview.md`) fica inútil se um CDN ou proxy intermediário
cachear a resposta HTTP: variante velha entregue depois de a zona ser remarcada é o mesmo
calçado errado, pela mesma causa, num lugar onde ninguém pensa em olhar.

**Nenhum header `X-Kora-*`.** O motor recusa aplicação parcial — ou todas as zonas pedidas
foram aplicadas, ou a resposta é erro —, então um header de "zonas aplicadas" repetiria o que
o corpo do pedido já diz e não informaria nada.

### Erro — sempre este envelope, `application/json`

```json
{
  "data": null,
  "error": { "code": "CHAVE_INVALIDA", "message": "Chave de API inválida." },
  "meta": { "timestamp": "2026-09-08T10:30:00.000Z", "version": "1" }
}
```

É o envelope de `memory/patterns.md`: `code` em enum estável, `message` em português e
acionável. A versão anterior de `autenticacao.md` mostrava `{"erro":"CHAVE_AUSENTE"}` — chave
em português, plana, sem `message`. Duas formas de erro na mesma API é o cliente parseando
uma das duas errado, e `erro` × `error` é "um termo, um nome" quebrado dentro do próprio
contrato. Vale o envelope acima, e `autenticacao.md` já foi corrigido. **Os códigos não
mudam** — eles são o contrato; o formato ao redor deles não era.

## Códigos e status

| `code` | Status | Família | Quando |
|---|---|---|---|
| `CHAVE_AUSENTE` | 401 | pedido | Sem header `Authorization`, sem esquema `Bearer`, **ou chave na query string** |
| `CHAVE_INVALIDA` | 401 | pedido | Malformada, inexistente **ou revogada** — as três com **mensagem idêntica** |
| `PRODUTO_NAO_ENCONTRADO` | 404 | pedido | Produto inexistente **ou de outro tenant**. Nunca 403 — 403 confirmaria que o id existe |
| `METODO_NAO_PERMITIDO` | 405 | pedido | Método diferente de POST. Acompanha o header `Allow: POST` |
| `CORPO_INVALIDO` | 400 | pedido | JSON malformado, não-objeto, vazio, ou acima do limite de tamanho |
| `FORMATO_NAO_SUPORTADO` | 400 | pedido | `?format=` diferente de `svg`. Recusa explícita, **nunca parâmetro ignorado em silêncio** |
| `ZONE_KEY_INVALIDA` | 422 | pedido | Chave semanticamente inválida (`"SOLA"`, `"__proto__"`, com acento ou espaço) |
| `COR_INVALIDA` | 422 | pedido | Valor que não é hex `#RGB` ou `#RRGGBB` |
| `ZONA_NAO_ENCONTRADA` | 422 | pedido | **Pré-checagem do handler**: pediu zona que este produto não tem. A mensagem lista as que ele tem |
| `ZONA_NAO_ENCONTRADA` | 409 | dado do tenant | **Vinda do motor**: o `svg_selector` gravado resolve zero elementos, ou não é seletor CSS válido |
| `ZONA_NAO_RECOLORIVEL` | 409 | dado do tenant | Zona mapeada em elemento que não aceita cor chapa (gradiente, pattern) |
| `ZONAS_SOBREPOSTAS` | 409 | dado do tenant | Duas zonas pedidas compartilham elemento (BUG-013) |
| `SVG_INVALIDO` | 409 | dado do tenant | O asset-base no Storage não é um SVG parseável |
| `SVG_NAO_NORMALIZAVEL` | 409 | dado do tenant | O asset-base canônico foi corrompido e não passa pela normalização |
| `MODELO_3D_INVALIDO` | 409 | dado do tenant | O asset-base 3D não é um glTF 2.0 utilizável: JSON malformado, sem `nodes`, sem nó com malha, ou índice de malha/material apontando para o que não existe |
| `MODELO_3D_NAO_NORMALIZAVEL` | 409 | dado do tenant | É glTF 2.0 e mesmo assim não vira canônico: exige extensão que não suportamos (Draco, meshopt) ou aponta para arquivo externo em `buffers`/`images` |
| `PECA_NAO_ENCONTRADA` | 422 | pedido | A composição escolheu uma peça que não está no acervo visível ao tenant. É o código do ADR-008 D1: o modelo de linguagem nunca inventa peça |
| `COMPOSICAO_INVALIDA` | 422 | pedido | A composição não tem a forma de uma composição: falta `forma_id`, `pecas` não é lista, forma desconhecida, categoria obrigatória ausente, categoria repetida, ou peça de categoria que a forma não prevê |
| `FORMAS_MISTURADAS` | 422 | pedido | A peça existe e o id está certo, mas ela é de outra forma. Peça só encaixa em peça da mesma forma (ADR-008 D4) |
| `PARAMETRO_INVALIDO` | 422 | pedido | Parâmetro fora da faixa declarada pela peça, não numérico, ou que a peça não declara |
| `FALHA_INTERNA` | 500 | nossa | Qualquer outro `Error`. Mensagem fixa; o detalhe vai só para o log |

Os dois códigos de modelo 3D são os gêmeos exatos dos de SVG (ADR-007), e ficam na mesma
família pela mesma razão: o pedido do integrador está correto e quem corrige é o time da
marca, no arquivo que subiu. Códigos próprios, e não reuso dos de SVG, porque a mensagem de
cada par ensina coisa diferente — "exporte com Presentation Attributes" contra "exporte sem
Draco, com os buffers embutidos" —, e um integrador que recebesse `SVG_INVALIDO` para um glTF
procuraria o defeito no arquivo errado.

Os quatro códigos de composição (ADR-008) vão na direção **oposta** à dos de modelo 3D, e vale
dizer por quê, porque a simetria enganaria: eles são **422**, não 409. Um modelo 3D quebrado é
arquivo já gravado do tenant, e o integrador não tem como consertá-lo; uma composição chega no
**corpo do pedido**, então é literalmente o pedido que é improcessável e quem corrige é quem
enviou. Mandá-lo ao editor de zonas o afastaria da causa.

O caso que ainda não existe, anotado antes de aparecer: uma composição **já gravada** que fica
inválida porque o acervo mudou (peça removida, forma aposentada) é dado do tenant e merece 409.
Quando esse ponto de chamada existir, a saída é a mesma que `ZONA_NAO_ENCONTRADA` já usa — o
handler pré-checa e levanta ele mesmo —, e não o mesmo código saindo com dois status da tabela.

`PECA_NAO_ENCONTRADA` merece uma linha à parte porque não é tratamento de erro, é fronteira de
segurança. A composição pode ter sido escrita por um modelo de linguagem, e o ADR-008 registra
que "a resposta do modelo vira escolha de arquivo". A validação é por **pertencimento ao
catálogo**, nunca por formato do id: um id sintaticamente impecável que não está no acervo é
recusado igual a um id absurdo.

### As três famílias, e por que "dado do tenant" é 409

A coluna **família** não é decoração: ela responde *quem tem que agir*, e é por ela que a
mensagem é escrita.

- **pedido** — quem corrige é o integrador, mudando o que ele envia. 4xx clássico.
- **dado do tenant** — o pedido está **certo**; o que está errado é o mapeamento de zonas ou
  o asset-base daquele produto. Quem corrige é o time da marca, **no editor de zonas**.
- **nossa** — defeito do sistema. 500.

**Por que 409 e não 500** para a família do meio: 500 sinaliza "tente de novo", e clientes com
retry automático reprocessariam em laço um `svg_selector` que não conserta sozinho — além de
enterrar um erro de dado no meio do alarme de indisponibilidade, onde ninguém vai procurá-lo.

**Por que 409 e não 422**: 422 diz "o payload que você mandou está errado" e manda o
integrador caçar defeito num pedido que está correto. Ele revisaria o JSON pelo tempo que
aguentasse sem chegar perto da causa, que está no banco do tenant.

409 é literalmente "a requisição conflita com o estado atual do recurso": autenticada, bem
formada, e ainda assim impossível pelo estado em que aquele produto está.

**A mensagem muda com a família, e isso é metade do valor.** Um 409 nunca diz "corrija o
pedido"; diz que o mapeamento de zonas deste produto precisa de correção no editor. É o que o
próprio motor já faz em `ZONAS_SOBREPOSTAS`, cuja mensagem termina em "corrija o mapeamento
das zonas".

### `ZONA_NAO_ENCONTRADA` é o único código ambíguo

Ele aparece duas vezes na tabela, com status diferentes. Não é engano, e não se resolve
renomeando: `src/lib/render/erros.ts` diz, no comentário do próprio arquivo, que mudar um
código quebra cliente e por isso ele não muda. Os 7 códigos do motor não mudam nem ganham
membro novo.

**A ambiguidade é resolvida na origem, não em quem lê a resposta.** O handler lê as zonas do
produto no banco antes de chamar o motor; com essa lista na mão ele **pré-checa** as
`zone_key` pedidas e levanta ele mesmo o 422, com a lista das zonas que o produto tem — que é
a informação acionável. Depois dessa pré-checagem, a única forma de o **motor** lançar
`ZONA_NAO_ENCONTRADA` é seletor gravado quebrado, e aí é 409.

Ou seja: o mesmo `code` com dois status é a consequência de a origem já ter separado os dois
casos, não uma dúvida deixada para o integrador desfazer.

Os códigos de **transporte** (`CHAVE_AUSENTE`, `CHAVE_INVALIDA`, `PRODUTO_NAO_ENCONTRADO`,
`METODO_NAO_PERMITIDO`, `CORPO_INVALIDO`, `FORMATO_NAO_SUPORTADO`, `FALHA_INTERNA`) não são do
motor: o lugar deles é uma união própria em `api/_lib/tiposDaApi.ts`, que **estende**
`CodigoDeErro` sem editá-lo. O motor não sabe o que é HTTP, e continua não sabendo.

## Autenticação

Resumo do que o endpoint exige; o contrato completo está em
[`autenticacao.md`](autenticacao.md) e o porquê no
[ADR-006](../08_DECISOES/adr-006-autenticacao-da-api-de-variante.md).

```
Authorization: Bearer kora_live_7f3ab902_<segredo>
```

- **Nunca em query string.** `?api_key=`, `?key=`, `?token=`, `?access_token=` → 401
  `CHAVE_AUSENTE`, sem sequer olhar o header.
- O `tenant_id` sai **sempre** da chave — nunca do corpo, da URL ou de header do chamador.
- O `productId` da URL é conferido contra esse `tenant_id` antes de qualquer outra coisa.

## Exemplos

Troque `<host>` pelo host onde o handler estiver respondendo e o `productId` pelo id real do
produto. A chave vai inteira, sempre no header.

### Sucesso — grava o SVG em disco

```bash
curl -X POST "https://<host>/api/v1/products/a3f1c2d4-5e6b-4a7c-8d9e-0f1a2b3c4d5e/variants" \
  -H "Authorization: Bearer kora_live_7f3ab902_SEGREDO" \
  -H "Content-Type: application/json" \
  -d '{"sola": "#C0392B", "cabedal": "#111111"}' \
  -o modelo-vermelho.svg
```

`200`, `Content-Type: image/svg+xml; charset=utf-8`, corpo = o SVG. Com `-o`, o arquivo já
sai pronto para abrir — é exatamente o uso que motivou o corpo nu.

### 401 — sem chave

```bash
curl -i -X POST "https://<host>/api/v1/products/a3f1c2d4-5e6b-4a7c-8d9e-0f1a2b3c4d5e/variants" \
  -H "Content-Type: application/json" \
  -d '{"sola": "#C0392B"}'
```

```json
{
  "data": null,
  "error": { "code": "CHAVE_AUSENTE", "message": "Envie a chave de API em Authorization: Bearer." },
  "meta": { "timestamp": "2026-09-08T10:30:00.000Z", "version": "1" }
}
```

A mesma resposta sai se a chave vier em `?api_key=` em vez do header.

### 404 — produto de outro tenant

```bash
curl -i -X POST "https://<host>/api/v1/products/00000000-0000-4000-8000-000000000000/variants" \
  -H "Authorization: Bearer kora_live_7f3ab902_SEGREDO" \
  -H "Content-Type: application/json" \
  -d '{"sola": "#C0392B"}'
```

```json
{
  "data": null,
  "error": { "code": "PRODUTO_NAO_ENCONTRADO", "message": "Produto não encontrado." },
  "meta": { "timestamp": "2026-09-08T10:30:00.000Z", "version": "1" }
}
```

Produto inexistente e produto de **outra marca** dão exatamente esta resposta. 403 contaria ao
chamador que aquele id existe, e marcas concorrentes convivem no mesmo sistema.

### 422 — cor inválida

```bash
curl -i -X POST "https://<host>/api/v1/products/a3f1c2d4-5e6b-4a7c-8d9e-0f1a2b3c4d5e/variants" \
  -H "Authorization: Bearer kora_live_7f3ab902_SEGREDO" \
  -H "Content-Type: application/json" \
  -d '{"sola": "vermelho"}'
```

```json
{
  "data": null,
  "error": {
    "code": "COR_INVALIDA",
    "message": "Cor \"vermelho\" da zona \"sola\" não é um hex válido (esperado #RRGGBB)."
  },
  "meta": { "timestamp": "2026-09-08T10:30:00.000Z", "version": "1" }
}
```

Nome CSS não é aceito (ADR-004): "red" é ambíguo entre renderizadores, e ambiguidade de cor é
o defeito que o princípio nº1 proíbe. A forma curta `#F00` é aceita e expande para `#FF0000`.

### 409 — zonas sobrepostas (dado do tenant)

```bash
curl -i -X POST "https://<host>/api/v1/products/a3f1c2d4-5e6b-4a7c-8d9e-0f1a2b3c4d5e/variants" \
  -H "Authorization: Bearer kora_live_7f3ab902_SEGREDO" \
  -H "Content-Type: application/json" \
  -d '{"cabedal": "#111111", "lingueta": "#C0392B"}'
```

```json
{
  "data": null,
  "error": {
    "code": "ZONAS_SOBREPOSTAS",
    "message": "As zonas \"cabedal\" e \"lingueta\" dividem 2 elemento(s). Qual cor vale seria decidido pela ordem do pedido — corrija o mapeamento das zonas. O pedido está correto: o que precisa de correção é o mapeamento de zonas ou o arquivo base deste produto, no editor de zonas da marca. Repetir a chamada não resolve."
  },
  "meta": { "timestamp": "2026-09-08T10:30:00.000Z", "version": "1" }
}
```

O pedido está correto; o mapeamento das duas zonas é que se sobrepõe. Repetir a chamada não
resolve — quem resolve é o time da marca, no editor de zonas (BUG-013).

A mensagem tem duas partes coladas, e isso é regra e não acaso: a primeira frase vem do motor
(nomeia as zonas e quantos elementos elas dividem) e a segunda é acrescentada por
`api/_lib/traduzirParaFalhaDaApi.ts` a **todo** erro da família "dado do tenant" — sozinha, a
mensagem do motor fala de elemento e seletor, vocabulário sobre o qual quem integra não tem
como agir. Os 422 não recebem esse acréscimo: eles já dizem o que mudar no pedido.

### 400 — `?format=png`

```bash
curl -i -X POST "https://<host>/api/v1/products/a3f1c2d4-5e6b-4a7c-8d9e-0f1a2b3c4d5e/variants?format=png" \
  -H "Authorization: Bearer kora_live_7f3ab902_SEGREDO" \
  -H "Content-Type: application/json" \
  -d '{"sola": "#C0392B"}'
```

```json
{
  "data": null,
  "error": { "code": "FORMATO_NAO_SUPORTADO", "message": "Formato \"png\" não é suportado. Use format=svg." },
  "meta": { "timestamp": "2026-09-08T10:30:00.000Z", "version": "1" }
}
```

Recusa explícita, nunca parâmetro ignorado em silêncio: quem pede PNG e recebe 200 com um SVG
dentro só descobre o problema no fim do pipeline dele, longe da causa.

## Fora de escopo deste contrato

Registrado para não ser confundido com omissão:

- **`?format=png`** — exige `sharp`/`resvg` e, pior, introduz um **segundo renderizador**.
  Antes de vender PNG é preciso provar que o pixel dele é o hex do SVG, e isso é entrega
  própria sob o princípio nº1. Hoje, `?format=` diferente de `svg` é 400 explícito.
- **UI de gerenciamento de chaves de API** — fica em script, como o provisionamento de tenant.
- **Rate limiting** — o ADR-006 já o coloca fora por escrito.
- **Deploy, `vercel.json` e CI.**
- **Cache em `variants`** — decisão de 2026-09-08; a tabela segue sem uso.
- **Segundo endpoint, métrica e cobrança por uso.**

## Ligações

- [`autenticacao.md`](autenticacao.md) — a chave de API, o header e as respostas 401/404
- `../08_DECISOES/adr-006-autenticacao-da-api-de-variante.md` — por que a autenticação é assim
- `../08_DECISOES/adr-004-contrato-de-zona-e-normalizacao-de-svg.md` — o contrato de zona que
  este endpoint aplica, e os códigos de erro do motor
- `../01_ARQUITETURA/overview.md` — o fluxo de geração ponta a ponta
- `../../src/lib/render/erros.ts` — os 7 códigos do motor, imutáveis
- `../../memory/patterns.md`, seção "Padrões de API / Backend" — o envelope de erro
