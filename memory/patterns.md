# Padrões Consolidados — Kora Calçados (codinome)

## Objetivo
- Registrar padrões validados em produção (não especulação)
- Evitar variação e inconsistência no código
- Acelerar onboarding com guias de implementação

## Contexto
- Stack: React + Vite + Supabase + Vercel Serverless Functions (ver ADR-001); editor de
  zonas manipula SVG no DOM, sem canvas (ver ADR-005)
- Padrões evoluem com a base de código; deprecados ganham tag [DEPRECADO]

## Regras Gerais
- Padrão só entra após validado em uso real ou por teste que o prove — não por opinião.
  (O projeto não tem time de dev humano: a validação vem de teste/execução, não de
  "≥ 2 aprovações" — ver ADR-003)
- Padrão obsoleto = tag [DEPRECADO] + data + sucessor
- Padrão quebrado repetidamente = vira ADR ou entra em `memory/bugs.md`

## Validações
- Padrão tem exemplos de código real (não pseudocódigo)?
- Contraexemplo está marcado como anti-padrão?

## Permissões
- Dono (Matheus): aprova/depreca padrões
- Agente: propõe padrão junto com o teste/execução que o valida

## Exceções
- Padrão de segurança/isolamento: entra imediatamente, sem esperar validação em uso

## Auditoria
- Revisão de código (feita por agente) checa conformidade com os padrões daqui
- **Não há linter configurado** neste projeto (não há ESLint em `package.json`). Onde um
  padrão precisa de garantia automática, ele vira **teste que lê o próprio fonte** — é o que
  `gravarZonaNoBanco.test.ts` faz com a proibição de `upsert`, e o que a guarda de
  `produtos.css` faz com a regra `[hidden]` (BUG-015). Comentário sozinho não segura regra
- Auditar este arquivo contra o código a cada entrega que muda arquitetura de front. Padrão
  documentado que o código não segue é pior que padrão ausente: o agente seguinte o
  implementa e cria a segunda convenção

## Casos de Uso
- Revisar código de feature nova
- Decidir como estruturar novo módulo
- Reconstruir o contexto do projeto numa sessão nova (não há dev humano com memória de
  time — ver ADR-003)

## Critérios de Aceite
- [ ] Padrão tem mínimo 1 exemplo de uso real, com caminho de arquivo que existe
- [ ] Contraexemplos claros (anti-padrão)
- [ ] Exceções documentadas

---

## Padrões de Código

### Organização para agente de IA (ver ADR-003)

Este projeto não tem desenvolvedor humano navegando o código por hábito — todo padrão
abaixo é otimizado pra busca/leitura de agente primeiro, ergonomia humana depois.

- **Nomenclatura de domínio bate 100% com `docs/03_REGRAS_DE_NEGOCIO/glossario.md`** —
  sem exceção, sem sinônimo "só nesse arquivo"
- **Arquivo alvo: ~80-150 linhas.** Módulo crescendo além disso é sinal de quebrar em
  responsabilidade menor, não de "arquivo grande mas organizado"
- **Toda pasta nova em `src/` ou `supabase/functions/` nasce com um README.md** de
  1 parágrafo: o que vive aqui, o que não vive aqui, arquivo de entrada

✅ `src/lib/render/gerarVarianteDeCor.ts` — nome literal, busca por "variante" acha o arquivo
❌ `src/lib/render/engine.ts` com função `process()` — nome não diz o que faz, exige abrir pra descobrir

### Nomenclatura

Termos de domínio vêm do glossário (`docs/03_REGRAS_DE_NEGOCIO/glossario.md`), sem
sinônimo — zona é zona em todo lugar.

Os exemplos abaixo são **nomes que existem no repositório**, não ilustrações inventadas —
exemplo fictício em doc de nomenclatura é a primeira coisa que um agente copia achando que
está seguindo o padrão.

- **Domínio (português)**: `marcarZona`, `gerarVarianteDeCor`, `resolverZonaDoElemento`,
  `zonasSobrepostas`, `montarSeletorDeZona`
