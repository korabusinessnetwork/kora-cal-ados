# src/esboco — esboço visual do editor

**Isto não é o editor de zonas.** É uma tela única, sem banco, sem login e sem upload,
feita para o dono do projeto **ver** o motor de render funcionando antes de existir
produto. O nome do diretório é literal de propósito (ADR-003): ninguém deve confundir
isto com a Fase 1 de verdade.

Rodar: `npm run dev` → <http://localhost:5173>

| Arquivo | Papel |
|---|---|
| `EsbocoDoEditor.tsx` | Tela única. **O único lugar com estado** — os painéis são burros |
| `PainelDeZonas.tsx` | Lista de zonas, contagem de elementos por seletor, seleção de cor |
| `PreviewDaVariante.tsx` | Palco: a variante + contorno da zona selecionada + clique no calçado |
| `PainelDaApi.tsx` | A chamada HTTP equivalente e o relatório da normalização |
| `ComparativoDeNormalizacao.tsx` | Antes/depois: o mesmo pedido de cor no arquivo cru e no canônico |
| `produtoDemo.ts` | O que viria de `products` + `product_zones` — dado falso, não é tenant real |
| `tenis-demo-cru.svg` | Asset-base **cru**, sujo de propósito (ver abaixo) |
| `produtoDemo.test.ts` | Prende a premissa do esboço: o que a tela afirma é verdade |
| `esboco.css` | Estilo separado do JSX (regra de white-label do CLAUDE.md) |

## O que o esboço demonstra (e por que cada peça está ali)

1. **Cor no editor = cor na API.** As duas colunas saem da mesma chamada de
   `gerarVarianteDeCor`. Não há caminho no código para elas divergirem — é o princípio
   nº1 virando estrutura, não promessa.
2. **Zona é conjunto de elementos.** O cadarço são 4 paths que nascem com o mesmo `id`;
   a normalização desambigua e o seletor `[id^="zona-cadarco"]` pega os 4 (BUG-002).
3. **Normalização não é firula.** O comparativo roda o mesmo pedido de cor nos dois
   arquivos. No cru, sola, cabedal, cadarço e logo **não mudam** — a regra `.st-*` do
   bloco `<style>` vence o atributo `fill` que o motor escreve. É o BUG-001 ao vivo.
4. **Falha alto.** A zona "Detalhe" tem gradiente. Pedir cor chapa nela devolve
   `ZONA_NAO_RECOLORIVEL` e **nenhuma** cor é aplicada — a variante sai inteira ou não sai.

## O arquivo cru é sujo de propósito

`tenis-demo-cru.svg` imita export real de Illustrator/Figma: cor em `<style>`, `style`
inline, `id` repetido, `<script>`, handler `onclick` e referência externa. O esboço nunca
o renderiza inline — só o asset-base canônico entra no DOM. O cru aparece apenas dentro
de um `<img>` com data URL no comparativo, onde não executa script nem busca rede.

## O que o esboço NÃO tem

- **Login, banco e upload**: nada de Supabase aqui. A tela não faz uma requisição sequer.
- **Marcação de zona**: as zonas já vêm marcadas em `produtoDemo.ts`. Marcar zona
  clicando no calçado (SVG no DOM, ADR-005) é a próxima peça e ainda não existe.
- **Estado de carregando**: tudo é síncrono e local. Preferi não simular spinner —
  estado falso em esboço vira expectativa errada de performance.
- **Identidade visual**: `docs/02_DESIGN_SYSTEM/` está vazio até o nome do produto
  existir. Os tokens em `esboco.css` são provisórios; os nomes ficam, os valores mudam.

## Verificado

`npm test` cobre a premissa do esboço (`produtoDemo.test.ts`) e o caminho do navegador do
motor (`../lib/render/dom.test.ts`, com `DOMParser` global em vez de jsdom).

`ComparativoDeNormalizacao.test.tsx` prende o comparativo: os dois lados recebem o mesmo
pedido de cor e um pedido recusado nunca vira `<img src="">` (BUG-011 e BUG-012).

**Aberto no Chrome em 2026-09-05** — não só em jsdom. Verificado na página: as 9 zonas com
a contagem de elementos certa (cadarço = 4), o preview mudando de cor, o comparativo
mostrando o cru bege ao lado do canônico azul, e `ZONA_NAO_RECOLORIVEL` congelando a
variante com o botão Desfazer funcionando. Foi essa passada que achou BUG-011/012 — a
suíte estava verde com os dois presentes.
