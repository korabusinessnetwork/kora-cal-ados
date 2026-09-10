# Acervo de prova gerado por código (T12)

> Regra de escrita: este arquivo não usa travessão, conforme a regra do dono. Vírgula, dois
> pontos ou parênteses no lugar.

## 0. De onde esta tarefa vem

O ADR-008 diz que o produto gerado se monta sobre um **acervo** de peças, e trata as ~15 peças
reais como o gargalo. A decisão 1 do dono (2026-09-10) resolveu o impasse de outro jeito:
**acervo de prova em geometria grosseira primeiro**, para provar a esteira de ponta a ponta
antes de investir em modelagem de verdade.

A releitura do projeto tornou a decisão mais barata do que o próprio dono aprovou. glTF é JSON,
e `src/lib/render/fixtures/gltfDeTeste.ts` já escreve glTF à mão. Geometria grosseira é caixa,
ou seja, lista de vértices que um script gera. Logo o acervo de prova **não precisa de Blender
nem de hora nenhuma do dono**: é código, versionado, testado e regenerável.

## 1. Escopo

Um módulo `src/lib/acervo/` que **gera por código** as 5 peças do acervo de prova (2 solas, 2
cabedais, 1 cadarço) de uma única forma, cada peça em glTF 2.0 válido, com nome próprio e
material próprio, mais o `CatalogoDoAcervo` correspondente para que `validarComposicao` monte
uma composição sobre elas.

## 2. Fora de escopo

- **three.js, palco 3D, montagem em cena.** São T13 e T14. Aqui não se desenha nada, produz-se
  texto glTF.
- **Juntar as 5 peças num documento glTF só.** Cada peça é um arquivo independente, como será
  no acervo de verdade. Fundir a cena é T14.
- **Cor nas peças.** O material da peça declara acabamento e nenhum campo de cor. Ver §7.
- **Banco, tabela de acervo, RLS.** T06 está adiada por decisão: o acervo de prova vive como
  código, não como linha.
- **Escrever os 5 arquivos em disco e versioná-los.** Ver a decisão em §7.
- **Modelagem que pareça um calçado.** Caixa é caixa de propósito. O que se prova aqui é a
  esteira, não a estética.
- **`npm audit fix`.** As 2 vulnerabilidades moderadas do `@vitest/mocker` são pré-existentes e
  não vieram desta tarefa. Consertá-las junto misturaria assuntos.

## 3. Arquivos afetados

### Novos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/acervo/README.md` | Índice do módulo, e por que ele é separado de `render/` e de `composicao/` |
| `src/lib/acervo/geometriaDeCaixa.ts` | Puro e sem glTF: dimensões em metros viram posições, normais, índices e o `min`/`max` do POSITION |
| `src/lib/acervo/montarGltfDePeca.ts` | Descrição de peça mais valores de parâmetro viram o texto glTF 2.0, com o buffer binário em `data:` URI |
| `src/lib/acervo/acervoDeProva.ts` | As 5 peças descritas, o `catalogoDeProva()` e o `gltfDaPecaDeProva()` |
| `src/lib/acervo/geometriaDeCaixa.test.ts` | |
| `src/lib/acervo/montarGltfDePeca.test.ts` | |
| `src/lib/acervo/acervoDeProva.test.ts` | Inclui a checagem contra o validador de referência da Khronos |

### Modificados

| Arquivo | Mudança |
|---|---|
| `package.json` | devDependency `gltf-validator` (validador de referência da Khronos, gratuito) |
| `src/lib/composicao/README.md` | Uma linha ligando o catálogo de prova ao módulo novo |
| `.full-auto/ESTADO.md`, `.full-auto/TAREFAS.md` | Estado da máquina do Full Automático |

## 4. Critérios de aceite

### O glTF é válido de verdade, e não pela minha própria régua

1. As 5 peças passam pelo **validador de referência da Khronos** (`gltf-validator`) com
   `numErrors === 0` **e** `numWarnings === 0`. Este é o critério central, e é externo de
   propósito: um validador escrito por mim declarando válidos arquivos escritos por mim não
   prova nada.
