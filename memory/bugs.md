# Registro de Bugs Conhecidos — Kora Calçados (codinome)

## Objetivo
- Documentar bugs conhecidos (produção e protótipo validado)
- Evitar re-report de problemas conhecidos
- Rastrear status e ETA de correções
- Post-mortems de bugs críticos

## Contexto
- Bugs em código (não user error) vão aqui
- Separados por severidade: CRÍTICA / ALTA / MÉDIA / BAIXA
- Estados: aberto / em_analise / em_correcao / corrigido / reaberto / wontfix

## Regras Gerais
- Bug que afeta produção **ou** que já está provado em protótipo/teste entra aqui —
  não esperar chegar em produção pra registrar defeito conhecido
- Toda bug CRÍTICA/ALTA tem ADR se deixar débito arquitetural
- Reaberturas ganham tag [REABERTO] com data nova
- Vazamento entre tenants é **sempre** severidade CRÍTICA (ver `docs/11_SEGURANCA/`)

## Validações
- Bug tem repro steps claros?
- Impacto está descrito em termos de produto (cor errada = produção errada), não só técnico?

## Permissões
- Qualquer agente/dev: abre e atualiza status
- Dono (Matheus): aprova "wontfix" ou prioriza

## Exceções
- Bug crítico (segurança, perda de dados): correção > documentação

## Auditoria
- Triagem semanal de bugs abertas
- Bugs "em_analise" > 7 dias = escalar ao dono

## Eventos
- `bug.reported`, `bug.reproduced`, `bug.fixed`, `bug.reopened`

## Casos de Uso
- "A cor que saiu da API é a mesma que o editor mostrou?"
- "Esse SVG do cliente já quebrou o motor antes?"
- "Alguém já viu tenant enxergando produto de outro tenant?"

## Critérios de Aceite
- [ ] Bug reproduzível tem teste que a prova (não só descrição)
- [ ] Bugs > 30 dias abertas revisadas
- [ ] Bugs corrigidas têm referência a PR/commit

---

## Registro por Severidade

### CRÍTICA (perda de dados, segurança, fidelidade de cor)

| ID | Data | Módulo | Descrição | Status | Correção/ADR | ETA |
|---|---|---|---|---|---|---|
| BUG-001 | 2026-08-12 | Motor de render | `style` inline e regra CSS de classe (`.st0{fill:...}`) vencem o atributo `fill` que o motor escreve — a zona **não muda de cor** e a API devolve 200 como se tivesse mudado. Export padrão de Illustrator/Figma cai exatamente nesse caso. Viola o princípio nº1 (cor no editor = cor na API) | aberto | ADR-004 (proposto) | — |
| BUG-003 | 2026-08-12 | Motor de render | Zona inexistente só emite `console.warn` e devolve o SVG normalmente; cor inválida (`"banana"`) é aceita sem validação. Em função serverless, `console.warn` é falha silenciosa — o chamador da API não tem como saber que a variante saiu errada | aberto | ADR-004 (proposto) | — |
| BUG-006 | 2026-08-12 | Banco / RLS | `auth_tenant_ids()` é `language sql stable` **sem `security definer`** e a policy de `tenant_members` a invoca — a função relê `tenant_members`, que reaplica a policy. Padrão clássico de `42P17: infinite recursion detected in policy`. **Ainda não reproduzido** (sem Docker local pra `supabase start`) | em_analise | `docs/11_SEGURANCA/proposta-correcao-rls.md` | — |

**Critério de fechamento**: correção + teste que prova a correção rodando em CI

---

### ALTA (impacto operacional, workaround existe)

