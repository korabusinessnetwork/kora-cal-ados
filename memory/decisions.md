# Decisões de Arquitetura — Kora Calçados (codinome)

## Objetivo
- Registrar todas as decisões arquiteturais e de produto relevantes
- Evitar re-discussão de problemas já resolvidos
- Documentar trade-offs e contexto de cada decisão

## Contexto
- Sistema vive em `docs/08_DECISOES/` (ADRs em markdown)
- Cada ADR tem ID sequencial (ADR-001, ADR-002, etc.)
- **A decisão** de um ADR aceito é imutável; **o arquivo não é**. Quando um ADR novo supersede
  um antigo, o antigo ganha o aviso de supersessão no cabeçalho e no trecho afetado — foi o
  que aconteceu com o ADR-001 quando o ADR-005 tirou o Fabric.js. A versão anterior deste
  documento dizia "ADRs são imutáveis após mergeados", e o próprio repositório já a
  contradiz. Deixar assim faria um agente encontrar o ADR-001 falando de Fabric.js sem o
  aviso e implementá-lo

## Regras Gerais
- Toda decisão de arquitetura, tech stack ou produto vai para um ADR
- Decisão = mudança que afeta 2+ componentes ou ciclo de vida longo
- Pequenos bugs/refators não viram ADR — vão para `memory/bugs.md`
- ADR sobrescreve docs divergentes; ADR é fonte de verdade

## Validações
- ADR tem contexto claro (problema, alternativas, consequências)?
- ADR tem o **porquê** da escolha, não só o quê? Sem isso, o próximo agente desfaz de boa-fé
- Decisão foi aprovada pelo dono (Matheus)? Não há "stakeholders" além dele nesta fase

## Permissões
- Agente propõe ADR (em `docs/08_DECISOES/adr-NNN-titulo.md`, minúsculo, como os existentes)
- Dono (Matheus): aceita ou recusa. É a única aprovação que existe — não há time de dev, não
  há PR e não há CI neste projeto (ver ADR-003)

## Exceções
- ADR de máxima urgência (segurança, compliance): pode ser escrito pós-deploy com tag [URGENT]

## Auditoria
- Revisar os ADRs contra a codebase **a cada entrega que muda arquitetura**, não por
  calendário: entre uma revisão semestral e a próxima, um agente lê o doc vencido como fato.
  A Etapa 6 (2026-09-07) foi a primeira dessas revisões

## Casos de Uso
- "Por que escolhemos Supabase e não Firebase?"
- "O que mudou de banco de dados e quando?"
- "Quem decidiu usar Context API e não Redux?"
- "Por que o editor não regrava o SVG depois de marcar zona?"

## Critérios de Aceite
- [x] Índice abaixo está em sync com arquivos em `docs/08_DECISOES/` (conferido 2026-09-08)
- [x] Cada ADR tem Status e Data
- [x] ADRs supersedidos têm link para o sucessor (ADR-001 → ADR-005, supersessão parcial)

---

## O que é um ADR?

Architecture Decision Record (ADR) é um documento que captura uma escolha arquitetural significativa, as alternativas consideradas, e as consequências. Formato padrão (Michael Nygard):

- **Status**: Proposed / Accepted / Superseded / Rejected / Deprecated
- **Contexto**: Por que estamos fazendo isso? Qual problema?
- **Decisão**: O que decidimos?
- **Alternativas consideradas**: O que mais pensamos?
- **Consequências**: O que muda? Tradeoffs?

## Índice de ADRs

| ID | Título | Status | Data | Supersede/Supersedido por |
|---|---|---|---|---|
| [ADR-001](../docs/08_DECISOES/adr-001-stack-e-motor-de-render.md) | Stack e motor de renderização (vetor-first) | Aceito | 2026-08-12 | Supersedido em parte por ADR-005 (Fabric.js) e por ADR-007 (“vetor-only”) |
| [ADR-002](../docs/08_DECISOES/adr-002-multi-tenant-white-label.md) | Estratégia multi-tenant e white-label | Aceito | 2026-08-12 | — |
| [ADR-003](../docs/08_DECISOES/adr-003-organizacao-para-ia.md) | Organização do projeto para agente de IA | Aceito | 2026-08-12 | — |
| [ADR-004](../docs/08_DECISOES/adr-004-contrato-de-zona-e-normalizacao-de-svg.md) | Contrato de zona e normalização de SVG | Aceito | 2026-08-12 | — |
| [ADR-005](../docs/08_DECISOES/adr-005-editor-de-zonas-em-svg-dom.md) | Editor de zonas em SVG DOM, e quem cunha o `id` | Aceito | 2026-09-05 | Supersede ADR-001 em parte (só Fabric.js) |
| [ADR-006](../docs/08_DECISOES/adr-006-autenticacao-da-api-de-variante.md) | Autenticação da API de variante: chave por tenant | Aceito — implementado | 2026-09-08 | — |
| [ADR-007](../docs/08_DECISOES/adr-007-modelo-3d-manipulavel.md) | Calçado 3D manipulável, e onde o princípio nº1 passa a ser verificado | Aceito — **bloqueado no insumo** | 2026-09-09 | Supersede ADR-001 em parte (só “vetor-only”) |

