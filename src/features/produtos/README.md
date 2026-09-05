# src/features/produtos — modelos do tenant

O que vive aqui: listar os produtos da marca ativa e abrir um deles, baixando o
**asset-base canônico** do Storage. O que **não** vive aqui: zona, marcação e variante —
isso é `src/features/zonas/`.

Entrada: `<TelaDeProdutos tenantId={...} />`, sempre dentro de `RotaProtegida`.

| Arquivo | Papel |
|---|---|
| `listarProdutos.ts` | Consulta os produtos do tenant, campos explícitos, ordem estável |
| `baixarAssetBase.ts` | URL assinada curta a partir de `base_asset_path` → texto do SVG |
| `hooks/useProdutos.ts` | Estado da lista: carregando / erro / vazia / pronta |
| `hooks/useAssetBase.ts` | Estado do download do SVG do produto aberto |
| `ListaDeProdutos.tsx` | A lista (apresentacional) |
| `VisualizacaoDoProduto.tsx` | O palco com o asset-base (apresentacional) |
| `TelaDeProdutos.tsx` | Único lugar com estado — decide entre lista e produto aberto |

## O caminho do asset nunca é remontado

`baixarAssetBase` recebe `products.base_asset_path` — o caminho **gravado**. Remontá-lo a
partir de `tenant_id` e `product_id` parece equivalente e não é: bastaria o formato mudar
uma vez para o front pedir um objeto inexistente ou, pior, o de outro produto. Quem
monta o path é quem escreve (`supabase/scripts/caminhoDoAssetBase.ts`), uma vez.

## O bucket é privado

Não existe URL pública para o asset-base: é assim que o SVG de um lançamento não vaza
para a concorrência. O acesso é por URL assinada de 5 minutos, emitida só se a RLS
reconhecer o usuário como membro do tenant dono do path. Ela não é para ser guardada.

## SVG vai para o DOM como markup, não como `<img>`

O editor precisa clicar em elemento, e elemento dentro de `<img>` não existe para o DOM.
É seguro porque o arquivo é o canônico: `normalizarSvg` removeu `<script>`, handlers
`on*` e referência externa **antes** de ele subir ao Storage — o editor nunca normaliza
nada (ADR-005).

## Ordem da lista

`created_at` crescente. Não existe coluna de ordem no schema; sem `order` explícito o
Postgres não promete ordem nenhuma e a lista trocaria de posição entre carregamentos.
Coluna de ordem própria está registrada como fora de escopo desta entrega.
