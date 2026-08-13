# src/lib/render — motor de render

O que vive aqui: transformar um asset-base em variante de cor. O que **não** vive aqui:
acesso ao Supabase, HTTP, UI. Este módulo é puro — recebe texto SVG, devolve texto SVG.

Importado pelos dois lados (editor e função serverless) **de propósito**: uma única
implementação é o que sustenta "cor no editor = cor na API" (princípio nº1 do CLAUDE.md).

| Arquivo | Papel | Entrada → saída |
|---|---|---|
| `normalizarSvg.ts` | Roda no **upload**: achata CSS em atributo, sanitiza, desambigua id | SVG cru → asset-base canônico + relatório |
| `gerarVarianteDeCor.ts` | Roda na **geração**: aplica `{zone_key: cor}` sobre o canônico | canônico + zonas + cores → SVG da variante |
| `lerRegrasCss.ts` | Lê o `<style>` do próprio SVG (o jsdom não monta CSSOM em `image/svg+xml`) | texto CSS → regras com especificidade |
| `validarCor.ts` | Só aceita hex (ADR-004, q3) | `#f00` → `#FF0000`, ou erro |
| `parsearSvg.ts` | Adaptador de DOM: nativo no navegador, registrado em Node | texto → `Document` |
| `analisadorDeNode.ts` | Registra o analisador de jsdom. **Único** arquivo que importa jsdom | — |
| `erros.ts` | `ErroDeVariante` + códigos de erro (contrato de API) | — |
| `fixtures/teste-zona.svg` | Modelo de teste com sola, cabedal e cadarço (2 paths) | — |

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
- `jsdom` só é usado onde não há DOM nativo. No navegador o motor usa `DOMParser`/
  `XMLSerializer` do próprio ambiente, e `parsearSvg.test.ts` prova que os dois caminhos
  produzem a mesma saída byte a byte — se divergissem, editor e API divergiriam.
- Ambiente Node precisa chamar `registrarAnalisadorDeNode()` uma vez antes de usar o motor
  (o `vitest.setup.ts` faz isso nos testes). Sem registro, o motor falha alto com mensagem
  dizendo o que fazer — nunca em silêncio.
