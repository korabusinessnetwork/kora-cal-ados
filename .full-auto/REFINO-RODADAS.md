# Rodadas de refino

Uma seção por rodada. O que entrou, o que foi revertido e por quê, e as medidas antes e depois, só
as que foram medidas de verdade.

A regra que governa este arquivo: **refino nunca piora o que já funciona**. Toda rodada começa com o
`BASELINE.md` verde e termina com ele verde.

---

## Rodada 1, fechada em 2026-09-12

**Lote:** 8 itens, de `TAREFAS.md`, seção "Refino, rodada 1". Nenhum com risco 4 ou 5.
**Entregues: 8 de 8. Revertidos: nenhum.**

| Item | Eixo | Score | Situação | Commit |
|---|---|---|---|---|
| R1-A01 cena 3D ao lado dos controles entre 860 e 1100 px | ux | 6 | entregue | `14796e4` |
| R1-A04 teste do `ProvedorDeSessao` | qualidade | 4 | entregue | `12701c5` |
| R1-A03 asset-base vazio é falha nomeada | robustez | 4 | entregue | `24e28ac` |
| R1-A02 copiar a composição em JSON | produto | 4 | entregue | `bdcd6de` |
| R1-A05 título de aba por tela | ux | 3 | entregue | `34d56a6` |
| R1-A06 categoria dispensada sem chave crua na frase | ux | 3 | entregue | `367539a` |
| R1-A07 faixa do parâmetro visível | ux | 3 | entregue | `231fdb2` |
| R1-A08 `aria-pressed` nos botões de peça | ux | 3 | entregue | `5e35551` |

Mais um commit que não estava no lote: `e0f1ab6`, o `afterAll` sem teto em `exportarTenant.test.ts`.
Ele apareceu na primeira verificação de baseline da rodada, com os 58 testes VERDES e o arquivo
reprovando assim mesmo, porque quem estourava era a limpeza, depois do último `expect`. Baseline
vermelho é a única coisa que vem antes do lote, então foi consertado na hora.

**Baseline:** verde na abertura (`08e4d1d`) e verde no fechamento (`5e35551`), com o lote inteiro
junto: typecheck limpo, 1072 testes, 58 de 58 contra o banco real, 25 no navegador, build limpo,
`npm audit` sem vulnerabilidade. A tabela com os dois lados está em `BASELINE.md`.

### O que mudou, em números medidos

| Medida | Antes | Depois |
|---|---|---|
| Testes | 1047 | **1072** (+25, de A02, A03, A04 e A05) |
| Chunk principal | 455,03 kB | 455,58 kB (+0,55 kB) |
| CSS | 20,76 kB | 21,75 kB (+0,99 kB) |

### O que foi conferido a olho, e não por teste

Quatro itens são de tela e não têm teste automatizado, então a verificação foi no navegador de
verdade, e é isto que foi visto:

- **A01:** em 1024x768 o canvas começava em y=789, fora da tela, e passou para dentro dela. Medido
  nas três larguras, 1440, 1024 e 375, para provar que as outras duas não mudaram.
- **A02:** o navegador embutido NEGA `navigator.clipboard.writeText`, o que exercitou o caminho
  alternativo de graça: aparece o `<pre>` com o JSON para copiar à mão. Com a área de transferência
  espionada, o texto copiado bateu byte a byte com o `<pre>`, e mexer num controle apagou a
  confirmação antiga, com a cópia seguinte já trazendo o valor novo.
- **A07:** com o foco no controle, `End` mostra 40,0 mm e `Home` mostra 10,0 mm, exatamente os dois
  extremos escritos ao lado.
- **A08:** os seis botões da composição nascem `aria-pressed=true` nos três escolhidos e `false` no
  resto, e clicar em "Nenhuma peça" move o `true` para ele. A árvore de acessibilidade do navegador
  embutido não mostra estado ARIA, então o que foi conferido é o atributo no DOM renderizado.

### Nada ficou atrás de flag

