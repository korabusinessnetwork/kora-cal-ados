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
| BUG-001 | 2026-08-12 | Motor de render | `style` inline e regra CSS de classe (`.st0{fill:...}`) vencem o atributo `fill` que o motor escreve — a zona **não muda de cor** e a API devolve 200 como se tivesse mudado. Export padrão de Illustrator/Figma cai exatamente nesse caso. Viola o princípio nº1 (cor no editor = cor na API) | **corrigido** | ADR-004 · `normalizarSvg.ts` | 2026-08-12 |
| BUG-003 | 2026-08-12 | Motor de render | Zona inexistente só emite `console.warn` e devolve o SVG normalmente; cor inválida (`"banana"`) é aceita sem validação. Em função serverless, `console.warn` é falha silenciosa — o chamador da API não tem como saber que a variante saiu errada | **corrigido** | ADR-004 · `ErroDeVariante` + `validarCor.ts` | 2026-08-12 |
| BUG-006 | 2026-08-12 | Banco / RLS | `auth_tenant_ids()` é `language sql stable` **sem `security definer`** e a policy de `tenant_members` a invoca — a função relê `tenant_members`, que reaplica a policy. Padrão clássico de `42P17: infinite recursion detected in policy`. **Ainda não reproduzido** (sem Docker local pra `supabase start`) | **corrigido** | `20260812_correcao_rls_e_storage.sql` | 2026-09-05 |

| BUG-013 | 2026-09-05 | Motor de render | Duas zonas que compartilham um elemento fazem a **ordem das chaves do JSON** decidir a cor dele: `gerarVarianteDeCor` pinta zona por zona, em sequência, e a última sobrescreve — sem erro, sem aviso. `{cabedal, lingueta}` e `{lingueta, cabedal}` produziam calçados diferentes com o mesmo dado. Ninguém conseguia criar esse estado enquanto as zonas eram escritas à mão; o editor de zonas passa a conseguir | **corrigido** | ADR-005 · `zonasSobrepostas.ts` + recusa `ZONAS_SOBREPOSTAS` | 2026-09-05 |

**Critério de fechamento**: correção + teste que prova a correção rodando em CI

---

### ALTA (impacto operacional, workaround existe)

| ID | Data | Módulo | Descrição | Status | Correção/ADR | ETA |
|---|---|---|---|---|---|---|
| BUG-002 | 2026-08-12 | Motor de render | Zona só é endereçável como **um** elemento por `id`: grupo `<g>` não repinta filhos com `fill` próprio, zona com N paths (`zona-cadarco` + `zona-cadarco-2`, presente no próprio `fixtures/teste-zona.svg`) só repinta o primeiro, e `id` duplicado idem | **corrigido** | ADR-004 · seletor CSS + descendentes pintáveis | 2026-08-12 |
| BUG-004 | 2026-08-12 | Motor de render / Upload | `<script>` embutido no SVG base sobrevive ao motor e é servido ao navegador do cliente. Não há sanitização no upload, apesar de exigida em `docs/11_SEGURANCA/multi-tenancy-rls.md` | **corrigido** | ADR-004 · `normalizarSvg.ts` → `sanitizar` | 2026-08-12 |
| BUG-007 | 2026-08-12 | Banco / RLS | Não existe policy de INSERT em `tenants` nem `tenant_members`, nem de UPDATE em `tenants` — criar tenant, convidar membro e editar tema white-label são impossíveis pelo cliente. Onboarding travado antes de existir | **corrigido** | `20260812_correcao_rls_e_storage.sql` | 2026-09-05 |
| BUG-008 | 2026-08-12 | Storage | Nenhuma policy de Storage definida na migration, apesar de o plano de segurança exigir bucket privado + path particionado por tenant + URL assinada. Hoje o isolamento do asset-base depende só de convenção de path | **corrigido** | `20260812_correcao_rls_e_storage.sql` | 2026-09-05 |

**Critério de fechamento**: correção + teste de isolamento (dois tenants) verde

---

### MÉDIA (impacto limitado ou raridade)

