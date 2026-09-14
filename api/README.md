# `api/`, a função serverless que gera a variante

> **Estado: funciona localmente, não está publicado.** Em 2026-09-08 o endpoint devolveu
> `200` com o SVG recolorido por HTTP real, contra o Supabase de produção, rodando em
> `npm run api:local`, a passada inteira está em `_local/roteiroDePassada.md` e a
> integração automatizada em `../supabase/tests/apiDeVariante.test.ts` (45/45 verdes por
> `npm run test:banco`).
>
> **Nada aqui foi publicado na Vercel, e isso não é detalhe:** o servidor local carrega o
> handler pelo Vite, e a Vercel o empacotaria com esbuild + node-file-trace. Rodar local não
> prova empacotamento, a lista do que ele **não** prova está em `_local/README.md`, e o
> risco do `jsdom` continua aberto até um deploy existir.
>
> Contrato em `docs/07_APIS/endpoints.md`; autenticação em
> `docs/08_DECISOES/adr-006-autenticacao-da-api-de-variante.md`.

Este diretório é a **API que o produto vende**: o sistema da marca calçadista manda as cores
e recebe o modelo pintado. O editor (`src/`) existe para produzir o dado que ela consome.

## Por que a `service_role` mora aqui, e não em `src/`

O front autentica com a chave `anon` e é protegido pela **RLS** do Postgres: cada requisição
carrega o JWT do usuário, e o banco recusa sozinho o que não é do tenant dele.

A API não tem JWT de usuário nenhum, quem chama é um servidor, autenticado por **chave de
API do tenant** (ADR-006). Depois de validar a chave, a função consulta o banco com
`service_role`, que **bypassa a RLS**. A partir daí o isolamento entre marcas concorrentes
deixa de ser do Postgres e passa a ser responsabilidade deste código:

- o `tenant_id` sai **sempre** da chave, nunca do corpo, da URL ou de header do chamador;
- o `product_id` é conferido contra esse `tenant_id` **antes** de qualquer outra coisa;
- recurso de outro tenant responde **404, não 403**, 403 confirmaria que o id existe, e
  entre concorrentes isso já é informação vendável.

Por isso `src/lib/supabase/semServiceRoleNoFront.test.ts` proíbe a palavra `service_role` em
`src/` inteiro, e por isso este diretório fica **fora** de `src/`. Nada daqui pode ser
importado pelo front, e nada do front pode ser importado por aqui, a proibição é guardada
por varredura (`api/_lib/apiNaoImportaOFront.test.ts`), não por lembrança.

## Estrutura

| Caminho | O que é |
|---|---|
| `v1/products/[productId]/variants.ts` | O handler HTTP. Orquestra os passos na ordem e **não decide nada** |
| `v1/modelo-de-linguagem/` | As rotas do fornecedor de modelo de linguagem da marca (D13), chamadas pela tela com a sessão da pessoa. Índice em `v1/modelo-de-linguagem/README.md`, contrato em `docs/07_APIS/modelo-de-linguagem.md` |
| `_lib/` | Toda a lógica: autenticação, leitura com escopo de tenant, tradução de erro, montagem da resposta. Índice em `_lib/README.md` |
| `_local/` | Um servidor local para abrir e dirigir a função sem depender de deploy. Índice em `_local/README.md` |

**`v1/products/[productId]/` não ganha README próprio**, e isso é exceção consciente à regra
do CLAUDE.md ("todo diretório novo ganha um README de índice"): esses segmentos **não são
organização nossa**, são a rota. A Vercel roteia por sistema de arquivos, então
`api/v1/products/[productId]/variants.ts` **é** `POST /api/v1/products/:productId/variants`.
Um README ali descreveria uma pasta que não representa uma decisão de arquitetura. O
contrato da rota vive em `docs/07_APIS/endpoints.md`.

Diretório começado por `_` é **ignorado** pelo roteamento da Vercel, é assim que `_lib/` e
`_local/` convivem com as rotas sem virar endpoint.

