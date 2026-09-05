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
| `VisualizacaoDoProduto.tsx` | A moldura do produto aberto: cabeçalho, estados e os espaços do palco e da lateral (apresentacional) |
| `TelaDeProdutos.tsx` | Único lugar com estado — decide entre lista e produto aberto, e hospeda o editor de zonas |

## O caminho do asset nunca é remontado

`baixarAssetBase` recebe `products.base_asset_path` — o caminho **gravado**. Remontá-lo a
partir de `tenant_id` e `product_id` parece equivalente e não é: bastaria o formato mudar
uma vez para o front pedir um objeto inexistente ou, pior, o de outro produto. Quem
monta o path é quem escreve (`supabase/scripts/caminhoDoAssetBase.ts`), uma vez.

## O bucket é privado

Não existe URL pública para o asset-base: é assim que o SVG de um lançamento não vaza
para a concorrência. O acesso é por URL assinada de 5 minutos, emitida só se a RLS
reconhecer o usuário como membro do tenant dono do path. Ela não é para ser guardada.

## Esta tela não desenha o calçado

Ela recebe o palco pronto e o coloca na moldura. Quem desenha é `PalcoDeMarcacao`
(`src/features/zonas/`), que passa o arquivo por `gerarVarianteDeCor` — o mesmo motor da
API. Até a Etapa 3 esta tela injetava o canônico ela mesma; com o palco ao lado, seriam
dois lugares desenhando o mesmo calçado e só um deles passando pelo motor, que é o
princípio nº1 quebrado. Há um teste que lê o fonte e reprova se `innerHTML` voltar.

O SVG vai para o DOM como markup, não como `<img>`: o editor precisa clicar em elemento, e
elemento dentro de `<img>` não existe para o DOM. É seguro porque o arquivo é o canônico —
`normalizarSvg` removeu `<script>`, handlers `on*` e referência externa **antes** de ele
subir ao Storage, e o editor nunca normaliza nada (ADR-005).

## Campo vazio não apaga o que já está gravado (BUG-014)

O formulário de zona volta limpo depois de salvar. Se a tela mandasse os campos vazios como
`null`, acrescentar um ilhós a uma zona existente apagaria o rótulo definido por um colega —
`null` significa "apague" para `marcarZona`. `preservarOuLimpar` faz a distinção: vazio em
zona existente é `undefined` (não mexe), vazio em zona nova é `null`.

## Ordem da lista

`created_at` crescente. Não existe coluna de ordem no schema; sem `order` explícito o
Postgres não promete ordem nenhuma e a lista trocaria de posição entre carregamentos.
Coluna de ordem própria está registrada como fora de escopo desta entrega.
