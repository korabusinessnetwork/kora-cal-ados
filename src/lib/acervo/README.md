# src/lib/acervo, o acervo de prova

> Regra de escrita: sem travessão. Vírgula, dois pontos ou parênteses no lugar.

O que vive aqui: **gerar peças de calçado em glTF 2.0 por código**, em geometria grosseira, para
provar a esteira do produto gerado (ADR-008) sem depender de modelagem em Blender.

O que **não** vive aqui: three.js, palco, montagem em cena, banco, cor. Este módulo produz texto
glTF e mais nada.

| Arquivo | Papel | Entrada → saída |
|---|---|---|
| `geometriaDeCaixa.ts` | A geometria grosseira, sem conhecer glTF: 24 vértices, 6 normais, 36 índices e o `min`/`max` do POSITION | dimensões em metros → listas de números |
| `malhaDePeca.ts` | As contas que toda geometria faz do mesmo jeito: arredondar para float32, normais por área, `min`/`max` das posições gravadas, juntar e transladar partes | malha crua → malha de peça |
| `interpolacaoMonotona.ts` | Curva suave pelos pontos de controle que não passa do valor deles (Fritsch e Carlson), para os perfis do calçado | pontos de controle → função |
| `contornoDoPe.ts` | O **contorno do pé** por **estações**: meia largura do lado de dentro e do lado de fora, pontas em zero exato | comprimento, largura, estações → estações |
| `extrusaoDoContorno.ts` | Pilha de contornos vira sólido fechado: tampas com vértices próprios (quina) e parede com vértices compartilhados (lisa) | níveis → malha crua |
| `geometriaDeSola.ts` | A sola: contorno do pé extrudado com bisel e barriga na lateral, e **cravos** opcionais dentro da espessura | medidas da sola → malha de peça |
| `perfilDoCabedal.ts` | A **crista** do cabedal estação por estação: o cano (que muda entre cabedal baixo e cano alto) e o **peito do pé** (igual nos dois), com o ponto mais alto resolvido para ser exatamente a altura pedida | posições, alcance, alturas, cano → cristas em metros |
| `geometriaDeCabedal.ts` | O cabedal: casca em arco de superelipse sobre o contorno do pé, aberta embaixo e na **boca** | medidas do cabedal → malha de peça |
| `cabedalSobreSola.test.ts` | Confere cabedal contra sola **lidos do glTF gravado**: base no plano do topo da sola, contorno dentro do topo dela, dupla face só nos cabedais | - |
| `montarGltfDePeca.ts` | Chama o modelador da peça (`modelar`, caixa quando ausente) e embrulha a geometria num glTF 2.0 com buffer em `data:` URI, nó/malha/material próprios (dupla face quando `materialDeDuplaFace`), e aplica o parâmetro como escala | descrição de peça + parâmetros → texto glTF |
| `acervoDeProva.ts` | As 5 peças descritas, o `catalogoDeProva()` que `validarComposicao` consome e o `gltfDaPecaDeProva()` | id de peça → texto glTF |
| `acervoDeProva.ts` (cont.) | `composicaoDeProva()` devolve `unknown`, de propósito: a demo entra por `validarComposicao` pelo mesmo portão que a saída de um modelo de linguagem | - |
| `gltfValidator.d.ts` | Tipos do validador de referência da Khronos, que é compilado de Dart e não traz os próprios | - |

## Por que um módulo separado

`src/lib/render/` **transforma** um asset-base em variante. O acervo **produz** asset-base, que
é a etapa anterior. Um gerador de conteúdo dentro do motor faria o README de `render/` passar a
mentir sobre o que vive lá.

Também não vai em `src/lib/composicao/`, porque aquele módulo compara identificadores e nunca
carrega geometria, coisa que o README dele afirma. Aqui é o oposto: só geometria.

## Da caixa para o tênis (Fase G)

A caixa provou a esteira. O passo seguinte (spec `specs/acervo-com-cara-de-tenis.md`) é o
calçado **parecer um tênis**, ainda por código: as solas já são o contorno do pé extrudado, a
sola tratorada tem cravos, e os dois cabedais são cascas com boca aberta sobre o mesmo peito do
pé. O contrato não muda: um nó, uma malha, um material sem cor, base em Y = 0, parâmetro como
escala em Y e geometria idêntica byte a byte entre dois valores.

O cabedal é a única peça com material de dupla face (`doubleSided`), porque é a única aberta: pela
boca se vê o lado de dentro dele. Peça fechada continua de face única, que é o que deixa uma face
do avesso sumir da tela e ser notada.

A caixa continua sendo o modelador padrão de `montarGltfDePeca`, de propósito: é a peça mais
simples que exercita buffer, accessor, validador e normalização, e os testes daquele arquivo
usam ela. Defeito de geometria aparece nos testes da geometria; defeito de buffer, lá.

## Por que caixa, e por que isso basta

