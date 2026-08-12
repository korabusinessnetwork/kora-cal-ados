# Decisões de Arquitetura — Kora Calçados (codinome)

## Objetivo
- Registrar todas as decisões arquiteturais e de produto relevantes
- Evitar re-discussão de problemas já resolvidos
- Documentar trade-offs e contexto de cada decisão

## Contexto
- Sistema vive em `/docs/08_DECISOES/` (ADRs em markdown)
- Cada ADR tem ID sequencial (ADR-001, ADR-002, etc.)
- ADRs são imutáveis após mergeados (novos ADRs superseden os antigos)

## Regras Gerais
- Toda decisão de arquitetura, tech stack ou produto vai para um ADR
- Decisão = mudança que afeta 2+ componentes ou ciclo de vida longo
- Pequenos bugs/refators não viram ADR
- ADR sobrescreve docs divergentes; ADR é fonte de verdade

## Validações
- ADR tem contexto claro (problema, alternativas, consequências)?
- Decisão foi discutida com stakeholders chave?

## Permissões
- Qualquer dev pode propor ADR (em `docs/08_DECISOES/adr-NNN-titulo.md` (minúsculo, como os existentes))
- Dono/tech lead: aprova merge

## Exceções
- ADR de máxima urgência (segurança, compliance): pode ser escrito pós-deploy com tag [URGENT]

## Auditoria
- Revisar ADRs semestralmente vs. realidade da codebase

## Eventos
- `decision.proposed`, `decision.superseded`, `decision.reviewed`

## Configurações Futuras
- Bot para validar formato de ADR
- Acoplamento automático ADR ↔ issues/PRs

## Casos de Uso
- "Por que escolhemos Supabase e não Firebase?"
- "O que mudou de banco de dados e quando?"
- "Quem decidiu usar Context API e não Redux?"

## Critérios de Aceite
- [x] Índice abaixo está em sync com arquivos em docs/08_DECISOES/ (conferido 2026-08-12)
- [x] Cada ADR tem Status e Data
- [ ] ADRs obsoletos têm link para sucessor (nenhum obsoleto ainda)

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
| [ADR-001](../docs/08_DECISOES/adr-001-stack-e-motor-de-render.md) | Stack e motor de renderização (vetor-first) | Aceito | 2026-08-12 | — |
| [ADR-002](../docs/08_DECISOES/adr-002-multi-tenant-white-label.md) | Estratégia multi-tenant e white-label | Aceito | 2026-08-12 | — |
| [ADR-003](../docs/08_DECISOES/adr-003-organizacao-para-ia.md) | Organização do projeto para agente de IA | Aceito | 2026-08-12 | — |
| [ADR-004](../docs/08_DECISOES/adr-004-contrato-de-zona-e-normalizacao-de-svg.md) | Contrato de zona e normalização de SVG | 🟡 Proposto | 2026-08-12 | — |

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
2. Solicitar revisão ao tech lead / dono
3. Discutir alternativas (no PR)
4. Merge quando consenso atingido
5. Atualizar índice acima

## Decisões Supersedidas / Em Review

- ADR-001 supersede: (nenhuma)
- **Em revisão (aguardando decisão do dono, 2026-08-12)**:
  - ADR-004 — contrato de zona e normalização de SVG (motor atual falha em SVG real,
    ver `memory/bugs.md` BUG-001/002)
  - Correção de RLS e caminho de onboarding de tenant —
    `docs/11_SEGURANCA/proposta-correcao-rls.md` (BUG-006/007/008/009)