- **Técnico (inglês)**: `useEffect`, `handleSubmit`, `closest`
- **Constantes**: `PINTAVEIS` (`src/lib/render/alvosPintaveis.ts`), `BUCKET_DO_ASSET_BASE`
  (`supabase/scripts/caminhoDoAssetBase.ts`)
- **Booleans**: `desabilitado`, `emFoco`, `salvando` — em português quando descrevem estado
  de domínio na tela, que é o caso de todos os que existem hoje

✅ `const gerarVarianteDeCor = (svg, zoneColors) => { ... }` (ação em português, termo do glossário)
❌ `const processColorMapping = () => { ... }` (jargão técnico + termo fora do glossário)

### Estrutura de Arquivos (por-feature) — como o código realmente é

```
src/features/
├── README.md                    <- índice e a regra de dependência entre features
├── zonas/
│   ├── README.md
│   ├── EditorDeZonas.tsx        <- componentes na raiz da feature, sem `components/`
│   ├── EditorDeZonas.test.ts    <- teste CO-LOCADO, ao lado do que ele prova
│   ├── PalcoDeMarcacao.tsx
│   ├── marcarZona.ts            <- regra pura, fora de componente e fora de hook
│   ├── tiposDeZona.ts           <- os tipos da feature (não `types.ts`)
│   ├── zonas.css                <- estilo separado do JSX, importado em src/main.tsx
│   └── hooks/
│       └── useZonasDoProduto.ts
```

Três coisas mudaram em relação ao que este arquivo prescrevia na fundação, e a razão de cada
uma é a mesma — **nome de arquivo tem de bater com nome de conceito** (ADR-003):

- **Sem pasta `components/`.** Ela separa por *tipo de coisa*, não por conceito: `zonas/`
  já tem 15 arquivos e a pasta só acrescentaria um nível para atravessar. O que separa é o
  sufixo do nome, que já diz o que o arquivo é.
- **Sem `index.js` de barrel.** Import por barrel esconde de onde a coisa vem; `grep` no nome
  do arquivo é como um agente encontra código aqui, e o barrel quebra exatamente isso.
- **`tiposDeZona.ts`, não `types.ts`.** Buscar por "zona" tem de achar o arquivo dos tipos de
  zona. `types.ts` existiria idêntico em toda feature e não diria nada.

✅ `src/features/zonas/EditorDeZonas.tsx` + `src/features/zonas/hooks/useZonasDoProduto.ts`
❌ `src/components/zonas/EditorDeZonas.tsx` + `src/hooks/zonas.ts` espalhados
❌ `src/features/zonas/index.ts` reexportando tudo

### Gerenciamento de Estado

- **Context API para a sessão** (`ContextoDeSessao`): usuário autenticado + tenant ativo. É
  contexto e não prop porque o tenant carrega o tema (white-label), e tema em constante de
  componente é o que o produto proíbe. **Não há Redux** (ADR-001).
- **Um único componente com estado por feature.** `EditorDeZonas` é o único lugar de
  `zonas/` com `useState`; `TelaDeProdutos` é o de `produtos/`. Tudo abaixo — `PalcoDeMarcacao`,
  `PainelDeZonas`, `FormularioDeNovaZona`, `ListaDeProdutos` — é **apresentacional**: recebe
  props, não busca nada, e por isso é testável como função pura de props.
- **Hook é casca de `useState`, a regra vive fora dele.** `useMarcacaoDeZona` guarda a lista
  de ids; quem sabe *alternar* e *desfazer* é `marcacaoEmCurso.ts`, puro. O motivo é teste:
  regra dentro do hook só se prova montando componente; fora dele se prova com uma chamada.
- **Cálculo derivado sobe para quem tem o estado.** `relatorioDeZonas` e `zonasSobrepostas`
  são calculados em `EditorDeZonas` e descem prontos por props — dois componentes calculando
  a mesma contagem divergiriam, e a divergência apareceria como número errado na conferência.

✅ Estado crítico + compartilhado = Supabase + Context; estado de tela = um dono só, no topo
❌ Redux; ❌ `useState` espalhado em componente burro para prop-drilling profundo

