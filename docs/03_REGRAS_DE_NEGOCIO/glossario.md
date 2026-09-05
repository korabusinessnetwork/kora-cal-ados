# Glossário de Domínio — Kora Calçados (codinome)

> Fonte única de nomenclatura. Todo termo aqui tem **exatamente um nome** em código,
> schema, docs e commits — ver `docs/08_DECISOES/adr-003-organizacao-para-ia.md` para
> o porquê disso ser regra, não sugestão. Termo novo entra aqui **antes** de ser usado
> em qualquer arquivo.

## Como usar

- Precisa nomear algo que já existe aqui? Use o nome exato desta lista, sempre.
- Termo novo de domínio? Adicione uma linha aqui **no mesmo commit** que o introduz.
- Achou um sinônimo escapado em algum arquivo (ex: "frame" em vez de "zona")? É bug de
  nomenclatura — corrigir para o termo canônico, não adicionar como alias.

## Termos

| Termo canônico | Campo/identificador técnico | Definição | Nunca chamar de |
|---|---|---|---|
| **Zona** | `zone_key`, `product_zones` | Parte endereçável de um modelo de calçado (ex: sola, cabedal, cadarço, logo) que pode ter cor/material definidos independentemente | frame, layer, área, region, parte (isolado) |
| **Produto** / **Modelo** | `products` | Um modelo de calçado cadastrado no sistema, com um asset-base (SVG) e um conjunto de zonas | item, artigo, referência |
| **Asset-base** | `base_asset_path` | O arquivo SVG original de um produto, antes de qualquer variante ser gerada — sempre vetor/ilustração na Fase 1 (nunca foto real, ver ADR-001) | template, base, original (isolado) |
| **Asset-base canônico** | saída de `normalizarSvg` | O asset-base depois da normalização: cor em atributo de apresentação, sem `<style>`, sem `<script>`, sem `id` duplicado. É o que o editor e a API leem — nunca o arquivo cru (ADR-004) | SVG limpo, sanitizado (isolado) |
| **Normalização** | `normalizarSvg` | A etapa de upload que converte o asset-base cru em canônico, ou recusa o arquivo explicando o motivo | limpeza, tratamento, sanitização (isolado — sanitizar é só uma parte) |
| **Seletor de zona** | `svg_selector` | Seletor CSS que resolve quais elementos do SVG pertencem a uma zona — pode capturar N elementos, não um só | id da zona, path da zona |
| **Variante** | `variants`, `zone_colors` | Uma combinação específica de cor/material aplicada às zonas de um produto, gerada pela API | versão, opção, combinação |
| **Tenant** | `tenants`, `tenant_id` | Uma marca/fabricante calçadista cliente da plataforma — unidade de isolamento (ver `docs/11_SEGURANCA/multi-tenancy-rls.md`) | cliente (isolado, sem contexto), empresa, conta |
| **Membro** | `tenant_members` | Usuário vinculado a um tenant, com um papel (`owner` ou `membro`) | usuário (isolado, sem contexto de tenant), colaborador |
| **Motor de render** | `src/lib/render/` (sugerido) | O componente que aplica `zone_colors` sobre o asset-base e devolve SVG/PNG | engine, renderer, gerador |
| **Editor de zonas** | app front-end (SVG no DOM, ADR-005) | Onde o time do tenant marca as zonas de um produto e faz preview de variante | designer, canvas (isolado, sem contexto), studio |
| **Marcar zona** | `marcarZona` | A operação de dizer quais elementos do asset-base canônico formam uma zona, gravando uma linha em `product_zones` | desenhar, selecionar (isolado), recortar |
| **Id de elemento** | atributo `id` do canônico | O identificador único de cada elemento pintável do asset-base canônico. Cunhado pela **normalização** (`elemento-N` quando o arquivo não trouxe id), nunca pelo editor — o canônico é imutável (ADR-005) | nome do path, chave do elemento |
| **Palco** | `PalcoDeMarcacao` | A área do editor onde o asset-base canônico é renderizado e clicado. Mostra o SVG que a API devolve, sem filtro nem overlay | canvas, viewport, tela (isolado) |
| **Sobreposição de zonas** | `ZONAS_SOBREPOSTAS` | Duas zonas do mesmo produto que compartilham pelo menos um elemento — estado inválido: sem isso, a ordem das chaves do JSON decidiria a cor | conflito, colisão, overlap |
| **Sessão** | `ContextoDeSessao` | O par usuário autenticado + tenant ativo. Nenhuma tela protegida renderiza sem os dois | login (isolado), auth (isolado) |

## Termos que existem só em contexto histórico (não usar em código novo)

- **"Frame"** — termo original usado na conversa de intake com Matheus antes de o
  vocabulário do produto ser fechado. Significa **zona** neste projeto. Mantido aqui
  só para quem ler o histórico de decisão e estranhar a palavra.

## Regras de nomenclatura técnica (complementa, não substitui a tabela acima)

- SQL: `snake_case` (`zone_key`, `base_asset_path`)
- JS/TS: `camelCase` para variáveis/funções, `PascalCase` para componentes
- Nome de domínio em português (`gerarVariante`, `marcarZona`), padrão técnico em
  inglês (`handleSubmit`, `useEffect`) — ver `memory/patterns.md`
- Toda função pública que recebe/retorna uma **zona** ou **variante** usa esses nomes
  literalmente no nome do parâmetro/retorno (`zona: Zona`, nunca `z: any` ou `data`)

## Atualizações

- **2026-08-12** — versão inicial, termos definidos durante o intake de fundação
- **2026-08-12** — entram "asset-base canônico", "normalização" e "seletor de zona" (ADR-004)
- **2026-09-05** — entram "marcar zona", "id de elemento", "palco", "sobreposição de zonas"
  e "sessão"; o editor de zonas deixa de ser descrito como Fabric.js (ADR-005)