A decisão do dono (2026-09-10) foi provar a esteira com combustível grosseiro antes de investir
nas ~15 peças reais que o ADR-008 trata como gargalo. Caixa é o menor sólido fechado que dá para
ver girando na tela e clicar para identificar, que é exatamente o que T13 precisa provar.

O que a caixa **não** prova: que uma sola de verdade normaliza sem recusa, que um exportador de
Blender produz nomes limpos, que a contagem de vértices real cabe onde precisa. Essas perguntas
esperam o acervo de verdade, e não são o que esta fase existe para responder.

## Nenhum arquivo em disco

O gerador é a fonte de verdade e o texto glTF sai sob demanda. Versionar os 5 arquivos criaria
uma segunda fonte de verdade capaz de divergir do gerador.

O consumidor no navegador não perde nada: `GLTFLoader.parse(texto)` recebe o texto direto, que é
a mesma chamada que o produto trazido usa depois de baixar o arquivo do Storage.

## A peça já nasce canônica

`normalizarModelo3d` sobre qualquer peça de prova é um **no-op**: relatório todo zerado, e o
documento sai igual a como entrou. Isso é testado peça a peça.

Não é detalhe de eficiência, é o que faz o acervo de prova imitar o acervo de verdade. Uma peça
que precisasse ser normalizada seria uma peça que ainda não é canônica, e T13 e T14 estariam
sendo construídos sobre uma premissa falsa.

## A peça não carrega cor nenhuma, nem o branco

O material da peça declara o **acabamento** (fosco, não metálico), que é propriedade física da
superfície e não muda com a variante. Ele **não** declara `baseColorFactor`. Cor é da composição,
não da peça: o sistema guarda receita e nunca resultado (ADR-004, ADR-008 D2), e peça pintada
obrigaria a mesma sola a existir duas vezes no acervo para duas marcas que a querem em cores
diferentes.

Escrever o branco explícito `[1, 1, 1, 1]` daria exatamente no mesmo na tela, porque é o padrão
do glTF 2.0. O custo estaria em outro lugar: `montarGltfDePeca.ts` teria que entrar na lista de
licença de `soUmLugarEscreveCorNoGltf.test.ts`, e a partir dali trocar aquela constante por uma
cor de verdade passaria calada. Omitir o campo mantém "só o recolor escreve cor no glTF"
literalmente verdadeiro, em vez de verdadeiro com uma exceção.

Isto foi descoberto na revisão, não planejado: o arame de tropeço disparou quando o arquivo novo
apareceu, e a resposta certa era mudar o desenho, não pedir licença.

## O parâmetro é escala, nunca malha nova

ADR-008 D7 diz que variação paramétrica é transformação. Aqui isso é verificável, não uma
promessa: gerar a mesma peça com dois valores de espessura produz `accessors`, `bufferViews` e
`buffers` **idênticos byte a byte**, e o único campo diferente no documento inteiro é o `scale`
do nó. O teste que afirma isso é o que impede alguém de "melhorar" o gerador remodelando a caixa
e transformar o acervo num kit de montar com uma peça por milímetro.

A caixa nasce com o **centro da base na origem**, não o centro do volume, para que escalar faça
a peça crescer para cima a partir de onde ela assenta. Com o centro do volume na origem,
engrossar uma sola a afundaria meio milímetro no chão a cada milímetro de espessura.

## Quem valida o glTF não somos nós

O critério de aceite é o **validador de referência da Khronos** (`gltf-validator`, devDependency
gratuita), rodando sobre as 5 peças e exigindo zero erro e zero aviso. Ele decodifica o buffer e
confere `min`/`max` contra os vértices de verdade, o alinhamento de `byteOffset`, a contagem dos
accessors e o alcance dos índices.

Um validador escrito por nós declarando válidos arquivos escritos por nós não provaria nada.

## O que este módulo NÃO valida

Parâmetro fora da faixa **não** é recusado aqui. Quem recusa é `validarComposicao`, e ter uma
segunda validação da mesma regra em outro arquivo é a família de defeito que este projeto
persegue desde o BUG-013: duas regras que podem divergir.

O que chega aqui já passou pelo guarda. O que não passou pelo guarda não deveria estar chamando
estas funções, e por isso o id desconhecido levanta `Error` cru e não `PECA_NAO_ENCONTRADA`:
aquele código é contrato de API para a saída do modelo de linguagem, e chegar aqui com id
inventado é defeito nosso, não pedido malformado de cliente.

## Referências

- `docs/08_DECISOES/adr-008-calcado-gerado-sobre-acervo-de-pecas.md`, D1 (o acervo), D2
  (composição é receita), D4 (forma) e D7 (variação paramétrica)
- `docs/08_DECISOES/adr-007-calcado-3d-manipulavel.md`, D4 (nome próprio) e D5 (material próprio)
- `specs/acervo-de-prova.md`, os 24 critérios de aceite desta entrega
- `src/lib/composicao/README.md`, o guarda que consome `catalogoDeProva()`