Nenhum item da rodada altera fluxo principal de quem usa o sistema logado: A01, A02, A06, A07 e A08
são das telas de prova do palco, A05 é o título da aba, A03 troca uma tela em branco por uma
mensagem, e A04 é só teste. Por isso nenhum precisou de flag de configuração.

### Pendências novas do dono

- **P04**, em `PENDENCIAS-DO-MATHEUS.md`: 8 tenants de teste órfãos no Supabase real, deixados por
  uma limpeza que abortou antes do conserto do `afterAll`. Apagar linha de banco real é decisão dele.

### Decisão registrada nesta rodada

- **D10:** o `test:banco` vermelho por cota de autenticação do plano gratuito não ganhou timeout
  maior. A causa e o jeito de reconhecer o sintoma estão em `BASELINE.md`.

---

## Rodada 2, fechada em 2026-09-12

**Lote:** 8 itens, em `TAREFAS.md`, seção "Refino, rodada 2". Nenhum com risco 4 ou 5.

| Item | Eixo | Score | Situação |
|---|---|---|---|
| R2-A22 uma função só para "N elementos" | qualidade | 3 | entregue, `5d5fc02` |
| R2-A18 confirmação ao gravar a zona | ux | 4 | entregue, `53078f8` |
| R2-A19 contagem de marcados vira região viva | ux | 3 | entregue, `06dc545` |
| R2-A09 teste de `listarZonasDoProduto` | qualidade | 3 | entregue, `640234c` |
| R2-A17 esboço cabe na tela | ux | 2 | entregue, `01e8841` |
| R2-A20 o editor de cor do esboço anuncia o que está errado | ux | 2 | entregue, `77281f9` |
| R2-A11 nome acessível no palco e peça clicada viva | ux | 2 | entregue, `cf00aab` |
| R2-A10 falha de rede deixa de virar "conta não vinculada" | robustez | 2 | entregue, `433e8eb` |

A tabela está na ordem de execução, não na de score. A única troca deliberada foi pôr A22 na frente
de A18: a confirmação de A18 escreve uma contagem de elementos, e executá-la antes teria criado a
QUINTA implementação do plural justo no item cujo trabalho era acabar com as quatro.

**8 de 8 entregues, nenhum revertido.**

**De onde veio a lista:** a reauditoria foi atrás do que a rodada 1 declarou não ter olhado, o editor
de zonas logado. Sem senha do `aurora-demo` registrada em lugar nenhum, e sem provisionar tenant
novo só para auditar, porque criar linha no banco real para olhar uma tela é exatamente como nasceu
o P04, o editor logado foi lido no código, com endereço de linha, e o que foi percorrido no
navegador foi a tela de login e o esboço do motor, que é o editor 2D rodando sem banco. Cinco
achados novos saíram daí: A17 a A20 e A22.

**Sem item de produto, e isto é declarado:** nenhum achado de produto ficou acima do corte. O
candidato forte virou a ideia I06, porque fazer uma segunda cópia do contrato da API dentro do
editor é o erro que o comentário do painel do esboço registra ter custado semanas.

### O que mudou de verdade

- **O editor de zonas passou a confirmar.** Gravar dizia "gravou" apagando a tela e mais nada. Quem
  cria zona vê a lista crescer, mas quem ACRESCENTA elemento a uma zona que já existe tinha como
  única prova um número mudando num painel que pode estar fora da vista. Agora a frase nomeia a zona
  e diz se ela nasceu ou se cresceu, e some no primeiro clique da marcação seguinte.
- **`aria-live` deixou de ser zero no projeto.** A abertura da rodada registrou que
  `grep -rn "aria-live" src/` não devolvia nada, e três telas trabalham por clique num desenho, com
  o resultado aparecendo em outro canto. Agora a contagem de marcados, a peça clicada do palco e a
  do calçado montado são regiões vivas educadas.
