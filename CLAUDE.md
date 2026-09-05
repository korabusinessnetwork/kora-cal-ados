# Diretrizes de Desenvolvimento — Kora Calçados (codinome)

> Constituição do projeto — preenchida a partir do intake (`respostas-intake.md`).
> Fonte de verdade de como este projeto é construído; atualizar sempre que uma
> decisão relevante mudar (e registrar o porquê em ADR quando for arquitetural).

## Princípio nº 1 — INTUITIVIDADE + FIDELIDADE DE COR (inegociável)

<!-- Produto tem UI (editor de zonas), mas o dado que sai da API vira produto físico
     (calçado fabricado) — cor errada não é só bug de UI, é erro de produção real. -->

O foco principal do sistema é **o time marcar uma zona e ver exatamente a cor que vai
sair pela API — sem manual, sem surpresa entre o editor e a geração**. Em qualquer
decisão, priorize este princípio acima de conveniência técnica. Regras práticas:

- Cor no editor = cor na API, sempre — mesmo motor de recolor nos dois lugares, nunca
  duas implementações que podem divergir
- Zona errada (seletor que pega o path errado) falha alto e visível — nunca aplica a
  cor silenciosamente no lugar errado
- Estados sempre visíveis: carregando, erro, vazio e sucesso com feedback humano.
- Prevenção de erro > mensagem de erro.
- Consistência total com o design system (`docs/02_DESIGN_SYSTEM/`).

## Organização para busca por IA (não para leitura humana casual)

Este projeto é escrito e mantido **exclusivamente por agentes de IA** (Claude Code).
Não existe desenvolvedor humano navegando o código no dia a dia por hábito ou memória
de time — a estrutura prioriza o que funciona bem pra grep/busca semântica/leitura de
agente, mesmo quando isso diverge de uma convenção "enxuta" que um humano preferiria.

Regras práticas:
- **Um termo, um nome, sempre.** Cada conceito de domínio tem exatamente um nome em
  todo o projeto (código, docs, banco, commits). "Zona" nunca vira "frame", "layer",
  "área" ou "region" em outro arquivo — `docs/03_REGRAS_DE_NEGOCIO/glossario.md` é a
  fonte de verdade da nomenclatura; qualquer termo novo entra lá antes de ser usado.
- **Nada de convenção implícita.** Se "faz sentido assim" e não está escrito em
  algum doc, não existe — um agente novo reconstrói o contexto do zero a cada sessão,
  não absorve cultura de time por osmose.
- **Nome de arquivo/função é literal, não criativo.** `gerarVarianteDeCor.ts`, nunca
  `magicColorEngine.ts`. Busca por nome de conceito deve bater com nome de arquivo.
- **Arquivo pequeno, responsabilidade única.** Preferir 5 arquivos de ~80 linhas a 1
  de 400 — um agente precisa carregar o arquivo inteiro no contexto pra editar com
  segurança; arquivo grande força leitura parcial e aumenta risco de edição às cegas.
- **Todo diretório novo ganha um README.md de índice** (não só `docs/00→11` — vale
  pra `src/`, `supabase/functions/` etc.). Objetivo: um agente lê o índice antes de
  explorar a árvore, nunca precisa adivinhar onde algo mora.
- **Comentário explica o "por quê", nunca só o "o quê"** — o "o quê" já está no
  código; o "por quê" é a parte que some se não for escrita, e é exatamente o que um
  agente sem memória da decisão original precisa pra não desfazer algo de propósito.

Decisão completa e trade-offs versus convenção humana tradicional em
`docs/08_DECISOES/adr-003-organizacao-para-ia.md`.

## Fonte de verdade (leia antes de qualquer mudança relevante)

- **`memory/`** — identidade, decisões, padrões, aprendizados e restrições.
  Consultar antes de decisões de produto/arquitetura.
- **`docs/`** — regras de negócio (`03_REGRAS_DE_NEGOCIO/`, inclui o glossário de
  domínio — nomenclatura obrigatória), design system (`02_DESIGN_SYSTEM/`), fluxos,
  modelagem, ADRs (`08_DECISOES/`) e o plano de segurança (`11_SEGURANCA/`).