| ID | Data | Módulo | Descrição | Status | Correção/ADR | ETA |
|---|---|---|---|---|---|---|
| BUG-002 | 2026-08-12 | Motor de render | Zona só é endereçável como **um** elemento por `id`: grupo `<g>` não repinta filhos com `fill` próprio, zona com N paths (`zona-cadarco` + `zona-cadarco-2`, presente no próprio `scripts/teste-zona.svg`) só repinta o primeiro, e `id` duplicado idem | aberto | ADR-004 (proposto) | — |
| BUG-004 | 2026-08-12 | Motor de render / Upload | `<script>` embutido no SVG base sobrevive ao motor e é servido ao navegador do cliente. Não há sanitização no upload, apesar de exigida em `docs/11_SEGURANCA/multi-tenancy-rls.md` | aberto | ADR-004 (proposto) | — |
| BUG-007 | 2026-08-12 | Banco / RLS | Não existe policy de INSERT em `tenants` nem `tenant_members`, nem de UPDATE em `tenants` — criar tenant, convidar membro e editar tema white-label são impossíveis pelo cliente. Onboarding travado antes de existir | aberto | `docs/11_SEGURANCA/proposta-correcao-rls.md` | — |
| BUG-008 | 2026-08-12 | Storage | Nenhuma policy de Storage definida na migration, apesar de o plano de segurança exigir bucket privado + path particionado por tenant + URL assinada. Hoje o isolamento do asset-base depende só de convenção de path | aberto | `docs/11_SEGURANCA/proposta-correcao-rls.md` | — |

**Critério de fechamento**: correção + teste de isolamento (dois tenants) verde

---

### MÉDIA (impacto limitado ou raridade)

| ID | Data | Módulo | Descrição | Status | Correção/ADR | ETA |
|---|---|---|---|---|---|---|
| BUG-005 | 2026-08-12 | Motor de render | Zona pintada com gradiente (`fill="url(#grad)"`) vira cor chapa sem aviso — perde a representação de material/textura silenciosamente | aberto | ADR-004 (proposto) | — |
| BUG-009 | 2026-08-12 | Banco / RLS | `tenant_members.papel` (`owner`/`membro`) está modelado mas nenhuma policy o usa — todo membro tem escrita total sobre produtos, zonas e variantes | aberto | `docs/11_SEGURANCA/proposta-correcao-rls.md` | — |

---

### BAIXA (cosmético, cenário de nicho)

| ID | Data | Módulo | Descrição | Status | Correção/ADR | ETA |
|---|---|---|---|---|---|---|
| BUG-010 | 2026-08-12 | Docs | `supabase/schema.sql` é um stub apontando para a migration, mas `CLAUDE.md` e `docs/04_MODELAGEM/` o declaram fonte de verdade do banco. A verdade real está em `supabase/migrations/` | aberto | — | — |

---

## Estados

- **aberto**: registrado, correção não começou
- **em_analise**: sob investigação (causa raiz ainda não confirmada)
- **em_correcao**: correção em andamento
- **corrigido**: correção aplicada e provada por teste
- **reaberto**: voltou; causa raiz não era essa (tag [REABERTO] + data)
- **wontfix**: descartado, motivo documentado

## Template para Reportar

```markdown
## Bug Report: <título>

**Severidade**: CRÍTICA / ALTA / MÉDIA / BAIXA

**Módulo**: motor de render / editor de zonas / banco-RLS / storage / API

**Descrição**:
O que acontece / o que deveria acontecer

**Repro Steps**:
1. ...
2. ...

**Impacto de produto**:
A variante sai com cor errada? Um tenant vê dado de outro? Quantos produtos/zonas?

**Contexto**:
- Origem do SVG (Illustrator / Figma / feito à mão)
- Ambiente (local / preview / produção)
- Data/hora

**Logs** (sem payload de outro tenant — ver plano de segurança)

**Workaround** (se existe)
```

## Bugs Corrigidas (últimos 30 dias)

| ID | Data Fechamento | Módulo | Referência |
|---|---|---|---|
| — | — | — | — |

---

## Post-Mortems (Bugs Críticas)

| Bug | Data | Causa Raiz | Ação Preventiva | ADR |
|---|---|---|---|---|
| — | — | — | — | — |

---

## SLA de Resposta

- CRÍTICA: 1h análise, 4h correção
- ALTA: 1 dia análise, 2 dias correção
- MÉDIA: 1 semana
- BAIXA: backlog (sem ETA)

## Como estes bugs foram encontrados

BUG-001..005 saíram de validação adversarial do protótipo contra SVGs equivalentes a
export real de Illustrator/Figma, executada em 2026-08-12 antes de qualquer código de
Fase 1 ser escrito. Todos estão travados em `scripts/prototipo-recolor-svg.test.mjs`
como `it.fails` — ao corrigir o motor, o teste acusa e força a atualização.
BUG-006..010 saíram de revisão estática do schema/migration e das docs na mesma data.