> **Supabase Realtime não é padrão deste projeto.** A versão anterior deste arquivo prescrevia
> "subscriptions em useEffect", e nada no código usa Realtime — a única `subscribe` que existe
> é o `onAuthStateChange` da sessão. Prescrever integração que ninguém validou contradiz a
> primeira regra deste documento (padrão entra depois de validado, não por opinião), e o
> concorrente entre membros hoje é tratado por releitura depois de gravar, não por push.

### CSS separado do JSX (white-label — CLAUDE.md)

Cada feature tem `<feature>.css`, importado **uma vez** em `src/main.tsx`; nenhum componente
importa estilo. É o que permite um tenant trocar a folha sem tocar em marcação.

Duas regras que custaram defeito:

- **Quem mede a tela é uma folha só.** A grade do editor mora em `zonas.css`, não em
  `produtos.css` — duas folhas medindo a mesma área é empate decidido pela ordem de import.
- **`display` de autor vence o `[hidden]` do navegador** (BUG-015). Todo elemento que a tela
  esconde por `hidden` e que tem `display` declarado precisa da regra `[hidden]` explícita na
  folha. Teste de componente **não pega isso**: `renderToStaticMarkup` prova o que o React
  escreve, nunca o que o navegador desenha — por isso a guarda lê o arquivo CSS.

## Padrões de API / Backend

> **Estado em 2026-09-08 — leia antes de acreditar no resto da seção.** A API de variante
> **não roda**: não existe handler, não existe deploy e a tabela `tenant_api_keys` ainda não
> foi criada (Etapa 2). O que nasce nesta etapa é **contrato e índice** — `docs/07_APIS/`, os
> `README.md` dos diretórios novos e os tipos de transporte em `api/_lib/tiposDaApi.ts`; o
> código do handler vem nas etapas seguintes. O que já é real, vinculante e coberto por teste
> é o **motor** (`src/lib/render/`) e os códigos de erro dele (`CodigoDeErro` em
> `src/lib/render/erros.ts`), que o editor usa hoje. Tudo abaixo é o alvo que o endpoint terá
> de cumprir, nunca a descrição do que está no ar.

A rota é `POST /api/v1/products/:productId/variants`, só POST (qualquer outro método →
`METODO_NAO_PERMITIDO` 405 com header `Allow: POST`). O corpo é um objeto de cores no topo,
uma chave por `zone_key` — `{"sola": "#C0392B", "cabedal": "#111111"}` — e **todo campo que
não é cor vai para a query string**, nunca para o topo do corpo: se `format` morasse no
corpo, uma zona chamada `format` colidiria com o contrato. O contrato completo, com exemplos,
vive em `docs/07_APIS/endpoints.md`.

### Sucesso é o artefato, erro é o envelope

**200 devolve o SVG cru** — byte a byte a saída de `gerarVarianteDeCor`, sem envelope:

```
HTTP/1.1 200 OK
Content-Type: image/svg+xml; charset=utf-8
Cache-Control: no-store

<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>
```

Três razões, e a primeira é a que decide:

1. **Envelopar obrigaria escape/unescape de um documento inteiro.** Pôr o SVG dentro de
   `{"data":{"svg":"..."}}` exige serializar o desenho como string JSON de um lado e
   desserializar do outro. O modo de falha desse round-trip não é "erro 500": é mojibake,
   BOM sobrando, `\u` mal decodificado dentro de um `<text>` — ou seja, **mudança silenciosa
   do desenho**, exatamente a classe que o princípio nº 1 do CLAUDE.md proíbe. Um erro que
   estoura é um problema; um desenho que volta diferente sem ninguém perceber vira calçado
   fabricado errado. Com o corpo nu há **zero transformações** entre a saída do motor e o
   byte que o cliente grava — não existe round-trip para dar errado.
2. **O cliente é um ERP que quer um arquivo, não um JSON.** Com corpo nu, `curl -o
   variante.svg` e `<img src="...">` funcionam sem uma linha de código de desempacotamento.
   Com envelope, todo integrador escreve o mesmo trecho de "pega `.data.svg` e grava" — e
   escreve cada um do seu jeito.