| ID | Data | Módulo | Descrição | Status | Correção/ADR | ETA |
|---|---|---|---|---|---|---|
| BUG-005 | 2026-08-12 | Motor de render | Zona pintada com gradiente (`fill="url(#grad)"`) vira cor chapa sem aviso — perde a representação de material/textura silenciosamente | **corrigido** (vira erro `ZONA_NAO_RECOLORIVEL`) | ADR-004, decisão 1 | 2026-08-12 |
| BUG-011 | 2026-09-05 | Esboço do editor | `ComparativoDeNormalizacao` renderizava o asset-base canônico **sem** o pedido de cor, enquanto o lado cru recebia o pedido. Os dois lados saíam visualmente iguais: o painel que existe para provar o BUG-001 lado a lado não provava nada, e o README afirmava o contrário do que o código fazia | **corrigido** | `ComparativoDeNormalizacao.test.tsx` | 2026-09-05 |
| BUG-009 | 2026-08-12 | Banco / RLS | `tenant_members.papel` (`owner`/`membro`) está modelado mas nenhuma policy o usa — todo membro tem escrita total sobre produtos, zonas e variantes | **corrigido** | `20260812_correcao_rls_e_storage.sql` | 2026-09-05 |

---

### BAIXA (cosmético, cenário de nicho)

| ID | Data | Módulo | Descrição | Status | Correção/ADR | ETA |
|---|---|---|---|---|---|---|
| BUG-010 | 2026-08-12 | Docs | `supabase/schema.sql` é um stub apontando para a migration, mas `CLAUDE.md` e `docs/04_MODELAGEM/` o declaram fonte de verdade do banco. A verdade real está em `supabase/migrations/` | **corrigido** | snapshot real em `supabase/schema.sql`, com a tabela de policies por operação | 2026-08-12 |
| BUG-012 | 2026-09-05 | Esboço do editor | Motor recusando o pedido (zona com gradiente) fazia o comparativo cair em `<img src="">`. `src` vazio faz o navegador pedir a própria página de novo — 404 e download do documento inteiro — e o quadro em branco mentia dizendo "variante vazia" em vez de "pedido recusado" | **corrigido** | placeholder explícito + teste | 2026-09-05 |

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
| BUG-001 | 2026-08-12 | Motor de render | `src/lib/render/normalizarSvg.ts` (achata CSS em atributo) |
| BUG-002 | 2026-08-12 | Motor de render | `src/lib/render/gerarVarianteDeCor.ts` (zona = conjunto de elementos) |
| BUG-003 | 2026-08-12 | Motor de render | `src/lib/render/erros.ts` + `validarCor.ts` |
| BUG-004 | 2026-08-12 | Upload | `src/lib/render/normalizarSvg.ts` → `sanitizar` |
| BUG-005 | 2026-08-12 | Motor de render | erro `ZONA_NAO_RECOLORIVEL`; preservar gradiente foi pro backlog |
| BUG-006 | 2026-09-05 | Banco / RLS | `auth_tenant_ids()` com `security definer` — sem recursão de policy |
| BUG-007 | 2026-09-05 | Banco / RLS | policies de INSERT/UPDATE em `tenants` e `tenant_members` — onboarding destravado |
| BUG-008 | 2026-09-05 | Storage | bucket privado `assets-base` + policies por path de tenant |
| BUG-009 | 2026-09-05 | Banco / RLS | policies que usam `tenant_members.papel` — membro não apaga produto |
| BUG-011 | 2026-09-05 | Esboço do editor | `src/esboco/ComparativoDeNormalizacao.tsx` (mesmo pedido de cor nos dois lados) |
| BUG-012 | 2026-09-05 | Esboço do editor | `src/esboco/ComparativoDeNormalizacao.tsx` (sem variante → placeholder, nunca `<img src="">`) |
| BUG-013 | 2026-09-05 | Motor de render | `zonasSobrepostas.ts` + `recusarSobreposicao` em `gerarVarianteDeCor.ts` |