- **Falha de rede parou de mentir sobre o cadastro.** Era o item de robustez: `sem-tenant` era o
  destino tanto de quem não tem vínculo quanto de quem perdeu a conexão, e como o estado escolhe a
  tela, a segunda pessoa lia "sua conta não está vinculada a uma marca" e ia procurar quem
  provisiona por um problema que um clique resolve.
- **O esboço voltou a caber na tela** entre 860 e 1220 px, onde três colunas fixas estouravam a
  largura da janela.
- **Uma frase, uma implementação.** "N elementos" estava escrita em quatro lugares de três jeitos, e
  o quarto tinha esquecido do plural. Agora é `src/lib/texto/contarElementos.ts`, com o adjetivo
  chegando flexionado nas duas formas em vez de derivado, porque "marcado/marcados" e
  "marcável/marcáveis" não seguem a mesma regra.

### Medidas

Na tabela de três colunas do `BASELINE.md`. Em resumo: **1047 para 1104 testes verdes** desde a
abertura do refino, 58 no banco e 25 no navegador intactos, `tsc` limpo, build limpo, `npm audit`
em zero. Os bytes subiram: chunk principal +1,34 kB, CSS +0,51 kB, chunk do three.js +0,04 kB. Isso
é o peso de texto que passou a existir, e nenhum deles veio de tentativa revertida.

### Verificação de cada item, e os limites dela

Cada item rodou a verificação completa do `BASELINE.md` antes do commit, e cada mudança de
comportamento foi checada por mutação, com o número de testes mortos registrado no commit e no
`TAREFAS.md`. Três coisas ficam ditas em vez de escondidas:

1. **A11 foi conferido no DOM renderizado, não na árvore de acessibilidade** do navegador embutido.
   Essa árvore não calcula nome acessível de conteúdo aninhado nem expõe estado ARIA, então afirmar
   por ela seria afirmar sobre a ferramenta e não sobre a página. A prova são os atributos lidos na
   página viva mais o clique de verdade em cada tela.
2. **A18 tem uma parte verificada por leitura**: que a confirmação some no clique seguinte. Montar
   `EditorDeZonas` em teste exigiria mock de módulo, que este projeto não usa em lugar nenhum. Virou
   o achado **A25**, com score -3, no backlog.
3. **A mutação que sobreviveu em A10 virou apagamento, não desculpa.** A guarda de usuário nulo em
   `tentarDeNovo` não tinha efeito observável, porque `aplicarUsuario(null)` já faz a mesma coisa.
   Código sem efeito observável é código morto, e ele saiu.

### O editor logado continua sem ter sido usado por mim

Mesma limitação da rodada 1, e ela não diminuiu: A18 e A19 mexem numa tela que eu li no código e
não operei com uma conta de verdade. A saída seria provisionar um tenant no Supabase real, e isso é
criar linha em banco real para auditoria, exatamente como nasceu o P04. Quem tiver a senha do
`aurora-demo` fecha essa conferência em dois minutos: marcar elementos, gravar, e ver a frase.

### Nada atrás de flag

Nenhum item desta rodada entrou atrás de configuração. Todos mexem em texto, atributo de
acessibilidade, CSS de quebra de layout ou estado de erro, e nenhum altera o fluxo principal a
ponto de justificar um interruptor.

### Pendências novas do dono

Nenhuma. P01, P02 e P04 continuam abertas como estavam, e nenhum item desta rodada dependeu delas.

### Achado novo registrado

- **A25** | qualidade | `EditorDeZonas` não é montável em teste neste projeto, porque a rede chega
  por import e não por prop. Score -3, fica no backlog: mexer na assinatura de um componente de 200
  linhas que ninguém consegue testar hoje é o tipo de mudança que quebra calada.

---

## Rodada 3, fechada em 2026-09-12

**Lote:** 5 itens, em `TAREFAS.md`, seção "Refino, rodada 3". Nenhum com risco 4 ou 5.