3. **`?format=png` no futuro não cabe em JSON sem base64.** Binário dentro de envelope vira
   base64: +33% de tamanho e mais uma codificação sobre o mesmo desenho. Corpo nu já é o
   formato certo para os dois casos, hoje e depois.

Nada de headers `X-Kora-*`. O motor **recusa aplicação parcial**, então um header de "zonas
aplicadas" repetiria o que o 200 já garante — e header informativo é a porta de entrada para
alguém tratar sucesso parcial como sucesso.

**`Cache-Control: no-store` não é enfeite.** A decisão de 2026-09-08 de não cachear em
`variants` (`memory/decisions.md`) protege só o nosso lado, e é inútil se um CDN — o da
Vercel na frente da função, ou o proxy do próprio cliente — guardar a resposta por conta
própria. Uma variante servida de cache depois de a zona ser remarcada ou a `cor_default`
mudar é a mesma cor errada no mesmo calçado, só que emitida por outra máquina. Decidir não
cachear tem de ser dito **no header**, senão é decisão que só vale onde não havia risco.

### Erro — sempre este envelope, `application/json`

```json
{
  "data": null,
  "error": { "code": "CHAVE_INVALIDA", "message": "Chave de API inválida." },
  "meta": { "timestamp": "2026-09-08T10:30:00.000Z", "version": "1" }
}
```

A chave é `error` (inglês, aninhado, com `code` e `message`), não `erro` plano. Duas formas
de erro na mesma API é o cliente parseando uma delas errado, e `erro` × `error` quebra "um
termo, um nome" dentro do próprio contrato. Os **códigos** são contrato e não mudam.

✅ Erro sempre envelopado, com `code` estável e `message` em português acionável
❌ Envelopar o sucesso (ver o [DEPRECADO 2026-09-08] abaixo)
❌ Erro como string solta, ou `{"erro": "CHAVE_AUSENTE"}` sem `message`
❌ Devolver 200 com a variante "quase certa" quando uma zona pedida não foi aplicada —
   fidelidade de cor é o princípio nº1; zona não aplicada é erro, não aviso

### Envelope de sucesso `data: { variante_id, svg_url }` — [DEPRECADO 2026-09-08]

Fica registrado em vez de apagado: a forma antiga circulou em doc, e um agente que a encontre
noutro lugar precisa achar **aqui** por que ela morreu.

```json
{ "data": { "variante_id": "...", "svg_url": "..." }, "error": null, "meta": { } }
```

Os dois campos pressupõem variante **persistida**, e em 2026-09-08 foi decidido **não
persistir** (cache em `variants`: "nada por enquanto"). Com isso: `variante_id` seria um id
que não identifica nada — ninguém consegue buscar a variante de volta por ele; e `svg_url`
não existe, porque nenhum `rendered_path` é gravado e o bucket do Storage é privado, então a
URL ou não teria destino ou seria uma URL assinada de vida curta apontando para um arquivo
que nunca foi escrito. **Sucessor**: "sucesso é o artefato, erro é o envelope", acima.

### Códigos e status

