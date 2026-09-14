# ADR-004, Contrato de zona e normalização de SVG

**Status**: **Aceito**
**Data**: 2026-08-12
**Decisores**: Matheus Bonato
**Implementado em**: `src/lib/render/` (30 testes verdes, incluindo os 9 casos que reprovaram o protótipo)
**Supersede**: (nenhum, complementa ADR-001)
**Supersedido por**: (nenhum)

---

## Contexto

O protótipo do motor (`scripts/prototipo-recolor-svg.mjs`, aposentado por este ADR) fazia
`getElementById` + `setAttribute('fill', cor)`. Validação adversarial em 2026-08-12 contra
SVGs equivalentes a export real de Illustrator/Figma reprovou 8 de 9 casos (ver
`memory/bugs.md` BUG-001..005; os casos viraram `src/lib/render/gerarVarianteDeCor.test.ts`):

1. **`style="fill:..."` inline vence o atributo `fill`**, a cor não muda.
2. **Regra CSS de classe (`.st0{fill:...}`) também vence**, export padrão do Illustrator.
3. **Zona como grupo `<g>`** não repinta filhos que têm `fill` próprio.
4. **Zona com N paths** (o próprio `teste-zona.svg` tem `zona-cadarco` em 2 paths) só repinta o primeiro.
5. **`id` duplicado** deixa o segundo elemento com a cor antiga.

Em todos, a API responderia **200 com a variante errada**. Isso viola o princípio nº1
do `CLAUDE.md` de forma direta: a cor que sai da API vira calçado fabricado, e aqui ela
diverge do editor **sem nenhum sinal**.

Há ainda um contrato ausente: a API documentada em `docs/01_ARQUITETURA/overview.md`
recebe `{"sola": "#C0392B"}` (chave = `zone_key`), mas o motor recebe id de elemento SVG.
A ponte é `product_zones.svg_selector`, que o schema descreve como "id/classe" enquanto
o motor só sabe resolver id.

---

## Decisão (proposta)

### 1. Normalizar o SVG no **upload**, não na geração

Todo asset-base passa por um normalizador antes de ser aceito no Storage, produzindo o
**asset-base canônico**, a única versão que o editor e a API leem:

- **Achatar estilo**: computar o `fill` efetivo de cada elemento (regra CSS + `style`
  inline + atributo) e reescrevê-lo como **atributo de apresentação**; remover `<style>`
  e o atributo `style` de pintura. Depois disso, `setAttribute('fill')` volta a ser
  autoritativo, não existe mais nada com precedência maior.
- **Sanitizar**: remover `<script>`, atributos `on*`, `<foreignObject>` e referência
  externa (`href`/`xlink:href` http), resolve BUG-004 e o requisito de upload já
  exigido em `docs/11_SEGURANCA/multi-tenancy-rls.md`.
- **Desambiguar `id`**: id duplicado é reescrito (`-2`, `-3`) e reportado.
- **Arquivar o original** ao lado do canônico, para reprocessar se o normalizador evoluir.

### 2. Zona é um **conjunto** de elementos, não um elemento

- `product_zones.svg_selector` passa a ser um **seletor CSS**, resolvido com
  `querySelectorAll`, não `getElementById`.
- O motor pinta cada elemento resolvido **e seus descendentes pintáveis**
  (`path`, `rect`, `circle`, `ellipse`, `polygon`, `polyline`, `line`), resolve grupo
  `<g>` e zona multi-path de uma vez.

### 3. Falhar alto, sempre

| Situação | Resposta |
|---|---|
| Seletor resolve 0 elementos | erro `ZONA_NAO_ENCONTRADA` (422), nunca 200 |
| Cor fora do formato aceito | erro `COR_INVALIDA` (422) |
| `zone_key` não existe no produto | erro `ZONA_NAO_ENCONTRADA` (422) |
| Zona pintada com gradiente/pattern | erro `ZONA_NAO_RECOLORIVEL` (422), ver Questão 1 |

`console.warn` deixa de ser tratamento de erro: em função serverless o log fica no
servidor e o chamador recebe sucesso (BUG-003).

### 4. Um motor só, importado nos dois lados

`gerarVarianteDeCor` é o **mesmo módulo** no editor e na função serverless, nunca duas
implementações. É o que sustenta "cor no editor = cor na API" do princípio nº1.

### 5. Prevenção antes da mensagem de erro

