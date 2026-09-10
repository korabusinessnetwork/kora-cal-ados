# Palco 3D no navegador (T13)

> Regra de escrita: sem travessão. Vírgula, dois pontos ou parênteses no lugar.

## 0. De onde esta tarefa vem

O ADR-007 escolheu a rota A (calçado 3D manipulável) e definiu três coisas que precisam existir
na tela: o modelo aparece (D1), gira com o mouse (D2), e cada malha é endereçável pelo nome
(D4). Nada disso existia porque faltava o que mostrar. T12 resolveu isso: `gltfDaPecaDeProva(id)`
devolve o texto de uma peça válida, e `GLTFLoader.parse(texto)` o recebe direto.

Esta é a **primeira tarefa da Fase C que o princípio nº1 obriga a conferir a olho**. Suíte verde
não prova que a peça aparece na tela. O que dá para automatizar está automatizado abaixo, e o que
sobra está dito com todas as letras na §7.

### O que a sonda já provou, antes de a spec existir

Rodada em jsdom, com as peças de T12, antes de escrever qualquer linha de produção:

- `GLTFLoader.parse(texto, '', ok, falha)` aceita o texto e devolve uma malha chamada
  `prova-sola-plana`
- a caixa envolvente sai `0.28 × 0.018 × 0.10`, com a base em Y = 0, ou seja, os metros e a
  âncora na base sobrevivem à viagem até a cena
- espessura `0.01` produz altura `0.01` e espessura `0.04` produz altura `0.04`: o parâmetro
  chega ao mundo como escala, exatamente como o ADR-008 D7 promete
- **o `Raycaster` acha a malha e devolve o nome dela sem GPU nenhuma**

O último item é o que muda a natureza desta entrega: "clicar numa peça a identifica pelo nome da
malha" deixa de ser verificável só a olho e passa a ser um teste.

## 1. Escopo

Uma tela `?tela=palco3d`, sem login e sem banco, que carrega uma peça do acervo de prova numa
cena three.js, deixa girar com o mouse, e ao clicar numa peça mostra o **nome da malha** que foi
atingida.

## 2. Fora de escopo

- **Montar as 5 peças numa cena só.** É T14. Aqui aparece **uma** peça por vez.
- **Cor.** Recolorir é T14 também. A peça aparece na cor que o material dá (branco padrão).
- **Configurador.** É T15.
- **Zoom, pan, enquadramento manual.** A câmera enquadra sozinha a partir da caixa envolvente e
  o mouse só orbita. Órbita é o que o ADR-007 D2 pede; o resto é conforto e pode esperar.
- **Sombra, mapa de ambiente, pós-processamento.** A peça é uma caixa branca; iluminação vai ser
  o mínimo que dá relevo às faces.
- **Guardar a zona 3D no banco.** Decisão 3 do dono: no modo gerado a zona vem da composição.
- **Empacotamento do three.js na Vercel.** Deploy está fora de escopo por decisão do dono.

## 3. Arquivos afetados

### Novos

| Arquivo | Responsabilidade |
|---|---|
| `src/palco3d/README.md` | Índice, e a fronteira entre o que é testável sem GPU e o que não é |
| `src/palco3d/orbita.ts` | Pura: arraste do ponteiro vira posição da câmera na esfera. Nenhuma referência a three nem ao DOM |
| `src/palco3d/carregarPecaNaCena.ts` | Texto glTF vira `Object3D`, mais o enquadramento derivado da caixa envolvente |
| `src/palco3d/nomeDaMalhaNoPonto.ts` | Ponto do ponteiro vira nome de malha, ou `null`. É o ADR-007 D4 virando função |
| `src/palco3d/PalcoDaPeca.tsx` | O `<canvas>` e o laço de render. **O único arquivo que precisa de GPU**, e por isso o único sem teste unitário |
| `src/palco3d/TelaDoPalco3d.tsx` | A tela: escolher peça, escolher o parâmetro, ver o nome do que foi clicado |
| `src/palco3d/palco3d.css` | Estilo separado do JSX (regra de white-label do CLAUDE.md) |
| `src/palco3d/orbita.test.ts` | |
| `src/palco3d/carregarPecaNaCena.test.ts` | Sob jsdom, porque o `FileLoader` do three dispara `ProgressEvent` |
| `src/palco3d/nomeDaMalhaNoPonto.test.ts` | Sob jsdom, pelo mesmo motivo |

### Modificados

| Arquivo | Mudança |
|---|---|
| `package.json` | dependency `three`, devDependency `@types/three` |
| `src/telaInicial.ts` | `Tela` ganha `palco3d`, e a regra deixa de falar em "uma tela" e passa a falar em "as telas sem banco" |
| `src/telaInicial.test.ts` | Os casos da tela nova, e o caso do valor desconhecido continua caindo em `app` |
| `src/App.tsx` | Rota da tela nova, antes da checagem de configuração do Supabase |
| `src/main.tsx` | Importa o CSS novo |
| `.full-auto/ESTADO.md`, `.full-auto/TAREFAS.md` | Estado da máquina |

