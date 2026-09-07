# Arquitetura — Visão Geral · Kora Calçados (codinome)

> Justificativa completa da escolha de stack vive em `08_DECISOES/adr-001-stack-e-motor-de-render.md`.
> Este arquivo é o "mapa" de como as peças se encaixam.
>
> **Cada linha diz o que já roda e o que ainda não existe.** Um mapa que descreve o alvo no
> mesmo tom do que está no ar faz um agente novo importar um módulo que ninguém escreveu — e
> gastar a sessão descobrindo isso. Estado é parte do fato, não enfeite.

## Stack

| Camada | Escolha | Papel | Estado (2026-09-07) |
|---|---|---|---|
| Frontend / Editor | React + Vite, **SVG no DOM** (ADR-005) | Login, lista de modelos, marcação de zona e preview de variante com o mesmo motor da API | **No ar** — `src/` |
| Dados / Auth | Supabase (Postgres + RLS + Storage) | Tenants, membros, produtos, zonas, autenticação, bucket privado dos SVGs | **No ar** — `supabase/migrations/` |
| API de geração | Vercel Serverless Functions | Recebe `{zona: cor}`, recolore o asset-base canônico, devolve SVG ou PNG | **Não existe ainda** — não há diretório `api/` no repositório; é a próxima peça |
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

`*variants` é cache opcional — a API pode gerar on-the-fly sem persistir. **Nenhuma linha é
escrita nessa tabela hoje**, porque a API ainda não existe.

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

## Fluxo — API (geração) — **contrato alvo, ainda não implementado**

Fica descrito aqui porque é o contrato que o motor já cumpre; o endpoint é a peça seguinte.

1. `POST /products/:id/variants` com `{"sola": "#C0392B", "cabedal": "#111111"}`
2. A função busca o asset-base canônico no Storage
   (`tenants/{tenant_id}/products/{product_id}/base.svg` — a definição única do path é
   `supabase/scripts/caminhoDoAssetBase.ts`)
3. Aplica os seletores de `product_zones` e troca `fill` de cada zona pedida — zona
   ausente, cor inválida, zona com gradiente ou zonas sobrepostas devolvem **erro**, nunca
   200 "quase certo". Os códigos são os de `src/lib/render/erros.ts`, que já é contrato
4. Devolve SVG direto, ou rasteriza pra PNG (`sharp` ou `resvg`) se `?format=png`
5. Opcionalmente grava em `variants` pra reuso rápido da mesma combinação

**Pergunta em aberto (só o dono decide):** como o chamador da API se autentica. O app usa o
JWT de sessão do Supabase, mas a API de variante é consumida por sistema do cliente, não por
navegador logado — chave por tenant, service account ou outra coisa não foi decidido em ADR
nenhum, e `docs/07_APIS/` ainda está vazio. Fica em branco de propósito: palpite bem escrito
vira fato na próxima leitura, e aqui ele decidiria sozinho o modelo de integração do produto.

**Segunda pergunta em aberto:** qual o critério para gravar em `variants`. "Cache opcional"
foi escrito na fundação sem regra; quem decide persistir e quem invalida não está definido.

## Isolamento multi-tenant (não-negociável — ver `11_SEGURANCA/`)

- RLS em toda tabela por `tenant_id`, sem exceção — provado por
  `supabase/tests/isolamento.test.ts` contra um projeto Supabase real (BUG-006..009 fechados)
- Storage particionado por tenant no path (`tenants/{tenant_id}/...`), em **bucket privado**:
  as policies leem `storage.foldername(name)`, então o path é controle de acesso e não
  convenção de nome de arquivo
- Nenhuma função serverless aceita `product_id` sem validar que pertence ao
  `tenant_id` do token autenticado

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
