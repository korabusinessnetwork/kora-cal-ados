# Aprendizados — Kora Calçados (codinome)

## Objetivo
- Manter memória viva do que aprendemos construindo o produto
- Documentar raciocínios antes de viraem padrão ou decisão
- Evitar repetir mesmo erro 6 meses depois

## Contexto
- Aprendizados vêm de: uso em produção, feedback de usuário, post-mortems, code review
- Aprendizado que consolida = migra para `memory/patterns.md` ou `memory/decisions.md`

## Regras Gerais
- Aprendizado é **observação real**, não especulação
- Data + contexto são obrigatórios
- Ação recomendada (implementar, pesquisar, descartar) sempre presente

## Validações
- Aprendizado veio de situação real (não teoria)?
- Tem recomendação de ação concreta?

## Permissões
- Qualquer um documenta aprendizado (PR adiciona linha)
- Tech lead: promove para padrão/decisão

## Exceções
- Aprendizado crítico (segurança/compliance): entra imediatamente mesmo in-progress

## Auditoria
- Revisar aprendizados mensais, promover consolidados
- Descartar aprendizados superados sem remorso

## Eventos
- `learning.documented`, `learning.promoted_to_pattern`, `learning.archived`

## Casos de Uso
- "Por que essa decisão foi tomada assim?"
- "Já fizemos isso antes? Como?"
- Pesquisa de causa-raiz pós-incidente

## Critérios de Aceite
- [ ] Mínimo 1 linha por tabela de área preenchida
- [ ] Cada aprendizado linkado a issue ou PR quando aplicável
- [ ] Ação clara (implementar agora / pesquisar / descartar)

---

## Aprendizados Técnicos

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| 2026-08-12 | Trocar `fill` por atributo só funciona em SVG feito à mão. Em export de Illustrator/Figma, `style` inline e regra CSS de classe têm precedência maior que o atributo — a cor não muda e nada acusa | Motor precisa **normalizar o SVG no upload** (achatar style/classe em atributo, remover `<style>`/`<script>`) em vez de tentar adivinhar na hora de gerar — proposta em ADR-004. Bugs: BUG-001/002 |
| 2026-08-12 | Uma zona real quase nunca é um elemento: é um grupo `<g>` ou N paths (o próprio SVG de teste já tem `zona-cadarco` em 2 paths) | Contrato de zona precisa endereçar **conjunto** de elementos, não um `id` único (ADR-004) |
| 2026-08-12 | `console.warn` dentro de função serverless é falha silenciosa do ponto de vista do cliente da API — o log fica no servidor, o chamador recebe 200 | Zona não aplicada ou cor inválida = erro explícito no envelope de resposta, nunca aviso (BUG-003) |

## Aprendizados de Produto

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| — | — | — |

## Aprendizados de Processo

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| 2026-08-12 | Doc afirmava "protótipo validado" mas `node_modules` nunca tinha sido instalado neste checkout — o script jamais rodou aqui. Documentação registrou intenção como se fosse fato | "Validado" só entra em doc quando houver comando executado ou teste no repositório provando. Ação: os 9 casos viraram `scripts/prototipo-recolor-svg.test.mjs` |
| 2026-08-12 | Fundação gerada a partir de template trouxe vocabulário de outro projeto Kora (PDV de bar) para `memory/` — e `patterns.md` ensinava `abrirCaixa`/`fecharComanda` como exemplo de nomenclatura, contradizendo o glossário que ele manda seguir | Num projeto lido só por agentes (ADR-003), resíduo de template é desinformação ativa: agente novo aprende o vocabulário errado. Limpar `memory/` faz parte de fechar a fundação, não é cosmético |

## Aprendizados de Negócio

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| — | — | — |

---

## Aprendizados Promovidos → Padrão

| Aprendizado Original | Data Promo | Padrão Resultado | Status |
|---|---|---|---|
| "Zona não aplicada é erro, não aviso" | 2026-08-12 | `patterns.md` → Envelope de Resposta (nunca 200 com variante "quase certa") | ✅ Ativo |

## Aprendizados Promovidos → Decisão

| Aprendizado Original | Data Promo | ADR Resultado | Status |
|---|---|---|---|
| "Atributo `fill` não basta; zona não é um elemento" | 2026-08-12 | ADR-004 — contrato de zona e normalização de SVG | 🟡 Proposto (aguarda aprovação do dono) |

## Limpeza Periódica

**Última revisão**: 2026-08-12

Aprendizados obsoletos (superados por realidade nova):
- (nenhum ainda)