## 4. Critérios de aceite

### A tela abre, e abrir não afrouxa o portão

1. `lerTelaDaUrl('?tela=palco3d')` devolve `'palco3d'`, com a mesma tolerância a caixa e espaço
   que o esboço já tem.
2. `lerTelaDaUrl('?tela=admin')` continua devolvendo `'app'`, e `?tela=app` continua idêntico a
   URL vazia. Nenhum valor de query alcança a área protegida.
3. `urlDaTela('palco3d', '/')` devolve `'?tela=palco3d'`, para o F5 não cair no login.
4. `App.tsx` trata `palco3d` **antes** da checagem de configuração do Supabase, como já faz com
   o esboço: a tela não faz uma requisição sequer e não pode exigir `.env.local`.

### A peça chega na cena inteira (ADR-007 D1)

5. `carregarPecaNaCena(texto)` devolve um `Object3D` cuja travessia encontra **exatamente uma**
   malha, e o `name` dela é o id da peça. Testado para as 5 peças, com a lista vinda do catálogo.
6. A caixa envolvente da peça carregada bate com as dimensões declaradas no acervo, em metros,
   dentro da tolerância de float32. É o que prova que a unidade sobreviveu.
7. A base da peça carregada fica em Y = 0, e não centrada na origem.
8. O parâmetro chega ao mundo: carregar a mesma peça com o mínimo e com o máximo da faixa produz
   caixas envolventes de alturas diferentes, e na proporção dos valores pedidos.
9. `enquadrar(caixa)` devolve uma distância de câmera **proporcional ao tamanho da peça**, de
   modo que o cadarço (0,13 m) e a sola (0,28 m) preencham o quadro de forma comparável. Uma
   distância fixa faria a peça pequena virar um ponto.

### Clicar identifica a peça (ADR-007 D4)

10. `nomeDaMalhaNoPonto` devolve o nome da malha quando o ponteiro está sobre a peça.
11. Devolve `null` quando o ponteiro está no vazio. Nunca devolve o nome da última peça
    atingida, e nunca lança.
12. O nome devolvido é o do **nó**, que é o endereço que o ADR-007 D4 define, e não o de um
    material ou de uma primitiva.
13. A função recebe coordenadas já normalizadas (`-1` a `1`) e o tamanho do canvas fica fora
    dela. Sem isso, um teste precisaria de um elemento com dimensões, que jsdom dá zeradas.

### Girar com o mouse (ADR-007 D2)

14. Arrastar na horizontal muda o azimute e não muda a elevação; arrastar na vertical faz o
    inverso.
15. A elevação é **travada** um pouco antes dos polos. Sem trava, a câmera passa por cima e a
    cena vira de cabeça para baixo, que é o defeito clássico de órbita escrita à mão.
16. A distância da câmera ao alvo **não muda** com o arraste: é órbita, não aproximação.
17. O azimute dá a volta sem descontinuidade: arrastar muito para um lado não faz a peça pular.
18. `orbita.ts` não importa `three` nem toca no DOM. É aritmética esférica pura, e é isso que a
    torna testável sem navegador.

### Higiene

19. `npm test` verde, `npm run typecheck` limpo.
20. `PalcoDaPeca.tsx` não contém regra nenhuma: se ele tiver aritmética de câmera ou lógica de
    seleção, ela escapou para o lugar errado, porque é justamente o arquivo que nenhum teste
    alcança.
21. O laço de render para e o contexto WebGL é liberado quando o componente sai da tela. Vazar
    contexto trava o navegador depois de algumas trocas de peça.
22. `src/palco3d/README.md` existe e indexa cada arquivo.
23. Sem `console.log`, sem TODO sem justificativa.

## 5. Edge cases conhecidos

- **`ProgressEvent` não existe no Node.** O `FileLoader` do three dispara um ao terminar de ler o
  `data:` URI. Os testes que carregam glTF rodam sob `// @vitest-environment jsdom`. Descoberto
  na sonda, não no build.
- **jsdom não tem WebGL.** Por isso `PalcoDaPeca.tsx` fica sem teste unitário, e por isso toda
  regra tem que morar fora dele. O critério 20 existe para prender essa fronteira.
- **Canvas de tamanho zero.** No primeiro quadro, antes do layout, o canvas pode medir 0 por 0 e
  a razão de aspecto vira divisão por zero. O palco precisa esperar uma medida positiva.
- **Peça trocada com o ponteiro pressionado.** Se o arraste começar numa peça e ela for trocada
  no meio, o estado de arraste não pode continuar apontando para o objeto antigo.
