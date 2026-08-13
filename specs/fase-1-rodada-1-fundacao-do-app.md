# Spec — Fase 1, rodada 1: fundação do app, tenant e upload normalizado

**Status**: especificado, não construído
**Data**: 2026-08-13
**Comando de teste do projeto**: `npm test` (→ `vitest run`)
**Portão de custo**: ✅ passa — tudo em free tier (Vite, React, Fabric.js e Supabase/Vercel
free). Nenhum item de `memory/restrictions.md` → "Implementações Pagas" é tocado.

---

## 0. Mapa da Fase 1 (o escopo da fase, fechado)

A Fase 1 inteira não cabe numa rodada de `/build`. Fica dividida assim, e **este spec é a
rodada 1**. As rodadas seguintes ganham spec próprio quando chegarem.

| Rodada | Entrega | Estado |
|---|---|---|
| **1** | App Vite/React existe, usuário loga, tema vem do tenant, produto é criado e o SVG-base sobe já normalizado | **este spec** |
| 2 | Editor de zonas (Fabric.js): marcar zona, relatório de zonas, preview client-side | não especificada |
| 3 | API de variante (Vercel Function): `POST /products/:id/variants`, envelope, erros, validação de tenant, normalização autoritativa no servidor | não especificada |
| 4 | PNG sob demanda (`?format=png`) e cache em `variants` | não especificada |

O critério de "Fase 1 pronta" é o fluxo do `docs/01_ARQUITETURA/overview.md` de ponta a
ponta: sobe modelo → marca zona → gera variante pela API com a mesma cor do editor.

---

## 1. Escopo

Criar o aplicativo React + Vite que hoje não existe, com autenticação Supabase, tema
vindo do tenant, catálogo de produtos e upload de SVG-base que passa por `normalizarSvg`
antes de ser gravado no Storage — e tornar o motor de render executável no navegador,
que é pré-requisito de tudo isso.

## 2. Fora de escopo

Nada abaixo entra nesta rodada, mesmo que pareça "só mais um passo":

- **Marcação de zona e Fabric.js** — rodada 2. Nenhuma dependência de Fabric.js é instalada aqui.
- **Preview de variante / troca de cor na tela** — rodada 2.
- **Qualquer função serverless ou `api/`** — rodada 3. Esta rodada não cria endpoint HTTP.
- **Geração de PNG, `sharp`/`resvg`, tabela `variants`** — rodada 4.
- **Recolor preservando gradiente** — backlog (`docs/09_BACKLOG/features.md`), Fase 1.5.
- **Identidade visual / marca** — `docs/02_DESIGN_SYSTEM/` está vazio de propósito
  enquanto o nome real do produto não existe. Esta rodada cria a **camada de tokens
  parametrizável**, com valores neutros, e não inventa marca.
- **Convite de membro, gestão de papéis, tela de administração de tenant** — o
  provisionamento é por script com `service_role` (decisão de 2026-08-12 em
  `memory/decisions.md`, venda manual na Fase 1).
- **Cadastro self-serve / signup público** — usuário é criado pelo script de provisionamento.
- **Edição e exclusão de produto** — esta rodada cria e lista; alterar fica para quando o
  editor de zonas existir e der contexto ao que se edita.

## 3. Origem e decisões que este item honra

- **Backlog**: não existe item catalogado para isto. `docs/09_BACKLOG/features.md` só tem
  "Recolor preservando gradiente" (Fase 1.5) e "Perfil de Marca" (Fase 4+). O `/aprender`
  deve cadastrar a Fase 1 no backlog depois desta rodada.
- **ADR-001** — stack React + Vite + Supabase; MVP vetor-only, sem IA, sem worker.
- **ADR-002** — multi-tenant white-label: tema e identidade vêm do tenant, nunca do código.
- **ADR-003** — organização para agente: arquivo pequeno, nome literal, README por diretório.
- **ADR-004** — contrato de zona: `normalizarSvg` **antes** de qualquer uso do SVG, e
  recusa de arquivo é comportamento aprovado.
- **`memory/decisions.md`** (2026-08-12) — tenant provisionado por `service_role` na Fase 1;
  membro cria e edita, owner apaga; URL assinada de 300s.