| `code` | Status | Família | Quando |
|---|---|---|---|
| `CHAVE_AUSENTE` | 401 | pedido | Sem header `Authorization`, sem esquema `Bearer`, **ou chave na query string** |
| `CHAVE_INVALIDA` | 401 | pedido | Malformada, inexistente **ou revogada** — as três com **mensagem idêntica** |
| `PRODUTO_NAO_ENCONTRADO` | 404 | pedido | Produto inexistente **ou de outro tenant**. Nunca 403 — 403 confirmaria que o id existe |
| `METODO_NAO_PERMITIDO` | 405 | pedido | Método diferente de POST; a resposta leva header `Allow: POST` |
| `CORPO_INVALIDO` | 400 | pedido | JSON malformado, não-objeto, vazio, ou acima do limite de tamanho |
| `FORMATO_NAO_SUPORTADO` | 400 | pedido | `?format=` diferente de `svg`. Recusa explícita, **nunca parâmetro ignorado em silêncio** |
| `ZONE_KEY_INVALIDA` | 422 | pedido | Chave semanticamente inválida (`"SOLA"`, `"__proto__"`) |
| `COR_INVALIDA` | 422 | pedido | Hex inválido |
| `ZONA_NAO_ENCONTRADA` | 422 | pedido | **Pré-checagem do handler**: pediu zona que este produto não tem. A mensagem lista as que ele tem |
| `ZONA_NAO_ENCONTRADA` | 409 | dado do tenant | **Vinda do motor**: o `svg_selector` gravado resolve zero elementos ou não é seletor válido |
| `ZONA_NAO_RECOLORIVEL` | 409 | dado do tenant | Zona mapeada em gradiente/pattern |
| `ZONAS_SOBREPOSTAS` | 409 | dado do tenant | Duas zonas pedidas compartilham elemento (BUG-013) |
| `SVG_INVALIDO` | 409 | dado do tenant | O asset-base no Storage não é SVG parseável |
| `SVG_NAO_NORMALIZAVEL` | 409 | dado do tenant | O canônico foi corrompido |
| `FALHA_INTERNA` | 500 | nossa | Qualquer outro `Error`. Mensagem fixa; o detalhe vai só para o log |

**A família responde "quem tem de agir?", e é ela que escolhe o status.**

- **Pedido** — quem corrige é o integrador, mexendo na requisição.
- **Dado do tenant** — a requisição está autenticada e bem formada; o que está errado é o
  **mapeamento de zonas gravado pela marca**, e quem corrige é uma pessoa **no editor**, não
  o código do cliente.
- **Nossa** — 500, e só aí.

**Por que a família "dado do tenant" é 409, e não 500 nem 422:**

- **Não 500**, porque 500 significa "tente de novo, pode passar". Cliente com retry
  automático reprocessaria em laço um `svg_selector` que não conserta sozinho — carga inútil
  sobre uma falha determinística — e ainda enterraria um erro de dado no meio do alarme de
  indisponibilidade, que é o lugar onde ninguém vai procurá-lo.
- **Não 422**, porque 422 manda o integrador caçar defeito num payload que está **correto**.
  Ele revisaria hex e `zone_key` indefinidamente sem chegar perto da causa, que está no dado
  da marca.
- **409 é literalmente "a requisição conflita com o estado atual do recurso"**: autenticada,
  bem formada, e ainda assim impossível pelo estado em que o produto está.

**A mensagem muda com a família, e isso é metade do valor.** Um 409 nunca diz "corrija o
pedido"; diz que o mapeamento de zonas **deste produto** precisa de correção no editor.