- **Elevação exatamente no polo.** Com elevação em 0 ou π o vetor "para cima" da câmera fica
  indefinido e a imagem gira sozinha. É o que o critério 15 evita.

## 6. Definição de "aprovado sem ressalvas"

Os 23 critérios em "sim" com evidência, `npm test` e `npm run typecheck` verdes, pelo menos 3
mutações matando teste, **e** a conferência a olho da §7 feita pelo dono em navegador de verdade.

Sem a conferência a olho esta tarefa **não** pode ser declarada feita, por mais verde que esteja
a suíte. `memory/learnings.md` registra três vezes que suíte verde não prova o que a interface
entrega, e esta é a tarefa em que isso mais vale.

## 7. O que só o dono pode confirmar, em navegador de verdade

Abrir <http://localhost:5173/?tela=palco3d> e conferir:

1. **A peça aparece.** Uma caixa branca, com relevo, não uma silhueta chapada nem uma tela preta.
2. **Ela gira com o mouse**, arrastando, e não vira de cabeça para baixo por mais que se arraste
   para cima.
3. **Clicar nela mostra o nome dela** na tela, e clicar no vazio limpa o nome.
4. **Trocar a peça no seletor troca o que está na tela**, e a peça nova continua enquadrada.
5. **Mexer no parâmetro engrossa ou afina a peça**, sem ela afundar no chão nem flutuar.

O item 5 é o mais importante dos cinco, porque é o único que nenhum teste pode ver de verdade: os
testes conferem a caixa envolvente, e caixa envolvente não distingue uma peça que cresceu para
cima de uma que cresceu para os dois lados.

---

## 8. Resultado da revisão

`npm test`: **844 passando**, 48 pulados (os de banco, sem `.env.local` nesta passada), 0 falhando.
`npm run typecheck`: limpo. `npm run build`: passa. `src/palco3d/` sem `console.log` e sem TODO.

Os 60 testes do palco moram em `src/palco3d/`: 16 em `orbita.test.ts`, 16 em
`carregarPecaNaCena.test.ts`, 12 em `nomeDaMalhaNoPonto.test.ts`, 6 em `fronteiraSemGpu.test.ts`,
mais 10 de roteamento em `src/telaInicial.test.ts`.

### Critério a critério

| # | | Evidência |
|---|---|---|
| 1 | sim | `telaInicial.test.ts`, "abre o palco 3D com ?tela=palco3d", mais os casos de caixa e espaço (`?tela=Palco3D`, `?tela=%20PALCO3D%20`) |
| 2 | sim | Os casos de valor desconhecido continuam lá, e ganharam dois: `?tela=palco` e `?tela=palco3d2` caem em `app`. A comparação é com a lista inteira, nunca por prefixo |
| 3 | sim | "devolve a query do palco 3D", mais o teste de ida e volta que casa `urlDaTela` com `lerTelaDaUrl` para toda tela sem banco |
| 4 | sim | `App.tsx`: o bloco `if (tela === 'palco3d')` está acima de `conferirConfiguracao()`, igual ao do esboço |
| 5 | sim | `carregarPecaNaCena.test.ts`, "vira exatamente uma malha, com o id da peça como nome", para as 5 peças, com a lista vinda do catálogo |
| 6 | sim | "chega na cena com as dimensões que o acervo declara, em metros" |
| 7 | sim | "assenta com a base no chão, e não centrada na origem": `caixa.min.y >= 0` |
| 8 | sim | "o parâmetro chega ao mundo como altura de verdade", mais "engrossar a peça a faz crescer para cima", que compara o piso das duas versões |
| 9 | sim | "recebe uma distância proporcional ao próprio tamanho" (`distancia / maior` = 2,2 para as 5), "a peça menor fica mais perto" e "a folga cabe a peça girada de viés" |
| 10 | sim | "é identificada pelo próprio nome quando o ponteiro está sobre ela", para as 5 peças, mais o teste de 7 azimutes diferentes |
| 11 | sim | "devolve null no vazio, nunca o nome do último acerto" e "não lança quando a cena está vazia" |
| 12 | sim | "devolve o nome do NÓ, que é o endereço que a zona guarda", conferido contra `nodes[0].name` do próprio glTF, mais os dois testes novos de subida pela hierarquia |
| 13 | sim | A assinatura recebe `PontoNormalizado`; a conversão de pixel mora em `PalcoDaPeca.normalizar` |
| 14 | sim | "arrastar na horizontal mexe só no azimute" e o inverso |
| 15 | sim | `travarNoPolo` nos dois polos, mais "arrastar sem parar não vira a cena de cabeça para baixo, nos dois sentidos" |
| 16 | sim | "a distância nunca muda com o arraste: é órbita, não aproximação", com 4 arrastes grandes |
| 17 | sim | "o azimute dá a volta sem pular", 200 arrastes |
| 18 | sim | `fronteiraSemGpu.test.ts` varre o fonte: nenhum `import`, nenhuma menção a `document`, `window`, `PointerEvent` ou `HTMLElement` |
| 19 | sim | Ver o topo desta seção |
| 20 | sim | `fronteiraSemGpu.test.ts` proíbe `Math.sin`, `Math.cos`, `Math.PI`, `Spherical`, `Raycaster`, `intersectObject` e `.parent` em `PalcoDaPeca.tsx`, e exige que ele importe os três módulos que têm teste. A contraprova existe porque as duas primeiras varreduras passariam num arquivo vazio |
| 21 | sim | `destruir()` chama `cancelAnimationFrame`, `renderizador.dispose()` e descarta geometria e material da peça que sai. O critério tem varredura própria |
| 22 | sim | `src/palco3d/README.md`, com a tabela do que precisa de GPU e do que não precisa |
| 23 | sim | Varredura por `console.log` e `TODO` em `src/palco3d/` |