2. O teste do critério 1 percorre **todas** as peças do catálogo, derivando a lista de
   `catalogoDeProva()`, nunca de uma lista repetida no teste. Peça nova no acervo entra no
   teste sozinha.
3. O buffer sai como `data:application/octet-stream;base64,...`, sem nenhuma URI externa, que é
   o que `normalizarModelo3d` exige para não recusar.
4. O accessor de POSITION traz `min` e `max` (obrigatórios pela especificação glTF 2.0) e eles
   batem com os vértices realmente escritos no buffer, **na precisão em que serão gravados**.

   > Correção feita na revisão. A redação original dizia que "o critério 1 já o cobre", e a
   > mutação (b) mostrou que não: retirar o arredondamento para float32 matou 4 testes nossos e
   > o validador da Khronos **passou mesmo assim**, porque ele tolera um epsilon ao comparar
   > `min`/`max` de accessor de float. O critério 4 é sustentado por teste nosso, não pelo
   > validador. Registrado porque um critério que se acredita coberto por outro é um critério
   > descoberto sem ninguém saber.

5. Cada `bufferView` declara `target` (`34962` para vértice, `34963` para índice), verificado
   por **teste próprio**. O validador da Khronos classifica a ausência como Informação e não
   como erro ou aviso, então o critério 1 não a pegaria. Pelo mesmo motivo do critério 4.

### As peças já nascem canônicas

6. `normalizarModelo3d(gltf)` **aceita** as 5 peças, sem lançar.
7. Para as 5, o relatório de normalização volta **todo zerado** nos campos de mudança
   (`nomesRenomeados`, `nomesAtribuidos`, `malhasDuplicadas`, `materiaisDuplicados`,
   `materiaisCriados` todos vazios ou 0). Ou seja, a peça já sai do gerador obedecendo ADR-007
   D4 e D5, e a normalização é um no-op sobre ela.
8. `normalizarModelo3d(gltf).modelo` reanalisado é **equivalente** ao documento de entrada
   (mesma estrutura depois de `JSON.parse` nos dois lados). É o gêmeo do canário
   `normalizarSvg(baixado) === baixado` do teste de integração.
9. `malhasNaoRecoloriveis` volta **vazio** para as 5: nenhuma peça de prova usa textura, então
   todas são recoloríveis.
10. O nome do nó de cada peça é exatamente o **id da peça** no catálogo, e passa na política de
    `nomeDeMalha` sem ser alterado (sem espaço, sem vírgula, sem acento).

### O catálogo casa com as peças

11. `catalogoDeProva()` devolve um `CatalogoDoAcervo` com **uma** forma e **5** peças: 2 de
    categoria `sola`, 2 de `cabedal`, 1 de `cadarco`.
12. Toda peça do catálogo tem `forma_id` igual ao id da única forma. Um teste afirma isso
    percorrendo o catálogo, não por inspeção visual.
13. Toda peça do catálogo tem uma geometria correspondente: `gltfDaPecaDeProva(id)` funciona
    para os 5 ids e **lança** para um id que não está no catálogo. Um teste percorre o catálogo
    inteiro, então peça declarada sem geometria reprova.
14. As categorias declaradas na forma são exatamente as categorias que as peças ocupam: nenhuma
    categoria da forma fica sem peça, e nenhuma peça ocupa categoria que a forma não declara.
15. `validarComposicao` aceita uma composição montada sobre `catalogoDeProva()` escolhendo uma
    sola, um cabedal e um cadarço, e devolve as 3 peças validadas.
16. `validarComposicao` **recusa** com `PECA_NAO_ENCONTRADA` uma composição que peça uma peça
    inexistente sobre este catálogo, e com o código de categoria obrigatória ausente uma que
    omita a sola. É a prova de que o catálogo de prova exercita o guarda de verdade, e não só o
    caminho feliz.

### O parâmetro é transformação, nunca malha nova (ADR-008 D7)

17. `gltfDaPecaDeProva(id, { espessura: X })` produz um nó cujo `scale` muda com `X`, e é o
    **único** campo que muda.
