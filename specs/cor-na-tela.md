# Cor na tela, medida em navegador de verdade (T17)

## 0. De onde esta tarefa vem

O princípio nº1 do projeto é uma frase sobre PIXEL: "o time marca uma zona e vê exatamente a cor
que vai sair pela API". Até aqui, 988 testes vigiavam essa frase olhando para o lugar errado. Todos
eles conferem o número escrito no glTF, e entre esse número e o pixel que uma pessoa enxerga ainda
existem a conversão de sRGB para linear e o renderizador. Um `baseColorFactor` correto que chega
torto na tela passava pela suíte inteira sem tocar num sino.

A tarefa nasceu de uma descoberta de 2026-09-11, anotada em `.full-auto/ESTADO.md`: **"não dá para
testar o 3D" era verdade sobre o jsdom, não sobre a máquina.** Há Chrome instalado, ele roda WebGL
por software em modo headless, e o Node 24 traz `WebSocket` global, então dá para dirigi-lo pelo
protocolo de DevTools sem instalar dependência nenhuma. O que era conferência a olho do dono, e
portanto um portão humano em cada entrega visual, passa a ser teste.

## 1. Escopo

Um teste que sobe o Chrome headless, serve o app de verdade, monta o calçado da composição de
prova e **mede a cor de cada peça no framebuffer contra o hex escolhido no código**. Pulado, e não
reprovado, numa máquina sem Chrome.

## 2. Fora de escopo

- **Comparação de imagem contra imagem de referência.** Renderização por software não é estável o
  bastante entre versões de Chrome e de driver para isso, e um teste que reprova quando o Chrome
  atualiza é um teste que alguém desliga no terceiro mês.
- **Geometria.** "A sola está embaixo do cabedal" já tem teste no nível do glTF
  (`empilharComposicao`), que é onde a resposta é exata. Medi-la em pixel seria trocar uma prova
  boa por uma pior.
- **Navegador que não seja Chrome.** O protocolo de DevTools é dele e do Edge.

## 3. Decisões que o build não pode redecidir

### D1. A medição acontece DENTRO da página, e volta como JSON

`Runtime.evaluate` roda uma expressão na página; ela lê o framebuffer com `gl.readPixels`, agrupa
as cores e devolve números. A alternativa, `Page.captureScreenshot`, traria um PNG que precisaria
de um decodificador aqui fora para chegar exatamente nos mesmos números. O protocolo carrega JSON
muito melhor do que carrega imagem.

### D2. A leitura é no quadro SEGUINTE ao pedido

`PalcoDeModelo3d` desenha num laço de `requestAnimationFrame`. Entrar na fila garante ler um quadro
recém desenhado, e não o resto de um que o compositor já limpou. Há reteste embutido para o caso de
cair num quadro limpo.

### D3. O agrupamento de cor joga fora os 2 bits baixos de cada canal

Sem isso, o degradê de iluminação de uma face vira dezenas de tons quase iguais na contagem, e a
peça de verdade nunca aparece nas primeiras posições.

### D4. A régua vive fora do teste, e tem teste próprio que roda sem Chrome

`matiz.ts` decide se duas cores são a mesma. Ele é TypeScript normal, com 20 testes que rodam em
qualquer máquina. Uma régua torta faria o teste de navegador mentir nas duas direções, e numa
máquina sem Chrome ninguém descobriria.

### D5. O veredito tem DOIS eixos: matiz e saturação

Esta decisão foi **comprada com uma mutação sobrevivente**, e é a parte mais importante do
documento.

A primeira versão da régua comparava só o matiz, com o raciocínio de que a iluminação muda o brilho
mas não gira a cor. O raciocínio está certo e é insuficiente. Ao mutar o código para pular a
conversão de sRGB para linear, que é literalmente o defeito que o princípio nº1 existe para vigiar,
**os cinco testes de navegador passaram.** Medido na tela:

| zona | matiz pedido | matiz na tela, quebrado | distância | folga |
|---|---|---|---|---|
| cabedal | 219° | 211° | 8° | 8° |
| cadarço | 42° | 46° | 4° | 8° |

O defeito passava por dentro da folga. A saturação, no mesmo par de rodadas:

| zona | saturação pedida | conversão correta | conversão quebrada |
|---|---|---|---|
| cabedal | 0,815 | 0,769 | **0,537** |
| cadarço | 0,741 | 0,729 | **0,456** |

A assimetria tem causa física, e é por isso que dá para confiar nela: **iluminação difusa
multiplica os três canais**, o que preserva a razão entre eles e portanto a saturação; **um erro de
gama aplica uma curva**, que comprime canal escuro e canal claro de formas diferentes e desmancha
essa razão. Por isso a folga de saturação é só para BAIXO: reflexo e luz ambiente lavam a cor, e
nenhuma iluminação normal deixa uma peça mais saturada que o material dela.

### D6. A face medida é a mais SATURADA, não a mais visível

Entre as faces de mesmo matiz, o teste pergunta à menos lavada pela luz, porque é a que está mais
perto da cor do material. Perguntar à face mais visível é perguntar à mais iluminada, que é
justamente a que menos sabe responder.

