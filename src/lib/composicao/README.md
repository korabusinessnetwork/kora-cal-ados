# src/lib/composicao — o modo gerado

O que vive aqui: a **composição** (ADR-008 D2), que é o que define um calçado gerado — quais
peças do acervo, em que cor, com que parâmetros. É JSON de algumas linhas, nunca um arquivo 3D.

O que **não** vive aqui: geometria, three.js, palco, acesso ao Supabase, HTTP, UI, e a chamada
de rede a um modelo de linguagem (o modelo entra por parâmetro, ver `gerarComposicaoPorPrompt.ts`). Este módulo é puro: recebe dado, devolve dado, e não sabe o que é um
glTF.

| Arquivo | Papel | Entrada → saída |
|---|---|---|
| `validarComposicao.ts` | O guarda do ADR-008 D1: resolve a composição contra o acervo ou recusa | composição (não confiável) + catálogo → composição validada |
| `empilharComposicao.ts` | De quanto cada peça sobe para assentar sobre a de baixo (T14) | forma + faixa vertical de cada peça → deslocamento por categoria |
| `montarComposicao.ts` | A orquestração de T14: mede, empilha, desloca, junta e pinta, nessa ordem | composição validada + provedor de glTF → um glTF só, já colorido |
| `montarCatalogoParaModelo.ts` | O catálogo para o modelo (T05): só as peças da forma, com id, categoria, rótulo e faixa, em JSON | forma + catálogo → texto que o modelo de linguagem lê |
| `gerarComposicaoPorPrompt.ts` | Prompt vira composição (T09): confere o prompt, chama o modelo de linguagem injetado e passa a resposta pelo guarda. Define `ModeloDeLinguagem` | prompt + forma + catálogo + modelo → composição validada |
| `lerRespostaDoModelo.ts` | Tira o JSON do texto que o modelo respondeu, sem conferir a composição | texto → `unknown` |
| `modeloDeLinguagemDeProva.ts` | O gerador de prova (D12): modelo de linguagem falso, sem IA e sem rede, que entende palavras-chave e só escolhe peças do catálogo que recebeu | pedido ao modelo → texto de composição |
| `tiposDaComposicao.ts` | O vocabulário do modo gerado em tipos. Nenhum comportamento | — |
| `fixtures/acervoDeTeste.ts` | Catálogo escrito à mão, com duas formas. O gêmeo de `render/fixtures/gltfDeTeste.ts` | — |

## O catálogo que existe fora dos testes

`fixtures/acervoDeTeste.ts` serve aos testes deste módulo e tem duas formas, porque uma só não
provaria `FORMAS_MISTURADAS`. Ele não é acervo, é fixture.

O acervo de prova de verdade mora em `src/lib/acervo/`, gerado por código e com glTF real por
trás de cada peça. `catalogoDeProva()` devolve um `CatalogoDoAcervo` que este guarda consome do
mesmo jeito, e é sobre ele que T13, T14 e T15 são construídos.

## Por que este módulo existe separado do motor de render

`src/lib/render/` transforma um **arquivo** em outro arquivo. Aqui não há arquivo: a composição
é uma receita, e o 3D é montado a partir dela no navegador. São dois estágios diferentes do
mesmo produto, e o glossário os separa (`docs/03_REGRAS_DE_NEGOCIO/glossario.md`).

O que os dois dividem é o vocabulário de erro: `ErroDeVariante` e os códigos de
`src/lib/render/erros.ts`, para que a API traduza tudo por **uma tabela só**. Uma segunda
classe de erro obrigaria todo ponto de captura a conhecer as duas.

## A entrada aqui não é como as outras entradas do projeto

`normalizarSvg` e `normalizarModelo3d` conferem um arquivo que um cliente subiu. Uma composição
pode ter sido escrita por um **modelo de linguagem**, que é o único componente do sistema em que
não se pode confiar por construção. O ADR-008 escreve isso nas consequências negativas: "um
prompt é entrada de usuário, e a resposta do modelo vira escolha de arquivo. A validação de D1 é
o que separa isso de uma vulnerabilidade; ela não é opcional e não é tratamento de erro".

Duas regras saem daí, e elas mandam no desenho inteiro:

1. **Pertencimento, nunca formato.** Um id é válido porque **está** no catálogo, jamais porque
   se parece com um id. `sola-corrida-04` é sintaticamente impecável e é recusado se não
   existir — e ids plausíveis são justamente o modo de falha esperado de um modelo de linguagem.
2. **A saída carrega a peça do catálogo, não o id da entrada.** Quem recebe uma
   `ComposicaoValidada` não tem em mãos a string que o modelo escreveu, então não tem como
   transformá-la em caminho de arquivo. O guarda não confere e devolve: ele **troca**.

## Por que `pecas` é uma lista e não um objeto por categoria

Um `Record<categoria, escolha>` seria mais curto de escrever e tornaria "sola duas vezes"
**indetectável**: `JSON.parse` descarta a chave duplicada em silêncio e fica com a última. Seria
a última chave do JSON decidindo o calçado sozinha, sem erro e com 200 na resposta — o BUG-013
por um terceiro caminho, depois do `fill` do SVG e do material compartilhado do glTF.

Em lista, a repetição é visível e vira `COMPOSICAO_INVALIDA`.

## A categoria de peça É a `zone_key`

