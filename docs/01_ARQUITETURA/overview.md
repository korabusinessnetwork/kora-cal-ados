# Arquitetura — Visão Geral · Kora Calçados (codinome)

> Justificativa completa da escolha de stack vive em `08_DECISOES/adr-001-stack-e-motor-de-render.md`.
> Este arquivo é o "mapa" de como as peças se encaixam.
>
> **Cada linha diz o que já roda e o que ainda não existe.** Um mapa que descreve o alvo no
> mesmo tom do que está no ar faz um agente novo importar um módulo que ninguém escreveu — e
> gastar a sessão descobrindo isso. Estado é parte do fato, não enfeite.

## Stack

| Camada | Escolha | Papel | Estado (2026-09-08) |
|---|---|---|---|
| Frontend / Editor | React + Vite, **SVG no DOM** (ADR-005) | Login, lista de modelos, marcação de zona e preview de variante com o mesmo motor da API | **No ar** — `src/` |
| Dados / Auth | Supabase (Postgres + RLS + Storage) | Tenants, membros, produtos, zonas, autenticação, bucket privado dos SVGs | **No ar** — `supabase/migrations/` |
| API de geração | Vercel Serverless Functions | Recebe `{zona: cor}`, recolore o asset-base canônico, devolve o SVG da variante | **Contrato escrito, código em curso** — o contrato está em `docs/07_APIS/endpoints.md`; o handler ainda não existe (não há diretório `api/` versionado). Contrato escrito não é função funcionando |
| Deploy | Vercel (app + funções) + Supabase (dados) | Mesma espinha dorsal dos outros projetos Kora | **Alvo** — o app roda em `npm run dev`; não há `vercel.json` nem `.github/` versionados |

Escala escolhida deliberadamente **enxuta para o MVP**: como o MVP é vetor/ilustração
(não foto real), recolorir é manipulação de atributo `fill` num SVG — leve o bastante
para rodar numa função serverless comum, sem GPU, sem worker sempre-ligado, sem custo
de infra além do free tier. Ver `memory/restrictions.md` para o racional de custo.

## Conceito central: zona endereçável

Uma **zona** é uma parte de um modelo de calçado (a sola, o cabedal, o cadarço, o logo) que
recebe cor de forma independente. Não é máscara sobre foto — isso é a V2, ver
`memory/identity.md` → Roadmap.

Tecnicamente, uma zona é um **conjunto de ids** do asset-base canônico, gravado em
`product_zones.svg_selector` como lista de ids exatos (`#a, #b`). Duas correções do texto
anterior, ambas vindas do ADR-005:

- **Não é "um path ou grupo já separado no SVG"**. O arquivo real do cliente (export padrão
  de Illustrator) manda paths sem id nenhum: os 8 ilhoses do tênis de demo não têm nome. É a
  **normalização** que cunha `elemento-N` em todo pintável anônimo — sem isso, o editor não
  marcaria zona no arquivo de cliente nenhum.
- **Uma zona quase nunca é um elemento.** Ela captura N elementos (BUG-002), e por isso o
  painel do editor mostra **quantos** cada seletor captura hoje: marcar 8 ilhoses e ler
  "7 elementos" é a única chance de perceber o clique que faltou.

## O app hoje — mapa por feature

`src/features/` é a divisão real do front (índice em `src/features/README.md`). A regra de
dependência é de mão única: `produtos/` → `zonas/`, e feature só importa de `src/lib/`.

| Peça | Onde | O que resolve |
|---|---|---|
| Sessão | `src/features/sessao/` | Usuário autenticado **+** tenant ativo, em Context API (`ContextoDeSessao`). `RotaProtegida` não renderiza nada protegido sem os dois |
| Produtos | `src/features/produtos/` | Lista os modelos do tenant e baixa o asset-base canônico do Storage por **URL assinada de 5 min**, a partir do `base_asset_path` gravado — nunca remontando o caminho |
| Zonas | `src/features/zonas/` | O editor: palco clicável, painel de zonas com contagem e sobreposição, formulário de nova zona, gravação em `product_zones` |
| Motor de render | `src/lib/render/` | Normalização e geração de variante. Puro: texto SVG entra, texto SVG sai |
| Provisionamento | `supabase/scripts/` | Cria tenant + owner + produto e sobe o canônico. Exige `service_role`, por isso vive fora de `src/` |

Não há roteador: `src/App.tsx` alterna as telas por `useState`, porque ainda não existe URL
que precise ser compartilhável. Trocar de tenant **remonta** a árvore (`key={tenant.id}`) —
sem isso o estado do tenant anterior sobreviveria à troca e mostraria o modelo de um
concorrente sob o nome da marca nova.

## Modelo de dados

