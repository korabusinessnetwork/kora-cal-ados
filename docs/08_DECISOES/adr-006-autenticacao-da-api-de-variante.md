# ADR-006 — Autenticação da API de variante: chave por tenant

**Status**: Aceito — **decidido, ainda não implementado**. A API de variante não existe
(ver `memory/decisions.md`, "A API de variante ainda não existe"). Este ADR fixa o modelo
antes de a primeira linha ser escrita, porque autenticação é a decisão que não se troca
depois de o primeiro cliente integrar.
**Data**: 2026-09-08
**Decisores**: Matheus Bonato
**Supersede**: (nenhum)
**Supersedido por**: (nenhum)

---

## Contexto

A API de variante é o produto vendido: o sistema da marca calçadista pede
`POST /api/v1/products/:productId/variants` com `{"sola": "#C0392B"}` e recebe **o SVG cru**
daquele modelo naquelas cores — sucesso é o artefato, erro é o envelope JSON. O motor que o
cumpre (`src/lib/render/`) já existe e é testado.

> **Nota de 2026-09-08.** Este parágrafo dizia "`POST /products/:id/variants` [...] recebe o
> SVG (ou PNG)". Ficou alinhado ao contrato fechado na mesma data, que é hoje a fonte da
> forma da requisição e da resposta: `docs/07_APIS/endpoints.md` (com o raciocínio em
> `memory/patterns.md`, seção "Padrões de API / Backend"). Mudaram três coisas de redação,
> nenhuma delas parte da decisão deste ADR: a rota ganhou o prefixo `/api/v1`; o sucesso é
> **o SVG cru, sem envelope**, e só o erro é envelopado; e o PNG saiu — `?format=` diferente
> de `svg` responde 400 explícito, porque rasterizar exigiria um segundo renderizador que
> teria de ser provado pixel a pixel contra o hex do SVG antes de ser vendido. O que este
> ADR decide — a autenticação — continua intacto.

Faltava a pergunta que o `overview.md` deixava **em branco de propósito**: como o chamador
se autentica. Ela ficou aberta porque um palpite bem escrito vira fato na leitura seguinte,
e aqui ele decidiria sozinho o modelo de integração do produto.

O que torna essa pergunta diferente da autenticação que já existe no projeto:

- **Quem chama não é gente.** O editor de zonas usa o JWT de sessão do Supabase: nasce de
  um login com e-mail e senha, expira em ~1h e é renovado por `supabase-js` dentro do
  navegador. A API de variante é chamada pelo ERP/PLM/e-commerce da marca, num servidor,
  sem ninguém para digitar senha nem para lidar com refresh.
- **Quem chama é um tenant, não um usuário.** A credencial pertence à marca. Se o
  funcionário que a criou sair da empresa, a integração **não pode** parar.
- **Do outro lado da chamada não há RLS de graça.** A RLS do Postgres protege o app porque
  cada requisição do navegador carrega o JWT do usuário. Uma função serverless que
  valida uma chave e depois consulta o banco precisa decidir *com qual identidade* consulta
  — e é aí que o isolamento entre marcas concorrentes é ganho ou perdido
  (`docs/11_SEGURANCA/multi-tenancy-rls.md`: isolamento é requisito comercial, não só
  técnico).

Momento certo: existem **zero** integrações. Trocar o modelo de autenticação depois obriga
todo cliente integrado a reescrever o código dele — é a mudança mais cara que uma API pode
sofrer.

---

## Decisão

### D1 — Chave de API por tenant, guardada em hash, enviada em header

Cada tenant tem uma ou mais chaves de API. A chave identifica **a marca**, não a pessoa,
e é o único credencial aceito pela API de variante.

- **Formato**: `kora_<ambiente>_<prefixo>_<segredo>` — por exemplo
  `kora_live_7f3ab902_<32 bytes aleatórios em base64url>`. O segredo vem de um gerador
  criptográfico (`crypto.randomBytes`), nunca de contador, timestamp ou id do tenant.
- **O banco nunca guarda a chave.** Guarda o **prefixo em claro** (para achar a linha por
  índice) e o **hash SHA-256 do segredo**. Vazamento do banco não vira acesso à API.
- **Exibida uma única vez**, no momento da criação. Perdeu, gera outra — não existe
  "ver chave de novo", porque isso exigiria guardá-la reversível.
- **Enviada em `Authorization: Bearer <chave>`**. Nunca em query string: URL entra em log
  de acesso, histórico de navegador e cabeçalho `Referer`, e é o jeito mais comum de uma
  credencial vazar sem ninguém perceber.
- **Nunca aparece em log.** Log registra o **prefixo** — que identifica a chave sem
  permitir usá-la (CLAUDE.md: nunca logar dados sensíveis).

