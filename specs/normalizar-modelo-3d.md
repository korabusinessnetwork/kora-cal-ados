# Spec — `normalizarModelo3d`, a normalização de glTF

> Loop `/spec → /build → /review`. Aberto em 2026-09-09, no mesmo dia dos ADR-007 (calçado 3D
> manipulável) e ADR-008 (calçado gerado sobre acervo de peças).

## 0. Por que isto, e por que agora

Os dois ADRs de hoje ficaram bloqueados em **conteúdo**: o 007 em "não existe um glTF neste
projeto", o 008 nas ~15 peças do acervo. Nenhum dos dois destrava com código.

`normalizarModelo3d` é a exceção. É a peça que os **dois** nomeiam como primeira entrega
(ADR-007, Notas de Implementação: *"A primeira entrega é o provisionamento
(`normalizarModelo3d` + coluna de tipo em `products`), não o palco"*), e a única do rumo 3D
que não depende de artista: **glTF é JSON**, então fixtures escritas à mão exercitam cada
regra sem nenhum modelo real de calçado.

Ela também não é especulativa: é obrigatória nos dois modos. Produto 3D trazido pela marca
passa por ela, e **toda peça do acervo passa por ela** (ADR-008 D1: cada peça é "normalizada
uma vez (ADR-007 D4/D5: nome próprio, material próprio)"). Se a direção do produto mudar de
novo, este módulo continua valendo.

## 1. Escopo

Uma função pura em Node — `normalizarModelo3d(gltfCru)` — que recebe um documento glTF 2.0 em
JSON e devolve **o modelo 3D canônico** mais um relatório do que mudou, ou **recusa** com
código de erro explícito e mensagem que diz o que fazer.

Arquivo: `src/lib/render/normalizarModelo3d.ts`, ao lado de `normalizarSvg.ts`, imitando-o em
forma, nomenclatura e estilo de teste.

## 2. Fora de escopo

- **three.js, palco 3D, órbita, modo cor chapa.** Isto é provisionamento, roda em Node, e não
  desenha nada.
- **Acervo, composição, prompt** (ADR-008). Nada de tabela, coluna ou schema.
- **Container binário `.glb`**, Draco, meshopt, quantização. Esta rodada opera sobre glTF em
  JSON; `.glb` é desempacotamento, e vira entrega própria se e quando um arquivo real exigir.
- **Textura e imagem.** Peça com textura não é tratada nesta rodada — ver critério 11, que
  decide o que fazer com ela em vez de ignorá-la em silêncio.
- **Upload, Storage, script de provisionamento, coluna de tipo em `products`.** O módulo é
  puro; quem o chama vem depois.
- **A conversão sRGB→linear (ADR-007 D3).** É do motor de recolor, não do normalizador.
- Qualquer alteração no caminho SVG, que os ADRs preservam intocado.

## 3. Arquivos afetados

| Arquivo | O quê |
|---|---|
| `src/lib/render/normalizarModelo3d.ts` | **novo** — a função e o relatório |
| `src/lib/render/normalizarModelo3d.test.ts` | **novo** — co-locado, sem rede |
| `src/lib/render/nomeDeMalha.ts` | **novo** — a política de nome, análoga a `idDeElemento.ts` |
| `src/lib/render/nomeDeMalha.test.ts` | **novo** |
| `src/lib/render/fixtures/` | **novo(s)** — construtor de glTF mínimo para os testes |
| `src/lib/render/erros.ts` | dois códigos novos **acrescentados** à união; nenhum existente tocado |
| `api/_lib/falhaDaApi.ts` + teste | mapear os códigos novos — ver critério 12, é obrigatório |
| `src/lib/render/README.md` | índice do diretório ganha as linhas novas |
| `docs/03_REGRAS_DE_NEGOCIO/glossario.md` | uma linha: **modelo 3D canônico** (o termo não existe ainda) |

## 4. Critérios de aceite

Cada um responde sim/não depois do build.

1. **Nome preservado.** Nó com `name` que o modelador escreveu chega ao canônico com o mesmo
   nome, quando ele já é único e seguro.
2. **Nome cunhado.** Nó endereçável sem `name` (ou com `name` vazio) recebe `malha-N`, em
   ordem de documento, começando em 1. O contador **pula** nomes já ocupados, como
   `cunharIdsAusentes` faz hoje.
3. **Colisão desambiguada.** Dois nós com o mesmo `name` viram `nome` e `nome-2`, no mesmo
   padrão de sufixo que o projeto já usa (`primeiroLivre` em `idDeElemento.ts`).
4. **Nome seguro.** Nome com caractere que quebraria o armazenamento do seletor — vírgula em
   primeiro lugar, já que o seletor é **lista** de nomes — é convertido, e a troca aparece no
   relatório. Mesma política de `tornarSeguro`, adaptada.
5. **Material próprio (ADR-007 D5).** Se duas malhas endereçáveis referenciam o mesmo
   material, o canônico tem **um material por malha**. Verificável: nenhum índice de material
   aparece duas vezes entre as malhas endereçáveis.
6. **Malha compartilhada entre nós é separada.** Se dois nós referenciam o **mesmo** `mesh`,
   duplicar só o material não resolve — o material mora na *primitive* do mesh, não no nó.
   O canônico dá a cada nó endereçável o seu próprio `mesh`. **A duplicação não copia
   geometria**: o mesh novo reusa os mesmos `accessors`, mudando só o índice de material. O
   teste afirma que `buffers` e `accessors` não cresceram.
7. **Mesh com várias primitives.** Um mesh pode ter N primitives com N materiais. A unidade
   endereçável é o **nó**, não a primitive: pintar a zona pinta **todas** as primitives
   daquele nó. O teste cobre um nó com 2 primitives e afirma que as duas ficam com material
   próprio e que ambas são alcançadas pelo nome do nó.
8. **Idempotência.** `normalizarModelo3d(normalizarModelo3d(x).modelo)` devolve um modelo
   igual ao da primeira passada, e um relatório **vazio**. É o que prova que o canônico é
   ponto fixo — e é a asserção que pega um cunhador que renumera a cada passada.
9. **Recusa explícita, nunca conserto silencioso.** Arquivo que não é glTF 2.0 válido levanta
   `MODELO_3D_INVALIDO`. Arquivo válido que o normalizador não consegue tornar canônico
   levanta `MODELO_3D_NAO_NORMALIZAVEL`, com mensagem que **diz o que fazer** — no espírito da
   mensagem de `SVG_NAO_NORMALIZAVEL`, que ensina a exportar com Presentation Attributes.
   Nunca devolve um modelo meio-normalizado.
10. **URI externa é recusada.** `buffer` ou `image` com `uri` que não seja `data:` levanta
    `MODELO_3D_NAO_NORMALIZAVEL`. Mesmo raciocínio da referência externa em `normalizarSvg`:
    o arquivo do cliente não faz requisição para fora, e uma URI que some depois quebraria o
    produto em silêncio.
11. **Textura decidida, não ignorada.** Malha cuja cor base vem de `baseColorTexture` **não**
    pode virar cor chapa sem apagar o desenho — é o gêmeo tridimensional do
    `ZONA_NAO_RECOLORIVEL` do gradiente. O build decide entre recusar o arquivo ou marcar a
    malha como não-recolorível no relatório, **escreve a decisão no código com o porquê**, e
    testa o caso. O que não é aceitável é a textura passar sem ninguém perceber.
12. **Os códigos novos entram no transporte.** `api/_lib/falhaDaApi.ts` tem um teste que
    **enumera os `CodigoDeErro`** e falha se algum ficar sem status — então acrescentar dois
    códigos quebra esse teste até serem mapeados. Ambos vão para **409**, junto de
    `SVG_INVALIDO`/`SVG_NAO_NORMALIZAVEL`: são "dado do tenant", e a mensagem manda corrigir o
    modelo, nunca o pedido. Nenhum código existente muda de valor ou de status.
13. **Relatório completo.** A função devolve `{ modelo, relatorio }`, com o relatório contando
    nomes renomeados (de→para), nomes atribuídos, materiais duplicados e malhas duplicadas —
    espelhando `RelatorioDeNormalizacao`. É o que o provisionamento vai imprimir para quem
    subir uma peça.
14. **Verificado por mutação.** Teste que passa de primeira é suspeito. No mínimo três
    mutações no código de produção, cada uma restaurada com `git checkout --`, com o resultado
    registrado: (a) não duplicar material compartilhado; (b) cunhar nome sem checar colisão;
    (c) duplicar mesh copiando accessors em vez de reusá-los. Cada uma tem que matar teste.
15. `npx tsc --noEmit` limpo, `npx vitest run` sem regressão, `npm run test:banco` verde
    (nada aqui toca banco, mas a suíte não pode quebrar).

## 5. Edge cases conhecidos

- **Nó sem mesh** (nó só de transformação, junta de esqueleto, câmera, luz): **não** é
  endereçável, não ganha nome cunhado, e não entra no relatório. Cunhar nele gastaria números
  de `malha-N` e deslocaria os nomes dos nós reais — o mesmo defeito que o comentário de
  `cunharIdsAusentes` descreve para o SVG.
- **Mesh sem material** (glTF permite: usa o material padrão): precisa ganhar material próprio
  para ser pintável, senão a zona existe e não recebe cor.
- **Nó endereçável dentro de outro nó endereçável.** Em glTF a hierarquia é livre. Decidir e
  escrever: os dois são zonas independentes, ou o pai absorve o filho? (Em SVG o projeto já
  respondeu o análogo: a zona pinta o elemento marcado **e seus descendentes pintáveis**.)
- **`name` duplicado entre um nó e outro que só será cunhado depois** — a ordem entre
  desambiguar e cunhar importa, exatamente como em `normalizarSvg`, onde sanitizar vem antes
  de `aplicarPoliticaDeId` para que elemento removido não consuma um `elemento-N`.
- **glTF sem `scenes`/`nodes`**, arrays vazios, `meshes` ausente: recusa, não `undefined`
  vazando.
- **Extensão desconhecida em `extensionsRequired`**: o arquivo pede algo que não entendemos.
  Recusar é mais honesto que normalizar e entregar um modelo que renderiza errado.
- **Nome que já é `malha-3`** vindo do modelador, com um nó anônimo depois: o cunhador não
  pode reemitir `malha-3`.

## 6. Definição de "aprovado sem ressalvas"

Os 15 critérios em "sim"; `npx tsc --noEmit` limpo; `npx vitest run` e `npm run test:banco`
verdes; as três mutações do critério 14 executadas, cada uma matando teste, e todas
restauradas (`git status` limpo do que não é a entrega); nenhum `console.log` esquecido;
nenhum TODO sem justificativa escrita; e as decisões dos critérios 11 e do edge case da
hierarquia **escritas no código com o porquê**, não deixadas implícitas — porque um agente sem
memória da decisão as desfaz na sessão seguinte.

Se a rodada achar defeito de produto, ele vira linha em `memory/bugs.md` e correção no mesmo
commit — e o loop recomeça do `/review`.
