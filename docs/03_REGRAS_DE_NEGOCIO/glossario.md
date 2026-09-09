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
| **Asset-base** | `base_asset_path` | O arquivo original de um produto, antes de qualquer variante ser gerada. É **SVG** em produto SVG e **glTF** em produto 3D (ADR-007) — nunca foto real, ver ADR-001 | template, base, original (isolado) |
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
| **Chave de API** | `tenant_api_keys` (`id`, `tenant_id`, `prefixo`, `hash`, `label`, `created_by`, `created_at`, `last_used_at`, `revoked_at`) — ADR-006 | A credencial com que o **sistema** do tenant chama a API de variante, no formato `kora_<ambiente>_<prefixo>_<segredo>`. Pertence à marca, não à pessoa; o banco guarda o **prefixo** em claro e o **hash** do **segredo**, nunca a chave inteira. Exibida uma vez, revogável (`revoked_at` preenchido, linha nunca apagada). É de onde o `tenant_id` sai — nunca do corpo da requisição. Não abre o editor, e a **sessão** não chama a API | token, api key, credencial, service account |
| **Prefixo** | coluna `prefixo` | A parte da chave de API guardada **em claro** e indexada: é por ela que a API acha a linha antes de conferir o hash, e é ela (nunca a chave) que aparece em log e na tela de gerenciamento. **Identifica sem autenticar** — quem tem só o prefixo não chama nada | id da chave, chave (isolado), token público |
| **Segredo** | os 32 bytes aleatórios de `crypto.randomBytes` da chave; `hash` é o SHA-256 dele | A parte da chave de API que **nunca é guardada** — o banco tem só o SHA-256, então perder o segredo significa gerar outra chave, não "ver de novo". Hash rápido é decisão do ADR-006 (D2): 32 bytes aleatórios não têm dicionário, e hash lento cobraria seu custo em toda chamada | senha, hash (o hash é do segredo, não é o segredo), chave (isolado) |
| **Modelo 3D** | asset-base de produto 3D, `.gltf` — ADR-007 | O calçado como malha tridimensional, em **glTF**. É o asset-base de um produto 3D, e cumpre exatamente o papel que o SVG cumpre num produto SVG: fonte única, normalizada uma vez no provisionamento, **imutável** depois disso | mesh (isolado), modelo (isolado — “modelo” já é sinônimo de produto), objeto 3D, asset 3D |
| **Malha** | nó/`mesh` do glTF | A parte endereçável de um modelo 3D — o análogo exato do **elemento pintável** no SVG. Uma zona 3D é um conjunto de malhas, do mesmo jeito que uma zona SVG é um conjunto de elementos | peça, parte (isolado), superfície, poly, objeto |
| **Nome de malha** | `name` do nó no glTF canônico | O identificador único de cada malha endereçável do modelo canônico. Cunhado pela **normalização** (`malha-N` quando o arquivo não trouxe nome), nunca pelo editor — o canônico é imutável, como no ADR-005 | id da malha, nome do objeto, label da malha |
| **Material** | `materials[i]` do glTF; a cor em `pbrMetallicRoughness.baseColorFactor` | Onde a cor de uma malha realmente mora em glTF. **Cada malha endereçável tem material próprio**: a normalização separa material compartilhado, senão pintar uma zona pintaria a outra em silêncio (ADR-007 D5). O `baseColorFactor` é **linear**, não sRGB — a conversão mora em uma função só | textura, shader, cor do objeto |
| **Modo cor chapa** | o palco 3D em render unlit | O modo do palco 3D **sem luz, sem sombra e sem reflexo**, em que o pixel do interior da zona **é** o hex pedido. É o modo em que “cor no editor = cor na API” continua verificável, e é onde a aprovação de cor acontece — o modo sombreado serve para julgar o produto, nunca para conferir cor (ADR-007 D2) | modo plano, unlit (isolado), preview simples, wireframe |
| **Órbita** | o gesto de arrastar no palco 3D | Girar a câmera em volta do modelo arrastando com o mouse. Disputa o mesmo gesto que o clique de marcar zona, e por isso a fronteira entre os dois é **limiar explícito em pixels**, escrito e testado: arrastar sem querer marcando zona é o modo de falha que o princípio nº1 proíbe | rotação, giro, drag, pan (pan é outra coisa: deslocar, não girar) |

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

- **2026-09-09** — entram os seis termos do **ADR-007** (calçado 3D): “modelo 3D”, “malha”, “nome de malha”, “material”, “modo cor chapa” e “órbita” — de novo **antes** de existir código que os use, como a regra deste arquivo manda e como o ADR-006 já tinha feito. Dois cuidados guiaram os sinônimos proibidos. “Modelo” neste projeto já significa **produto** (“um modelo de calçado”), então a malha tridimensional é **modelo 3D**, sempre com o “3D” colado — sem isso, “o modelo” passa a ter dois donos na mesma frase. E **material** não é sinônimo de cor nem de textura: é o objeto do glTF onde a cor mora, e a diferença entre os dois nomes é o que impede um agente de escrever cor em `baseColorFactor` sem a conversão sRGB→linear. A linha do **asset-base** deixa de dizer “sempre SVG”: passa a ser SVG em produto SVG e glTF em produto 3D, que coexistem (ADR-007 D6)
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
- **2026-09-08** — entram **"prefixo"** e **"segredo"**, as duas metades da chave de API, e
  a linha da **chave de API** ganha os nomes reais das colunas de `tenant_api_keys`. As duas
  metades viram termo próprio porque a diferença entre elas é a **regra de segurança
  inteira** em uma palavra: o prefixo pode aparecer em log, em tela e em ticket de suporte;
  o segredo não existe em lugar nenhum depois de exibido. Sem os dois nomes, escreve-se
  "a chave" nos dois casos e um agente futuro loga a chave inteira achando que segue o
  padrão. Nomes de coluna: valem `label`, `created_by`, `created_at`, `last_used_at`,
  `revoked_at` — as Notas de Implementação do ADR-006 anotaram `rotulo`/`criada_em`/
  `criada_por`/`ultima_utilizacao_em`/`revogada_em`, o que conflita com as 5 tabelas já
  existentes (todas com `created_at`) e, no caso de `rotulo`, inventaria uma segunda coluna
  para o conceito que este glossário já mapeia como **rótulo → coluna `label`**
