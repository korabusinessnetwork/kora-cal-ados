# Arquitetura — Visão Geral · Kora Calçados (codinome)

> Justificativa completa da escolha de stack vive em `08_DECISOES/adr-001-stack-e-motor-de-render.md`.
> Este arquivo é o "mapa" de como as peças se encaixam.

## Stack

| Camada | Escolha | Papel |
|---|---|---|
| Frontend / Editor | React + Vite + **Fabric.js** | Canvas de edição: carregar SVG base, marcar zonas, preview de variante |
| Dados / Auth | Supabase (Postgres + RLS + Storage) | Tenants, produtos, zonas, autenticação, storage dos SVGs |
| API de geração | Vercel Serverless Functions | Recebe `{zona: cor}`, recolore o SVG base, devolve SVG ou PNG |
| Deploy | Vercel (app + funções) + Supabase (dados) | Mesma espinha dorsal dos outros projetos Kora |

Escala escolhida deliberadamente **enxuta para o MVP**: como o MVP é vetor/ilustração
(não foto real), recolorir é manipulação de atributo `fill` num SVG — leve o bastante
para rodar numa função serverless comum, sem GPU, sem worker sempre-ligado, sem custo
de infra além do free tier. Ver `memory/restrictions.md` para o racional de custo.

## Conceito central: zona endereçável

Um "frame" no vocabulário original do produto = uma **zona** dentro da imagem de um
modelo de calçado (a sola, o cabedal, o cadarço, o logo). Cada zona é um path ou grupo
já separado dentro do SVG base — não é uma máscara sobre foto (isso é a V2, ver
`memory/identity.md` → Roadmap).

## Modelo de dados (rascunho — detalhar em `04_MODELAGEM/`)

```
tenants          (id, nome, slug, tema/white-label config)
products         (id, tenant_id, nome, base_asset_path)       -- SVG em Supabase Storage
product_zones    (id, product_id, zone_key, svg_selector, label, cor_default)
variants*        (id, product_id, zone_colors jsonb, rendered_path, created_at)
```
`*variants` é cache opcional — a API pode gerar on-the-fly sem persistir, e só grava
quando faz sentido reaproveitar (ex: catálogo público, ou variante muito requisitada).

## Fluxo — Editor (setup, feito uma vez por modelo)

1. Time de produto sobe o SVG base do modelo no editor (Fabric.js)
2. Seleciona cada parte (path/grupo) e marca como zona: `sola`, `cabedal`, `cadarço`, `logo`
3. Isso grava `product_zones` (zone_key ↔ seletor dentro do SVG)
4. Preview client-side já mostra a troca de cor em tempo real antes de publicar

## Fluxo — API (geração, chamado quantas vezes precisar)

1. `POST /products/:id/variants` com `{"sola": "#C0392B", "cabedal": "#111111"}`
2. Função serverless busca o SVG base no Storage (`tenants/{tenant_id}/products/{id}/base.svg`)
3. Aplica os seletores de `product_zones` e troca `fill` de cada zona pedida
4. Devolve SVG direto, ou rasteriza pra PNG (`sharp` ou `resvg`) se `?format=png`
5. Opcionalmente grava em `variants` pra reuso rápido da mesma combinação

## Isolamento multi-tenant (não-negociável — ver `11_SEGURANCA/`)

- RLS em toda tabela por `tenant_id`, sem exceção
- Storage particionado por tenant no path (`tenants/{tenant_id}/...`), nunca por
  convenção de nome de arquivo só
- Nenhuma função serverless aceita `product_id` sem validar que pertence ao
  `tenant_id` do token autenticado

## Protótipo — o que está provado e o que não está

`scripts/prototipo-recolor-svg.mjs` prova o **caminho feliz** do fluxo API em código real
(jsdom + `getElementById` + `setAttribute('fill', ...)`), contra `scripts/teste-zona.svg`.

⚠️ **Não está pronto pra SVG real.** Validação adversarial em 2026-08-12 (9 casos,
travados em `scripts/prototipo-recolor-svg.test.mjs`) mostrou que em export de
Illustrator/Figma o `style` inline e a regra CSS de classe vencem o atributo `fill` —
a zona não muda de cor e a API responde 200 como se tivesse mudado. Zona também não é
endereçável como grupo `<g>` nem como conjunto de N paths. Ver `memory/bugs.md`
BUG-001..005; contrato corrigido proposto em ADR-004.

Vira `src/lib/render/gerarVarianteDeCor.ts` quando o projeto Vite for inicializado —
mesma função, mesmo nome (ver glossário) — **depois** que o contrato de zona for fechado.

## O que fica fora do MVP (documentado, não esquecido)

- Segmentação de foto real (precisa IA/máscara — Fase 2)
- Self-serve + billing (Fase 3 — venda é manual/contrato por enquanto)
- Widget/embed pro consumidor final (não é B2B2C nesta fase)

## Atualizações

- **2026-08-12** — versão inicial, gerada na fundação do projeto.