| Item | Eixo | Score | Situação |
|---|---|---|---|
| R3-A27 digitar o hex no configurador | produto | 4 | pendente |
| R3-A26 teste dos dois hooks que descartam estado ao trocar de produto | qualidade | 4 | pendente |
| R3-A29 empate de especificidade e seletor descendente presos por teste | qualidade | 3 | pendente |
| R3-A30 o palco aparece antes dos controles na tela estreita | ux | 3 | pendente |
| R3-A28 contexto WebGL perdido para de mentir | robustez | 2 | pendente |

**Por que cinco e não oito:** cinco é o que passou do corte com evidência. As duas primeiras rodadas
levaram oito porque havia oito; completar esta com itens do backlog abaixo do corte seria trocar a
régua do score por vontade de ter lista maior. Os quatro eixos estão representados, e o eixo de
produto, que faltou na rodada 2, voltou com o maior score do lote.

**De onde veio a lista:** as duas primeiras rodadas varreram o que se vê. Esta foi atrás do que não
tem teste no caminho crítico do editor e do que acontece quando uma peça de infraestrutura falha por
baixo. O achado mais caro é o A27, e ele é de produto, não de acessibilidade: o configurador, que o
ADR-008 chama de produto vendável por si só, escolhe cor apenas pelo seletor do sistema, então não
existe onde digitar o hex do manual da marca. O esboço, que é a demonstração, sempre teve o campo.

**Duas suspeitas morreram na sonda** e estão escritas em `AUDITORIA.md`, na seção "o que eu achei
que era defeito e não era": o buffer do canvas do palco parecia estar em 300x150 esticado, e era
artefato de medir com o painel do navegador escondido, onde o `requestAnimationFrame` fica parado; e
a falta de `maxLength` nos campos, que já é prevenida uma camada abaixo, em `validarZoneKey`.

---

## Rodada 3: o que foi entregue

**6 de 6 entregues, nenhum revertido.** Seis e não cinco porque o sexto item nasceu no meio da
rodada, e a história dele está abaixo.

| Item | Trilha | Commit | Resultado |
|---|---|---|---|
| R3-A27 digitar o hex no configurador | produto | `995912c`, `acd3a97` | entregue |
| R3-A26 teste dos dois hooks que descartam estado | qualidade | `a5b713a` | entregue |
| R3-A29 cascata do achatamento de CSS presa por teste | qualidade | `4870294` | entregue |
| R3-A33 o baseline para de piscar vermelho sozinho | qualidade | `1788a10` | entregue |
| R3-A30 a cena antes dos controles na tela estreita | ux | `a98a953` | entregue |
| R3-A28 contexto WebGL perdido para de mentir | robustez | `37b96a6` | entregue |

### O item que apareceu no meio da rodada, e por que ele entrou na frente

Rodando o baseline depois do A29, um teste de navegador reprovou sozinho: "a sola não ficou
vermelha". Ninguém tinha tocado naquele código. Reproduzi 1 vez em 4 execuções da suíte completa, e
o mesmo arquivo passava 6 de 6 rodando sozinho.

Isso virou item na frente dos outros porque ataca a regra de ouro do refino diretamente. A regra é
que toda rodada começa e termina com baseline verde, e ela só funciona se vermelho significar "eu
quebrei". Um baseline que pisca destrói essa leitura, e o estrago não é o teste, é o hábito:
vermelho intermitente ensina a rodar de novo em vez de investigar, e é assim que uma regressão de
verdade passa batida no meio de uma rodada.

**E a honestidade sobre ele:** não consegui reproduzir a corrida sob demanda. Tentei duas vezes e as
duas falharam, e as duas estão escritas em `AUDITORIA.md` com o que cada uma mostrou de errado. O
conserto foi feito com a falha capturada em mãos e a causa lida no código (o leitor só repete o
quadro quando ele vem VAZIO, nunca quando vem pintado com a cor antiga), não com a corrida isolada.
O que afirmo é o que dá para afirmar: a única forma de aquela asserção falhar sem a cor estar errada
foi removida, e duas mutações no caminho real provam que cor errada continua reprovando.

### O que mudou de verdade

