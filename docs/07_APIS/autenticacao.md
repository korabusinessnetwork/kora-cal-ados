# Autenticação da API de variante

> **Estado: contrato decidido, não implementado.** A API de variante ainda não existe.
> Este documento é o contrato que ela vai cumprir, fixado pelo
> [ADR-006](../08_DECISOES/adr-006-autenticacao-da-api-de-variante.md), o *porquê* de
> cada regra está lá; aqui está só o *o quê*.
> A rota, o corpo e a tabela completa de códigos estão em [`endpoints.md`](endpoints.md).

## Duas autenticações, e elas não se misturam

| | Editor de zonas (app) | API de variante |
|---|---|---|
| Quem chama | pessoa, no navegador | sistema do cliente, num servidor |
| Credencial | JWT de sessão do Supabase (anon key + login) | **chave de API do tenant** |
| Isolamento | RLS do Postgres | responsabilidade da função (ver abaixo) |
| Onde vive | `src/features/sessao/` | função serverless em `api/`, fora de `src/` |

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
  **SHA-256 do segredo**, não existe "ver a chave de novo".
- Um tenant pode ter **várias chaves ativas** ao mesmo tempo, para rotacionar sem derrubar
  a integração.
- Revogar preenche `revoked_at`; a linha nunca é apagada.

## Como enviar

```bash
curl -X POST https://<host>/api/v1/products/<product_id>/variants \
  -H "Authorization: Bearer kora_live_7f3ab902_..." \
  -H "Content-Type: application/json" \
  -d '{"sola": "#C0392B", "cabedal": "#111111"}'
```

**Nunca em query string.** URL entra em log de acesso, histórico de navegador e cabeçalho
`Referer`, é o caminho mais comum de uma credencial vazar sem ninguém perceber.

Um pedido com a chave em `?api_key=`, `?key=`, `?token=` ou `?access_token=` é recusado como
`CHAVE_AUSENTE`, **sem sequer olhar o header `Authorization`**. A ordem importa e é parte do
contrato: se a função lesse o header primeiro e só depois se preocupasse com a query, a recusa
viraria uma segunda checagem, e segunda checagem é a que se esquece de escrever, ou se
escreve num ramo que um `return` anterior nunca alcança. Recusar antes de ler qualquer
credencial deixa uma única porta de entrada; e o chamador recebe a resposta que descreve o que
ele fez de errado, em vez de ser autenticado por um header que ele nem sabia estar mandando.

## O que a chave decide, e o que ela não decide

A chave determina o `tenant_id`. **Só ela.**

- `tenant_id` nunca é lido do corpo, da URL ou de header do chamador. Se o chamador puder
  dizer de quem é o produto, a marca A pede a variante da marca B.
- `product_id` é conferido contra o `tenant_id` da chave **antes** de qualquer outra coisa.
- Produto de outro tenant responde **404**, não 403, 403 confirmaria que aquele id existe,
  e marcas concorrentes convivem no mesmo sistema.

## Respostas de autenticação

Todo erro sai no envelope único da API, o de `memory/patterns.md`, com `code` estável e
`message` em português:

```json
{
  "data": null,
  "error": { "code": "CHAVE_INVALIDA", "message": "Chave de API inválida." },
  "meta": { "timestamp": "2026-09-08T10:30:00.000Z", "version": "1" }
}
```

| Situação | Status | `error.code` |
|---|---|---|
| Sem header `Authorization`, sem esquema `Bearer`, **ou chave na query string** | 401 | `CHAVE_AUSENTE` |
| Chave malformada, inexistente **ou revogada** | 401 | `CHAVE_INVALIDA` |
| Chave válida, `product_id` de outro tenant ou inexistente | 404 | `PRODUTO_NAO_ENCONTRADO` |

> Até 2026-09-08 esta tabela mostrava `{"erro":"CHAVE_AUSENTE"}`, chave em português, plana,
> sem `message`. Estava errado: conflitava com o envelope de `memory/patterns.md`, e `erro`
> contra `error` é "um termo, um nome" quebrado dentro do próprio contrato. Duas formas de
> erro na mesma API terminam com o cliente parseando uma das duas errado. **Os códigos não
> mudaram**, eles são o contrato; o que estava errado era o formato ao redor deles.

Chave revogada e chave inexistente respondem **igual**, mesmo código, mesma mensagem, mesmo
tempo. Distinguir as duas contaria ao atacante que ele acertou um prefixo real.

Os erros de **geração** (zona ausente, cor inválida, gradiente, zonas sobrepostas) são
outra família: vêm de `src/lib/render/erros.ts`, que já é contrato, e continuam sendo
**erro**, nunca 200 com variante "quase certa" (ADR-004). A tabela completa deles, com status
e família, está em [`endpoints.md`](endpoints.md).

## O que ainda não está decidido

Registrado para não ser confundido com omissão:

- **Rate limiting**, a chave por tenant é o que torna um limite por tenant *possível*; o
  limite em si não existe.
- **Política de depreciação de versão**, o `/v1` **já foi decidido** e está na rota
  (`POST /api/v1/products/:productId/variants`, ver [`endpoints.md`](endpoints.md)): entrou
  antes do primeiro cliente porque, depois dele, ou o cliente reescreve a integração ou
  carregamos um alias sem versão para sempre. O que continua **indeciso** é o que acontece
  quando existir um `/v2`, por quanto tempo o `/v1` continua respondendo, como o cliente é
  avisado e o que caracteriza mudança que exige versão nova. Sem integração viva, qualquer
  prazo escrito hoje seria número inventado.
- **Métrica e cobrança por uso**, só `last_used_at` está previsto, e serve para responder
  "esta chave ainda serve para alguma coisa?" antes de revogar.
