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
| **Asset-base canônico** | saída de `normalizarSvg` | O asset-base depois da normalização: cor em atributo de apresentação, sem `<style>`, sem `<script>`, sem `id` duplicado e com todo pintável endereçável por id. É **imutável** — o editor lê e nunca regrava (ADR-005) | SVG limpo, sanitizado (isolado) |
| **Normalização** | `normalizarSvg` | A etapa que converte o asset-base cru em canônico, ou recusa o arquivo explicando o motivo. Roda **uma vez por modelo, no provisionamento** (`supabase/scripts/`), nunca no editor | limpeza, tratamento, sanitização (isolado — sanitizar é só uma parte) |
| **Provisionamento** | `supabase/scripts/provisionarTenant.ts` | Criar tenant + owner + produto e subir o asset-base canônico, com `service_role`, fora do navegador. Na Fase 1 a venda é manual e não existe tela de cadastro | onboarding, cadastro, setup, upload |
| **Seletor de zona** | `svg_selector` | A **lista de ids exatos** (`#a, #b`) que diz quais elementos do canônico formam uma zona. Montada só por `montarSeletorDeZona`; seletor de prefixo é proibido, capturaria zona futura e pintaria o lugar errado em silêncio (ADR-005) | id da zona, path da zona |
| **Elemento pintável** | `PINTAVEIS`, `expandirPintaveis` (`alvosPintaveis.ts`) | Elemento do SVG que recebe cor (`path`, `rect`, `circle`, `ellipse`, `polygon`, `polyline`, `line`, `text`, `tspan`). A zona pinta o elemento marcado **e seus descendentes pintáveis**; `fill="none"` fica de fora — é contorno, e pintá-lo mudaria o desenho | shape, forma, nó, elemento (isolado) |
| **Variante** | `variants`, `zone_colors` | Uma combinação específica de cor aplicada às zonas de um produto, produzida por `gerarVarianteDeCor` — hoje no preview do editor, e pela API quando ela existir. Mesmo motor nos dois, nunca duas implementações. A tabela `variants` existe no schema mas **fica sem uso**: a variante é gerada sob demanda, sem cache (decisão de 2026-09-08) | versão, opção, combinação |
| **Tenant** | `tenants`, `tenant_id` | Uma marca/fabricante calçadista cliente da plataforma — unidade de isolamento (ver `docs/11_SEGURANCA/multi-tenancy-rls.md`) | cliente (isolado, sem contexto), empresa, conta |
| **Membro** | `tenant_members` | Usuário vinculado a um tenant, com um papel (`owner` ou `membro`) | usuário (isolado, sem contexto de tenant), colaborador |
| **Motor de render** | `src/lib/render/` | O módulo que aplica `zone_colors` sobre o asset-base canônico e devolve o SVG da variante. Um só, importado pelo editor e pela API | engine, renderer, gerador |
| **Editor de zonas** | `src/features/zonas/`, `EditorDeZonas` | Onde o time do tenant marca as zonas de um produto e faz preview de variante. Único lugar da feature com estado; palco, painel e formulário são apresentacionais | designer, canvas (isolado, sem contexto), studio |
| **Marcar zona** | `marcarZona` | A operação de dizer quais elementos do asset-base canônico formam uma zona, gravando uma linha em `product_zones` | desenhar, selecionar (isolado), recortar |
| **Id de elemento** | atributo `id` do canônico | O identificador único de cada elemento pintável do asset-base canônico. Cunhado pela **normalização** (`elemento-N` quando o arquivo não trouxe id), nunca pelo editor — o canônico é imutável (ADR-005) | nome do path, chave do elemento |
| **Palco** | `PalcoDeMarcacao` | A área do editor onde o asset-base canônico é renderizado e clicado. Desenha a saída de `gerarVarianteDeCor`, nunca cor por CSS. O **desenho** não recebe filtro, sombra nem `opacity`; realce é sempre camada `<svg>` separada por cima | canvas, viewport, tela (isolado) |
| **Marcação em curso** | `marcacaoEmCurso.ts`, `useMarcacaoDeZona` | Os ids que a pessoa clicou e **ainda não gravou**. Não existe no banco e some ao trocar de produto | seleção, rascunho de zona |
| **Zona em foco** | `emFoco`, `zoneKeyEmFoco` | A zona já gravada que o painel destaca no palco para conferência. É uma segunda camada de contorno, distinta da marcação em curso pelo **traço** e não pela cor — separar por matiz morreria no primeiro tenant que trocasse a paleta | zona selecionada, zona ativa |
| **Relatório de zonas** | `relatorioDeZonas` | Quantos elementos cada `svg_selector` captura no canônico **hoje**. Zero elementos é mapeamento quebrado, não zona vazia: a geração falharia nessa zona | contagem, resumo, estatística |
| **Sobreposição de zonas** | `ZONAS_SOBREPOSTAS`, `zonasSobrepostas` | Duas zonas do mesmo produto que compartilham pelo menos um elemento — estado inválido: sem isso, a ordem das chaves do JSON decidiria a cor (BUG-013) | conflito, colisão, overlap |
| **Cor em edição** | `corEmEdicao` (`coresDoPreview.ts`) | O texto do campo de cor **como foi digitado**, antes de ser hex válido. `#C0` é rascunho, não erro — anunciar erro a cada tecla ensina o time a ignorar alerta | cor inválida, cor errada |
| **Cor válida** | `coresValidas` (`coresDoPreview.ts`) | Só o que `validarCor` aceita, já em `#RRGGBB` — é isso, e só isso, que chega ao motor | cor final, cor confirmada |
| **Rótulo** | coluna `label`, estado `rotulo` | O nome legível da zona, escrito pela pessoa ("Ilhós"). Diferente de `zone_key`, que é chave pública da API e nunca é renomeada | nome, título, descrição |
| **Sessão** | `ContextoDeSessao` | O par usuário autenticado + tenant ativo. Nenhuma tela protegida renderiza sem os dois | login (isolado), auth (isolado) |
| **Chave de API** | `tenant_api_keys` (ADR-006) | A credencial com que o **sistema** do tenant chama a API de variante. Pertence à marca, não à pessoa; guardada em hash, exibida uma vez, revogável. É de onde o `tenant_id` sai — nunca do corpo da requisição. Não abre o editor, e a **sessão** não chama a API | token, api key, credencial, service account |

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
- **2026-09-07** — auditoria do glossário contra o código das Etapas 4–5. Entram sete termos
  que o código já usava sem linha aqui — "elemento pintável", "marcação em curso", "zona em
  foco", "relatório de zonas", "cor em edição", "cor válida", "rótulo" — mais
  "provisionamento". Termo usado em código e ausente daqui é defeito de processo, não
  detalhe: a regra deste arquivo é que o termo entra **antes** de ser usado, e o custo de
  furá-la é um agente inventando o segundo nome do mesmo conceito na sessão seguinte.
  Corrigidos no mesmo passe: **"seletor de zona"** deixa de ser "seletor CSS" genérico e
  passa a ser lista de ids exatos (era o texto do ADR-004, superado pelo ADR-005 — descrição
  genérica demais autorizava exatamente o seletor de prefixo que o projeto proíbe);
  **"normalização"** deixa de dizer que roda "no upload" (não há upload — roda no
  provisionamento); **"palco"** deixa de dizer "sem overlay" (o palco **tem** duas camadas
  `<svg>` de contorno — o que não pode receber filtro nem overlay é o **desenho**);
  **"motor de render"** perde o "(sugerido)" — `src/lib/render/` existe desde 2026-08-12
- **2026-09-08** — entra **"chave de API"** (ADR-006), desta vez **antes** de existir código
  que a use, que é como a regra deste arquivo deveria ter funcionado sempre. Os sinônimos
  proibidos importam mais que o normal aqui: "token" já significa o JWT de sessão neste
  projeto, e chamar as duas coisas pelo mesmo nome é como se confunde a credencial de pessoa
  com a de sistema — que é exatamente a alternativa que o ADR-006 descartou