## O que cada ADR decidiu, e o que isso obriga no código

Resumo operacional, não substituto: o ADR continua sendo a fonte. Isto existe porque um
agente que só lê o índice acima sai sem saber **o que pode e o que não pode escrever** — e
descobre a regra depois de já ter violado.

| ADR | A decisão | O que ela proíbe no código |
|---|---|---|
| ADR-001 | React + Vite + Supabase + Vercel Functions; MVP **vetor-only** (nada de foto real na Fase 1) | Dependência de canvas/rasterização **para produto SVG**; segmentação de foto. O ADR-007 abre WebGL **só para produto 3D** — no palco de um produto SVG a proibição continua inteira, e é o que impede o preview vetorial de virar canvas rasterizado |
| ADR-002 | Multi-tenant com RLS por `tenant_id` em toda tabela; white-label vindo do tenant | Marca, cor, logo ou regra de cliente hardcodada; tabela nova sem RLS |
| ADR-003 | O projeto é escrito e lido por agentes: um termo um nome, arquivo pequeno, README de índice em todo diretório, comentário explica o porquê | Nome criativo (`magicColorEngine`); sinônimo "só neste arquivo"; convenção implícita não escrita |
| ADR-004 | Normalizar o SVG **antes** do Storage; zona endereça **conjunto** de elementos; zona não aplicada é **erro**, nunca aviso | `getElementById` + `setAttribute('fill')`; responder 200 com variante "quase certa"; `console.warn` como tratamento de falha |
| ADR-005 | Editor manipula SVG no DOM (Fabric.js **não entra no projeto**); o `id` nasce na normalização; `svg_selector` é lista de ids exatos; o canônico é **imutável** e o editor é somente-leitura sobre ele | Cunhar id no editor; regravar o asset ao marcar zona; seletor de prefixo (`[id^="..."]`); pintar o preview por CSS |
| ADR-006 | A API de variante autentica por **chave de API do tenant** (hash no banco, header `Authorization: Bearer`, revogável); o `tenant_id` sai da chave e a função valida o `product_id` contra ele antes de tudo | Aceitar `tenant_id` vindo do corpo/URL/header do chamador; chave em query string; chave guardada em claro ou reexibida; logar a chave (só o prefixo); responder 403 para recurso de outro tenant (é 404) |
| ADR-007 | Produto 3D é **glTF**; recolorir é escrever `baseColorFactor`, nunca renderizar no servidor; o **modo cor chapa** (unlit) é onde “cor no editor = cor na API” é verificável por pixel; zona 3D é **lista de nomes de malha exatos**, nascidos na normalização; material compartilhado é separado no provisionamento | Render 3D no servidor; aprovar cor no modo sombreado; escrever sRGB direto em `baseColorFactor` (é linear — a conversão mora em uma função só); seletor de malha por prefixo; nomear malha no editor; migrar produto SVG para 3D |

### ADR-005 em detalhe, porque é o que rege todo o código do editor

Está implementado e verificável hoje — `src/features/zonas/` e `src/lib/render/idDeElemento.ts`:

- **O id é cunhado na normalização, nunca no editor.** `normalizarSvg` dá `elemento-N` a todo
  pintável anônimo, em ordem de documento, sem colidir com id que o designer escreveu. Sem
  isso o export padrão de Illustrator seria immarcável: no tênis de demo, os 8 ilhoses não
  têm id nenhum.
- **O asset-base canônico é imutável e o editor é somente-leitura sobre ele.** Marcar zona
  escreve uma linha em `product_zones` e **nada** no SVG. O motivo é concorrência, não
  elegância: o Storage não tem escrita condicional (sem If-Match/ETag no `supabase-js`), então
  dois membros marcando ao mesmo tempo se sobrescreveriam — o id de um sumiria do arquivo
  enquanto o `svg_selector` dele continuaria no banco, resolvendo 0 elementos ou, pior, o
  elemento errado. Nenhum arquivo de `src/features/zonas/` importa `normalizarSvg`.