Fonte de verdade: `supabase/schema.sql` (snapshot) e `supabase/migrations/`.

```
tenants          (id, nome, slug, tema jsonb, plano, status, created_at)
tenant_members   (id, tenant_id, user_id, papel, created_at)     -- unique (tenant_id, user_id)
products         (id, tenant_id, nome, base_asset_path)          -- SVG canônico no Supabase Storage
product_zones    (id, product_id, tenant_id, zone_key, svg_selector, label, cor_default)
                                                                 -- unique (product_id, zone_key)
variants*        (id, product_id, tenant_id, zone_colors jsonb, rendered_path, created_at)
```

`tenant_id` é **desnormalizado** em `product_zones` e `variants` de propósito: a policy de
RLS filtra direto na linha, sem `join` até `products`.

A `unique (product_id, zone_key)` é o que desenha o editor inteiro: acrescentar um elemento a
uma zona é **UPDATE** da linha existente, nunca um segundo INSERT, e `upsert` cego é proibido
porque apagaria em silêncio o mapeamento de um colega.

`*variants` **fica sem uso**: a decisão de 2026-09-08 é gerar sob demanda e não cachear até
haver medição de custo ou latência (motivo na seção da API, mais abaixo). Nenhuma linha é
escrita nessa tabela — hoje porque a API não existe, e depois por escolha.

## Fluxo — Editor (setup, feito uma vez por modelo)

1. O asset-base entra pelo **provisionamento** (`supabase/scripts/provisionarTenant.ts`,
   `service_role`): `normalizarSvg` roda ali, uma vez, e o canônico sobe ao Storage. **Não há
   upload pelo navegador** — a venda é manual na Fase 1 e a policy de INSERT em `tenants` é
   `service_role` de propósito. A versão anterior deste arquivo dizia "o time de produto sobe
   o SVG base no editor"; nunca foi assim, e descrever assim manda um agente procurar uma
   tela que não existe.
2. A pessoa entra (`TelaDeLogin`), escolhe a marca se for membro de duas ou mais
   (`SeletorDeTenant`) e abre um modelo da lista.
3. **Clicar numa parte do calçado marca a zona** — `PalcoDeMarcacao` resolve o alvo com
   `closest('[id]')`, `marcarZona` (puro) monta a linha e `gravarZonaNoBanco` grava.
   O editor **nunca** normaliza nem regrava o asset: o canônico é imutável (ADR-005).
4. O clique é **recusado com motivo** quando o elemento já pertence a outra zona, tem
   `fill="none"` (contorno: pintá-lo mudaria o desenho) ou não aceita cor chapa (gradiente →
   `ZONA_NAO_RECOLORIVEL`). Prevenção de erro > mensagem de erro: a recusa acontece no
   clique, não depois de a pessoa preencher o formulário.
5. **`PainelDeZonas`** mostra o mapeamento gravado, quantos elementos cada zona captura hoje
   (`relatorioDeZonas`) e o alerta de sobreposição (`zonasSobrepostas`, BUG-013) —
   conferência antes de existir variante, porque depois disso o erro já virou calçado
   fabricado.
6. **Preview de cor** no próprio painel, passando o canônico pelo mesmo `gerarVarianteDeCor`
   da API. O editor nunca pinta por CSS.

Descrição passo a passo, com os estados de tela e as recusas, em
`docs/05_FLUXOS/fluxo-marcacao-de-zona.md`.

## Fluxo — API (geração) — **contrato escrito, função ainda não existe**

> **O contrato vive em [`docs/07_APIS/endpoints.md`](../07_APIS/endpoints.md)** — corpo do
> pedido, headers, envelope de erro e a tabela de código → status. Esta seção ficou só com o
> que é arquitetura: o que a função faz, em que ordem e com qual identidade consulta o banco.
> A tabela de status **não é repetida aqui de propósito**: duas cópias do mesmo contrato
> divergem no primeiro ajuste, e quando divergem ninguém sabe qual das duas o cliente leu.

Rota final: **`POST /api/v1/products/:productId/variants`**, servida pelo arquivo
`api/v1/products/[productId]/variants.ts` (roteamento por sistema de arquivos da Vercel — não
há `vercel.json` e não vai haver: um arquivo de rota criado por antecipação seria a segunda
fonte de verdade do endereço). Ordem das etapas, e a ordem importa:

1. **Autentica antes de ler qualquer coisa** — chave de API do tenant em
   `Authorization: Bearer` (ADR-006). É desta etapa que sai o `tenant_id`.
2. Lê o produto e as zonas (`products`, `product_zones`) **já filtrando pelo `tenant_id` da
   chave**. Produto inexistente e produto de outro tenant respondem igual: 404, nunca 403 —
   403 confirmaria ao concorrente que aquele id existe.