No upload, o editor mostra um **relatório de zonas**: quantos elementos cada seletor
captura e um preview de cada zona destacada. O time confere o mapeamento **antes** de o
produto existir para a API, em vez de descobrir na primeira variante errada.

---

## Alternativas Consideradas

### 1. Injetar `<style>` com `!important` na hora de gerar

Em vez de reescrever atributos: injetar `#zona-sola, #zona-sola * { fill: #F00 !important }`.

- **Prós**: bem mais simples; `!important` em folha de estilo vence `style` inline sem
  `!important` e vence regra de classe, resolveria BUG-001 sem normalizar nada.
- **Contras**: transfere a resolução de CSS para **quem renderiza**. O navegador (editor)
  e o rasterizador (`resvg`/`sharp`, no `?format=png`) não têm suporte idêntico a CSS em
  SVG. Divergência entre editor e API é exatamente o risco que o princípio nº1 proíbe.
- **Descartado porque**: atributo de apresentação é o denominador comum que todo renderer
  entende igual. A simplicidade não compensa o risco de divergir justo no que é inegociável.

### 2. Normalizar a cada requisição de geração, em vez de no upload

- **Prós**: nada de estado derivado; o original é sempre a fonte.
- **Contras**: custo de parse+CSS repetido em toda geração (a API é o produto, vai rodar
  em lote); e um SVG problemático só é descoberto na hora de gerar, não no cadastro.
- **Descartado porque**: o setup acontece uma vez por modelo e a geração acontece milhares
  de vezes, pagar o custo no lado errado da equação.

### 3. Exigir SVG "limpo" do cliente (guia de export)

- **Prós**: custo zero de engenharia.
- **Contras**: depende da disciplina de quem exporta; o cliente-alvo (designer de marca)
  exporta do Illustrator com as opções padrão, que produzem exatamente o caso que quebra.
- **Descartado porque**: transfere ao cliente um problema que é nosso, no primeiro contato
  com o produto.

---

## Consequências

### Positivas
- O motor volta a ser previsível: depois da normalização, atributo `fill` é a única fonte de cor.
- Sanitização de upload sai de graça no mesmo passo (fecha BUG-004).
- Erro de mapeamento de zona aparece no cadastro, não na produção do catálogo.
- `jsdom` (pesado) fica confinado ao upload; o caminho de geração pode usar parser leve.

### Negativas / Trade-offs
- Upload passa a poder **rejeitar** arquivo, precisa de UI pra explicar o porquê.
- Dois arquivos por produto (original + canônico), mais storage (ver Questão 4).
- Normalizador é código não-trivial (resolução de CSS) e precisa de teste próprio desde o dia 1.

---

## Decisões do dono (2026-08-12)

Matheus aprovou as quatro recomendações e o caminho estrutural (normalizar no upload):

| # | Questão | Decisão | Onde está no código |
|---|---|---|---|
| 0 | Normalizar no upload × injetar CSS `!important` na geração | **Normalizar no upload** | `normalizarSvg.ts` |
| 1 | Zona com gradiente/pattern | **Erro** `ZONA_NAO_RECOLORIVEL`, não vira cor chapa | `gerarVarianteDeCor.ts` → `alvosPintaveis` |
| 2 | SVG que não normaliza | **Rejeitar** com motivo explicando o export correto | `normalizarSvg.ts` → `SVG_NAO_NORMALIZAVEL` |
| 3 | Formato de cor | **Só hex** (`#RGB` expandido para `#RRGGBB`); nome CSS recusado | `validarCor.ts` |
| 4 | Guardar o original | **Sim**, original + canônico | pendente: é decisão de upload/Storage, entra com a feature de upload |

Consequência registrada da decisão 1: recolorir **preservando** o gradiente (trocar as
paradas de cor mantendo a variação de luz) é a resposta certa a médio prazo e virou item
de backlog, hoje o gradiente barra a geração, e se os arquivos reais dos clientes vierem
cheios deles, isso vira barreira de adoção antes de virar recurso.

---

## Referências

- `memory/bugs.md`, BUG-001..005 (defeitos que motivaram este ADR)
- `src/lib/render/`, implementação + os 9 casos como teste executável
- `docs/09_BACKLOG/features.md`, recolor preservando gradiente (consequência da decisão 1)
- `CLAUDE.md`, princípio nº1 (fidelidade de cor)
- `docs/11_SEGURANCA/multi-tenancy-rls.md`, requisito de validação de upload
- ADR-001, stack e escopo vetor-only que este contrato detalha