1. **Dá para digitar o hex no configurador (A27).** A marca chega com `#C0392B` no manual e até
   aqui só existia o conta-gotas do sistema, que aproxima e não acerta. O configurador é o que o
   ADR-008 chama de produto vendável por si só, e era a única das três telas sem campo de texto.

   A ordem dos dois commits é a lição da rodada anterior aplicada: primeiro a REGRA de quando um
   hex está completo virou `lib/render/estadoDoHexDigitado.ts`, usada pelos três lugares, e só
   depois a tela nova. Escrever a tela antes teria criado a QUARTA definição de "isto é uma cor" no
   mesmo projeto, que é exatamente o que aconteceu com a contagem de elementos antes do R2-A22.

   O que NÃO foi compartilhado, de propósito, é o widget: as duas telas desenham coisas diferentes
   (o esboço tem paleta de atalho) e moram em áreas diferentes da árvore. Compartilhar a regra e não
   a marcação é o que impede as telas de divergirem sobre o que é uma cor sem impedi-las de serem
   telas diferentes.

2. **A tela para de afirmar que está tudo bem quando o 3D caiu (A28).** Com
   `WEBGL_lose_context.loseContext()` o canvas ficava em branco e a linha de estado seguia dizendo
   "Peça na cena. Arraste para girar". O defeito de fundo não era a falta do listener, era a escolha
   da frase: as duas telas decidiam com dois `if` e um `return` de fim que servia de coringa, e o
   coringa dizia que estava tudo bem. Qualquer estado novo caía nele.

3. **Em 375 px a cena vem antes dos controles, e FICA (A30).** A moldura começava a 1158 px do topo
   numa tela de 812 na composição: a pessoa escolhia as nove cores e só via o calçado depois de
   todas. `order` sozinho entregaria "vê ao abrir", que não é a mesma coisa que "vê enquanto
   escolhe": bastaria rolar até o primeiro campo de cor para o calçado sumir de novo. Com `sticky`,
   rolando 900 px a moldura continua inteira na tela.

4. **Três pedaços do caminho crítico saíram do escuro (A26, A29).** O descarte de estado ao trocar
   de produto e a cascata do achatamento de CSS do SVG não tinham teste nenhum, e as duas falham em
   silêncio: a primeira grava id de outro modelo numa zona que nasce sem pintar nada, a segunda
   deixa um calçado entrar no catálogo com a sola da cor errada, com editor e API concordando
   perfeitamente sobre a cor errada.

### Medidas, ponta a ponta

| | Abertura da rodada 3 | Fechamento |
|---|---|---|
| Testes verdes | 1104 | **1161** |
| Arquivos de teste | 74 | **80** |
| Banco / navegador | 58 / 25 | **58 / 25** |
| `npm run build` | 507 ms | 564 ms |
| Chunk principal | 456,92 kB | **457,00 kB** (+0,08) |
| CSS | 22,26 kB | **22,69 kB** (+0,43) |
| Chunk do three.js | 618,91 kB | **619,40 kB** (+0,49) |
| `npm audit` | 0 | **0** |

Uma coluna do `BASELINE.md` mudou para trás nesta rodada: a contagem de arquivos e de linhas não era
reproduzível, então refiz as quatro com a mesma fórmula em vez de emendar uma quarta numa série que
ninguém consegue conferir. Está explicado lá.

### Mutações: o que sobreviveu, e o que foi feito com cada uma

Dezenove mutações rodadas na rodada. Duas sobreviveram, e nenhuma das duas foi escondida:

1. **Tirar a âncora do regex de elemento em `calcularEspecificidade`.** Sobreviveu à primeira versão
   do teste do A29, porque com afirmações só relativas a conta inteira anda junto: toda classe passa
   a valer 101 e todo id 10.001, e nenhuma comparação inverte. **O teste foi corrigido**, passou a
   fixar a escala em número cheio (10.000 / 100 / 1), e a mutação morre. O motivo está escrito
   dentro do próprio teste, para quem for afrouxá-lo depois.