**`ZONA_NAO_ENCONTRADA` é o único código ambíguo** — o motor o usa para duas situações
diferentes, e o código é imutável (`src/lib/render/erros.ts`: "mudar um código quebra
cliente, então não muda"). A ambiguidade é resolvida **na origem**, não no mapeamento: o
handler pré-checa as `zone_key` pedidas contra as que acabou de ler do banco e levanta ele
mesmo o 422. Depois dessa pré-checagem, a única forma de o **motor** lançar esse código é
seletor quebrado — logo, 409.

Os 7 códigos do motor (`CodigoDeErro`) **não mudam e não ganham membro novo**. Os códigos de
transporte (`CHAVE_AUSENTE`, `CHAVE_INVALIDA`, `PRODUTO_NAO_ENCONTRADO`,
`METODO_NAO_PERMITIDO`, `CORPO_INVALIDO`, `FORMATO_NAO_SUPORTADO`, `FALHA_INTERNA`) vivem em
`api/_lib/tiposDaApi.ts`, numa união que **estende** `CodigoDeErro` sem editá-lo — assim o
motor continua compilável e testável sem saber que HTTP existe.

### Validação
- Input validation antes de tocar no banco **e antes de tocar no SVG**: `validarCor` e
  `validarZoneKey`, em `src/lib/render/`. São validadores escritos à mão, **não Zod** — duas
  regras pequenas e estáveis não pagam uma dependência nova, e elas precisam rodar igual no
  editor e na função serverless (princípio nº1). Quem decide o que é um hex é `validarCor`, e
  é o mesmo em todo lugar
- **O mesmo validador vale para os dois lados.** A tela chama `validarZoneKey`/`validarCor`
  antes de gravar, e o motor chama de novo na geração: a primeira chamada é conveniência
  (prevenção de erro > mensagem de erro), a segunda é a garantia
- Mensagens de erro em português, código de erro em enum estável (`CodigoDeErro`)

### Tratamento de Erros
- Código de erro estável (não muda entre versões) — `CodigoDeErro` é contrato de API
- Erro do Supabase **nunca** sai cru da camada de acesso: `gravarZonaNoBanco` traduz `23505`
  e `PGRST116` para frase acionável antes de o objeto chegar à tela
- Erro **sobe**, nunca vira lista vazia. Lista vazia por engano se lê como "essa marca não
  tem produto", que é um fato falso apresentado com a mesma cara de um fato verdadeiro
- Log estruturado sem dados sensíveis (senhas, tokens). Da chave de API o log registra o
  **prefixo**, nunca a chave (ADR-006)
- **Retry automático ainda não existe** em nenhum caminho do código. Fica registrado como
  alvo para quando houver função serverless com 5xx a que reagir; hoje não há a quem aplicar,
  e descrevê-lo como padrão vigente faria um agente procurar o utilitário que o implementa

## Padrões de UI/UX

### Feedback Temporal
- **Erro**: banner com a ação a tomar, que **permanece até alguém agir**. Nunca toast — a
  mensagem que some sozinha é a que ninguém leu. É o que `ListaDeProdutos` faz hoje
- **Sucesso**: o resultado aparece na tela, não um aviso sobre ele. Gravar zona relê
  `product_zones` e a zona nova entra no painel com a contagem de elementos — confirmação que
  se pode conferir, em vez de uma frase dizendo que deu certo
- **Carregando**: estado próprio e nomeado, nunca ausência de estado
- **Não existe componente de toast, skeleton nem spinner** no projeto. Antes de escrever
  "spinner", olhe o que a tela vizinha faz: uma segunda convenção de carregamento é o começo
  de duas experiências diferentes na mesma aplicação

### Estados Obrigatórios
Toda tela tem renderização para carregando, vazio, erro e sucesso (CLAUDE.md). O padrão é
uma **união de strings exaustiva**, não um par de booleanos:

```ts
export type EstadoDaLista = 'carregando' | 'erro' | 'vazia' | 'pronta';
```

✅ `EstadoDaLista` (`hooks/useProdutos.ts`), `EstadoDaSessao` (`ContextoDeSessao.tsx`) —
   um estado por vez, e a lista de nomes é a própria checagem de que nenhum foi esquecido
❌ `carregando: boolean` + `erro: string | null`, que admite "carregando e com erro ao mesmo
   tempo" e deixa o quarto estado (vazio) sem nome nenhum

## Padrões de Processo

### Fluxo de entrega

Este projeto **não tem PR, não tem CI e não tem revisor humano** — todos os commits até hoje
foram direto em `main`, e não existe `.github/`. O texto anterior descrevia branch, PR com
`≥ 1 aprovação` e "CI green = merge"; nada disso jamais existiu aqui, e um agente que o siga
fica esperando uma aprovação que nunca vem. O que existe, do CLAUDE.md e do ADR-003:

1. **Planejar tudo antes de executar** — escopo fechado, sem retrabalho
2. Build multi-parte → fan-out paralelo com **dono exclusivo por arquivo** (dois agentes
   nunca escrevem no mesmo arquivo). Tarefa de peça única não ganha fan-out
3. `npm test` e `npm run typecheck` verdes **antes** de commitar; função pura nasce com teste
4. **Abrir no navegador** toda peça de UI cuja razão de existir é mostrar algo — a suíte não
   substitui isso (ver `memory/learnings.md`)
5. **Sintetizar e validar no fim**: revisar cada entrega, rodar a suíte e o build
6. Commit com mensagem em inglês, corpo em pt-BR quando ajudar

### Revisão de código (feita por agente)
- Nome bate com `docs/03_REGRAS_DE_NEGOCIO/glossario.md`? Termo novo entrou lá **no mesmo
  commit**?
- Padrão novo? Documentar aqui, com o arquivo real que o valida
- Quebra padrão existente? Tag `[DEPRECADO]` no padrão velho, com data e sucessor
- Doc que descreve o trecho mudado continua verdadeiro? Se não, corrigir no mesmo commit
- Segurança/isolamento entre tenants? Escalar ao dono imediatamente, antes de commitar

### Documentação
- Comentário explica o **porquê**, não o quê (ver ADR-003) — o quê já está no código
- Função > 3 linhas = JSDoc (tipos, exemplos)
- Feature relevante = ADR; termo de domínio novo = linha no glossário no mesmo commit

---

## Padrões [DEPRECADO]

| Padrão | Razão | Data | Sucessor |
|---|---|---|---|
| Recolor por `getElementById` + `setAttribute('fill')` | Falha em silêncio em SVG real (style inline/CSS vencem o atributo) — ver BUG-001/002 | 2026-08-12 | `normalizarSvg` + seletor de zona (ADR-004, aceito) |
| `svg_selector` como "seletor CSS" qualquer, inclusive prefixo | `[id^="zona-cadarco"]` capturaria uma zona futura `zona-cadarco-lateral` e pintaria o lugar errado **sem avisar** | 2026-09-05 | Lista de ids exatos, montada só por `montarSeletorDeZona` (ADR-005) |
| Subscriptions de Supabase Realtime como padrão de estado | Nunca foi usado no código; entrou na fundação como opinião, não como padrão validado | 2026-09-07 | Releitura depois de gravar (`useZonasDoProduto`) |
| Envelope de sucesso `data: { variante_id, svg_url }` na API de variante | Os dois campos pressupõem variante persistida, e foi decidido **não persistir**: `variante_id` não identifica nada e `svg_url` não existe (sem `rendered_path`, bucket privado). Envelopar o SVG ainda obrigaria escape/unescape do desenho inteiro | 2026-09-08 | "Sucesso é o artefato, erro é o envelope" (seção "Padrões de API / Backend") |

## Checklist de Novo Padrão

- [ ] Validado por execução ou teste real (não por opinião), com o caminho de arquivo citado
- [ ] Documentado aqui com exemplo ✅ e contraexemplo ❌
- [ ] O ✅ aponta para código que existe no repositório, não para exemplo inventado
- [ ] Aprovado pelo dono quando muda algo já em uso
- [ ] Onde a regra é fácil de desfazer sem perceber, existe teste que a segura (não só
      comentário)

## Atualizações deste documento

- **2026-09-08** — reescrita da seção "Padrões de API / Backend" contra o contrato da API de
  variante. O envelope de sucesso `data: { variante_id, svg_url }` estava obsoleto desde a
  decisão de não persistir variante e foi **deprecado com sucessor apontado**, não apagado:
  a regra vigente é "sucesso é o artefato, erro é o envelope" (200 devolve o SVG cru com
  `Cache-Control: no-store`; erro devolve o envelope JSON). Entram a tabela de códigos →
  status, a distinção de família (pedido × dado do tenant × nossa) e o argumento de por que
  "dado do tenant" é 409. O aviso de estado no topo da seção foi atualizado: nesta etapa
  nascem o contrato e os README; o handler ainda não existe.
- **2026-09-07** — auditoria contra o código das Etapas 0–5 (Etapa 6). Alinhados à realidade:
  a estrutura por feature (sem `components/`, sem barrel, `tiposDeZona.ts`), o gerenciamento
  de estado (Context só na sessão; um componente com estado por feature, apresentacionais
  abaixo; regra pura fora do hook), a validação (validadores próprios, não Zod), o feedback
  de UI (banner que fica; não há toast/skeleton/spinner) e os exemplos de nomenclatura, que
  agora usam nomes que existem. Marcado como não-vigente o que nunca foi implementado
  (Realtime, retry com backoff, linter) e removido o processo herdado de template (branch,
  PR com aprovação, CI). Padrão documentado que o código não segue é armadilha: o próximo
  agente o implementa e cria a segunda convenção.