18. Para dois valores diferentes de `espessura` na mesma peça, os `accessors`, `bufferViews` e
    `buffers` saem **idênticos byte a byte**. Este é o critério que torna "transformação e nunca
    malha nova" verificável em vez de ser só uma frase do ADR.
19. Parâmetro fora da faixa declarada no catálogo **não** é problema deste módulo: quem recusa é
    `validarComposicao`. O gerador recebe o valor já validado. Um comentário no código diz isso,
    para ninguém adicionar uma segunda validação que possa divergir da primeira.
20. Sem parâmetro nenhum, a peça sai no valor `padrao` declarado no catálogo, e o `scale`
    resultante é `[1, 1, 1]`. Ou seja, o padrão é o tamanho em que a peça foi modelada.

### Higiene do projeto

21. `npm test` verde, `npm run typecheck` limpo.
22. Nenhum arquivo novo importa `hexParaLinear` nem repete as constantes da curva sRGB, e
    `soUmLugarEscreveCorNoGltf.test.ts` continua verde.
23. `src/lib/acervo/README.md` existe e indexa cada arquivo do módulo, como o CLAUDE.md exige de
    todo diretório novo.
24. Sem `console.log`, sem TODO sem justificativa.

## 5. Edge cases conhecidos

- **`min`/`max` com dimensão zero.** Uma caixa achatada (o cadarço é fino) tem extensão pequena
  mas nunca nula. Se alguma dimensão fosse 0, o `min` e o `max` daquele eixo coincidiriam, o que
  é válido em glTF mas produz uma malha degenerada. As dimensões escolhidas são todas positivas,
  e um teste afirma que `max > min` nos três eixos de todas as peças.
- **Alinhamento de bytes.** O `byteOffset` de um accessor precisa ser múltiplo do tamanho do
  componente. POSITION e NORMAL são float (4 bytes), os índices são `unsigned short` (2 bytes).
  O layout precisa acomodar isso, e o validador da Khronos reprova se não acomodar.
- **Base da caixa na origem.** A geometria nasce com o **centro da base** na origem, não o
  centro do volume. É o que faz escalar a espessura crescer para cima em vez de afundar a peça
  na sola. Sem essa escolha, o parâmetro de espessura moveria a peça enquanto a engrossa.
- **Índice de 16 bits.** Uma caixa tem 24 vértices, então `unsigned short` sobra. Se algum dia
  uma peça de prova passar de 65535 vértices, o tipo de índice precisa mudar. O gerador afirma
  isso com uma recusa explícita em vez de gerar um arquivo silenciosamente errado.
- **Peça no catálogo sem geometria.** É o defeito mais provável deste módulo: alguém adiciona a
  peça na lista do catálogo e esquece a caixa. O critério 13 existe para isso.

## 6. Definição de "aprovado sem ressalvas"

Todos os 24 critérios respondidos "sim" com evidência de linha, o validador de referência da
Khronos reportando zero erro e zero aviso nas 5 peças, `npm test` e `npm run typecheck` verdes,
e pelo menos 3 mutações deliberadas no código novo matando teste (o padrão de verificação deste
projeto: teste que passa de primeira é suspeito até uma quebra proposital reprová-lo).

## 7. Decisões tomadas nesta spec

### Por que as peças não têm cor, nem mesmo o branco

O material de cada peça declara só o **acabamento** (`metallicFactor: 0`, `roughnessFactor: 0.9`)
e nenhum campo de cor.

O motivo arquitetural: **cor não é da peça, é da composição**. O sistema guarda receita e nunca
resultado (ADR-004, ADR-008 D2). Peça pintada seria resultado gravado, e a mesma sola em duas
marcas concorrentes teria que existir duas vezes no acervo. A cor chega pelo `recolorirModelo3d`,
no mesmo caminho do produto trazido.

