# Respostas do Intake, Kora Calçados (codinome)

> Fonte de verdade das respostas da entrevista de fundação, conduzida por chat.
> Data do intake: 2026-08-12 · Conduzido por: Claude (a pedido de Matheus Bonato)

## Bloco 1, Produto e identidade
- **PRODUTO (nome + essência):** Kora Calçados (codinome provisório, nome real "assumido, revisar"), motor de customização de calçados
- **ESSENCIA (1 frase):** Editor visual pra marcar zonas de um modelo de calçado (sola, cabedal, cadarço, logo) + API que gera variantes de cor/material em escala
- **PROBLEMA que resolve:** Gerar cada variante de cor/material de um modelo hoje exige fotografia ou edição manual por unidade, caro, lento, não escala com catálogos grandes
- **PROPOSTA de valor / diferencial:** API-first (geração automática) + editor visual (setup humano), os dois desde o início, não é só ferramenta de design, é motor de escala
- **Existe código ou é do zero?** Do zero, venture nova

## Bloco 2, Público e escopo
- **PUBLICO_ALVO primário:** Times internos (design/produto/marketing) de marcas e fabricantes calçadistas
- **PERSONAS (1-3):** Ana, Design de Produto, marca de porte médio, catálogo 200+ modelos/coleção, hoje gera variante manualmente no Photoshop (persona hipotética, validar com usuário real)
- **B2B / B2C / B2B2C:** B2B puro, só time interno da marca usa, sem camada consumidor-final nesta fase
- **"Aha moment":** Gerar em segundos as variantes de cor/material de um modelo que hoje levam fotografia ou edição manual por unidade

## Bloco 3, Multi-tenant e white-label
- **MULTI_TENANT:** multi-desde-já, cada marca calçadista é um tenant
- **WHITE_LABEL:** sim, identidade vem do tenant, mesmo padrão dos outros projetos Kora
- **PLANOS (free/pro/enterprise):** Adiado, venda manual/contrato na Fase 1, planos + feature flags entram na Fase 3 junto com self-serve/billing

## Bloco 4, Stack e arquitetura
- **STACK:** React + Vite + Fabric.js (editor) + Supabase (auth/Postgres/RLS/storage) + Vercel Serverless Functions (motor de render: recolor SVG por zona, rasteriza com sharp/resvg sob demanda)
- **MODELO_ARQUITETURA:** A, SPA + BaaS (Supabase), com função serverless dedicada ao motor de geração de variante
- **TEM_UI:** Sim, editor visual de zonas
- **DEPLOY:** Vercel (app + funções) + Supabase (dados/storage)
- **SCHEMA_PATH:** supabase/schema.sql
- **ENV_PREFIX:** import.meta.env.VITE_*
- **TEST_CMD:** npm test

## Bloco 5, Segurança e compliance
- **Trata dado pessoal/financeiro/de menores?** Não, B2B puro, só dado básico de conta dos usuários do time cliente (nome/e-mail/empresa); sem PII de consumidor, sem dado financeiro processado na Fase 1 (venda manual, sem billing automatizado)
- **COMPLIANCE específico:** Nenhum setor regulado (não é fiscal, não é PCI). Requisito real é confidencialidade comercial entre tenants, coleção não lançada de uma marca não pode vazar pra outra
- **Nível de isolamento entre clientes:** Crítico / não-negociável, marcas concorrentes podem coexistir no mesmo sistema. RLS em toda tabela + storage particionado por tenant + validação de tenant_id em toda função (ver `docs/11_SEGURANCA/multi-tenancy-rls.md`)

## Bloco 6, Custo
- **FASE_CUSTO:** Bootstrap gratuito, decisão informada pela escolha de MVP vetor-only (recolor de SVG é leve, roda em free tier sem IA/GPU)
- **Serviços pagos já aprovados:** Nenhum. Segmentação de foto real (Fase 2) é o primeiro ponto que provavelmente vai exigir custo real, decidir quando chegar lá

## Bloco 7, Design (se tem UI)
- **Identidade visual definida?** Não, pendente, revisar quando o nome real for definido
- **Referências / tom visual:** TBD
- **Contexto de uso crítico:** Desktop, editor de precisão (marcação de zona), não é fluxo touch/mobile
- **PRINCIPIO_N1:** INTUITIVIDADE + FIDELIDADE DE COR (cor que sai da API vira produto físico fabricado, erro de cor é erro de produção real, não só bug de UI)

## Roadmap inicial
- **FASE_ATUAL:** Fase 0, fundação documentada, arquitetura definida, ADR-001 registrado
- **Próximas fases:** Fase 1 (MVP: editor de zonas vetor + API de variante, multi-tenant, venda manual) → Fase 2 (segmentação de foto real via IA) → Fase 3 (self-serve + billing automatizado, planos/feature flags) → Fase 4 (integração com a suite Kora calçadista)

---

## Itens marcados "assumido, revisar"

- Nome real do produto (hoje: codinome "Kora Calçados")
- Identidade visual (cores, tom visual, logo), Bloco 7 não foi conduzido a fundo
- Aha moment e personas são hipóteses fundamentadas na conversa, não validadas com usuário real ainda
