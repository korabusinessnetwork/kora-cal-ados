# Aprendizados — Kora Calçados (codinome)

## Objetivo
- Manter memória viva do que aprendemos construindo o produto
- Documentar raciocínios antes de virarem padrão ou decisão
- Evitar repetir o mesmo erro 6 meses depois — num projeto sem dev humano, "6 meses depois"
  é a próxima sessão: o que não estiver escrito aqui não volta

## Contexto
- **Ainda não há produção nem usuário real** (a Fase 1 é venda manual e o primeiro tenant
  ainda não subiu catálogo). Por isso todo aprendizado registrado até hoje vem de: validação
  adversarial do código, revisão de schema/CSS, e **abrir a tela num navegador de verdade**
- Aprendizado que consolida = migra para `memory/patterns.md` ou `memory/decisions.md`

## Regras Gerais
- Aprendizado é **observação real**, não especulação
- Data + contexto são obrigatórios
- Ação recomendada (implementar, pesquisar, descartar) sempre presente
- Escrever o **porquê**, não só o quê: lista seca de fatos envelhece sem ninguém perceber

## Validações
- Aprendizado veio de situação real (não teoria)?
- Tem recomendação de ação concreta?

## Permissões
- O agente documenta o aprendizado no mesmo commit que o produziu
- Dono (Matheus): promove para padrão ou decisão

## Exceções
- Aprendizado crítico (segurança/compliance): entra imediatamente mesmo in-progress

## Auditoria
- Revisar a cada entrega, não por calendário: aprendizado que não é escrito na hora se perde
  com a sessão que o produziu
- Descartar aprendizados superados sem remorso

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
| 2026-09-05 | **Capacidade nova cria defeito que nunca foi regressão.** Enquanto as zonas eram escritas à mão em `produtoDemo.ts`, ninguém conseguia marcar o mesmo elemento em duas zonas — o editor passou a conseguir, e aí a ordem das chaves do JSON decidia a cor (BUG-013). O código de pintura não mudou: mudou quem podia alimentá-lo | Ao planejar feature que **amplia o que o usuário consegue produzir**, perguntar por escrito "que estado inválido isso passa a permitir?" e ler o código que consome esse estado — foi assim que o BUG-013 apareceu antes de existir UI que o criasse. A recusa entra no mesmo commit que a detecção |
| 2026-09-05 | **Recusar no clique torna o caminho de falha inalcançável pela tela — e ele continua alcançável na vida real.** Desde a Etapa 4 o editor recusa, no clique, elemento de outra zona e elemento que não aceita cor chapa. Ótimo para quem marca; péssimo para verificar: ninguém consegue mais *produzir* o estado que a tela precisa saber tratar. E ele existe assim mesmo — mapeamento gravado antes da regra, importação futura, correção manual no banco | Quando a prevenção fecha a porta da frente, o estado passa a ser **semeado no banco** para continuar verificável: `supabase/scripts/semearZonasDeTeste.ts` (`npm run semear-zonas`) planta zona de gradiente e zonas sobrepostas no produto de demonstração. Sem isso, "a tela reage bem a mapeamento quebrado" viraria uma crença sem nada a sustentá-la |

## Aprendizados de Produto

Vazio de propósito: não há usuário real ainda. A primeira linha aqui deve sair de um time de
tenant usando o editor, não de suposição sobre o que ele vai achar.

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| — | — | — |