> Ajustado na revisão. A spec original mandava escrever o branco explícito `[1, 1, 1, 1]`, que é
> o padrão do glTF 2.0 e daria no mesmo na tela. Quando o build rodou, o arame de tropeço
> `soUmLugarEscreveCorNoGltf.test.ts` disparou: ele proíbe qualquer arquivo de produção fora do
> recolor de escrever `baseColorFactor`, e teria sido preciso adicionar o gerador à lista de
> licença. Adicionar enfraqueceria a guarda para sempre (trocar a constante por uma cor de
> verdade passaria calada). Omitir o campo mantém o invariante literal. O desenho mudou, e a
> guarda ficou de pé: é para isso que ela existe.

### Por que os 5 arquivos não vão para o disco

O gerador é a fonte de verdade, e o texto glTF é produzido sob demanda. Versionar os 5 arquivos
criaria uma segunda fonte de verdade que pode divergir do gerador, e o projeto já pagou esse
preço em outro lugar para saber que não vale.

O consumidor no navegador (T13) não perde nada: `GLTFLoader.parse(texto)` recebe o texto direto,
que é a mesma chamada que o produto trazido usará depois de baixar o arquivo do Storage.

Se algum dia for preciso abrir uma peça num visualizador externo, um script de despejo é meia
dúzia de linhas e escreve numa pasta ignorada pelo git. Não entra agora porque ninguém pediu.

### Por que um módulo novo, e não dentro de `render/`

`src/lib/render/` transforma um asset-base em variante. O acervo **produz** asset-base, que é a
etapa anterior. Misturar as duas colocaria um gerador de conteúdo dentro do motor que só deveria
consumir conteúdo, e o README de `render/` teria que passar a mentir sobre o que vive lá.

Também não vai em `composicao/`, porque aquele módulo é o guarda que compara identificadores e
**nunca carrega geometria**, coisa que o README dele afirma. Aqui é o oposto: só geometria.

---

## 8. Resultado da revisão, 2026-09-10

**Veredito: aprovado sem ressalvas.** 24 de 24 critérios em "sim". Suíte inteira em 787 verdes
(era 699 antes desta entrega), `tsc --noEmit` limpo, 93 testes no módulo novo.

### Critério a critério

| # | Resposta | Evidência |
|---|---|---|
| 1 | sim | `acervoDeProva.test.ts`, bloco "as 5 peças são glTF 2.0 válido pelo validador de referência da Khronos": `expect(issues.numErrors).toBe(0)` e `numWarnings` idem, 5 peças no padrão e 5 no extremo da faixa |
| 2 | sim | `const IDS = CATALOGO.pecas.map(({ id }) => id)` e `it.each(IDS)`. Nenhuma lista repetida |
| 3 | sim | `montarGltfDePeca.ts`, o campo `uri` com `data:application/octet-stream;base64,`; teste "o buffer vem embutido em data: URI" |
| 4 | sim | `geometriaDeCaixa.ts`, `arredondarParaFloat32`; teste "toda posição já está na precisão de float32". **Não** coberto pelo validador, ver a nota no critério |
| 5 | sim | `target: ARRAY_BUFFER` / `ELEMENT_ARRAY_BUFFER`; teste "cada bufferView declara para que serve" |
| 6 | sim | `it.each(IDS)('%s é aceita por normalizarModelo3d')` |
| 7 | sim | `it.each(IDS)('%s não tem nada para a normalização mudar')`, os 5 campos de mudança conferidos |
| 8 | sim | `it.each(IDS)('%s sai da normalização igual a como entrou')` |
| 9 | sim | `it.each(IDS)('%s é recolorível, ou seja, não usa textura')` |
| 10 | sim | `it.each(IDS)('%s tem o próprio id como nome de malha...')`, com `nomesRenomeados` vazio |
| 11 | sim | Testes "tem uma forma só..." e "tem 5 peças: 2 solas, 2 cabedais e 1 cadarço" |
| 12 | sim | Teste "toda peça pertence à única forma", percorrendo o catálogo |
| 13 | sim | Testes "gera glTF para todo id que o catálogo declara" e "recusa id que não está no acervo" |
| 14 | sim | Testes "nenhuma categoria da forma fica sem peça" e "nenhuma peça ocupa categoria que a forma não declara" |
| 15 | sim | Teste "aceita uma composição completa e devolve as 3 peças do catálogo" |
| 16 | sim | Testes de recusa com `PECA_NAO_ENCONTRADA` e `COMPOSICAO_INVALIDA` (ausente e repetida) |
| 17 | sim | Teste "o parâmetro escala o eixo Y na proporção do padrão" |
| 18 | sim | Teste "dois valores de parâmetro produzem a MESMA geometria, byte a byte" |
| 19 | sim | Comentário em `montarGltfDePeca`, "**Este módulo não valida parâmetro**"; teste "recusa parâmetro fora da faixa, e é ELE quem recusa, não o gerador" |
| 20 | sim | Teste "sem parâmetro, a peça sai no tamanho em que foi modelada" |
| 21 | sim | `npm test` 787 verdes, `npm run typecheck` limpo |
| 22 | sim | Nenhum `hexParaLinear` e nenhuma constante da curva nos arquivos novos; `soUmLugarEscreveCorNoGltf.test.ts` verde depois da mudança de desenho descrita em §7 |
| 23 | sim | `src/lib/acervo/README.md` |
| 24 | sim | `grep -rn "console.log\|TODO" src/lib/acervo/` não devolve nada |

