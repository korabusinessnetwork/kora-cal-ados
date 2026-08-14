# Ledger do loop — Kora Calçados (codinome)

> O que cada rodada entregou, o que deixou para trás e qual é o próximo item.
> Passo 6 (`/proximo`) lê e grava aqui. Uma linha por rodada, sem narrativa.
>
> Este arquivo nasceu na rodada 2 — as rodadas anteriores foram registradas
> retroativamente a partir de `specs/`, `memory/bugs.md` e do histórico do git.

## Esquema de identificador

- `BUG-00X` — defeitos. Já existia no repo (`memory/bugs.md`), BUG-001..011.
- `F0XX` — features. **Criado em 2026-08-14** pelo raio-x do passo 6; antes disso as
  features viviam sem ID em `docs/09_BACKLOG/features.md`.
- `TD0XX` — débito técnico. **Criado em 2026-08-14**, mesma origem.

Backlog completo e classificado por urgência: `docs/09_BACKLOG/features.md` (F001..F018) e
`docs/09_BACKLOG/debito-tecnico.md` (TD001..TD019) — cadastrados no `/aprender` da rodada 2,
o que fecha a parte de registro do TD012.

## Rodadas

| # | Item | Entregue | Deixou para trás |
|---|---|---|---|
| 1 | Motor de zona e normalização de SVG (ADR-004) | `src/lib/render/` com 39 testes; BUG-001..005 fechados | — |
| 1 | Correção de RLS, papéis e Storage | migration aplicada em Supabase real; BUG-006..009 fechados por `isolamento.test.ts` (8 casos) | — |
| 1 | Fundação do app (`specs/fase-1-rodada-1-fundacao-do-app.md`) | shell, auth, tenant/tema, produtos, upload; 47 testes verdes | TD011 (upload sem teste), TD013 (READMEs faltando), TD014 (critério 24 sem prova), critérios 8/11/19 dados como atendidos sem consumidor em código |
| 2 | **F001 — leitura do asset-base e tela de produto** | validador de caminho por tenant + URL assinada 300s, hook de 4 estados, visualizador script-inerte; 66 testes verdes; BUG-011 fechado; TD002 mitigado na leitura; backlog cadastrado em `docs/09_BACKLOG/` | edge 6.2 (não re-assina URL expirada com a tela aberta) e 6.3 (falha do Storage não distingue "arquivo sumiu"), ambos aceitos na review; TD001 e TD017 seguem abertos |

## Próximo item

**F002 — Editor de zonas: marcar zona sobre o desenho e gravar `product_zones`.**

Por quê: F001 entregou a superfície e ela ainda não faz nada. Marcar zona é o primeiro
passo do fluxo que o produto existe para vender — e é pré-requisito duro de F003 (preview),
F004 (relatório de zonas) e F005 (API de variante): sem linha em `product_zones`, o motor
de render não tem o que recolorir. `src/lib/render/` está pronto e sem consumidor desde a
rodada 1.

O que o `/spec` precisa resolver antes de qualquer código:

1. **Inércia de script continua valendo.** Marcar zona exige selecionar um elemento do SVG,
   e `<img src>` não dá acesso a elemento nenhum. Antes de trocar o mecanismo de render,
   provar como o Fabric.js lê o arquivo — se ele parseia sem inserir o SVG no documento
   vivo, o script embutido segue inerte e **TD001** não bloqueia; se não, TD001 vem antes.
   Esta é a pergunta que decide o tamanho da rodada.
2. **O seletor gravado tem de ser o mesmo que o motor aplica.** `svg_selector` marcado no
   editor e usado por `gerarVarianteDeCor` é literalmente o princípio nº1: se divergirem,
   a zona certa na tela vira a zona errada na API. A prova é teste, não inspeção — marcar,
   gravar e recolorir com o seletor gravado, comparando o resultado.
3. **Validação de `zone_key` e `svg_selector` (TD005) entra junto**, não depois: seletor que
   não casa nada precisa falhar alto na marcação, onde o usuário ainda pode corrigir.

Fora de escopo provável: preview de cor (F003) e relatório de zonas (F004) — são features
próprias, e enfiá-las aqui repete o erro que a rodada 1 cometeu ao dar critérios como
atendidos sem consumidor em código.