2. **Apagar a guarda `contextoPerdido` do laço de render.** Sobreviveu à suíte inteira, e vai
   continuar sobrevivendo a qualquer teste de comportamento: jsdom não tem WebGL e o laço de render
   é a única parte do projeto que nenhum teste alcança. **Passou a ser pega por varredura de
   fonte** em `fronteiraSemGpu.test.ts`, que é o instrumento que aquele arquivo já usa para os
   critérios 18, 20 e 21. É a varredura mais colada ao texto do projeto, e o comentário dela diz
   isso e diz por que a troca vale a pena.

### Nada atrás de flag

Nenhum item desta rodada entrou atrás de configuração. Os seis são visíveis assim que a tela abre.

### Nenhuma pendência nova do dono

As três de sempre continuam: P01 (hook), P02 (revogar a chave `2aec9a55`) e P04 (os 8 tenants órfãos
de teste). Nenhuma delas é tarefa minha, e nenhuma virou mais urgente nesta rodada.

---

## Rodada 4, fechada em 2026-09-12

**Lote:** 6 itens, em `TAREFAS.md`, seção "Refino, rodada 4". Nenhum com risco 4 ou 5.

| Item | Eixo | Score | Situação |
|---|---|---|---|
| R4-A39 o calçado antes da lista de zonas na tela estreita | ux | 4 | entregue |
| R4-A40 os tipos do three acompanham o three | qualidade | 3 | entregue |
| R4-A36 atalhos de cor de 24 px com nome que se lê | ux | 3 | entregue |
| R4-A34 o esboço oferece as três irmãs | ux | 3 | entregue |
| R4-A37 corpo grande demais recusado antes de ser lido | robustez | 2 | entregue |
| R4-A38 copiar a chamada equivalente do esboço | produto | 2 | entregue |

Abaixo do corte e fora do lote: **A35**, o canvas sem nome acessível nem teclado, com score -1.

**De onde veio a lista:** as rodadas 1 a 3 varreram o editor logado, o palco 3D e o motor. A tela
que um clone recém-baixado abre, o esboço, nunca tinha sido varrida, e quatro dos seis achados
vieram dela. Isso não é coincidência: o esboço é a tela que a equipe já conhece de cor, então
ninguém a percorre com olhos de quem chega.

**Quatro suspeitas morreram antes de virar item**, e estão escritas em `AUDITORIA.md`, na seção "o
que eu achei que era defeito e não era": a zona de gradiente que parecia não recolorir, as
dependências que pareciam atrasadas, o log de requisição que parecia vazar dado, e um contraste que
parecia abaixo do mínimo.

---

## Rodada 4: o que foi entregue

**6 de 6 entregues, nenhum revertido.**

| Item | Trilha | Commit | Resultado |
|---|---|---|---|
| R4-A39 o calçado antes da lista de zonas em 375 px | ux | `637cf15` | entregue |
| R4-A40 os tipos do three acompanham o three | qualidade | `5edce98`, `f5ee209` | entregue |
| R4-A34 o rodapé de saídas vira um só, para as quatro telas | ux | `2259266` | entregue |
| R4-A36 atalhos de cor de 24 px com nome que se lê | ux | `8798467` | entregue |
| R4-A37 corpo grande demais recusado antes de ser lido | robustez | `c8f65f1` | entregue |
| R4-A38 a regra da cópia sobe, e o esboço ganha o botão | produto | `9520052`, `a7caf05`, `edf3d40` | entregue |

### A armadilha desta rodada: uma classe CSS declarada em dois arquivos

Vale mais que qualquer item, porque vai acontecer de novo.

No A39 o `position: sticky` da minha regra **não teve efeito nenhum, duas vezes, em silêncio**,
enquanto o `order: -1` da MESMA regra funcionava. Da primeira vez porque a minha media query estava
na linha 70 de `src/esboco/esboco.css` e `.palco { position: relative }` na linha 116 do mesmo
arquivo. Movi o bloco para depois, e continuou sem efeito: `src/features/zonas/zonas.css` declara
`.palco { position: relative }` de novo, e a duplicação é deliberada e documentada. Media query não
acrescenta especificidade, então quem decide é a ordem no bundle, e o outro arquivo vinha depois.