### D7. O servidor escuta em IPv4 explícito

Sem `host: '127.0.0.1'`, o Vite escuta só em `::1`, o Chrome resolve `127.0.0.1` por IPv4, e a aba
abre num `ERR_CONNECTION_REFUSED` que chega ao teste disfarçado de "a cena nunca desenhou". Foi
assim que ele falhou na primeira execução, e o comentário no código existe para ninguém pagar duas
vezes.

## 4. Arquivos

### Novos

| Arquivo | O que é |
|---|---|
| `testes-de-navegador/matiz.ts` | A régua: matiz, saturação e o veredito de duas dimensões |
| `testes-de-navegador/matiz.test.ts` | 20 testes da régua, rodam sem Chrome |
| `testes-de-navegador/chrome.ts` | Acha o Chrome, sobe, fala o protocolo de DevTools |
| `testes-de-navegador/sonda.ts` | O servidor de teste e as expressões que rodam na página |
| `testes-de-navegador/corNaTela.test.ts` | Os 5 testes que medem a tela |
| `testes-de-navegador/README.md` | Índice da pasta |

### Modificados

| Arquivo | Mudança |
|---|---|
| `tsconfig.json` | `testes-de-navegador` entra no `include` |
| `package.json` | script `test:navegador` |

## 5. Critérios de aceite

| # | Critério | Resultado |
|---|---|---|
| 1 | O teste sobe um Chrome de verdade, sem dependência nova no `package.json` | sim, 0 dependências |
| 2 | Numa máquina sem Chrome os testes são PULADOS, não reprovados | sim, `describe.skipIf(CHROME === null)` |
| 3 | `CHROME_PATH` permite apontar para outro navegador | sim |
| 4 | O servidor sobe em porta livre, sem brigar com o `npm run dev` de quem trabalha | sim, porta 0 |
| 5 | O teste mede a cor das 3 peças contra o hex escolhido | sim |
| 6 | A mensagem de falha diz o que houve sem precisar abrir o navegador | sim, matiz e saturação na mensagem |
| 7 | A régua tem teste próprio que roda sem Chrome | sim, 20 testes |
| 8 | Mutar a troca de cor entre peças reprova | sim, 3 testes morrem |
| 9 | Mutar a conversão de sRGB para linear reprova | sim, 4 testes morrem |
| 10 | Mutar o conserto do BUG-019 reprova | sim, 1 teste morre |
| 11 | Suíte inteira verde e typecheck limpo | sim, 1013 testes |
| 12 | O teste não deixa processo de Chrome nem pasta de perfil para trás | sim, `afterAll` mata e apaga |

## 6. Verificação por mutação

Três mutações, todas aplicadas ao código de produção e revertidas depois.

| Mutação | Onde | Efeito esperado | Testes mortos |
|---|---|---|---|
| A. desligar o descarte de parâmetro | `composicaoDaTela.ts` | a tela apaga ao trocar de peça | 1, com a mensagem "a tela apagou ao trocar para o cano alto" |
| B. toda zona recebe a cor da primeira | `recolorirModelo3d.ts` | cabedal e cadarço saem brancos | 3 |
| C. pular a conversão de sRGB para linear | `corSrgbLinear.ts` | tudo lavado | 4 (0 antes de D5) |

A mutação C é a razão de este documento existir na forma em que está. Ela **sobreviveu** à primeira
versão do teste, e foi consertada acrescentando o eixo da saturação, não afrouxando nada.

## 7. Fragilidade, que é o risco assumido

Este é o teste mais lento e o mais frágil da suíte, e vale dizer isso de frente em vez de descobrir
em produção:

- **Depende de navegador instalado.** Numa máquina sem Chrome ele some, e some em silêncio. Uma
  suíte verde não prova que a cor foi medida; prova que nada do que rodou reprovou. Quem quiser a
  garantia roda `npm run test:navegador` e confere que apareceram 5 testes, não 0.
- **Depende de renderização por software.** Uma versão nova de Chrome pode mudar o SwiftShader o
  bastante para deslocar os números. A folga de matiz é de 8° e a de saturação de 0,12, contra
  medições de 1° e 0,05 na máquina de referência, então há espaço. Se um dia o teste começar a
  reprovar sem ninguém ter mexido em cor, o primeiro suspeito é este, e a resposta certa é
  **remedir as duas versões** como foi feito em D5, nunca afrouxar a folga no escuro.
- **Depende de um `innerText` e de rótulos de botão.** Renomear "Cabedal cano alto" na tela quebra
  o teste. É acoplamento de propósito: um teste que sobrevive à troca do rótulo também sobreviveria
  ao botão sumir.

## 8. O que este teste ainda NÃO responde

O item 4 da conferência a olho, "engrossar a sola faz o cabedal e o cadarço subirem juntos,
encaixados", continua fora. A geometria tem prova melhor no nível do glTF, e medir encaixe em
pixel, num render em perspectiva, confundiria sobreposição de projeção com peça enterrada. Fica
anotado aqui para não parecer esquecimento: foi decisão, e está em §2.
