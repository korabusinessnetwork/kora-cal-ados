# Spec, o elo editor → API

> Loop `/spec → /build → /review`. Aberto em 2026-09-09, com a Fase 1 do roadmap fechada
> (editor de zonas + API de variante, 45/45 em `npm run test:banco`, 536 testes verdes,
> migration de `tenant_api_keys` aplicada ao projeto real).

## 0. Por que isto existe

O princípio nº1 do `CLAUDE.md` é **"cor no editor = cor na API"**. As duas metades existem,
cada uma passa nos seus testes, e **elas nunca se olharam**:

- a passada do editor foi em 2026-09-05 (commit `441740c`), quando a API não existia;
- a passada da API foi em 2026-09-08, sobre zonas **semeadas por script**
  (`semearZonasDoProdutoA`, `semearZonasDeTeste.ts`), nenhuma delas veio do caminho que o
  editor usa para gravar.

`supabase/tests/apiDeVariante.test.ts` monta os seus próprios `svg_selector` chamando
`montarSeletorDeZona` diretamente. Isso prova que a API **consome** o formato. Não prova que
o que o editor **produz** é aquele formato, nem que a linha que a RLS deixa o dono gravar é a
linha que a `service_role` lê depois. São dois caminhos de privilégio diferentes sobre a
mesma linha, e nenhum teste atravessa os dois.

**O que mudou desde que este elo parecia caro:** o editor **não cunha id**. O ADR-005 decide
que ele é somente-leitura sobre o canônico, e os ids nascem em `normalizarSvg`, no
provisionamento, em Node. Editor e API leem **o mesmo arquivo com os mesmos ids**. Logo o
elo é automatizável sem navegador, e o resíduo de risco de navegador fica pequeno e
nomeável (ver §5).

## 1. Escopo

Um teste de integração contra o Supabase real que percorre o caminho inteiro numa rodada só:
o **caminho de gravação do editor** (com o cliente autenticado do dono, passando pela RLS)
cria uma zona nova sobre o canônico do Storage; em seguida a **API** é chamada com aquela
`zone_key`, e o SVG devolvido é conferido elemento por elemento.

Arquivo: `supabase/tests/eloEditorApi.test.ts`.

## 2. Fora de escopo

- **Navegador.** Nenhuma dependência nova (Playwright, Puppeteer, testing-library). O que
  exige olho fica registrado como roteiro em §5, não construído aqui.
- **Deploy na Vercel**, fora por decisão do dono.
- Qualquer alteração no editor, na API ou no motor. Esta rodada **verifica**; se achar
  defeito, aí sim corrige, e a correção entra no mesmo commit com o teste que a pegou.
- Itens de Fase 1.5 do backlog (tela de chaves, `?format=png`, gradiente, rate limiting),
  os três primeiros têm gatilho escrito que não disparou.

## 3. Arquivos afetados

| Arquivo | O quê |
|---|---|
| `supabase/tests/eloEditorApi.test.ts` | **novo**, o teste do elo |
| `supabase/tests/ambiente.ts` | possível helper de login do dono já existe (`clienteA`); mexer só se faltar algo |
| `supabase/tests/README.md` | linha na tabela + por que este teste não é redundante |
| `api/_local/roteiroDePassada.md` | seção §5 (o resíduo que precisa de olho) |
| `memory/bugs.md`, `memory/learnings.md` | só se a rodada achar defeito |

## 4. Critérios de aceite

Cada um responde sim/não depois do build.

1. O teste grava a zona pelo **caminho do editor**: `marcarZona` (que chama
   `montarSeletorDeZona`) seguido de `gravarZonaNoBanco`. Nenhum `svg_selector` é montado à
   mão no arquivo de teste, e nenhum `insert` direto em `product_zones` para a zona sob teste.
2. A gravação usa o **cliente autenticado do dono** (`cenario.clienteA`), não `admin()`,
   ou seja, atravessa a RLS como o navegador atravessa.
3. A leitura é feita pela API: `handlerDaVariante.fetch(...)` com `Authorization: Bearer` de
   uma chave ativa do mesmo tenant, sem cliente injetado.
4. A asserção é **por elemento, não por contagem de cor**: o teste extrai o `fill` do
   elemento cujo `id` o editor escolheu e afirma que é a cor pedida.
5. O teste afirma também que **nenhum outro elemento mudou**, comparando o SVG devolvido
   com o canônico baixado do Storage, exigindo que as linhas diferentes sejam exatamente as
   dos elementos daquela zona.
6. Há um caso com zona de **vários elementos** (o `zona-cadarco` do demo tem 4 ids): a API
   pinta **todos**, e o teste conta 4 elementos com a cor nova, não 1.
7. Há um caso de **acrescentar elemento a uma zona já gravada** (o `UPDATE` que originou o
   BUG-014): depois do update, a API pinta o conjunto novo, e o `label` gravado antes
   continua lá.
8. A `zone_key` usada no pedido à API é **a mesma string** que o editor gravou, o teste
   lê a `zone_key` de volta do banco e usa esse valor no corpo do POST, em vez de repetir o
   literal. É o que pega normalização divergente entre os dois lados.
9. O teste nasce com `describe.skipIf(!temAmbiente)` e limpa o que criou (`limpar`), sem
   deixar tenant, usuário, chave ou objeto no Storage.
10. `npm run test:banco` verde por inteiro (não só o arquivo novo), e `npx tsc --noEmit`
    limpo, e `npx vitest run` sem regressão.
11. `supabase/tests/README.md` explica em uma seção **por que este teste não é redundante**
    com `apiDeVariante.test.ts`, a diferença é "quem produziu o seletor".

## 5. Edge cases conhecidos

- **Zona de um elemento só** × **zona de vários**, critério 6.
- **Elemento que o editor recusa no clique** (gradiente, elemento de outra zona): o teste
  **não** deve tentar marcá-lo pelo caminho do editor, porque o editor recusa antes de
  gravar. Esse par já está coberto em `apiDeVariante.test.ts` por semeadura direta, que é o
  jeito certo, o estado existe no banco sem o editor tê-lo criado.
- **`label` preservado no update**, critério 7, é o BUG-014.
- **Zona gravada e produto de outro tenant**: não repetir aqui, `apiDeVariante.test.ts` cobre.
- **O resíduo que este teste NÃO alcança, e que precisa de olho:** que o Chrome resolva
  `#a, #b` nos mesmos elementos que o jsdom resolve. O risco é pequeno (o seletor é lista de
  ids exatos, a forma mais simples de seletor que existe, e `montarSeletorDeZona` é a única
  fonte do formato), mas não é zero. Vira uma linha de roteiro em
  `api/_local/roteiroDePassada.md`, não código.

## 6. Definição de "aprovado sem ressalvas"

Os 11 critérios em "sim", `npm run test:banco` e `npx vitest run` verdes, `npx tsc --noEmit`
limpo, nenhum `console.log` esquecido, nenhum TODO sem justificativa, e o banco sem resíduo
depois da rodada (conferido, não suposto). Se a rodada achar defeito de produto, ele vira
linha em `memory/bugs.md` e correção no mesmo commit, e aí o loop recomeça do `/review`.
