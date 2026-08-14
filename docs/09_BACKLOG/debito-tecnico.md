# Dívida Técnica — Kora Calçados (codinome)

> Origem: raio-x do repositório de **2026-08-14** (93 achados brutos → 37 itens abertos,
> `TD001..TD019` + `F001..F018`). O esquema de identificador `TD0XX` nasceu aí — antes
> disso a dívida existia espalhada em specs e comentários, sem ID.
>
> Features: `features.md`. Bugs: `memory/bugs.md`. Rodadas do loop: `specs/_loop.md`.

## Como ler

- A ordem é de **urgência**, não cronológica: o primeiro item é o que mais custa deixar para depois.
- **Custo** segue `memory/restrictions.md`: enquanto o projeto não vende, a alternativa
  gratuita é o padrão e o item pago fica represado esperando decisão do dono (`F018`).
- Item fechado sai daqui e vira linha na rodada correspondente de `specs/_loop.md`.

## Aberto

| ID | Item | Por que dói | Status |
|---|---|---|---|
| TD001 | Re-normalização autoritativa do SVG no servidor (e trava do bucket) | `normalizarSvg` roda só no navegador de quem sobe, e o bucket foi criado sem `file_size_limit`/`allowed_mime_types` — SVG não sanitizado pode já estar gravado. Enquanto não existir, BUG-004 volta na primeira leitura que não for script-inerte | aberto — bloqueia F002 usar `dangerouslySetInnerHTML` |
| TD002 | `products.base_asset_path` é texto livre, sem vínculo com o `tenant_id` da própria linha | Nada no banco impede gravar caminho de outro tenant; quem segura é só a policy de Storage, que o `service_role` da rodada 3 ignora | **mitigado** na leitura por `validarCaminhoDeAssetBase` (F001, rodada 2). O check no banco continua faltando |
| TD004 | Não existe CI | `supabase/tests/isolamento.test.ts` passaria em silêncio se rodasse sem secrets — o teste que prova o isolamento é justamente o que some sem alarde | aberto — GitHub Actions é gratuito; exige cadastrar `SUPABASE_SERVICE_ROLE_KEY` como secret (chave que ignora RLS) |
| TD005 | Validação de input de zona (`zone_key`, `svg_selector`) não existe | Seletor errado pinta o path errado sem avisar — viola o princípio nº1 | aberto — entra com F002 |
| TD006 | Arquivar o SVG original ao lado do canônico | Decisão do dono aprovada, upload entregue sem ela: hoje o arquivo do cliente é perdido na normalização | aberto — custo zero hoje, mas dobra arquivos por produto |
| TD007 | Rate limit da API | Exigido pela doc de APIs, sem especificação e sem implementação | aberto — alternativa gratuita: contador por tenant em Postgres no próprio handler (o gerenciado da Vercel é plano pago) |
| TD008 | Log de atividade / auditoria | Sem ele a North Star do produto não é medível, e `CLAUDE.md` já manda log fire-and-forget | aberto |
| TD009 | Senha inicial do owner é impressa no terminal; sem fluxo de recuperação no app | Provisionamento manual vaza senha em scrollback e não há como o cliente recuperar acesso sozinho | aberto — custo zero (`generateLink('recovery')`) |
| TD010 | `.gitignore` cobre `.env` e `.env.local`, mas o checklist exige `.env*` | Um `.env.producao` entraria no repositório sem reclamação | aberto — correção de uma linha |
| TD011 | `uploadDeAssetBase.ts` nasceu sem teste | É o caminho que grava o canônico; regressão ali contamina tudo que lê depois | aberto (deixado para trás pela rodada 1) |
| TD013 | Oito diretórios sem README de índice (critério de aceite 26) | ADR-003 exige índice em todo diretório: agente novo passa a adivinhar onde as coisas moram | aberto — `src/features/produtos/` e `src/lib/render/` já têm |
| TD014 | Critério de aceite 24 sem prova: `npm run dev` nunca foi executado e registrado | "Validado" sem comando executado é exatamente o que `memory/learnings.md` proíbe | aberto |
| TD015 | Scrub de log de erro | Mensagem crua do Storage pode carregar caminho de outro tenant; log com dado alheio é vazamento | aberto — F001 já traduz o erro em vez de repassar, mas não existe regra geral |
| TD016 | `docs/04_MODELAGEM`, `05_FLUXOS`, `06_COMPONENTES` e `10_PROMPTS` ainda são README de template | Doc de template é desinformação ativa num projeto lido só por agente | aberto |
| TD017 | CSP e cabeçalhos de segurança não previstos no plano | Primeira linha de defesa para SVG de terceiro no navegador | aberto |
| TD018 | Runbooks de segurança não escritos | Rotação de `service_role` sem procedimento = ninguém roda sob pressão | aberto |
| TD019 | Sem monitoramento nem alertas | Falha em produção só aparece quando o cliente reclama | aberto — Sentry free ou log nativo cobrem a fase |

## Em correção

| ID | Item | O que já foi feito |
|---|---|---|
| TD012 | Registro do projeto desatualizado: sem tech-debt, sem Fase 1 no backlog, sem ledger de loop | `specs/_loop.md` criado na rodada 2; este arquivo e o índice de IDs em `features.md` criados no `/aprender` da rodada 2 |

## Decidido pelo dono

| ID | Item | Decisão |
|---|---|---|
| TD003 | Plataforma de deploy indefinida (Hobby da Vercel é não-comercial) e app nunca publicado | **2026-08-14**: fica no Hobby durante a construção e migra para plano pago quando a venda começar (`memory/decisions.md`). Não há violação hoje porque não há uso comercial. Falta o import do repositório na Vercel, que só o dono pode fazer (`docs/01_ARQUITETURA/infra.md`) |