3. Busca o asset-base canônico no Storage
   (`tenants/{tenant_id}/products/{product_id}/base.svg` — a definição única do path é
   `supabase/scripts/caminhoDoAssetBase.ts`).
4. Passa o canônico e o `{zone_key: cor}` pedido pelo **mesmo** `gerarVarianteDeCor` que o
   editor usa no preview. Zona ausente, cor inválida, zona com gradiente ou zonas
   sobrepostas devolvem **erro**, nunca 200 "quase certo".
5. **Não grava em `variants`** — gera sob demanda, toda vez (motivo mais abaixo).

**Sucesso é o artefato; erro é o envelope.** A assimetria é deliberada:

- **200 devolve o SVG cru** — byte a byte a saída do motor, `Content-Type: image/svg+xml`,
  **sem envelope JSON**. Envelopar obrigaria escapar e desescapar um documento inteiro, e o
  modo de falha desse round-trip (mojibake, BOM, `\u` dentro de `<text>`) é **mudança
  silenciosa do desenho** — a classe exata de falha que o princípio nº1 proíbe. Com o corpo
  nu, há zero transformações entre a saída do motor e o byte que o cliente grava.
- **Erro devolve JSON**, sempre no envelope `{ data, error: { code, message }, meta }` de
  `memory/patterns.md`. Os códigos do motor (`src/lib/render/erros.ts`) são contrato e não
  mudam; os códigos de transporte (chave, método, corpo, formato, falha interna) os
  **estendem** sem editá-los. Qual código dá qual status: `docs/07_APIS/endpoints.md`.

`?format=png` **não existe nesta versão**: `?format=` diferente de `svg` é recusa explícita
com 400, nunca parâmetro ignorado em silêncio — parâmetro ignorado devolveria 200 com um
artefato que não é o pedido. O porquê de PNG ser entrega própria está em
`docs/09_BACKLOG/features.md`.

**Autenticação — decidida em 2026-09-08, [ADR-006](../08_DECISOES/adr-006-autenticacao-da-api-de-variante.md):**
chave de API **por tenant**, guardada em hash, enviada em `Authorization: Bearer`, revogável
sem derrubar as outras chaves da marca. O JWT de sessão do Supabase não serve aqui: é
credencial de pessoa (login, expiração, refresh) para um chamador que é máquina. Contrato em
`docs/07_APIS/autenticacao.md`. **Ainda não implementado** — a função serverless não existe,
e ter o contrato escrito não é tê-la funcionando.

Consequência que o ADR-006 obriga e que vale repetir aqui: a função valida a chave e depois
consulta com `service_role`, que **bypassa a RLS**. O `tenant_id` sai **sempre** da chave,
nunca do corpo, da URL ou de header do chamador, e o `product_id` é conferido contra ele
antes de qualquer outra coisa. É o único lugar do sistema onde o isolamento entre marcas não
é do Postgres — em toda a outra superfície, esquecer o filtro é inofensivo porque a RLS
recusa; aqui, esquecer o filtro é o vazamento.

**Cache em `variants` — decidido em 2026-09-08: nada por enquanto.** A tabela existe e fica
sem uso até haver medição de custo ou latência que justifique o contrário. O motivo é o
princípio nº1: cache mal invalidado devolve a variante **antiga** depois de a zona ser
remapeada ou a cor trocada, e o resultado é cor errada num calçado fabricado — falha
silenciosa, o modo que este projeto trata como o pior de todos. Gerar é um `parse` + troca de
`fill` sobre um SVG pequeno; enquanto for barato, correto vence rápido. Reabrir a decisão
exige número medido, não intuição — e junto dela a regra de invalidação, que é a parte
difícil (mudar zona, cor padrão ou asset-base invalida o quê?). Vale notar que não cachear
**do nosso lado** é metade da decisão: se um CDN cachear a resposta, a variante velha volta
do mesmo jeito depois de a zona ser remarcada. Por isso a resposta declara `no-store` — o
header exato e o resto dos cabeçalhos estão em `docs/07_APIS/endpoints.md`.

## Isolamento multi-tenant (não-negociável — ver `11_SEGURANCA/`)

- RLS em toda tabela por `tenant_id`, sem exceção — provado por
  `supabase/tests/isolamento.test.ts` contra um projeto Supabase real (BUG-006..009 fechados)
- Storage particionado por tenant no path (`tenants/{tenant_id}/...`), em **bucket privado**:
  as policies leem `storage.foldername(name)`, então o path é controle de acesso e não
  convenção de nome de arquivo
- Nenhuma função serverless aceita `product_id` sem validar que pertence ao `tenant_id` da
  **chave de API** que autenticou a chamada — nunca "token", que neste projeto é o JWT de
  sessão da pessoa (glossário). A função consulta com `service_role` e por isso não tem a
  RLS como rede: o isolamento ali é código, e mora num ponto só (ver a seção da API acima e
  o ADR-006)