### Passada de mutação: 10 mutações, 10 mortas

Uma delas só depois de correção, e essa é a que valeu a passada.

| | Mutação | Testes mortos |
|---|---|---|
| a | `travarNoPolo` devolve a elevação sem travar | 3 |
| b | Sinal do azimute invertido | 1 |
| c | Arraste horizontal passa a mexer também na elevação | 1 |
| d | Distância de câmera fixa em 0,6 em vez de proporcional | 6 |
| e | Alvo da câmera na origem em vez do centro da peça | 2 |
| f | `nomeDaMalhaNoPonto` devolve `primeiro.object.name`, sem subir até o nó | **0, depois 2** |
| g | A lista de telas sem banco vira comparação por prefixo | 1 |
| h | A subida pela hierarquia não para no primeiro nome, vai até a raiz | 11 |
| i | `renderizador.dispose()` removido | 1 |
| j | `orbita.ts` passa a importar `three` | 1 |

### O buraco que a mutação (f) achou

Trocar a subida pela hierarquia por `primeiro.object.name` **passava nos 10 testes que existiam**.
Motivo: as 5 peças do acervo de prova têm uma primitiva só, então o carregador põe o nome do nó
direto na malha e o caminho de subida nunca é percorrido. A função tinha um comentário explicando
por que a subida existe, e nenhum teste provando que ela funciona.

Corrigido com dois testes que montam à mão a forma que o carregador produz quando o nó tem mais
de uma primitiva: um grupo com nome e malhas filhas sem nome. Um confere que a subida acha o nó,
o outro que ninguém com nome na linhagem devolve `null` em vez de nome inventado. A mutação (h)
existe por causa deles.

Vale registrar o padrão, porque é o segundo caso desta fase: **código defensivo escrito para um
caso que os dados atuais não produzem nasce sem cobertura, e o comentário que explica o porquê
dele dá a impressão de que ele está protegido**. Só mutação encontra isso.

### Três desvios do spec, todos deliberados

1. **`src/palco3d/fronteiraSemGpu.test.ts` não estava na lista de arquivos.** Os critérios 18, 20
   e 21 descrevem disciplina de arquitetura, e do jeito que estavam valiam pela palavra de quem
   escreveu. Disciplina que só existe como frase num README dura até a primeira pressa.
2. **Dois testes de `orbita.test.ts` nasceram errados e foram corrigidos, não o código.** Eles
   afirmavam que arrastar para cima levanta a câmera. É o contrário: os dois eixos seguem "agarrar
   a peça", como o `OrbitControls` do three, então arrastar para **baixo** é que levanta. O que
   importa é os dois eixos concordarem; inverter só um é o que faz um controle de órbita parecer
   quebrado. A correção ficou registrada dentro do próprio teste, para ninguém desfazê-la.
3. **O palco entra por `import()` tardio em `App.tsx`, com `Suspense`.** Não estava previsto. Com
   import comum o `three` ia para o chunk principal e o pacote saltava de 453 kB para 1.075 kB,
   ou seja, todo mundo que abre o editor 2D passaria a baixar a biblioteca do palco sem usá-la.
   Separado, o principal volta aos 453 kB e o palco vira um chunk de 622 kB que só carrega quem
   abre a tela.

### O que esta entrega NÃO prova

- **Que a peça aparece na tela.** Nenhum teste desta suíte desenhou um pixel; jsdom não tem WebGL.
  É a §7, e sem ela T13 não pode ser declarada feita.
- **Que o `three` empacota na Vercel.** Deploy está fora de escopo por decisão do dono.
- **Que a peça cresce para cima e não para os dois lados.** Os testes conferem a caixa envolvente,
  e caixa envolvente não distingue as duas coisas. É o item 5 da §7, e é o mais importante dos cinco.