## Aprendizados de Processo

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| 2026-08-12 | Doc afirmava "protótipo validado" mas `node_modules` nunca tinha sido instalado neste checkout — o script jamais rodou aqui. Documentação registrou intenção como se fosse fato | "Validado" só entra em doc quando houver comando executado ou teste no repositório provando. Ação: os 9 casos viraram `src/lib/render/gerarVarianteDeCor.test.ts` |
| 2026-08-12 | Fundação gerada a partir de template trouxe vocabulário de outro projeto Kora (PDV de bar) para `memory/` — e `patterns.md` ensinava `abrirCaixa`/`fecharComanda` como exemplo de nomenclatura, contradizendo o glossário que ele manda seguir | Num projeto lido só por agentes (ADR-003), resíduo de template é desinformação ativa: agente novo aprende o vocabulário errado. Limpar `memory/` faz parte de fechar a fundação, não é cosmético |
| 2026-09-05 | **Suíte verde não prova que a tela mostra o que ela afirma — e isso já aconteceu três vezes.** O comparativo do esboço renderizava a mesma imagem dos dois lados (BUG-011) e caía em `<img src="">` quando o motor recusava o pedido (BUG-012), com tudo verde. Depois, com 233 testes verdes, `tsc` limpo e o teste de banco 7/7, acrescentar um ilhós a uma zona **apagava o `label` gravado** por um colega (BUG-014) — cada metade estava certa isolada (`marcarZona` distingue ausente de nulo; a tela é que escolhia mal entre os dois), então nenhum teste unitário podia pegar. Nenhum dos três é detectável em jsdom: um é diferença de pixel, outro é o navegador reagindo a atributo vazio, o terceiro só aparece conferindo a **linha gravada no banco** depois de usar a tela | Toda peça de UI cuja razão de existir é *mostrar* algo ganha uma passada dirigida em navegador real antes de ser considerada pronta — com o banco aberto ao lado quando ela escreve. O que a passada descobrir vira teste no mesmo commit (`ComparativoDeNormalizacao.test.tsx`, `EditorDeZonas.test.ts`). O erro a **não** cometer é o inverso: tratar suíte verde como licença para pular o navegador, que foi o que abriu as três |
| 2026-09-05 | **Teste de componente prova o que o React escreve, nunca o que o navegador desenha.** BUG-015 saiu de uma **revisão de CSS**, não do navegador nem do vitest: `.produto__area { display: grid }` é declaração de autor e vence o `[hidden] { display: none }` da folha do navegador, então a área do editor continuava visível durante o "Baixando…" — palco vazio ao lado do carregando, que se lê como "modelo sem desenho". O teste `a área do editor fica oculta até o asset-base chegar` estava verde e **continuou** verde: `renderToStaticMarkup` devolve markup, e a markup nunca esteve errada. Defeito pré-existente desde a Etapa 4 | Esse teto vale para **todo** teste de componente deste projeto: onde a verdade mora no CSS, a garantia tem de ler o CSS. A guarda nova abre `produtos.css` e exige a regra `[hidden]`. Regra prática: elemento escondido por `hidden` que tenha `display` declarado precisa da regra `[hidden]` explícita na mesma folha — e revisão de folha de estilo é uma passada própria, não um apêndice da revisão de componente |

## Aprendizados de Negócio

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| — | — | — |

---

## Aprendizados Promovidos → Padrão

| Aprendizado Original | Data Promo | Padrão Resultado | Status |
|---|---|---|---|
| "Zona não aplicada é erro, não aviso" | 2026-08-12 | `patterns.md` → Envelope de Resposta (nunca 200 com variante "quase certa") | ✅ Ativo |
| "Teste de componente não alcança o CSS" | 2026-09-07 | `patterns.md` → CSS separado do JSX: elemento com `display` de autor precisa da regra `[hidden]`, garantida por teste que lê a folha | ✅ Ativo |
| "Suíte verde não prova a tela" | 2026-09-07 | `patterns.md` → Fluxo de entrega, passo 4: abrir no navegador toda peça de UI cuja razão de existir é mostrar algo | ✅ Ativo |

## Aprendizados Promovidos → Decisão

| Aprendizado Original | Data Promo | ADR Resultado | Status |
|---|---|---|---|
| "Atributo `fill` não basta; zona não é um elemento" | 2026-08-12 | ADR-004 — contrato de zona e normalização de SVG | ✅ **Aceito** em 2026-08-12, implementado em `src/lib/render/` |
| "O editor não pode cunhar id no asset; o canônico é imutável" | 2026-09-05 | ADR-005 — editor de zonas em SVG DOM e quem cunha o `id` | ✅ Aceito, implementado em `idDeElemento.ts` + `src/features/zonas/` |

## Limpeza Periódica

**Última revisão**: 2026-09-07 (Etapa 6 — auditoria de docs vencidos)

Aprendizados obsoletos (superados por realidade nova):
- (nenhum descartado; três linhas foram **corrigidas** por estarem vencidas — ver abaixo)

## Atualizações deste documento

- **2026-09-07** — auditoria contra o código das Etapas 0–5. Corrigido o status do ADR-004,
  que ainda constava "🟡 Proposto (aguarda aprovação do dono)" enquanto o arquivo do ADR diz
  **Aceito** desde 2026-08-12 e o motor está implementado e em uso — status vencido em
  memória é pior que ausente, porque um agente evita construir sobre uma decisão que ele lê
  como pendente. Entram os aprendizados das Etapas 4 e 5 (suíte verde × navegador, o teto do
  teste de componente diante do CSS, semear no banco o estado que a tela recusa criar, e
  defeito nascido de capacidade nova). Sai o processo herdado de template que não existe
  aqui (PR, eventos `learning.*`) e a afirmação de que os aprendizados vêm de produção — não
  há produção ainda.
