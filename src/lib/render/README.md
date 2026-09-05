# src/lib/render — motor de render

O que vive aqui: transformar um asset-base em variante de cor. O que **não** vive aqui:
acesso ao Supabase, HTTP, UI. Este módulo é puro — recebe texto SVG, devolve texto SVG.

Importado pelos dois lados (editor e função serverless) **de propósito**: uma única
implementação é o que sustenta "cor no editor = cor na API" (princípio nº1 do CLAUDE.md).

| Arquivo | Papel | Entrada → saída |
|---|---|---|
| `normalizarSvg.ts` | Roda no **upload**: achata CSS em atributo, sanitiza, aplica a política de id | SVG cru → asset-base canônico + relatório |
| `idDeElemento.ts` | A política de id do canônico: desambigua duplicado, renomeia id que quebra `#id`, cunha `elemento-N` em pintável anônimo (ADR-005) | Document → o mesmo Document, todo pintável endereçável |
| `gerarVarianteDeCor.ts` | Roda na **geração**: aplica `{zone_key: cor}` sobre o canônico | canônico + zonas + cores → SVG da variante |
| `alvosPintaveis.ts` | Regra única de "o que recebe cor": elemento + descendentes pintáveis, pulando `fill="none"` | elementos → alvos |
| `zonasSobrepostas.ts` | Pares de zonas que dividem elemento — o estado que faria a ordem das chaves decidir a cor (BUG-013) | canônico + zonas → sobreposições |
| `montarSeletorDeZona.ts` | Fonte única do formato de `svg_selector`: lista de ids exatos, nunca prefixo | ids → `#a, #b` |
| `validarZoneKey.ts` | `zone_key` é chave pública da API — slug estável; `sugerirZoneKey` propõe a partir do rótulo digitado | texto → chave, ou erro |
| `lerRegrasCss.ts` | Lê o `<style>` do próprio SVG (o jsdom não monta CSSOM em `image/svg+xml`) | texto CSS → regras com especificidade |
| `validarCor.ts` | Só aceita hex (ADR-004, q3) | `#f00` → `#FF0000`, ou erro |
| `erros.ts` | `ErroDeVariante` + códigos de erro (contrato de API) | — |
| `dom.ts` | Abstrai de onde vem o DOM. No navegador usa `DOMParser` nativo | — |
| `domNode.ts` | Registra o jsdom. **Só o Node importa** — é o que mantém jsdom fora do bundle | — |
| `fixtures/teste-zona.svg` | Modelo de teste com sola, cabedal e cadarço (2 paths) | — |

## Como o mesmo motor roda nos dois lados

`jsdom` não roda no navegador e `DOMParser` não existe no Node. Sem `dom.ts`, a única
saída seria reescrever o motor para o front — que é o que o princípio nº1 proíbe.

- **Navegador** (editor, `src/esboco/`): não importa nada; `dom.ts` detecta o `DOMParser`
  global sozinho. O jsdom não entra no bundle porque ninguém no front importa `domNode`.
- **Node** (testes, função serverless): importa `./domNode` uma vez. Nos testes isso é o
  `setupFiles` do `vite.config.ts`.

Sem DOM nenhum, o motor **lança** em vez de devolver o SVG intacto — SVG que voltou sem
mudar de cor com resposta 200 é o BUG-001 outra vez, por outro caminho.

`dom.test.ts` roda o motor pelo caminho do navegador (`DOMParser` global) e confere que
a saída é a mesma do caminho do Node.

## O editor NUNCA normaliza (ADR-005)

O asset-base canônico é **imutável**: a normalização roda uma vez, no upload, e o arquivo
gravado no Storage não muda mais. O editor de zonas é somente-leitura sobre ele — marcar
zona escreve uma linha em `product_zones` e nada no SVG.

O motivo é concorrência: o Storage não tem escrita condicional (sem If-Match/ETag no
`supabase-js`). Se o editor escrevesse id ao marcar, dois membros marcando zonas ao mesmo
tempo se sobrescreveriam — o id de um sumiria do arquivo enquanto o `svg_selector` dele
continuaria no banco, resolvendo 0 elementos ou, pior, o elemento errado.

Consequência prática: **todo elemento pintável já sai da normalização com id**
(`elemento-N` quando o arquivo não trouxe um), e `svg_selector` é lista de ids exatos.
Prefixo (`[id^="zona-sola"]`) é proibido: capturaria uma zona futura `zona-sola-lateral` e
pintaria o lugar errado em silêncio.

Isso torna a ordem de cunhagem um **contrato**. Se ela mudar, todo seletor gravado
repointa sem aviso — o canário é `normalizarSvg(baixado).svg === baixado` no teste de
integração, que fica vermelho antes de qualquer variante sair errada.

## Ordem obrigatória

`normalizarSvg` **antes** de `gerarVarianteDeCor`, sempre. O motor assume que a cor mora
em atributo de apresentação — é o normalizador que garante isso. Gerar variante direto do
arquivo cru do cliente é o bug que reprovou o protótipo (BUG-001).

## O que faz o normalizador recusar um arquivo

Recusa é comportamento aprovado (ADR-004, q2): melhor barrar no cadastro que gerar
catálogo errado. Motivos: `@media`/`@import`/`@font-face`, propriedade CSS sem atributo
de apresentação equivalente (ex.: `transform`, cuja sintaxe CSS `rotate(3deg)` não é
válida como atributo e quebraria o desenho ao ser achatada), CSS malformado, e arquivo
que não é SVG.

A saída típica para o cliente é uma frase só: exportar do Illustrator com
**Styling: Presentation Attributes** resolve quase todos os casos.

## Limites conhecidos

- Zona com gradiente/pattern é **erro**, não vira cor chapa (ADR-004, q1). Recolorir
  preservando o gradiente está no backlog (`docs/09_BACKLOG/features.md`).
- `fill="none"` é pulado: é contorno sem preenchimento, pintá-lo mudaria o desenho.
- Elemento com `fill="none"` **ganha id** mesmo assim: a numeração precisa depender só da
  estrutura do arquivo. Se dependesse do fill, trocar a cor de um elemento deslocaria o id
  de todos os seguintes.
- Zona sobreposta é recusada **no pedido**, não no cadastro: mapeamento ruim numa zona não
  trava a geração das outras.
- `jsdom` é pesado para função serverless. Confinado ao upload seria o ideal; hoje os dois
  caminhos usam. Revisitar se o tempo de cold start incomodar.