- **`svg_selector` é lista de ids exatos** (`#zona-cadarco, #zona-cadarco-2`), montada só por
  `montarSeletorDeZona`. Prefixo é **proibido**: `[id^="zona-cadarco"]` capturaria uma zona
  futura `zona-cadarco-lateral` e pintaria o lugar errado sem avisar — o modo de falha exato
  que o princípio nº1 existe para impedir.
- **Fabric.js não entra no projeto.** Importar o SVG para objetos Fabric criaria uma segunda
  representação do mesmo desenho ao lado do canônico, e o preview viraria canvas rasterizado
  enquanto a API devolve SVG: o pixel do editor deixaria de ser o pixel da API por construção.

## Regra Principal

> Toda decisão de arquitetura/produto relevante que afeta 2+ sistemas ou tem ciclo de vida > 1 sprint vira um ADR. Sem exceção.

Propostas de ADR vão em `docs/08_DECISOES/` como `ADR-NNN-titulo-da-decisao.md`. Numeração é sequencial, única, e nunca reciclada.

## Template para novo ADR

```markdown
# ADR-NNN: {{TITULO}}

## Status
Proposed / Accepted / Rejected

## Contexto
{{PROBLEMA}} {{RESTRICOES}} {{POR_QUE_AGORA}}

## Decisão
{{O_QUE_DECIDIMOS}}

## Alternativas Consideradas
- {{ALT_1}}: {{PROS}}, {{CONTRAS}}
- {{ALT_2}}: {{PROS}}, {{CONTRAS}}

## Consequências
- {{IMPACTO_1}}
- {{IMPACTO_2}}
- {{RISCO_1}}

## Referências
- {{LINK_DISCUSSAO}}
- {{LINK_IMPLEMENTACAO}}
```

## Como Contribuir

1. Propor ADR em `docs/08_DECISOES/adr-NNN-titulo.md` (minúsculo, como os existentes)
2. Escrever as alternativas descartadas **e por que foram descartadas** — é a parte que
   impede a decisão de ser refeita do zero daqui a três meses
3. Levar ao dono (Matheus). Não há PR nem revisor além dele nesta fase
4. Ao ser aceito: atualizar o índice acima, a tabela de "o que ela proíbe no código", e
   marcar a supersessão no ADR antigo, se houver
5. Se o ADR muda algo que já está no ar, atualizar `docs/01_ARQUITETURA/overview.md` e
   `memory/patterns.md` no **mesmo commit** — doc vencido é o defeito que esta seção existe
   para evitar

## Decisões Supersedidas / Em Review

- ADR-001 supersede: (nenhuma); **supersedido em parte pelo ADR-005** — só a escolha de Fabric.js
- **Em revisão**: (nenhuma decisão aberta). As duas perguntas que o
  `docs/01_ARQUITETURA/overview.md` deixava em branco — autenticação da API e cache em
  `variants` — foram respondidas em 2026-09-08: ADR-006 e "nada por enquanto"
- **Decidido em 2026-08-12, executado e provado em 2026-09-05**: correção de RLS, papéis e Storage
  (`docs/11_SEGURANCA/proposta-correcao-rls.md` → migration
  `20260812_correcao_rls_e_storage.sql`). Tenant provisionado por `service_role` na
  Fase 1; membro cria/edita, owner apaga e gerencia membros; URL assinada 300s.
  Não virou ADR porque implementa o ADR-002, não o altera. Aplicado num projeto Supabase
  real e provado por `supabase/tests/isolamento.test.ts` (8/8) — BUG-006..009 fechados

## Decisões tomadas na execução, sem ADR próprio (registradas para não serem refeitas)

Nenhuma delas altera um ADR — todas o implementam. Ficam aqui porque são escolhas com
alternativa razoável descartada, e um agente que não as encontre vai refazer a discussão:

- **Sem roteador no front** (`src/App.tsx` alterna telas por `useState`). Uma dependência de
  rota só se paga quando existir URL que precise ser compartilhável; hoje não existe.
- **`key={tenant.id}` na árvore protegida.** Trocar de marca **remonta** a tela em vez de
  atualizar o estado. Sem isso, o produto aberto e o SVG baixado da marca anterior
  sobreviveriam à troca e apareceriam sob o nome da marca nova — vazamento visual entre
  tenants concorrentes.
- **Validação escrita à mão (`validarCor`, `validarZoneKey`), sem Zod.** Duas validações
  pequenas e estáveis não pagam uma dependência nova; `memory/patterns.md` dizia "Zod ou
  equivalente" e o "equivalente" é isto.