Todos provados por teste em `src/lib/render/*.test.ts` (30 casos) — não por inspeção.

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
export real de Illustrator/Figma, executada em 2026-08-12 **antes** de qualquer código de
Fase 1 ser escrito — e foram corrigidos no mesmo dia pelo ADR-004. Os casos viraram
`src/lib/render/gerarVarianteDeCor.test.ts`: os mesmos 9 cenários que reprovavam agora
exigem o comportamento correto, então uma regressão futura reprova o build.

BUG-006..009 saíram de revisão estática do schema/migration na mesma data, e ficaram em
correção enquanto a migration existia só como SQL escrito. **Fechados em 2026-09-05**: as
duas migrations estão aplicadas num projeto Supabase real (free tier) e
`supabase/tests/isolamento.test.ts` roda **8/8 verde** contra ele — dois tenants
concorrentes, três usuários, ataque real (pedir o produto alheio pelo id, escrever zona no
tenant alheio, pedir URL assinada do asset-base do concorrente, apagar produto sendo
membro não-owner, editar tema de outro tenant, ler sem sessão). O cenário é criado e
destruído a cada rodada; conferido depois: 0 tenants e 0 usuários residuais.

A diferença importava mesmo: BUG-006 (recursão `42P17`) é o tipo de defeito que só aparece
na execução, e agora tem asserção própria — o teste falha explicitamente nesse código de
erro, não numa consequência dele.

BUG-010 (docs) foi corrigido junto: `supabase/schema.sql` virou snapshot de verdade.

BUG-011 e BUG-012 saíram de **abrir a página num Chrome de verdade** em 2026-09-05 —
depois de `npm test`, `tsc` e `npm run build` já estarem verdes. Nenhum dos dois é
detectável em jsdom: um é diferença de pixel entre duas imagens, o outro é o navegador
reagindo a um atributo vazio. Viraram `src/esboco/ComparativoDeNormalizacao.test.tsx`,
que reprova se o comparativo voltar a mandar pedidos diferentes para cada lado.

BUG-013 saiu de **planejar o editor de zonas** em 2026-09-05: a pergunta "o que acontece se
o time marcar o mesmo elemento em duas zonas?" não tinha resposta no código. Foi confirmado
lendo o laço de pintura, não suposto — e é o caso em que o defeito nasce de uma capacidade
nova, não de uma regressão: enquanto as zonas eram escritas à mão em `produtoDemo.ts`,
ninguém conseguia produzir o estado inválido. A recusa entra no mesmo commit que a
detecção, antes de existir UI que crie o problema.

BUG-014 saiu de **abrir o editor num Chrome de verdade** em 2026-09-05, de novo com a suíte
inteira verde (233 testes), `tsc` limpo e o teste de banco 7/7 — o mesmo jeito como BUG-011 e
BUG-012 apareceram, e a terceira vez que o navegador acha o que o vitest não acha.

O defeito: acrescentar um elemento a uma zona que já existe **apagava o `label` gravado**.
O formulário volta vazio depois de salvar; a tela mandava `label: null` para `marcarZona`, e
`null` ali significa "apague esta coluna" — semântica correta e documentada. O UPDATE então
limpava o nome legível que um colega tinha definido. Ninguém perceberia tão cedo: a zona
continua funcionando e gerando cor certa, só perde o nome.

Como apareceu: a passada dirigida gravou a zona `ilhos` com rótulo "Ilhós", acrescentou os
outros sete ilhoses e, ao conferir a linha no banco com service_role, o `label` estava
`null`. Nenhum teste pegava porque cada metade estava certa isolada — `marcarZona` distingue
ausente de nulo, e a tela é que escolhia mal entre os dois.

Correção: `preservarOuLimpar` em `src/features/produtos/TelaDeProdutos.tsx` — campo vazio em
zona existente vira `undefined` (preserva), em zona nova vira `null` (não há o que
preservar). Provado por `src/features/produtos/TelaDeProdutos.test.ts` e reconferido no
banco: a linha final tem os 8 ilhoses **e** o rótulo "Ilhós".