- **ADR-001** define a stack vigente; ADRs em `docs/08_DECISOES/` registram as
  decisões de arquitetura.
- Schema do banco: `supabase/schema.sql`.
- Se doc e código conflitarem, a documentação prevalece — e deve ser corrigida
  quando estiver errada.
- **Produto = SaaS B2B multi-tenant white-label.** Cada marca calçadista é um tenant;
  tenants concorrentes podem coexistir no mesmo sistema — isolamento é requisito de
  confiança comercial, não só técnico (ver `docs/11_SEGURANCA/multi-tenancy-rls.md`).
  Todo código novo assume **múltiplos tenants** e é **adaptável por estabelecimento**:
  nada de marca, nome, cor, logo ou regra de cliente hardcodada — identidade vem do tenant.

## Processo de trabalho

<!-- Se usa orquestração multi-modelo, mantenha; senão, descreva seu fluxo. -->
1. **Planejar TUDO antes de executar** — escopo fechado, sem retrabalho.
2. Builds multi-parte → fan-out paralelo com **dono exclusivo por arquivo**
   (dois agentes nunca tocam o mesmo arquivo).
3. **Sintetizar e VALIDAR no fim** — revisar cada entrega, rodar testes e build.
4. Tarefa de peça única não ganha fan-out.

## Custo — priorizar o gratuito (bootstrap gratuito, venda manual/contrato)

Enquanto o projeto está em construção/pré-receita, **use sempre meios gratuitos**.
Toda implementação que exija investimento é **adiada por padrão**, salvo decisão
explícita do dono. Ao esbarrar em algo pago, apresente: custo aproximado,
alternativa gratuita, impacto, e recomendação (agora × depois) — o dono decide.
Detalhes em `memory/restrictions.md`.

## Segurança (obrigatório em todo código novo)

- **Nunca** hardcodar chaves, URLs de API, secrets ou senhas — usar `import.meta.env.VITE_*`.
- **Nunca** `select *` em tabelas sensíveis — sempre campos explícitos.
- **Sempre** validar inputs do usuário antes de qualquer operação no banco.
- **Nunca** logar dados sensíveis (senhas, tokens, dados financeiros).
- **Sempre** verificar autenticação antes de renderizar rota protegida.
- Ao criar tabela/função nova, lembrar que **RLS** precisa ser configurada.
- Plano de segurança completo em `docs/11_SEGURANCA/` (base: guia da fundação).

## Padrões de código

- Componentes React em arquivos separados; lógica de manipulação do SVG do editor isolada
  em hooks próprios (`src/features/zonas/hooks/`), nunca misturada com componente de UI
  genérico. **O editor nunca normaliza nem regrava o asset-base** — ele é somente-leitura
  sobre o canônico (ADR-005).
- Variáveis/funções em português para nomes de domínio (`gerarVariante`, `marcarZona`),
  inglês para padrões técnicos (`handleSubmit`).
- Sempre tratar erros de chamadas ao backend com `try/catch` ou checagem de `.error`.
- Logs de atividade fire-and-forget — nunca bloquear a operação principal.
- Rodar `npm test` antes de commitar; funções puras nascem com teste (o recolor de
  SVG é a função mais crítica pra ter teste desde a primeira versão).
- **Separar CSS do JSX** — estilo desacoplado da marcação, para white-label.

## Stack

- React + Vite
- SVG manipulado direto no DOM no editor de zonas — sem canvas, sem Fabric.js (ADR-005)
- Supabase (auth, Postgres, RLS, storage dos SVGs base)
- Vercel Serverless Functions (motor de geração de variante — recolore SVG por zona)
- sharp / resvg (rasterização SVG → PNG sob demanda, só quando `?format=png`)
- Context API (sem Redux)
- Deploy: Vercel (app + funções) + Supabase (dados)

Ver justificativa completa em `docs/08_DECISOES/adr-001-stack-e-motor-de-render.md`.