O conserto foi mirar em `.colunas .palco`, especificidade 0,2,0, que ganha dos dois.

**O que fica registrado é o formato da falha, não o conserto.** Uma declaração de uma regra some e a
outra, do mesmo bloco, fica, sem erro em lugar nenhum, sem aviso no build e sem teste vermelho. A
única coisa que denuncia é medir o efeito no navegador em vez de olhar o arquivo e concluir que
está escrito. Quem for mexer em `.palco` daqui para a frente: ela mora em **dois** arquivos.

### O que mudou de verdade

1. **Em 375 px o esboço mostra o calçado antes da lista de zonas, e ele fica (A39).** O `<svg>`
   começava a **1000 px** do topo numa tela de 812: a pessoa lia as nove zonas e só via o tênis
   depois de todas. Agora começa a **199 px**. Os dois números foram medidos do mesmo jeito, com a
   regra neutralizada e recolocada em tempo de execução, para as duas pontas serem comparáveis.
   Mesma decisão do R3-A30, e agora na terceira tela.

2. **O rodapé de saídas virou UM, e o bundle encolheu (A34).** O esboço era a única das quatro telas
   que não oferecia as irmãs, e a saída fácil era escrever o quinto rodapé à mão. Consertei a classe
   do defeito: `saidasDaTela.ts` (dados) mais `RodapeDeTelas.tsx` (componente burro), usados nos
   cinco pontos de chamada do `App.tsx`. Uma tela nova não tem como nascer com o mesmo buraco, e o
   chunk principal **encolheu de 457,00 para 455,98 kB**, a primeira vez em quatro rodadas que um
   item tira peso em vez de pôr.

3. **Corpo de pedido grande demais é recusado antes de ser lido (A37).** Medido antes do conserto:
   um corpo de 7.088.891 bytes era inteiramente lido e parseado em 202 ms, custando 13,4 MB de
   heap, para só então ser recusado por passar de 90 zonas. Em função serverless, cobrada por tempo
   e por memória, isso é conta paga para recusar pedido. O teto de 64 kB tem **duas** conferências,
   e as duas precisam existir: o `content-length` é barato e recusa antes de ler um byte, mas quem o
   escreve é o cliente; a contagem durante a leitura é a que não depende da palavra dele.

4. **Os oito atalhos de cor viraram alvo de 24 px com nome que se lê (A36).** Medido no fechamento,
   em 375x812: 24x24 px, e o primeiro com nome acessível `preto (#1B1B1F)`. O nome por extenso
   passou a viver junto do hex em `produtoDemo.ts`, e não numa tabela paralela na tela, porque
   tabela paralela é exatamente a forma como um nono hex entraria sem nome.

5. **A regra de copiar virou uma só, e o esboço ganhou o botão (A38).** A ordem é a lição do R3-A27
   aplicada: a regra SOBE primeiro para `src/lib/copia/` e a composição migra, e só então a segunda
   tela ganha o botão. A segunda tela nunca chega a ser a segunda implementação. Duas coisas que
   eram responsabilidade de quem chamava entraram no hook: o descarte do aviso, agora chaveado pelo
   texto (era um `setCopia('pronta')` escrito à mão dentro do `mudar()`, que qualquer caminho novo
   podia esquecer), e o diagnóstico da falha, que não fala do que está sendo copiado.

6. **Os tipos do three passaram a ser os da versão que roda (A40).** O segundo commit é o que impede
   a volta: varredura de fonte comparando as faixas declaradas entre si e o instalado contra o
   declarado, com guarda `not.toBeNull()` para que duas leituras nulas não passem por "iguais".

### Medidas, ponta a ponta

