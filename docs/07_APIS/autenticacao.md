# Autenticação da API de variante

> **Estado: contrato decidido, não implementado.** A API de variante ainda não existe.
> Este documento é o contrato que ela vai cumprir, fixado pelo
> [ADR-006](../08_DECISOES/adr-006-autenticacao-da-api-de-variante.md) — o *porquê* de
> cada regra está lá; aqui está só o *o quê*.

## Duas autenticações, e elas não se misturam

| | Editor de zonas (app) | API de variante |
|---|---|---|
| Quem chama | pessoa, no navegador | sistema do cliente, num servidor |
| Credencial | JWT de sessão do Supabase (anon key + login) | **chave de API do tenant** |
| Isolamento | RLS do Postgres | responsabilidade da função (ver abaixo) |
| Onde vive | `src/features/sessao/` | função serverless, fora de `src/` |

Uma chave de API **não** abre o editor. Um login de editor **não** chama a API. Não existe
credencial que sirva para os dois.

## A chave

```
kora_live_7f3ab902_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
└──┬─┘ └─┬┘ └───┬──┘ └──────────────────┬───────────────────┘
  │     │      │                        └── segredo: 32 bytes aleatórios (base64url)
  │     │      └── prefixo: identifica a chave em log e na UI, não autentica
  │     └── ambiente: `live` ou `test`
  └── produto
```

- Gerada por **owner** do tenant. Membro não cria nem revoga chave.
- **Exibida uma única vez**, na criação. O banco guarda o prefixo em claro e o
  **SHA-256 do segredo** — não existe "ver a chave de novo".
- Um tenant pode ter **várias chaves ativas** ao mesmo tempo, para rotacionar sem derrubar
  a integração.
- Revogar preenche `revogada_em`; a linha nunca é apagada.

## Como enviar

```bash
curl -X POST https://<host>/api/products/<product_id>/variants \
  -H "Authorization: Bearer kora_live_7f3ab902_..." \
  -H "Content-Type: application/json" \
  -d '{"sola": "#C0392B", "cabedal": "#111111"}'
```

**Nunca em query string.** URL entra em log de acesso, histórico de navegador e cabeçalho
`Referer` — é o caminho mais comum de uma credencial vazar sem ninguém perceber. Um pedido
com a chave na URL é recusado como se não tivesse chave.

## O que a chave decide, e o que ela não decide

A chave determina o `tenant_id`. **Só ela.**

- `tenant_id` nunca é lido do corpo, da URL ou de header do chamador. Se o chamador puder
  dizer de quem é o produto, a marca A pede a variante da marca B.
- `product_id` é conferido contra o `tenant_id` da chave **antes** de qualquer outra coisa.
- Produto de outro tenant responde **404**, não 403 — 403 confirmaria que aquele id existe,
  e marcas concorrentes convivem no mesmo sistema.

## Respostas de autenticação

| Situação | Status | Corpo |
|---|---|---|
| Sem header `Authorization` | 401 | `{"erro":"CHAVE_AUSENTE"}` |
| Chave malformada, inexistente **ou revogada** | 401 | `{"erro":"CHAVE_INVALIDA"}` |
| Chave válida, `product_id` de outro tenant ou inexistente | 404 | `{"erro":"PRODUTO_NAO_ENCONTRADO"}` |

Chave revogada e chave inexistente respondem **igual** — mesma mensagem, mesmo tempo.
Distinguir as duas contaria ao atacante que ele acertou um prefixo real.

Os erros de **geração** (zona ausente, cor inválida, gradiente, zonas sobrepostas) são
outra família: vêm de `src/lib/render/erros.ts`, que já é contrato, e continuam sendo
**erro**, nunca 200 com variante "quase certa" (ADR-004).

## O que ainda não está decidido

Registrado para não ser confundido com omissão:

- **Rate limiting** — a chave por tenant é o que torna um limite por tenant *possível*; o
  limite em si não existe.
- **Versionamento da API** (`/v1/`) — nenhum cliente integrou ainda; a decisão pode
  esperar o primeiro, mas não o segundo.
- **Métrica e cobrança por uso** — só `ultima_utilizacao_em` está previsto, e serve para
  responder "esta chave ainda serve para alguma coisa?" antes de revogar.