- **`upsert` proibido em `product_zones`.** INSERT e UPDATE significam coisas diferentes, e a
  diferença é *quem some* — `upsert` cego apagaria o mapeamento de um colega em silêncio. A
  regra é guardada por teste que lê o próprio fonte, não por comentário.
- **A API de variante ainda não existe.** Não é omissão: é a peça seguinte. Enquanto isso,
  `src/lib/render/` já é o contrato que ela vai cumprir, e o editor prova que ele funciona.
  A **autenticação** dela já está decidida e documentada (ADR-006) — decidir antes de
  implementar, porque autenticação é o que não se troca depois do primeiro cliente integrado.
- **Cache em `variants`: nada por enquanto** (2026-09-08). A tabela existe e fica sem uso
  até haver medição de custo ou latência. Cache mal invalidado devolve a variante antiga
  depois de a zona ser remapeada ou a cor trocada — cor errada num calçado fabricado, e em
  silêncio, que é o princípio nº1 quebrado do pior jeito. Gerar é um `parse` + troca de
  `fill` sobre um SVG pequeno. Reabrir exige número medido **e** a regra de invalidação,
  que é a parte difícil (mudar zona, `cor_default` ou asset-base invalida o quê?).
- **`label` no banco, `rotulo` no código e na prosa** (2026-09-08). O glossário registra os
  dois como o mesmo conceito. A coluna `label` já está no schema aplicado num projeto real e
  renomeá-la custa migration + reescrita de todo `select` para ganhar consistência
  cosmética; o inverso — falar "label" em português — colidiria com a regra "um termo, um
  nome" no lado que um humano lê. A fronteira é exatamente a borda do banco: `zona.label`
  vindo do `select`, `rotulo` de lá para dentro.
- **Rota `POST /api/v1/products/:productId/variants`** (2026-09-08). Inglês e com `/v1`
  desde já. Inglês porque o corpo já é `{"sola": ...}` sob a coluna `zone_key`, que o
  glossário declara "chave pública da API e nunca é renomeada" — path em português
  (`/produtos/:id/variantes`) com corpo em inglês mistura dois idiomas dentro de uma
  requisição só, e o integrador acerta um e erra o outro. O `/v1` custa um segmento hoje;
  descartado "adicionar versão quando precisar", porque depois do primeiro cliente
  integrado o custo vira ou ele reescrever o código dele, ou nós carregarmos um alias sem
  versão para sempre. O arquivo é `api/v1/products/[productId]/variants.ts` — roteamento
  por sistema de arquivos da Vercel.
- **Sucesso é o artefato, erro é o envelope** (2026-09-08). 200 devolve o SVG cru
  (`Content-Type: image/svg+xml; charset=utf-8`, `Cache-Control: no-store`); erro devolve o
  envelope JSON `{ data, error: { code, message }, meta }`. Descartado envelopar também o
  sucesso (que era o que `memory/patterns.md` prescrevia): pôr o SVG dentro de JSON obriga
  escape/unescape do desenho inteiro, e o modo de falha desse round-trip é **mudança
  silenciosa do desenho** — a classe que o princípio nº1 proíbe. O raciocínio completo, as
  três razões e a tabela de códigos → status estão em `memory/patterns.md`, seção "Padrões
  de API / Backend".
- **A família "dado do tenant" responde 409** (2026-09-08), não 500 nem 422. São os erros em
  que a requisição está autenticada e bem formada e o que está errado é o mapeamento de
  zonas gravado pela marca (`svg_selector` que resolve zero elementos, zona em gradiente,
  zonas sobrepostas, asset-base corrompido). Descartado 500 porque faz cliente com retry
  reprocessar em laço uma falha determinística e enterra erro de dado no alarme de
  indisponibilidade; descartado 422 porque manda o integrador caçar defeito num payload
  correto. 409 é literalmente "a requisição conflita com o estado atual do recurso" — e a
  mensagem, que muda com a família, aponta a correção para o **editor**, não para o pedido.
- **Sem `vercel.json`** (2026-09-08). O roteamento por sistema de arquivos (zero-config) já
  cobre `api/v1/products/[productId]/variants.ts`. Descartado criar o arquivo por
  antecipação "porque um dia vai precisar": ele viraria a **segunda fonte de verdade da
  rota**, e a hora em que as duas divergirem é a hora em que ninguém sabe qual manda.
