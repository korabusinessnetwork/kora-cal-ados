# `POST /api/v1/products/:productId/variants`

A única rota pública da API. O nome do diretório entre colchetes é o parâmetro de rota da Vercel,
e é ele que vira `productId`.

| Arquivo | O que é |
|---|---|
| [`variants.ts`](variants.ts) | O handler HTTP. **Orquestra e não decide** |
| [`_variants.test.ts`](_variants.test.ts) | O teste do handler, mais as guardas que leem o próprio fonte |

O `_` do nome do teste não é enfeite: a Vercel trata todo arquivo deste diretório como rota, e o
prefixo é o que impede o teste de virar endpoint. O mesmo vale para `api/_lib/` e `api/_local/`.

## Toda decisão mora em `api/_lib/`

Status, mensagem, formato da resposta, o que é chave válida, o que é corpo válido: cada uma dessas
regras tem arquivo e teste próprios em [`../../../_lib/`](../../../_lib/). Se `variants.ts`
crescer, é sinal de que uma regra escapou para o único lugar do fluxo sem teste dedicado, e o
conserto é mover a regra para `_lib/`, nunca escrever mais um `if` aqui.

## A ordem dos passos é propriedade de segurança, não estilo

1. método, 2. autenticação, 3. produto do tenant, 4. `?format=`, 5. corpo, 6. zonas do produto,
7. pré-checagem das `zone_key`, 8. asset-base, 9. motor.

Os passos 4 e 5 vêm depois de 2 e 3 de propósito. Cada recusa é informação, e quem ainda não provou
ter chave válida naquele produto não recebe mensagem diferenciada: sem isso, uma marca compararia
respostas para mapear o `product_id` da concorrente. Validar cedo é bom para carga e péssimo para
vazamento entre tenants. O comentário no topo de `variants.ts` repete isso, e é para repetir mesmo:
é a linha que alguém "arrumaria" por parecer mais natural validar a query string primeiro.

## O import que não pode sair do topo

O import de `src/lib/render/domNode` é efeito colateral e registra o jsdom como DOM do motor. Sem
ele TODA requisição vira 500, e isso não aparece em `tsc --noEmit` nem nos testes de `_lib/`,
porque lá o vitest registra o adaptador por `setupFiles`. Aparece só em runtime, na primeira
chamada de cliente. Por isso `_variants.test.ts` tem uma guarda que lê este fonte e exige o import,
com o caminho conferido em disco.

O envelope de resposta, os códigos e o porquê da assinatura Web Handler estão em
[`../../../README.md`](../../../README.md).