### Todo arquivo de teste dentro de `api/v1/**` começa com `_`

O `_` vale para **arquivo**, não só para diretório, e é o único jeito de um arquivo em `api/`
não virar endpoint. Consequência que custa caro se passar batido: um `variants.test.ts`
co-locado ao lado do handler seria **publicado** como `/api/v1/products/:productId/variants.test`
um endpoint que ninguém pretendeu criar, que expõe o nome dos casos de teste e que responde
alguma coisa (ou falha no build) sem nunca ter sido pensado como rota.

Por isso o teste do handler é `_variants.test.ts`. Ele fica co-locado, o vitest o encontra
igual (o padrão dele é por sufixo `.test.ts`, não por prefixo) e o roteamento não o vê.

Isto foi descoberto pelo servidor local, que deriva a rota do caminho do arquivo exatamente
como a Vercel: o teste apareceu na lista de rotas dele. `api/_local/servidorLocal.mjs` segue
listando e avisando sobre arquivo de teste que vire rota, como rede para o dia em que alguém
criar um sem o `_`, e nunca o esconde, porque esconder aqui esconderia o que apareceria no
deploy.

## Não existe `vercel.json`, e não vai existir

O roteamento zero-config já cobre `api/` mais a saída do Vite em `dist/`. Um `vercel.json`
criado por antecipação viraria a **segunda fonte de verdade da rota**, e duas fontes de
verdade divergem, sempre. Se um dia houver configuração que zero-config não cobre, ela entra
com a justificativa junto.

## O handler tem assinatura Web, não `(req, res)`

A Vercel aceita **duas** formas de Web Handler numa função Node fora de framework. A que
este projeto usa é o export `fetch`, um objeto com um método `fetch`, **não** uma função
default solta:

```ts
// api/v1/products/[productId]/variants.ts
export default {
  async fetch(pedido: Request): Promise<Response> {
    // …
  },
};
```

A alternativa documentada é um export por método, `export function POST(pedido: Request)`,
`export function GET(...)` etc. Escolhemos o `fetch` porque a rota tem **um** método válido e
o 405 é parte do contrato (`METODO_NAO_PERMITIDO` + header `Allow: POST`, ver
`docs/07_APIS/endpoints.md`): com export por método, quem responde a um `GET` é a Vercel, com
o corpo dela, e o cliente receberia um erro fora do nosso envelope. Com `fetch`, todo método
entra no nosso código e sai pela mesma porta.

