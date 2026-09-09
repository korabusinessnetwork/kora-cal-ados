# ADR-001 — Stack e motor de renderização (vetor-first)

**Status**: Aceito
**Data**: 2026-08-12
**Decisores**: Matheus Bonato
**Supersede**: (nenhum — primeira decisão do projeto)
**Supersedido por**: ADR-005, **parcialmente** — só a escolha de Fabric.js para o editor.
E ADR-007, **parcialmente** — só o “MVP vetor-only”, que passa a admitir produto 3D ao
lado do vetorial (nenhum produto SVG é migrado). O resto (React+Vite, Supabase, Vercel
Functions) continua vigente.

---

## Contexto

Kora Calçados precisa de duas capacidades desde o dia 1: um editor visual (time de
produto marca zonas num modelo de calçado) e uma API que gera variantes de cor/material
dessas zonas em escala. O produto atende marcas calçadistas, que podem incluir
concorrentes diretas no mesmo sistema — isolamento entre tenants é requisito crítico,
não incremental.

Os modelos-base podem ser vetor/ilustração (zonas já separadas no arquivo) ou foto real
(precisa segmentação/máscara). O MVP foi escopado para vetor/ilustração apenas — foto
real fica para uma fase futura porque exige IA de segmentação (SAM ou equivalente),
custo de computação real, e complexidade que não é necessária pra validar o valor
central do produto (gerar variante em escala).

Projeto em fase bootstrap, pré-receita, venda B2B manual/contrato — sem orçamento pra
infraestrutura paga na Fase 1.

---

## Decisão

> ⚠️ **A parte "Fabric.js" desta decisão foi supersedida pelo ADR-005** (2026-09-05):
> o editor manipula SVG no DOM, sem canvas. O texto abaixo fica como foi escrito — ADR não
> se reescreve, se supersede.

Vamos usar **React + Vite + Fabric.js** no editor, **Supabase** (Postgres + RLS +
Storage + Auth) como camada de dados, e **Vercel Serverless Functions** como motor de
geração de variante (recolore SVG via manipulação de atributo `fill`, rasteriza com
`sharp`/`resvg` quando PNG for pedido). Nenhum worker sempre-ligado, nenhuma GPU, nenhum
serviço de IA nesta fase — o MVP é deliberadamente vetor-only para manter o motor de
render leve o bastante para rodar em função serverless comum.

---

## Alternativas Consideradas

### 1. Konva.js no lugar de Fabric.js

- **Prós**: melhor performance em cenas complexas, bindings React mais limpos (`react-konva`)
- **Contras**: menos "herança" de ferramenta de design (seleção, handles, filtros já prontos); renderização server-side menos madura que Fabric+node-canvas
- **Descartado porque**: Fabric.js tem serialização JSON e histórico de uso em ferramentas tipo Kittl/Canva que casa melhor com "editor que também precisa espelhar no servidor"

### 2. Worker sempre-ligado (Railway/Render, como no projeto WIA) desde o MVP

- **Prós**: prepara terreno pra segmentação de foto real (Fase 2) sem re-arquitetar depois
- **Contras**: custo mensal fixo desde o dia 1, complexidade operacional que o MVP vetor-only não precisa
- **Descartado porque**: MVP não faz nada computacionalmente pesado; adicionar o worker fica fácil quando a Fase 2 (foto real) for decidida — não é retrabalho, é adição

### 3. Segmentação por IA (SAM ou equivalente) já na Fase 1, suportando foto real desde o início

- **Prós**: cobre os dois tipos de imagem-base (vetor e foto) que os clientes eventualmente vão trazer
- **Contras**: custo de computação real, complexidade de UI pra máscara manual/revisão, atraso no MVP
- **Descartado porque**: aumenta o escopo do MVP sem aumentar a prova de valor central (gerar variante em escala); vetor-only já prova o conceito com um catálogo real

---

## Consequências

### Positivas

- MVP roda 100% em free tier (Vercel + Supabase) — sem custo de infra na fase de venda manual
- Motor de render simples (manipulação de SVG) é rápido de construir e fácil de testar
- Mesma espinha dorsal dos outros projetos Kora (React+Vite+Supabase+Vercel) — reaproveita padrão de RLS, auth e deploy já validado
- ~~Fabric.js permite reaproveitar o mesmo grafo de objetos no editor (client) e, se necessário, num render espelhado no servidor~~ — **não se concretizou**: o ADR-004 decidiu que o servidor usa `gerarVarianteDeCor` sobre o SVG canônico, sem grafo nenhum. Foi o que motivou o ADR-005

### Negativas / Trade-offs

- Clientes com modelos apenas em foto real não são atendidos até a Fase 2
- Escopo "os dois desde o início" (vetor + foto) do produto fica parcialmente adiado —
  documentado como decisão consciente, não esquecimento
- Se a demanda por foto real chegar antes do previsto, precisa reabrir esta decisão via
  novo ADR (adicionar worker + modelo de segmentação)

---

## Referências

- `docs/01_ARQUITETURA/overview.md` — como as peças se encaixam
- `docs/00_VISAO/visao-produto.md` — problema e proposta de valor que motivam o escopo vetor-first
- `memory/restrictions.md` — restrição de custo (bootstrap R$0) que influenciou a decisão
- `docs/11_SEGURANCA/` — isolamento multi-tenant, requisito que vale para qualquer stack escolhida

---

## Notas de Implementação

- Migrations de schema vivem em `supabase/migrations/`
- Toda tabela assume `tenant_id` + RLS policy, sem exceção (ver ADR-002 quando multi-tenant for detalhado)
- Storage particionado por tenant no path, não só por nome de arquivo
- Rasterização SVG→PNG: preferir `resvg`/`@resvg/resvg-js` (renderer dedicado) sobre `sharp`
  se a qualidade de SVGs complexos (gradientes, clip-paths) exigir mais fidelidade