## Motor de render — estado

Implementado em `src/lib/render/` (índice em `src/lib/render/README.md`), seguindo o contrato
do **ADR-004** e a política de id do **ADR-005**. A suíte inteira roda com `npm test`; os 9
casos de export real de Illustrator/Figma que reprovaram o protótipo original são hoje testes
em `gerarVarianteDeCor.test.ts` (`memory/bugs.md` BUG-001..005, todos fechados).

> Este parágrafo já disse "30 testes verdes". Contagem absoluta de teste envelhece a cada
> commit e ninguém percebe que envelheceu — por isso a referência agora é o comando e o
> arquivo, que continuam verdadeiros depois da próxima entrega.

Duas peças, nesta ordem obrigatória:

1. **`normalizarSvg`** — roda no provisionamento, uma vez por modelo. Achata CSS/style em
   atributo de apresentação, sanitiza (`<script>`, handler inline, referência externa),
   desambigua `id` duplicado e **cunha `elemento-N` em todo pintável anônimo** (ADR-005).
   Recusa o arquivo quando não consegue garantir fidelidade.
2. **`gerarVarianteDeCor`** — roda na geração e no preview do editor. Recebe
   `{zone_key: cor}`, resolve o seletor de cada zona e pinta o elemento **e seus descendentes
   pintáveis**.

O mesmo módulo será importado pela função serverless quando ela existir — nunca duas
implementações (princípio nº1). Hoje quem o importa é o editor (`PalcoDeMarcacao`), os
scripts de provisionamento e os testes. `dom.ts` é o que torna isso possível: abstrai
`DOMParser` (navegador) de jsdom (Node) e mantém o jsdom fora do bundle.

## O que fica fora do MVP (documentado, não esquecido)

- Segmentação de foto real (precisa IA/máscara — Fase 2)
- Self-serve + billing (Fase 3 — venda é manual/contrato por enquanto)
- Widget/embed pro consumidor final (não é B2B2C nesta fase)
- Upload de SVG pelo navegador, DELETE de zona, lock otimista em `product_zones` e coluna de
  ordem de zona — recortes conscientes da entrega do editor, listados com o porquê em
  `src/features/zonas/README.md`

## Atualizações

- **2026-08-12** — versão inicial, gerada na fundação do projeto.
- **2026-09-07** — auditoria contra o código das Etapas 0–5. Corrigido: a API de geração e o
  deploy passam a declarar que **ainda não existem**; o upload pelo navegador sai do fluxo do
  editor (nunca existiu — quem sobe o asset é o provisionamento por `service_role`); "zona é
  um path ou grupo já separado" vira "conjunto de ids cunhados na normalização" (ADR-005); o
  modelo de dados ganha `tenant_id` e as restrições `unique` que o schema realmente tem;
  entra o mapa por feature; sai a contagem fixa de testes. Duas lacunas ficam registradas
  como pergunta em aberto (autenticação da API, critério de cache em `variants`) em vez de
  preenchidas por palpite.
- **2026-09-08** — as duas perguntas em aberto são respondidas pelo dono, e o texto delas dá
  lugar às decisões: **chave de API por tenant** (ADR-006, com o alerta de que a função
  serverless usa `service_role` e por isso o isolamento entre marcas passa a ser dela) e
  **nenhum cache em `variants`** até haver medição. Ter deixado as duas em branco funcionou:
  voltaram como decisão explícita, não como convenção que alguém achou no código.
- **2026-09-08** — o contrato do endpoint **muda de casa** para `docs/07_APIS/endpoints.md`;
  a seção "Fluxo — API (geração)" encolhe para o resumo de arquitetura (o que a função faz,
  em que ordem, com qual identidade) e aponta para lá. Ele estava aqui provisoriamente
  porque não havia `endpoints.md`; mantê-lo nos dois lugares seria escolher, agora, qual
  dos dois vai envelhecer errado. No mesmo passe: a rota fica fixada como
  `POST /api/v1/products/:productId/variants`, fica escrito que **200 é o SVG cru e só o
  erro é envelope** (o texto anterior dizia "devolve SVG direto" e não dizia nada do erro),
  `?format=png` deixa de ser descrito como se já respondesse e passa a ser 400 explícito com
  o porquê no backlog, e a linha da API na tabela de stack passa de "não existe ainda" para
  "contrato escrito, código em curso" — sem afirmar que funciona, porque não funciona. O
  bullet de isolamento troca "token autenticado" por "chave de API": "token" é sinônimo
  proibido no glossário justamente porque já significa o JWT de sessão da pessoa.