No produto gerado cada peça é uma zona (ADR-008 D3), e a categoria da peça é o texto da
`zone_key` daquela zona. Não é analogia: é o mesmo texto, no mesmo campo público. Daí duas
consequências que estão no código e não em convenção:

- a categoria passa por `validarZoneKey`, o mesmo validador do produto trazido;
- `validarCor(valor, zoneKey)` é chamado com a categoria, e a mensagem sai correta por
  construção, não por coincidência.

## O que faz a validação recusar

| Código | Quando |
|---|---|
| `PECA_NAO_ENCONTRADA` | O id não está no catálogo visível |
| `COMPOSICAO_INVALIDA` | Estrutura errada, forma desconhecida, categoria obrigatória ausente, categoria repetida, peça de categoria que a forma não prevê |
| `FORMAS_MISTURADAS` | A peça existe, mas é de outra forma (ADR-008 D4) |
| `PARAMETRO_INVALIDO` | Fora da faixa, não numérico, ou não declarado pela peça |
| `COR_INVALIDA` / `ZONE_KEY_INVALIDA` | Vindos dos validadores do motor, sem reimplementação |

Todos são 422 na API — a composição vem no corpo do pedido, então quem corrige é quem enviou.
A tabela mora em `docs/07_APIS/endpoints.md`.

## O empilhamento lê a geometria, nunca uma altura declarada

`empilharComposicao` responde uma pergunta só: de quanto cada peça precisa subir para assentar
sobre a de baixo. Ela existe porque o `assento` que cada peça do acervo carrega é o lugar dela no
calçado **padrão**: escolher uma sola mais grossa afunda o cabedal dentro dela, escolher uma mais
fina o deixa flutuando, e nenhum dos dois dá erro. Os dois só ficam errados na tela.

Duas propriedades do desenho merecem ficar escritas:

- **Ela não conhece glTF.** Recebe a faixa vertical (base e topo) de cada peça e devolve números.
  Quem mede é `medidaDoModelo3d` e quem aplica é `deslocarModelo3d`, os dois em `../render/`.
  É o que torna a regra testável sem montar modelo 3D nenhum.
- **A altura vem da malha, não de um campo.** Uma peça cujo campo de altura discorde da própria
  malha existiria; uma peça cuja malha discorde dela mesma, não. É a mesma escolha do BUG-013:
  campo redundante que pode divergir é a família de defeito que este projeto persegue.

Quem assenta sobre quem é a **forma** que declara, em `assenta_sobre` (ADR-008 D4). Campo
opcional: categoria sem ele mantém o assento em que foi modelada, então uma forma que ainda não
declarou anatomia continua montando exatamente como antes.

## Limites conhecidos

- **Acervo malformado não tem código próprio.** Faixa invertida (`minimo > maximo`) e id de
  peça repetido no catálogo são defeito **nosso**, não do pedido. Hoje o primeiro vira
  `PARAMETRO_INVALIDO` com mensagem dizendo que o acervo precisa de correção, e o segundo não
  recusa nada (o primeiro id vence), para não deixar o designer sem saída por causa de uma
  linha duplicada no nosso banco. Se o acervo crescer, isto merece validação própria, no
  cadastro da peça e não no pedido.
- **A lista de categorias vem da forma**, e não há lista fixa no código: chinelo não tem
  cadarço, e uma lista fixa transformaria isso em recusa permanente.
- Os parâmetros são **validados** aqui e **aplicados** no palco (ADR-008 D7). Enquanto o palco
  não existir, nada consome os números — e é por isso que a faixa é conferida aqui, onde há
  quem recuse, e não lá, onde só haveria o que desenhar.

## A ordem da montagem não é livre

`montarComposicao` faz cinco coisas, e a ordem entre elas é a única regra que mora no arquivo:

1. **pede o glTF de cada peça** ao provedor, com os parâmetros já completos;
2. **mede** cada uma (`medidaDoModelo3d`);
3. **empilha** (`empilharComposicao`), que só olha números;
4. **desloca** cada peça (`deslocarModelo3d`) e **junta** as N num documento só (`juntarModelos3d`);
5. **pinta uma vez**, no calçado inteiro (`recolorirModelo3d`).

Medir vem antes de deslocar porque o deslocamento é calculado sobre onde a peça foi modelada:
medir depois mediria o resultado do próprio deslocamento e a pilha se acumularia sozinha. Pintar
vem depois de juntar por três razões, em ordem de peso: é **uma** chamada ao mesmo motor que a API
chama; a sobreposição de zonas só é detectável olhando o modelo inteiro; e a `zone_key` de uma zona
é a **categoria**, que só faz sentido no calçado, não dentro de uma peça solta.

O provedor de glTF entra por parâmetro e não por `import`. Hoje a única fonte é o acervo de prova,
que é código; amanhã é o storage do tenant, que é rede. Amarrar a montagem a uma delas obrigaria a
reescrever este arquivo na virada, e faria o módulo de composição importar dados de prova para
sempre.

## O nanômetro que a geometria carrega

A geometria de um glTF é float32, e o `min`/`max` do acessor também. Medir a sola de 18 mm devolve
`0,017999999225`, e o empilhamento leva essa diferença para cima: as peças de um calçado montado
ficam a um **nanômetro** do lugar exato. Arredondar dentro da montagem para esconder isso
inventaria precisão que o arquivo não tem. Quem compara posição em teste compara em micrômetros,
que é folgado em relação ao float32 e fino demais para alguém enxergar.