> Correção de 2026-09-08: este arquivo dizia
> `export default async function (pedido: Request): Promise<Response>`. **Essa forma não é a
> documentada.** A função default solta é o formato antigo `(req, res)` do Node; o Web
> Handler é o objeto com `fetch`, ou o export por método. Verificado na
> [referência de API de Vercel Functions](https://vercel.com/docs/functions/functions-api-reference).

Três consequências, e as três são o motivo de preferir Web Handler a `(req, res)`:

1. **Dispensa a dependência `@vercel/node`.** O projeto é de custo zero e evita dependência
   sem justificativa (`memory/restrictions.md`).
2. **Torna o handler testável sem servidor**: monta-se um `Request` à mão e lê-se a
   `Response`.
3. **Permite rodar o mesmo handler localmente** (`api/_local/`), sem uma segunda
   implementação para desenvolvimento, o que divergiria da que roda em produção.

Duas condições de ambiente que a Vercel exige e que este projeto **já cumpre**, registradas
porque quebrariam em silêncio se alguém as mexesse:

- `package.json` tem `"type": "module"`. Sem isso, função sem framework precisaria de
  extensão `.mjs`.
- O `tsconfig.json` não usa **Path Mappings** (`paths`) nem **Project References**. São as
  duas opções de tsconfig que a Vercel declara **não** suportar ao compilar `api/`. Hoje não
  usamos nenhuma das duas; se alguém introduzir um alias `@/…` no projeto, ele funciona no
  Vite e **falha no deploy da função**, e o erro aparece só lá.

## O empacotamento com jsdom foi provado, e tem uma armadilha nomeada

Este era o maior risco da entrega: `api/` **não é compilado pelo Vite**. A Vercel usa esbuild
mais node-file-trace, e o motor de render importa `jsdom`, que é CommonJS e cheio de `require`
dinâmico. Se isso não empacotasse, a API não existiria, e o plano B era Supabase Edge
Function em Deno, que **não roda jsdom** e exigiria um terceiro adaptador em `dom.ts`.

Provado em 2026-09-08, antes de escrever o handler:

```bash
# empacota um handler de mentira que importa domNode + gerarVarianteDeCor
npx esbuild sonda.ts --bundle --packages=external --platform=node --format=esm --target=node22 --outfile=sonda.mjs
# e roda o resultado sob node puro
node -e "import('./sonda.mjs').then(async m => console.log(await (await m.default.fetch(new Request('http://x/',{method:'POST'}))).text()))"
```

Resultado: 200, `image/svg+xml; charset=utf-8`, e o `fill="#000000"` saiu `fill="#C0392B"`. Ou
seja, sob Node puro, sem Vite, sem Vitest, os imports sem extensão de `src/lib/render/`
resolvem, o jsdom carrega e o motor pinta. **É a primeira vez que código deste repositório
roda fora de um dos dois carregadores** (ver `supabase/scripts/executar.mjs`, que existe
justamente porque `moduleResolution: bundler` quebra no `node` cru).

**A armadilha, e é por isso que a linha acima tem `--packages=external`:** a primeira tentativa
foi `--bundle` sem exceção, e ela **falha**, `Error: Dynamic require of "path" is not
supported`. Espremer o jsdom, que é CJS, dentro de um único arquivo ESM quebra os `require`
dele em tempo de execução, e **não em tempo de empacotamento**: o esbuild termina com exit 0 e
12,5 MB de bundle aparentemente saudável. O erro só aparece na primeira requisição.

`--packages=external` é o que corresponde ao que a Vercel realmente faz: ela **não** achata
`node_modules` num arquivo só, o node-file-trace copia os pacotes e o `require` continua
funcionando. Quem um dia trocar isso por um bundle achatado (por otimização de cold start, o
motivo mais provável) reintroduz a falha, e ela vai aparecer em produção, na primeira chamada
de cliente. Se for preciso mesmo, o jsdom tem de ficar de fora do bundle.

## `tsconfig.json`: este diretório está no `include`, e `types` ganhou `"node"`

Duas mudanças que precisam de motivo escrito, senão alguém as desfaz por parecerem sobras:

- **`"api"` no `include`**, sem isso `npm run typecheck` **não olharia nada daqui**. O
  `include` é uma allowlist; código fora dele não é verificado e ninguém percebe.
- **`"node"` no `types`**, `process.env` e `node:crypto` compilavam antes por acidente,
  através de um `@types/node` puxado transitivamente por `jsdom`/`vitest`. `types` é uma
  allowlist e depender de sorte dentro dela é convenção implícita, que o ADR-003 proíbe.
  `@types/node` passou a ser devDependency explícita.

O preço da segunda mudança: `process.env` passa a compilar em `src/` também, onde é
proibido. Quem segura isso é a varredura de `semServiceRoleNoFront.test.ts`, não o
compilador.

## Ligações

- `docs/07_APIS/endpoints.md`, o contrato: rota, corpo, respostas, códigos e status
- `docs/07_APIS/autenticacao.md`, a chave de API em formato de API
- `docs/08_DECISOES/adr-006-autenticacao-da-api-de-variante.md`, a decisão e o que ela proíbe
- `src/lib/render/README.md`, o motor, importado daqui **e** do editor: a mesma função nos
  dois lados é o princípio nº1 por construção
- `docs/11_SEGURANCA/multi-tenancy-rls.md`, o isolamento que esta função é obrigada a
  preservar sem RLS