- **`memory/patterns.md`** — estrutura por-feature (`src/features/<feature>/`), nomes de
  domínio em português, estados obrigatórios (loading/empty/error/success), Context para
  auth e tenant/tema.
- **`supabase/schema.sql`** — políticas já aplicadas e provadas em 2026-08-13
  (`supabase/tests/isolamento.test.ts`, 8/8): `products` insert por membro, Storage
  `assets-base` privado particionado por tenant.

### Bloqueador técnico que esta rodada resolve

`src/lib/render/normalizarSvg.ts` e `gerarVarianteDeCor.ts` fazem `import { JSDOM } from
'jsdom'` e chamam `new JSDOM(...)` em três pontos. jsdom é biblioteca de Node e **não roda
em navegador** — hoje, importar o motor no app Vite quebra o bundle. Isso contradiz na
prática o ADR-001 e o princípio nº1 ("mesmo motor no editor e na API, nunca duas
implementações"). A correção é injetar o parser em vez de acoplá-lo: um adaptador
`parsearSvg` que usa `DOMParser` nativo no navegador e `JSDOM` no Node, mantendo **uma**
implementação do motor. Sem isso, a rodada 2 (preview) não tem como existir.

## 4. Arquivos afetados

Convenções lidas do projeto: TypeScript, `type: module`, identificadores de domínio em
português, técnico em inglês, README em toda pasta nova, CSS separado do JSX.

### Criados — motor (pré-requisito)

| Arquivo | Papel |
|---|---|
| `src/lib/render/parsearSvg.ts` | Adaptador: devolve `Document` a partir de texto SVG, escolhendo `DOMParser` (navegador) ou `JSDOM` (Node) |
| `src/lib/render/parsearSvg.test.ts` | Prova que o adaptador devolve o mesmo `Document` nos dois ambientes |

### Modificados — motor

| Arquivo | Mudança |
|---|---|
| `src/lib/render/normalizarSvg.ts` | Troca `new JSDOM(...)` por `parsearSvg(...)`; remove o import de jsdom |
| `src/lib/render/gerarVarianteDeCor.ts` | Idem, nos dois pontos (`gerarVarianteDeCor` e `relatorioDeZonas`) |
| `src/lib/render/README.md` | Atualiza a linha de "limites conhecidos" sobre jsdom |

### Criados — app

| Arquivo | Papel |
|---|---|
| `index.html` | Entrada do Vite |
| `vite.config.ts` | Config do Vite + React |
| `vitest.config.ts` | `setupFiles` que carrega `.env.local` para `process.env` (hoje o teste de isolamento pula em `npm test`) |
| `src/main.tsx` | Bootstrap do React |
| `src/App.tsx` | Rotas e composição dos providers |
| `src/App.css` | Estilo do shell (CSS separado do JSX) |
| `src/estilos/tokens.css` | Tokens neutros como custom properties (`--cor-superficie`, `--cor-primaria`, espaçamento, tipografia) |
| `src/estilos/README.md` | Índice: o que vive aqui, o que não vive |
| `src/lib/supabase/cliente.ts` | Cliente Supabase único, lendo `import.meta.env.VITE_*` |
| `src/lib/supabase/README.md` | Índice |
| `src/features/autenticacao/AutenticacaoContext.tsx` | Sessão do usuário, login, logout |
| `src/features/autenticacao/components/TelaDeLogin.tsx` | Formulário de e-mail/senha |
| `src/features/autenticacao/components/TelaDeLogin.css` | Estilo da tela |
| `src/features/autenticacao/components/RotaProtegida.tsx` | Barra rota sem sessão |
| `src/features/autenticacao/README.md` | Índice |
| `src/features/tenant/TenantContext.tsx` | Carrega o tenant do usuário e aplica `tenants.tema` sobre os tokens |
| `src/features/tenant/aplicarTemaDoTenant.ts` | Função pura: `tema` jsonb → custom properties |
| `src/features/tenant/aplicarTemaDoTenant.test.ts` | Teste da função pura |
| `src/features/tenant/README.md` | Índice |
| `src/features/produtos/components/ListaDeProdutos.tsx` | Catálogo do tenant, com os 4 estados |
| `src/features/produtos/components/ListaDeProdutos.css` | Estilo |
| `src/features/produtos/components/FormularioDeProduto.tsx` | Nome do produto + arquivo SVG |
| `src/features/produtos/components/FormularioDeProduto.css` | Estilo |
| `src/features/produtos/components/RelatorioDeNormalizacao.tsx` | Mostra o que o normalizador mudou, ou por que recusou |
| `src/features/produtos/hooks/useProdutos.ts` | Busca/cria produto (campos explícitos, sem `select *`) |
| `src/features/produtos/hooks/useUploadDeAssetBase.ts` | Normaliza no cliente e sobe o canônico no Storage |
| `src/features/produtos/README.md` | Índice |
| `scripts/provisionarTenant.ts` | Cria tenant + owner com `service_role`, só em Node |
| `scripts/README.md` | Índice + aviso de que `service_role` nunca vai pro front |
| `docs/02_DESIGN_SYSTEM/TOKENS.md` | Documenta os tokens neutros e como o tenant os sobrescreve |

### Modificados — projeto

| Arquivo | Mudança |
|---|---|
| `package.json` | Adiciona `react`, `react-dom`, `react-router-dom`, `vite`, `@vitejs/plugin-react`, tipos; scripts `dev`, `build`, `preview`, `provisionar-tenant` |
| `.env.example` | Documenta as variáveis já usadas (sem valor) se algo novo aparecer |
| `docs/01_ARQUITETURA/overview.md` | Registra que o motor passou a ser agnóstico de ambiente |
| `src/lib/README.md` | Índice atualizado |

## 5. Critérios de aceite

Cada item responde sim/não com evidência no código depois do build.

**Motor executável nos dois ambientes**

1. Nenhum arquivo em `src/lib/render/` importa `jsdom` diretamente; o único ponto que o
   menciona é `parsearSvg.ts`.
2. `parsearSvg` escolhe `DOMParser` quando existe `globalThis.DOMParser` e `JSDOM` caso
   contrário, sem variável de ambiente ou flag de build para decidir.
3. Os 30 testes existentes de `src/lib/render/` continuam passando sem alteração nas
   asserções — a refatoração não muda comportamento.
4. `parsearSvg.test.ts` prova que texto SVG idêntico produz o mesmo resultado de
   `gerarVarianteDeCor` nos dois caminhos de parser.

**Segredos e configuração**

5. Nenhuma chave, URL de Supabase ou senha aparece hardcodada; o cliente lê
   `import.meta.env.VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
6. `SUPABASE_SERVICE_ROLE_KEY` é lida apenas em `scripts/provisionarTenant.ts`, via
   `process.env`, e nenhum arquivo sob `src/` a referencia.
7. `npm run build` não emite a `service_role` no bundle (conferir por busca no `dist/`).

**Autenticação e isolamento**

8. Rota de catálogo e de produto não renderiza sem sessão — redireciona para o login.
9. Toda consulta a `products` lista campos explícitos (`id, nome, base_asset_path,
   created_at`), nunca `select *`.
10. Nenhuma consulta do app filtra por `tenant_id` vindo do cliente como fonte de
    verdade — o isolamento é da RLS; o `tenant_id` do front serve só para montar o path
    de Storage.
11. O acesso ao SVG-base é por URL assinada de 300s, coerente com a decisão de 2026-08-12.

**Upload normalizado (ADR-004)**

12. O arquivo enviado passa por `normalizarSvg` **antes** de qualquer gravação; o que vai
    para o Storage é o canônico, nunca o original do cliente.
13. Arquivo recusado pelo normalizador não cria produto nem grava nada, e a tela mostra o
    motivo em uma frase acionável (ex.: exportar com *Presentation Attributes*).
14. Quando o normalizador aceita mas alterou coisas, o relatório é exibido antes de
    confirmar — prevenção de erro, não aviso depois do fato.
15. O caminho de Storage é `tenants/{tenant_id}/products/{product_id}/base.svg`, montado a
    partir do tenant da sessão.

**Tema e white-label**

16. Nenhuma cor, nome, logo ou regra de marca específica aparece em componente ou CSS;
    tudo sai de custom property definida em `tokens.css` e sobrescrita por `tenants.tema`.
17. `aplicarTemaDoTenant` é função pura e nasce com teste, incluindo `tema` vazio, `tema`
    nulo e chave desconhecida (que deve ser ignorada, não aplicada).
18. Nenhum estilo inline de layout no JSX; CSS em arquivo separado por componente.
19. Nenhum token de tema é aplicado como filtro, overlay ou ajuste sobre a cor de zona
    (regra 6 de `docs/02_DESIGN_SYSTEM/README.md`) — nesta rodada isso significa que a
    pré-visualização do SVG-base é renderizada sem `filter`, `opacity` ou `mix-blend-mode`.

**Estados e erros**

20. Catálogo e formulário renderizam os quatro estados: carregando, vazio, erro e sucesso.
21. Toda chamada ao Supabase checa `.error` ou está em `try/catch`; nenhuma promessa
    pendurada sem tratamento.
22. Erro de rede no upload não deixa produto órfão sem asset (ver edge case 3).
23. Nenhum `console.log` de dado de usuário, token ou payload de tenant.

**Teste e execução**

24. `npm run dev` sobe o app e a tela de login aparece — esta rodada existe justamente
    porque hoje não há servidor para rodar.
25. `npm test` passa inteiro, incluindo o teste de isolamento, sem precisar exportar
    variável na linha de comando (é o que o `vitest.config.ts` novo resolve).
26. Toda pasta nova sob `src/` e `scripts/` tem `README.md` de índice (ADR-003).

## 6. Edge cases conhecidos

1. **Usuário autenticado sem tenant** — conta existe mas não há linha em `tenant_members`.
   A tela mostra estado vazio explicando que o acesso precisa ser provisionado; não pode
   quebrar nem cair em loop de redirect.
2. **Usuário em mais de um tenant** — o modelo permite. Nesta rodada: usar o primeiro por
   ordem estável e registrar no README da feature que o seletor de tenant fica para depois;
   nunca assumir silenciosamente que só existe um.
3. **Upload que falha no meio** — produto criado e Storage falhou. O produto não pode ficar
   com `base_asset_path` apontando para arquivo inexistente: ou grava o caminho só depois
   do upload confirmado, ou remove a linha. Estado inconsistente aqui vira erro na API na
   rodada 3.
4. **Arquivo que não é SVG** (PNG renomeado, PDF, vazio) — `normalizarSvg` já devolve
   `SVG_INVALIDO`; a tela precisa tratar esse código, não só o de recusa por CSS.
5. **SVG muito grande** — normalizar no navegador é síncrono e trava a aba. Definir um
   limite de tamanho e recusar acima dele com mensagem clara, em vez de congelar.
6. **Nome de produto duplicado** — permitido pelo schema; não inventar unicidade que o
   banco não tem.
7. **`tenants.tema` com valor inválido** (cor que não é cor, chave desconhecida) — ignorar
   a chave e manter o token neutro; tema quebrado não pode derrubar o app.
8. **Sessão expirada durante o upload** — a RLS recusa a escrita; a tela precisa mandar
   para o login em vez de mostrar erro genérico.
9. **Membro não-owner** — pode criar produto e subir asset (a RLS permite); não pode
   apagar. Nada nesta rodada assume papel `owner`.

## 7. Risco aceito nesta rodada (fechar na rodada 3)

A normalização roda **no navegador**. Um cliente adulterado poderia gravar no Storage um
SVG não sanitizado, dentro do próprio tenant. O risco é aceito aqui porque o bucket é
privado, o acesso é por URL assinada e nada é servido a público nesta rodada — mas a
**rodada 3 precisa re-normalizar no servidor** antes de qualquer variante ser servida,
senão BUG-004 (script embutido em SVG) volta por outra porta. O `/aprender` deve registrar
isto como débito técnico ao fim desta rodada.

## 8. Definição de "aprovado sem ressalvas"

Todos os 26 critérios de aceite em sim, `npm test` verde com os 38 testes existentes mais
os novos, `npm run build` sem erro, `npm run typecheck` limpo, sem TODO pendente, sem
`console.log` esquecido e sem regressão no motor de render nem no teste de isolamento.