- **Assinatura Web (`Request`/`Response`) no handler, sem `@vercel/node`** (2026-09-08).
  Descartada a assinatura `(req: VercelRequest, res: VercelResponse)`: ela amarra o handler
  ao runtime da Vercel. Com `Request`/`Response`, (a) o mesmo handler roda num servidor
  local por Vite sem dependência nova — que é como ele será exercitado enquanto não houver
  deploy — e (b) ele fica testável construindo um `Request` à mão, sem subir servidor nem
  simular objetos de `node:http`.
- **Colunas de `tenant_api_keys` seguem o schema, não o rascunho do ADR-006** (2026-09-08).
  Valem `id, tenant_id, prefixo, hash, label, created_by, created_at, last_used_at,
  revoked_at`. As Notas de Implementação do ADR-006 tinham anotado `criada_em` /
  `criada_por` / `ultima_utilizacao_em` / `revogada_em` / `rotulo`; confrontadas com o
  schema real, estão erradas em dois pontos. Timestamp é coluna técnica e o schema já põe
  técnica em inglês (`zone_key`, `svg_selector`, `base_asset_path`, `rendered_path`), e as
  **5 tabelas existentes usam `created_at`** — descartado inaugurar uma sexta convenção numa
  tabela nova. E `rotulo` vira `label` porque o glossário já declara "**Rótulo** | coluna
  `label`, estado `rotulo`": inventar uma segunda coluna para o mesmo conceito é exatamente
  o que "um termo, um nome" proíbe. A **decisão** do ADR-006 não muda; mudou a nota de
  implementação, com o rastro da correção escrito no próprio ADR.
- **`mapaDeZonasPorElemento` fica, como contraprova** (2026-09-08). Ele **não** é usado pelo
  palco — `resolverZonaDoElemento` é quem responde ao clique. Continua existindo porque é a
  única implementação que enxerga o desenho inteiro de uma vez, e é assim que se confere que
  a resposta elemento a elemento bate com o mapa completo. Apagá-lo por "código morto" tira
  a contraprova; o docstring diz isso no arquivo, para ninguém redescobrir pelo `git log`.

## Atualizações deste documento

- **2026-09-09** — entra o **ADR-007** (calçado 3D manipulável). O dono escolheu a rota A —
  3D de verdade, não carrossel de vistas 2D — e o ADR existe sobretudo para resolver a
  objeção que a escolha levantava: em cena sombreada o pixel não é o hex, e o princípio nº1
  deixaria de ser verificável. A saída tem três partes: o **artefato** continua sendo editado,
  não renderizado, no servidor (glTF é JSON); o **modo cor chapa** devolve a igualdade de
  pixel onde ela precisa existir; e a conversão sRGB→linear vira função única com teste de
  ida e volta, porque errá-la produz cor plausível e errada — o modo de falha silencioso que
  o projeto existe para não ter. No mesmo passe, duas correções de índice: o ADR-006 estava
  marcado “não implementado” desde 2026-09-08, quando foi implementado inteiro, e a
  linha do ADR-001 não registrava a supersessão parcial do “vetor-only”.
- **2026-09-08** — entram as decisões de execução do **contrato da API de variante** (Etapa 1,
  contrato e README; a função ainda não existe): a rota `POST /api/v1/products/:productId/variants`,
  "sucesso é o artefato, erro é o envelope", a família "dado do tenant" em 409, a ausência
  deliberada de `vercel.json`, a assinatura Web (`Request`/`Response`) no handler e a
  correção dos nomes de coluna de `tenant_api_keys` contra o schema real. Nenhuma delas
  altera um ADR — a última **corrige a nota de implementação** do ADR-006 sem tocar na
  decisão dele, que é o caso que a seção "Contexto" deste documento já previa ("a decisão de
  um ADR aceito é imutável; o arquivo não é").
- **2026-09-08** — entra o **ADR-006** (autenticação da API de variante) e as três decisões
  menores que o acompanham: cache em `variants` ("nada por enquanto"), `label`×`rotulo` e
  `mapaDeZonasPorElemento` como contraprova. É o primeiro ADR escrito **antes** da
  implementação em vez de junto dela — cabível porque autenticação é o que não se troca
  depois do primeiro cliente integrado, e hoje existem zero integrações.
- **2026-09-07** — auditoria contra o código das Etapas 0–5 (Etapa 6). Entram o resumo do
  que cada ADR obriga/proíbe e o detalhamento do ADR-005, que só existia como uma linha de
  índice; sai o processo herdado de template que este projeto nunca teve (PR com revisor,
  CI, bot de validação de ADR, acoplamento a issue tracker, eventos `decision.*`); corrigida
  a afirmação "ADRs são imutáveis após mergeados", que o próprio ADR-001 contradiz.