| | Abertura da rodada 4 | Fechamento |
|---|---|---|
| Testes verdes | 1161 | **1198** |
| Arquivos de teste | 80 | **85** |
| Banco / navegador | 58 / 25 | **58 / 25** |
| `npm run build` | 564 ms | 512 ms |
| Chunk principal | 457,00 kB | **457,16 kB** (+0,16) |
| CSS | 22,69 kB | **23,30 kB** (+0,61) |
| Chunk do three.js | 619,40 kB | 619,40 kB (igual) |
| `npm audit` | 0 | **0** |

Dos 37 testes novos, **34 estão nos 5 arquivos criados na rodada**, todos os 5 sobre coisas que
antes não tinham teste nenhum: o teto de bytes do corpo, a regra da cópia, o botão de copiar do
esboço, o conjunto de saídas de cada tela e o casamento das versões do three. Os 3 restantes
entraram em arquivos que já existiam.

### Mutações: o que sobreviveu, e o que foi feito com cada uma

Cinco mutações rodadas nesta rodada, três no A37 e duas no A38, que são os dois itens cujo código
novo é lógica pura. Os outros quatro itens não foram verificados por mutação, e não vale fingir que
foram: o A39 e o A36 são medida no navegador, o A34 é o conjunto de saídas preso por teste, e o A40
é varredura de fonte. Uma das cinco sobreviveu:

1. **Apagar `{ stream: true }` do `TextDecoder.decode` em `lerCorpoDoPedido`.** Sobreviveu aos 11
   testes, porque um corpo pequeno chega num pedaço só e a decodificação isolada de um pedaço
   inteiro dá no mesmo. **O conserto foi no TESTE**: um `ReadableStream` que parte os dois bytes do
   `ç` (0xC3 0xA7) entre dois pedaços à força, e aí a mutação morre com
   `expected { sola: '#C0392B', …(1) } to deeply equal { sola: '#C0392B', nota: 'cadarço' }`. O dano
   que isso evita não apareceria como erro: apareceria como `zone_key` que não casa com zona
   nenhuma do produto, ou seja, como "zona inexistente", longe da causa.

As outras quatro morreram, entre elas as duas do A38: copiar `requisicao` no lugar do corpo mata o
teste que afirma, pelo lado negativo, que a chave de exemplo não vai junto; e apagar o bloco do
aviso de falha mata o teste do caminho negado.

### Duas correções minhas, ditas por inteiro

Nenhuma das duas quebrou nada, e as duas teriam virado teste mentiroso se ficassem:

1. **Uma asserção tautológica** no teste do A34: `expect(ROTULO_DA_SAIDA[destino]).toBe(...)` com os
   dois lados idênticos, que passa sempre. Virou a afirmação de verdade: nenhuma saída oferecida cai
   num rótulo que não existe.

2. **Duas asserções apertadas demais** no teste do A37, que contavam bytes entregues pelo stream.
   As duas reprovaram, e o motivo é que o runtime adianta pedaços por conta própria: contar bytes
   mede o prefetch dele, não o que o módulo leu. A do `content-length` passou a afirmar
   `pedido.bodyUsed === false`, que responde exatamente a pergunta; a do streaming afirma
   `entregues < TOTAL / 2` com um comentário dizendo que o número exato não é afirmável e por quê.

### Um item ficou de fora, inteiro e de propósito

**A35**, o canvas do palco sem `tabindex`, `role` nem `aria-label`, continua no backlog. A metade
barata (dar nome acessível) não resolve a metade que importa (girar o modelo pelo teclado), e
entregar só a barata deixaria a tela parecendo acessível sem ser. Fica inteiro para uma rodada que
comporte a metade cara.

### Nada atrás de flag

Nenhum item desta rodada entrou atrás de configuração. Os seis são visíveis assim que a tela abre.

### Nenhuma pendência nova do dono

As três de sempre continuam: P01 (hook), P02 (revogar a chave `2aec9a55`) e P04 (os 8 tenants órfãos
de teste). Nenhuma delas é tarefa minha, e nenhuma virou mais urgente nesta rodada.