### As mutações

Seis quebras propositais, seis mortas. A definição de aprovado exigia três.

| # | Mutação | Testes mortos | O que ela ensinou |
|---|---|---|---|
| a | Inverter o sentido de enrolamento dos triângulos | 1 | O teste de face virada é o único guarda disso. O validador da Khronos não pega, e não tem como pegar: ele não sabe qual lado é fora |
| b | Tirar o arredondamento para float32 | 4 | **Achado.** O validador da Khronos **passou mesmo assim**, porque tolera um epsilon em `min`/`max` de float. A spec afirmava que o critério 1 cobria o 4. Não cobre. Corrigido no critério 4 |
| c | Remodelar a caixa em vez de escalar o nó | 3 | O ADR-008 D7 tem guarda de verdade: violar "transformação, nunca malha nova" reprova |
| d | Gravar o buffer em big-endian | 11 | Os 10 testes do validador morreram junto, o que prova que ele decodifica o binário de verdade e não só lê o JSON |
| e | Tirar o `name` do nó | 17 | "A peça nasce canônica" é a afirmação mais amarrada do módulo. Sem nome, a normalização cunha `malha-1` e o endereço da zona muda |
| f | Tirar o `target` dos bufferViews | 1 | O teste que eu **acrescentei durante a revisão**, ao perceber que a ausência de `target` é Informação e não erro para o validador. Sem ele, o critério 5 estaria descoberto |

### Desvios da spec, e por quê

1. **A peça deixou de escrever o branco explícito.** A spec mandava
   `baseColorFactor: [1, 1, 1, 1]`. O arame de tropeço `soUmLugarEscreveCorNoGltf.test.ts`
   disparou no build e a resposta certa foi mudar o desenho, não pedir licença. Detalhe em §7.
2. **`recusarSeIndiceNaoCabe` virou função exportada.** A spec previa a guarda embutida. A
   primeira versão do teste dela conferia o texto-fonte da função, que é teste de fachada.
   Extrair a guarda tornou possível testá-la de verdade, com 65535 e 65536.
3. **Um teste meu estava errado, não o código.** "A caixa tem exatamente as dimensões pedidas"
   pedia 9 casas decimais e reprovava por 1,2e-9, que é a precisão do float32 em 0,28. Trocado
   por igualdade exata contra `arredondarParaFloat32`, o que é mais forte e não mais fraco.

### O que esta entrega NÃO prova, e fica dito

- Que uma peça modelada em Blender de verdade normaliza sem recusa. Caixa é caixa.
- Que a peça **aparece** na tela. Só T13, em navegador de verdade, responde isso, e o princípio
  nº1 exige conferência a olho.
- Que a montagem das 5 peças numa cena só funciona. É T14, e é onde o `assento` de cada peça
  passa a ter que conversar com a espessura escolhida para a sola.