### D2 — SHA-256, e não bcrypt/argon2

Contraintuitivo o bastante para precisar estar escrito: para **senha** de gente, hash lento
(bcrypt, argon2) é obrigatório, porque senha humana tem pouca entropia e um vazamento vira
ataque de dicionário. Uma chave de 32 bytes aleatórios **não tem dicionário** — não existe
"chave comum" para tentar, e força bruta sobre 256 bits não termina.

Em compensação, o hash lento cobraria seu custo em **toda** chamada da API, não só no
login: é o pior lugar possível para gastar 100ms.

### D3 — A validação da chave é o único ponto onde `service_role` entra, e ele é responsável pelo escopo

A função serverless valida a chave e, a partir daí, consulta o banco com `service_role` —
que **bypassa RLS**. Isso é a consequência mais perigosa desta decisão e a razão de ela
virar ADR em vez de convenção:

- **`tenant_id` vem SEMPRE da chave**, nunca do corpo, da URL ou de header do chamador.
  Se o `tenant_id` puder ser dito pelo cliente, a marca A pede a variante da marca B e a
  API entrega. Essa é a falha inteira, numa linha.
- **`product_id` é validado contra o `tenant_id` da chave** antes de qualquer outra coisa
  — a regra que o `overview.md` já registra ("nenhuma função serverless aceita
  `product_id` sem validar que pertence ao `tenant_id` da **chave de API** que autenticou a
  chamada"). Não "token": neste projeto token é o JWT de sessão da pessoa, e usá-lo aqui
  confundiria as duas credenciais justamente na frase que separa uma da outra (glossário).
- Produto de outro tenant responde **404, não 403**. 403 confirma que aquele id existe;
  entre marcas concorrentes no mesmo sistema, isso já é informação vendável.
- A validação mora em **um** módulo (`autenticarChaveDeApi`), e toda rota da API passa por
  ele. Ponto único de estrangulamento: com RLS, esquecer o filtro é inofensivo; com
  `service_role`, esquecer o filtro é o vazamento. A defesa não pode depender de lembrar.

### D4 — Revogação e rotação

- Revogar é preencher `revoked_at`, nunca apagar a linha: chave apagada some do histórico
  junto com a resposta para "quem estava usando isso quando aconteceu".
- Um tenant pode ter **várias chaves ativas** ao mesmo tempo. Sem isso, rotacionar exige
  derrubar a integração do cliente entre gerar a nova e trocar no sistema dele — e uma
  rotação que causa downtime é uma rotação que ninguém faz.
- Só **owner** do tenant cria e revoga chave. Membro não.

---

## Alternativas consideradas

### A) Reaproveitar o JWT de sessão do Supabase

O app já tem isso funcionando e a RLS já protege tudo — seria zero código novo.

**Descartada** porque o token é de pessoa, não de sistema: exige login com e-mail e senha,
expira em ~1h e precisa de refresh. Na prática o cliente faria uma de duas coisas — guardar
a senha de um funcionário no servidor dele (a credencial passa a poder abrir o **editor** e
apagar dado, muito além de gerar variante), ou implementar o refresh no lado dele, que é
código de autenticação escrito por quem só queria uma cor de sola. E quando o funcionário
sair da empresa, a integração cai.

### B) Service account por tenant (usuário técnico no Supabase Auth)

Criar um usuário real por tenant (`api@marca.kora`) e entregar as credenciais dele. Ganha
a RLS de graça — o `service_role` nunca entraria em cena, que é justamente o risco do D3.

**Descartada** porque só empurra o problema: continua sendo e-mail + senha + refresh no
lado do cliente (o defeito central de A), o "usuário" técnico aparece na lista de membros
como se fosse gente, e revogar exige mexer no Auth em vez de numa linha de tabela nossa.
Vale registrar que ela era a alternativa **mais segura** das três: se um dia o D3 se mostrar
difícil de segurar, é para cá que se volta.

### C) Chave única global, com o tenant dito no corpo da requisição

Mais simples de implementar e de documentar.

**Descartada** de imediato: é exatamente o modo de falha que o D3 proíbe. Uma chave que
serve para todos os tenants transforma qualquer vazamento em vazamento de **todas** as
marcas, e o `tenant_id` dito pelo chamador é isolamento nenhum.

---

## Consequências

- Nasce a tabela `tenant_api_keys` — e, com ela, RLS própria (CLAUDE.md: tabela nova exige
  RLS). Detalhe importante: RLS filtra **linha**, não **coluna**; o hash não pode chegar ao
  front por `select` descuidado. Front lê por lista de campos explícitos, sem o hash, e
  nunca `select *`.
- Nasce UI de gerenciamento de chaves (criar, ver prefixo e último uso, revogar) — pequena,
  mas com o momento delicado de "exibida uma vez".
- A função serverless passa a precisar do `service_role` no ambiente da Vercel. Ele já é
  proibido em `src/` e há teste que falha se aparecer lá
  (`src/lib/supabase/semServiceRoleNoFront.test.ts`); a função **não** fica sob `src/`.
- O cliente da API não precisa de biblioteca nossa: um header e um POST. É o formato de
  integração que qualquer ERP consegue fazer sem projeto.
- **Rate limiting fica de fora por enquanto** e vira dívida registrada: chave por tenant é
  o que torna limite por tenant *possível*, mas o limite em si não está decidido. Sem ele,
  um cliente com laço mal escrito consome a cota da Vercel de todo mundo.
- **Não há métrica de uso ainda.** `last_used_at` é o mínimo para responder "esta
  chave ainda serve para alguma coisa?" antes de revogar; contagem e cobrança por uso são
  decisão futura.

---

## Referências

- `docs/01_ARQUITETURA/overview.md` — o **fluxo** de geração que esta decisão fecha (o
  contrato da API saiu de lá em 2026-09-08 e mora em `docs/07_APIS/`)
- `docs/07_APIS/autenticacao.md` — o contrato desta decisão em formato de API
- `docs/07_APIS/endpoints.md` — o **contrato da API**: rota, corpo e forma da resposta
  ("sucesso é o artefato, erro é o envelope"); é a fonte para tudo que não é autenticação
- `docs/11_SEGURANCA/multi-tenancy-rls.md` — o isolamento que o D3 é obrigado a preservar
- ADR-002 — multi-tenant com RLS por `tenant_id`; este ADR é o primeiro caso em que a RLS
  **não** é o mecanismo de isolamento, e por isso precisa substituí-la explicitamente
- ADR-004 — os códigos de erro do motor, que a API devolve como contrato
- `supabase/schema.sql` — onde `tenant_api_keys` entra quando for implementada

---

## Notas de Implementação

Escritas antes da implementação, para que ela não redecida nada:

> **Correção de 2026-09-08 — nomes de coluna.** A primeira versão destas notas anotou
> `criada_em`, `criada_por`, `ultima_utilizacao_em`, `revogada_em` e `rotulo`. Confrontados
> com `supabase/schema.sql` e com a migration `20260812_schema_inicial.sql`, estavam errados
> em dois pontos, e ficam corrigidos abaixo. O rastro fica escrito em vez de apagado porque
> um agente que encontre os nomes antigos noutro lugar precisa achar aqui por que eles não
> valem. **(1)** As **5 tabelas existentes** (`tenants`, `tenant_members`, `products`,
> `product_zones`, `variants`) usam `created_at`: timestamp é coluna técnica, e o schema já
> põe técnica em inglês (`zone_key`, `svg_selector`, `base_asset_path`, `rendered_path`) —
> inaugurar uma sexta convenção numa tabela nova é criar a segunda forma de escrever a mesma
> coisa. **(2)** `rotulo` vira `label` porque o glossário
> (`docs/03_REGRAS_DE_NEGOCIO/glossario.md`) já declara "**Rótulo** | coluna `label`, estado
> `rotulo`"; uma segunda coluna para o conceito que já tem nome é exatamente o que "um termo,
> um nome" (ADR-003) proíbe. A **decisão** deste ADR não muda — muda a nota de implementação
> (`memory/decisions.md`: "a decisão de um ADR aceito é imutável; o arquivo não é"). Os nomes
> corrigidos aparecem também em D4 e em Consequências, pelo mesmo motivo.

- Tabela `tenant_api_keys` (`id`, `tenant_id`, `prefixo` único indexado, `hash`, `label`,
  `created_by`, `created_at`, `last_used_at`, `revoked_at`).
- Validação = uma consulta por `prefixo` (indexada) + comparação do hash **em tempo
  constante** (`crypto.timingSafeEqual`). Comparar hash com `===` vaza, por tempo, quantos
  bytes iniciais estavam certos.
- Chave revogada e chave inexistente respondem **igual** (401, mesma mensagem, mesmo
  tempo): distinguir as duas conta ao atacante que ele acertou um prefixo real.
- `last_used_at` é gravado **fire-and-forget** — nunca bloqueia a geração da
  variante (padrão já vigente para log de atividade, em CLAUDE.md).
- O termo é **chave de API** em todo o projeto (código, banco, docs, commits) — não
  "token", não "api key", não "credencial", não "service account". Já está no glossário
  (`docs/03_REGRAS_DE_NEGOCIO/glossario.md`), registrado junto com este ADR e antes de
  existir código que o use, como a regra do próprio glossário exige (ADR-003).
