# Restrições Permanentes — Kora Calçados (codinome)

## Objetivo
- Documentar limites e restrições que guiam decisões
- Evitar caminhos bloqueados (custo, legal, ético, técnico)
- Força atualizações de restrições vencidas

## Contexto
- Restrição = barreira de entrada; exceção exige ADR
- Revisão: trimestral

## Regras Gerais
- Nenhuma restrição ignorada sem ADR formal de exceção
- Restrições legais/compliance têm prioridade máxima
- Restrição vencida é removida; não acumula dívida técnica

## Validações
- Restrição tem justificativa concreta?
- Data de revisão planejada está clara?

## Permissões
- Dono/compliance: aprova exceção de restrição legal
- Tech lead: aprova exceção técnica

## Exceções
- Restrição legal pode ser violada por decisão explícita do dono com ADR (raro)

## Auditoria
- Revisar todas as restrições contra realidade trimestralmente
- Exceções aprovadas vira ADR público

## Eventos
- `restriction.added`, `restriction.excepted`, `restriction.lifted`

## Casos de Uso
- "Posso usar biblioteca paga?"
- "Posso armazenar dados de PII sem encriptação?"
- "Temos limite de infraestrutura?"

## Critérios de Aceite
- [ ] Cada categoria tem mínimo 1 restrição preenchida
- [ ] Restrições com data de revisão clara
- [ ] Exceções aprovadas linkadas a ADR

---

## Restrições Técnicas

| Restrição | Detalhes | Revisão | Exceção |
|---|---|---|---|
| Sem worker sempre-ligado (Railway/Render) na Fase 1 | MVP vetor-only não precisa de compute pesado; motor de render roda em função serverless comum | 2026-11-01 | Reavalia quando Fase 2 (segmentação de foto real) for decidida — ver ADR-001 |
| Sem Redis pago (bootstrap) | Cache de variante é a própria tabela `variants` + Storage, não terceiros | 2026-11-01 | Exceção por ADR se volume de geração crescer 10x |
| Sem webhook/automação paga | Funções serverless da Vercel + Supabase (grátis) cobrem o necessário | 2026-11-01 | Reavalia quando houver receita recorrente |
| Motor de render precisa caber em função serverless | Sem GPU, sem processo longo — limite de tempo/memória da Vercel é o teto de projeto do motor | 2026-11-01 | Fase 2 (foto real) provavelmente exige exceção formal — novo ADR |

## Restrições Legais / Compliance

| Restrição | Detalhes | Prioridade | Revisão |
|---|---|---|---|
| Isolamento entre tenants concorrentes | RLS obrigatória em toda tabela + storage particionado por tenant; marca concorrente nunca vê coleção de outra | CRÍTICA | 2026-11-01 (trimestral) |
| LGPD: minimização de dado | Só nome/e-mail/empresa do usuário do time cliente — nada além do necessário pra login e contato | CRÍTICA | 2027-08-12 (anual) |
| Dados de menores | Não aplicável na Fase 1 (B2B puro, sem consumidor final). Mantida como trava caso o produto ganhe camada B2C | CRÍTICA | 2027-08-12 (anual) |
| Retenção de dados | 90 dias máx logs, 2 anos máx operacionais, cliente pode exportar/excluir sempre | CRÍTICA | 2027-08-12 (anual) |

## Restrições de Custo (Fase Bootstrap)

**Diretriz Geral**: Priorizar meios **gratuitos**. Toda implementação com custo relevante é **ADIADA por padrão**, salvo decisão explícita do dono.

### Implementações Pagas Encontradas
Ao esbarrar em algo pago, seguir este checklist:

- [ ] **Custo aproximado**: R$ X/mês ou Y% do MRR
- [ ] **Alternativa gratuita**: Qual? Por que não usável agora?
- [ ] **Importância/Impacto**: Crítica / Alta / Média / Baixa para produto
- [ ] **Recomendação**: Investir AGORA ou MAIS PRA FRENTE?
- [ ] **Decisão do dono**: [Reter até decisão explícita]

### Exemplos de Itens Pagos (Restringidos)

| Item | Custo Aprox | Alt Grátis | Impacto | Status |
|---|---|---|---|---|
| Segmentação de foto real (IA/SAM ou equivalente) | A definir na Fase 2 | Não — Fase 1 é vetor-only | ALTA (só na Fase 2) | [ADIADO até Fase 2 ser priorizada] |
| Stripe/Asaas (gateway) | 2.99% + R$ 0.30/tx (Stripe) | Venda manual/contrato, PIX/TED | CRÍTICA (fase billing) | [ADIADO — venda manual na Fase 1, ver ADR quando Fase 3 chegar] |
| Supabase tier pago (storage de SVG/PNG além do free) | ~US$ 25/mês | Free tier até estourar; SVG é leve, PNG só sob demanda | MÉDIA (só quando houver catálogo real) | [ADIADO — monitorar uso quando o primeiro cliente subir catálogo] |
| Analytics pago (Mixpanel) | R$ 200+/mês | PostHog open-source, Plausible | BAIXA (B2B, poucos usuários por tenant) | [ADIADO, usar alternativa grátis] |

**Processo**: Dono revisa lista trimestralmente, aprova investimentos conforme receita cresce.

## Restrições de Produto

| Restrição | Detalhes | Por quê | Exceção |
|---|---|---|---|
| Foto real como imagem-base | MVP só aceita vetor/ilustração; foto real fica pra Fase 2 | Segmentação de foto exige IA/custo/complexidade que o MVP não precisa pra provar o valor central | Reavaliar quando Fase 2 for decidida (novo ADR) |
| Sem lock-in | Cliente exporta asset (SVG) e dados (CSV/JSON) quando quiser | Diferencial + confiança | Nunca. Prioridade máxima |
| Multi-tenancy obrigatório | Novo código assume N tenants, não hardcoda marca/cores | Roadmap de escala + isolamento entre concorrentes | Refatorar antes de mergear (ver ADR-002) |
| Sem hardcode de identidade | Tema, cores, logo, regras vêm da config do tenant | White-label | Usar contexto de tenant em runtime, nunca constante no componente |
| Sem promessa de cor sem falha visível | Zona pedida que não foi aplicada é erro na resposta, nunca 200 silencioso | Cor errada vira calçado errado — princípio nº1 | Nenhuma |

## Restrições Éticas

| Restrição | Detalhes | Revisão |
|---|---|---|
| Sem promessa de fidelidade de cor sem calibração | Nunca comunicar "cor exata de fábrica" sem testar contra padrão físico (Pantone/RAL) — cor de tela ≠ cor de produção | 2026-11-01 |
| Transparência de IA | Se usar IA (segmentação, sugestão), informar ao usuário que é automático | 2026-11-01 |
| Sem dark patterns | Nada de default sneaky (auto-renovação, confirmação dupla para cancelar) | Contínuo |

---

## Plano de Revisão

- **Próxima revisão legal/compliance**: 2026-11-01
- **Próxima revisão técnica**: 2026-11-01
- **Próxima revisão de custo**: quando Fase 2 (segmentação de foto real) for priorizada
- **Proprietário de cada seção**: Matheus Bonato

## Exceções Aprovadas (ADRs)

| Restrição | ADR | Data Exceção | Contexto |
|---|---|---|---|
| (nenhuma exceção aprovada até 2026-08-12) | — | — | — |
