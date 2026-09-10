# 08 — DECISÕES · Kora Calçados (codinome)

> ADRs (Architecture Decision Records): por que escolhemos X em vez de Y.

## O que vive aqui

- **ADRs**: decisões técnicas formalizadas (status, contexto, alternativas, consequências)
- **Ciclo de vida**: Proposto → Aceito → Supersedido
- **Arquivo**: um ADR por arquivo (`adr-NNN-titulo.md`)
- **Histórico**: decisões antigas/supersedidas ficam, marcadas como "Supersedido por"
- **Rastreabilidade**: quando foi decidido, quem decidiu, qual código implementa

## O que NÃO vive aqui

- Implementação da decisão → `src/`
- Especificações de API → `07_APIS/`
- Regras de negócio → `03_REGRAS_DE_NEGOCIO/`
- Fluxos → `05_FLUXOS/`

## Índice (arquivos reais desta pasta)

| Arquivo | Decisão | Status |
|---|---|---|
| `adr-000-template.md` | TEMPLATE — copie para criar um ADR novo | — |
| `adr-001-stack-e-motor-de-render.md` | React+Vite+Supabase+Vercel, MVP vetor-only | Aceito (Fabric.js supersedido pelo ADR-005; “vetor-only” pelo ADR-007) |
| `adr-002-multi-tenant-white-label.md` | Multi-tenant desde o schema, white-label por tenant | Aceito |
| `adr-003-organizacao-para-ia.md` | Projeto organizado para leitura de agente, não de humano | Aceito |
| `adr-004-contrato-de-zona-e-normalizacao-de-svg.md` | Zona = conjunto de elementos; SVG normalizado no upload | Aceito |
| `adr-005-editor-de-zonas-em-svg-dom.md` | Editor em SVG DOM (sem Fabric.js); id cunhado na normalização; seletor = lista de ids exatos | Aceito |
| `adr-006-autenticacao-da-api-de-variante.md` | API de variante autentica por chave de API **por tenant**; `tenant_id` vem da chave, nunca do chamador | Aceito — implementado (Etapas 1–6, 2026-09-08) |

| `adr-007-modelo-3d-manipulavel.md` | Calçado 3D manipulável: glTF como artefato, recolor por `baseColorFactor`, **modo cor chapa** como o modo que verifica o princípio nº1, zona = lista de nomes de malha | Aceito — **bloqueado no insumo** (não existe glTF no projeto) |
| `adr-008-calcado-gerado-sobre-acervo-de-pecas.md` | Calçado gerado por prompt: a IA **escolhe e estiliza** peças de um acervo, nunca esculpe; o calçado gerado é uma **composição** (JSON), não uma malha; **cada peça é uma zona**, então marcar zona deixa de existir no modo gerado | Aceito — **bloqueado no acervo** (as peças não existem) |
| `adr-009-saida-do-cliente.md` | O que a marca leva embora se cancelar: tudo que é dela, em formato aberto; o acervo base da Kora não sai | Aceito |

Numeração é sequencial e nunca reciclada. Espelho deste índice em `memory/decisions.md`
— os dois precisam estar em sync.

## Como preencher

1. **Copie `adr-000-template.md`**: renomeie para `adr-NNN-titulo.md`
2. **Preencha todas as seções**: Contexto, Decisão, Alternativas, Consequências
3. **Status começa "Proposto"**: aprovação → "Aceito", depois → "Supersedido"
4. **Não delete ADRs antigos**: marque como "Supersedido por adr-NNN", arquivo fica no histórico
5. **Atualize quando decisão muda**: novo ADR que supersede, link bidirecional

## Ligações

- `adr-000-template.md` — comece aqui, clone para novo ADR
- `01_ARQUITETURA/` — ADRs justificam as escolhas técnicas
- `03_REGRAS_DE_NEGOCIO/` — se regra é decisão técnica, document em ADR
