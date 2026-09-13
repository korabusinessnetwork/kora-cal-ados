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

---

## Rodada 5, fechada em 2026-09-12

**Lote:** 6 itens, em `TAREFAS.md`, seção "Refino, rodada 5". Nenhum com risco 4 ou 5.

| Item | Eixo | Score | Situação |
|---|---|---|---|
| R5-A46 navegador sem WebGL deixa de apagar a página inteira | robustez | 5 | entregue |
| R5-A41 tabela nova sem RLS vira teste vermelho | qualidade | 5 | entregue |
| R5-A45 as citações de ADR passam a dizer a verdade | qualidade | 4 | entregue |
| R5-A47 colar a composição de volta na tela | produto | 3 | entregue |
| R5-A44 os três hooks de rede do editor saem do escuro | qualidade | 3 | entregue |
| R5-A43 o palco 3D para de negar o que a composição já faz | ux | 3 | entregue |

Abaixo do corte e fora do lote: **A42**, README por diretório sem guarda, e **A35**, o canvas sem
teclado, que atravessa a quinta rodada pelo motivo já escrito.

**De onde veio a lista:** as quatro rodadas anteriores auditaram telas. Esta foi atrás de três
coisas que tela nenhuma mostra: o que acontece quando a máquina de quem visita **não tem** o que a
tela precisa, as regras do projeto que existem **só como frase** e não têm guarda nenhuma, e o
editor logado **por baixo** dos componentes, nos hooks que falam com a rede. Cinco suspeitas
morreram na sonda e estão em `AUDITORIA.md`.

---

## Rodada 5: o que foi entregue

**6 de 6 entregues, nenhum revertido.**

| Item | Trilha | Commit | Resultado |
|---|---|---|---|
| R5-A46 o contexto WebGL negado vira estado, não página em branco | robustez | `2077f0a` | entregue |
| R5-A41 varredura de RLS sobre as migrations | qualidade | `88d273d` | entregue |
| R5-A45 seis citações de ADR consertadas, mais a varredura | qualidade | `7738fc9`, `5c25cdc` | entregue |
| R5-A47 colar a composição de volta na tela | produto | `84279b6` | entregue |
| R5-A44 os três hooks de rede recebem o cliente, e ganham teste | qualidade | `04e890b`, `f699fb3` | entregue |
| R5-A43 o painel "Peça" para de prometer o que já existe | ux | `d5c262f` | entregue |

### O que mudou de verdade

1. **Máquina sem GPU utilizável para de apagar a página inteira (A46).** Medido antes: com
   `getContext` devolvendo `null` para `webgl*`, `document.body.innerText` ficava **vazio** e
   `querySelectorAll('canvas')` devolvia **0**. Não sumia só o palco, sumia o rodapé que levaria ao
   esboço, que não precisa de WebGL nenhum. Não existe `ErrorBoundary` em `src/`, então não havia
   onde o erro parar. Agora a falha de criação vira o quinto estado, `contexto-negado`, com frase
   própria, separada do `contexto-perdido` porque a orientação é oposta: no perdido, esperar; no
   negado, ir para o esboço, que desenha o mesmo tênis em SVG.

2. **Tabela criada sem RLS agora reprova em `npm test` (A41).** O `CLAUDE.md` mandava lembrar da
   RLS ao criar tabela, e nada conferia. A varredura é função pura sobre o texto das migrations, e
   por isso responde tanto a pergunta real quanto uma sintética que TEM de reprovar. Roda sem banco
   e sem `.env.local`, o que importa: a suíte que fala com o banco pula inteira numa máquina sem
   credencial, e uma guarda que pula não é guarda.

3. **Seis citações de ADR que mentiam passaram a dizer a verdade, e uma varredura confere (A45).**
   O defeito original era `ADR-008 D6` citado para a não persistência da composição, quando o D6
   fala de acervo da Kora contra acervo do tenant. **Duas das seis eu mesmo escrevi nesta rodada**,
   no A46, copiando a citação errada de um vizinho, que é exatamente como uma citação errada se
   multiplica. A varredura pega a metade mecânica (o número não existe) e **não** a semântica (o
   número existe e diz outra coisa), que era a forma do defeito original, e isso está escrito no
   README de `docs/08_DECISOES/` para ninguém confiar demais na guarda.

4. **O JSON da composição volta para a tela (A47).** Dava para copiar a montagem e não dava para
   colá-la de volta: o botão de copiar resolvia metade do problema. `escolhasDoTextoColado` é o
   inverso exato de `composicaoDasEscolhas` e passa pelo **mesmo** `validarComposicao` que a API
   usa, e não por uma conferência própria, senão a tela passaria a aceitar coisa diferente do que a
   API aceita. Uma conferência é da tela e não do validador, a da forma trocada, e ela pegou um erro
   meu de verdade no navegador: colei um `forma_id` inventado e a tela recusou sem derrubar o
   calçado que estava em cena.

5. **Os três hooks de rede do editor saíram do escuro, e o teste achou dois defeitos (A44).** Eles
   liam `clienteSupabase()` de dentro, o que os tornava inalcançáveis sem `vi.mock`, que este
   projeto não usa. Com o cliente por parâmetro, a sonda entrou, e o que ela achou está na seção
   seguinte, porque vale mais que a mudança em si.

6. **O painel "Peça" parou de prometer o que a tela ao lado já faz (A43).** A frase dizia que montar
   as cinco peças numa cena só era "a próxima tarefa", e desde o R4-A34 o rodapé logo abaixo
   oferecia "ver o calçado montado (as peças juntas)": a tela contradizia o próprio botão a dois
   palmos. Agora ela aponta, com o **mesmo nome** que o rodapé usa, lido de `ROTULO_DA_SAIDA` no
   teste para os dois não divergirem.

### O achado desta rodada: a guarda contra a corrida não olhava a metade que a tela mostra

Vale mais que qualquer item, do mesmo jeito que a classe CSS duplicada valeu na rodada 4.

Os três hooks já tinham guarda contra a resposta **atrasada**: `vivo` no efeito, e
`produtoAberto.current` no `gravar` das zonas. As três estavam certas e nenhuma tinha teste. Ao
escrever a sonda, o que apareceu não foi a resposta atrasada, foi outra coisa: **entre o render que
troca de id e o efeito que limpa o estado existe uma passagem inteira** em que a lista, o desenho e
as zonas do id ANTERIOR aparecem sob o id NOVO. Nenhuma das guardas olha essa janela, porque
nenhuma delas roda ali.

Uma passagem de render é a tela. Em `useProdutos` isso é nome de produto de uma marca visível na
tela de uma marca **concorrente**, que é precisamente o que o isolamento existe para impedir. No
editor é pior que exibição: é o desenho errado aceitando clique, e clique ali vira `svg_selector`
gravado no banco contra outro produto, parecendo correto e sobrevivendo à sessão.

O conserto é uma etiqueta: estado, lista e erro viram um objeto só com o campo `de`, dizendo de qual
id aquela leitura veio, e o render devolve leitura vazia quando a etiqueta não bate. As guardas
antigas **continuam**, e não são decorativas: a leitura é um lugar só, e sem elas a resposta morta
não apareceria (a etiqueta descarta) mas apagaria o que o id novo já mostrou, e ninguém recarregaria
depois.

Segundo defeito, achado no mesmo caminho: quem trocava de produto no meio de um `gravar` ficava com
**`salvando` ligado para sempre**, porque quem o desliga é o fim da gravação, e o fim da gravação era
justamente o trecho que se recusava a escrever quando a pessoa já tinha saído.

**O formato da falha é o que fica:** uma guarda correta, com comentário correto ao lado, cobrindo o
caso que quem a escreveu imaginou, e cega para o caso vizinho. O que a revelou não foi ler o código,
foi gravar **todas** as passagens de render, inclusive as intermediárias que o React descarta, e
afirmar sobre o conjunto em vez de sobre a última.

### Medidas, ponta a ponta

| | Abertura da rodada 5 | Fechamento |
|---|---|---|
| Testes verdes | 1198 | **1243** |
| Arquivos de teste | 85 | **92** |
| Banco / navegador | 58 / 25 | **58 / 25** |
| `npm run build` | 512 ms | 483 ms |
| Chunk principal | 457,16 kB | **457,75 kB** (+0,59) |
| CSS | 23,30 kB | **23,81 kB** (+0,51) |
| Chunk do three.js | 619,40 kB | **619,48 kB** (+0,08) |
| `npm audit` | 0 | **0** |

Dos 45 testes novos, seis arquivos foram criados na rodada, todos sobre coisas que não tinham teste
nenhum: o palco sem WebGL, a RLS das migrations, as citações de ADR, e os três hooks de rede. O
sétimo arquivo novo é o da tela do palco, que só passou a ser montável em jsdom **por causa do
A46**: sem ele, montar a tela num teste estouraria no `WebGLRenderer`.

### Mutações: quatro guardas, quatro mortas, e uma que sobreviveu primeiro

No A44 rodei uma mutação por guarda, e as quatro morreram:

1. etiqueta fora do render, nos três hooks: **4 vermelhos**, um por hook mais o do `gravar`;
2. `if (!vivo) return` apagado dos três efeitos: **3 vermelhos**;
3. `aindaVale()` apagado da releitura de depois de gravar: **1 vermelho**;
4. o fim da gravação de volta atrás do `aindaVale()`: **1 vermelho**.

A quarta **sobreviveu na primeira tentativa**, e isso está aqui porque é o tipo de coisa que se
esconde fácil: meu teste só olhava a tela do produto NOVO, e ali a etiqueta já resolvia sozinha. O
que o desligamento sem guarda acrescenta só aparece quando a pessoa **volta** para o produto em que
a gravação começou. Estendi o teste até essa volta, e aí a mutação morre. Mutação que sobrevive não
diz que a guarda é inútil, diz que o teste estava perguntando a coisa errada.

No A43 a mutação é a frase antiga de volta no lugar: **2 dos 3 testes** ficam vermelhos, e o
terceiro é o de contraprova, que continua verde de propósito, porque ele afirma só que a tela montou.

Os outros itens: o A46 teve a sua (removi o `try`, e os 4 testes do arquivo morrem), o A41 e o A45
são varreduras cuja contraprova é o texto sintético que TEM de reprovar, e o A47 é caminho de tela
conferido no navegador.

### Uma linha do baseline mudou de significado, e para melhor

O `tsc --noEmit` das colunas antigas olhava menos arquivos que o desta. O `include` do
`tsconfig.json` não continha `supabase/migrations` nem `docs/08_DECISOES`, então a varredura de RLS
criada no A41 rodava em `vitest` sem nunca passar pelo compilador: **a pior forma de passar limpo é
passar limpo porque ninguém olhou**. Corrigido em commit separado, `7738fc9`, de propósito, para
ficar legível no histórico.

### A piscada do `test:banco`, reconferida

No commit do A41 ficou registrado que uma execução do `test:banco` devolveu `1 failed | 57 passed` e
a execução seguinte devolveu 58 de 58, sem que eu tivesse capturado a mensagem. Prometi reconferir
no fechamento. **Reconferido: três execuções nesta rodada, todas 58 de 58**, uma no A44, uma no A43
e uma no fechamento. A piscada não voltou, e como não tenho a mensagem daquela vez, ela fica
registrada como episódio não explicado, e não como problema resolvido. O suspeito continua sendo a
cota de autenticação do plano gratuito, que é o D10.

### Nada atrás de flag

Nenhum item desta rodada entrou atrás de configuração. Os seis estão visíveis assim que a tela abre,
ou reprovam em `npm test`.

### Nenhuma pendência nova do dono

As três de sempre continuam: P01 (hook), P02 (revogar a chave `2aec9a55`) e P04 (os 8 tenants órfãos
de teste). Nenhuma virou mais urgente nesta rodada.

### Um limite de verificação, dito por inteiro

A tela do editor logado, que é onde os três hooks do A44 rodam de verdade, **não foi conferida no
navegador**: ela exige login, e eu não preencho credencial. O que sustenta o A44 são os 16 testes
novos, as quatro mutações e o baseline inteiro verde, não olho em tela.

---

## Rodada 6, fechada em 2026-09-12

**Lote:** 6 itens, em `TAREFAS.md`, seção "Refino, rodada 6". Nenhum com risco 4 ou 5, e o mais alto
foi 2.

| Item | Eixo | Score | Situação |
|---|---|---|---|
| R6-A51 a raiz ganha rede de proteção contra exceção de render | robustez | 4 | entregue |
| R6-A50 a peça clicada mostra os dois lados do endereço | produto | 4 | entregue |
| R6-A49 a tela da composição ganha teste de comportamento | qualidade | 3 | entregue |
| R6-A48 a moldura preta some quando o 3D não vai abrir | ux | 3 | entregue |
| R6-A42 README por diretório vira varredura, não lembrete | qualidade | 2 | entregue |
| R6-A52 o cliente de banco sai do chunk que todo mundo baixa | robustez | 2 | entregue |

Abaixo do corte e fora do lote: **A35**, o canvas sem teclado, que atravessa a sexta rodada pelo
motivo já escrito.

**De onde veio a lista:** três perguntas. O que SOBRA na tela depois de a falha já ter sido tratada,
o que a tela promete no próprio texto de ajuda e não entrega, e o que todo mundo baixa para usar o
que não precisa disso. Mais o backlog que atravessou as rodadas. Três suspeitas morreram na sonda e
estão em `AUDITORIA.md`, entre elas o anel de foco, que aparece de verdade num `Tab` de verdade, e o
custo de arrastar o seletor de cor, que é de 11 a 26 ms por mudança e não justifica `debounce` numa
tela cujo ponto é a cor aparecer na hora.

---

## Rodada 6: o que foi entregue

**6 de 6 entregues, nenhum revertido.**

| Item | Trilha | Commit | Resultado |
|---|---|---|---|
| R6-A51 a rede de proteção da raiz | robustez | `40d28c2`, `e1a16a8` | entregue |
| R6-A50 o nó e a zona juntos, com atalho para a cor | produto | `df3e77c`, `53bc89a` | entregue |
| R6-A49 seis testes de comportamento na tela da composição | qualidade | `44b2741`, `5b78dc1` | entregue |
| R6-A48 a moldura vazia some no `contexto-negado` | ux | `9a1a72d`, `ec2f1fd` | entregue |
| R6-A42 nove READMEs e a varredura que os cobra | qualidade | `cc80ca4`, `ac2d3ae` | entregue |
| R6-A52 o cliente de banco fora do chunk principal | robustez | `55a91ca`, `cff0fe3` | entregue |

### O que mudou de verdade

1. **Exceção de render deixa de apagar a página inteira (A51).** Não existia `ErrorBoundary` em
   lugar nenhum de `src/`: qualquer exceção durante o render desmontava a árvore, e
   `document.body.innerText` ficava vazio, sem cabeçalho, sem rodapé e sem caminho para outra tela.
   O R5-A46 tinha fechado UMA porta, a criação do contexto WebGL, dentro do componente que sabia o
   que fazer com aquela falha. Esta é a rede por baixo das portas que ninguém listou. As duas são
   necessárias, e os comentários dos dois arquivos dizem isso para nenhuma ser removida como
   redundante.

2. **A peça clicada mostra os dois lados do endereço (A50).** O painel dizia, no próprio texto de
   ajuda, "são os dois lados do mesmo endereço", e mostrava um lado só: o id do nó. A categoria, que
   é o lado que a API recolore e o lado que tem controle de cor na tela, a pessoa descobria casando
   duas listas com o olho. Agora vêm as duas, tiradas da MESMA montagem em cena, e um botão leva o
   foco direto ao seletor de cor daquela categoria.

3. **A tela mais tocada do projeto ganhou teste (A49).** `TelaDaComposicao.tsx` tinha 15 commits em
   30 dias, contra 9 do segundo colocado, e nenhum teste de comportamento. Montá-la em jsdom era
   impossível até o R5-A46, porque o `WebGLRenderer` lançava e derrubava o teste junto. São seis
   testes, e o que eles prendem é a ligação entre as regras puras, que já tinham teste cada uma, e a
   tela.

4. **A caixa preta vazia saiu da frente (A48).** No `contexto-negado` a moldura ficava na tela para
   sempre, 532x320 px de nada, com a explicação embaixo dela. A frase do erro subiu de 365 px do
   topo para 143 px, e para 160 px em 375x812. O `contexto-perdido` continua com a moldura de pé,
   conferido forçando `WEBGL_lose_context` no navegador, porque ali o contexto pode voltar e a caixa
   é o lugar onde ele volta.

5. **Nove diretórios sem índice, e a regra passou a ter guarda (A42).** A raiz do projeto era um
   deles: um clone recém-baixado não tinha uma linha dizendo o que o projeto é nem como rodar.
   Escrever a raiz foi decisão, não completude: com ela escrita, a varredura não precisa de lista de
   exceção nenhuma. Terceira guarda desse feitio, depois da RLS e das citações de ADR, e pelo mesmo
   motivo das outras duas: quem furou a regra duas vezes em duas rodadas fui eu, que a escrevi.

6. **O chunk principal caiu pela metade (A52).** De **457,75 kB para 218,97 kB**, de 133,12 kB para
   **70,15 kB** em gzip. O `@supabase/supabase-js`, com o cliente de realtime junto, estava no chunk
   que todo mundo baixa, e as três telas públicas não falam com o banco nem têm para onde mandar
   requisição. Agora a área protegida entra por `import()` tardio, do mesmo jeito e pelo mesmo
   motivo que o palco já entrava. Conferido no navegador: as três telas públicas abrem com ZERO
   requisição de módulo do Supabase.

### As medidas, antes e depois

| Medida | Abertura da rodada 6 | Fechamento |
|---|---|---|
| Testes verdes | 1243, 58 pulados | **1275**, 58 pulados |
| Testes contra o banco real | 58 de 58 | **58 de 58** |
| Testes em navegador | 25 | **25** |
| Chunk principal | 457,75 kB (gzip 133,12 kB) | **218,97 kB** (gzip 70,15 kB) |
| CSS | 23,81 kB | **24,67 kB** |
| Chunk do three.js | 619,48 kB | **619,51 kB** |
| `npm audit` | 0 | **0** |
| Diretórios com código e sem `README.md` | 9 | **0, e com varredura** |

### Uma mutação sobreviveu, e o que foi feito com ela

No teste da tela de "falta `.env.local`", trocar `{problema}` por uma frase fixa no JSX passava nos
três testes. O motivo: os dois nomes de variável aparecem SEMPRE na mensagem, porque a instrução
final diz o que escrever no arquivo, e o teste só procurava os nomes soltos no texto. O que muda com
o ambiente é a LISTA do começo, e era ela que precisava ser afirmada. O conserto foi no teste, que
perguntava a coisa errada, e a mutação morre agora. Está registrado dentro do próprio arquivo.

### O achado da rodada, o que vale guardar

**Duas listas idênticas uma embaixo da outra, e nenhum teste viu.** A rede de proteção do A51
desenhava as saídas para as outras telas, o que é certo quando ela é a única coisa de pé. Dentro do
`App`, porém, o rodapé fica FORA da rede e sobrevive à falha, então a mesma lista de três destinos
aparecia duas vezes seguidas, uma em links e outra em botões. Todos os testes passavam, porque cada
um perguntava por uma lista e achava uma. Foi visto no navegador, e só lá. O conserto virou a prop
`comSaidas`, e o sexto teste do arquivo existe para isso não voltar.

### Limites de verificação, ditos por inteiro

- **O editor logado continua sem conferência no navegador.** Ele exige login, e eu não preencho
  credencial. O que foi conferido da área protegida é a tela de login renderizando com um rodapé só,
  e a tela de configuração ausente, esta em jsdom.
- **A metade `contexto-perdido` do A48 não tem teste automático.** Criar um contexto WebGL de
  verdade em jsdom é impossível, que é o mesmo limite que o A46 já tinha. Foi conferida à mão, no
  navegador, forçando `WEBGL_lose_context`.
- **A varredura de README não promete que o índice esteja bom**, só que exista. Índice ruim continua
  sendo leitura humana, e está escrito assim dentro do teste.
- **A guarda do chunk não promete que o chunk esteja pequeno**, só que o `App.tsx` não volte a
  importar `features/` de forma estática. O elo entre uma coisa e outra foi medido: devolver um
  `import` comum de `features/sessao/BarraDaSessao` ao `App.tsx` reprova a varredura E devolve as 72
  ocorrências de `supabase` ao chunk principal, que sobe para 432,21 kB.

---

## Rodada 7, fechada em 2026-09-12

**Lote:** 6 itens, em `TAREFAS.md`, seção "Refino, rodada 7". Nenhum com risco 4 ou 5, e o mais alto
foi 2.

| Item | Eixo | Score | Situação |
|---|---|---|---|
| R7-A53 chave estrangeira sem índice que a lidere | robustez | 5 | entregue |
| R7-A55 região viva dentro de região viva no painel de colar | ux | 3 | entregue |
| R7-A56 o botão Voltar do navegador não andava entre as telas | ux | 2 | entregue |
| R7-A57 o F5 perdia a composição | produto | 2 | entregue |
| R7-A58 só o primeiro parâmetro da peça tinha controle | robustez | 2 | entregue |
| R7-A54 a tela da composição com 447 linhas | qualidade | 3 | entregue |

Abaixo do corte e fora do lote: **A35**, o canvas sem teclado, pela sétima rodada.

**De onde veio a lista:** três perguntas. O que o navegador oferece de graça e o app joga fora
(Voltar, F5), o que o banco faz em toda consulta de todo mundo (o `auth_tenant_ids()` das políticas),
e o que a tela mais tocada do projeto esconde de quem não enxerga o canvas. Sete suspeitas morreram
na sonda e estão em `AUDITORIA.md`.

---

## Rodada 7: o que foi entregue

**6 de 6 entregues, nenhum revertido.**

| Item | Trilha | Commit | Resultado |
|---|---|---|---|
| R7-A53 dois índices e a varredura de chave estrangeira | robustez | `e11f072` | entregue, migration **não aplicada** no banco real (P05) |
| R7-A55 uma região viva só, com `role` pelo desfecho | ux | `282626b` | entregue |
| R7-A56 `pushState` mais ouvinte de `popstate` | ux | `ccae056` | entregue |
| R7-A57 a composição guardada no navegador | produto | `b982977`, `3c4a921` | entregue |
| R7-A58 um controle por parâmetro, e mudança que soma | robustez | `a7c1975`, `4d7033f` | entregue |
| R7-A54 tela mais quatro painéis | qualidade | `3671802` | entregue |

### O que mudou de verdade

1. **As políticas de RLS deixam de depender de um índice que não servia (A53).** `auth_tenant_ids()`
   aparece em 15 predicados das políticas ativas e consulta `tenant_members` por `user_id`. O único
   índice que tocava essa coluna era composto com `tenant_id` na frente, e composto não serve para
   busca pela segunda coluna. A varredura nova, `indiceEmChaveEstrangeira.test.ts`, lê as migrations
   e reprova chave estrangeira sem índice que a lidere. Na primeira execução ela achou um caso que eu
   não tinha visto: `tenant_api_keys.created_by`, com `on delete set null`, que faria cada remoção de
   usuário varrer a tabela de chaves. Os dois ganharam índice na mesma migration. **A migration não
   foi aplicada no Supabase real**, porque DDL no banco de verdade é decisão do dono, e está em
   `PENDENCIAS-DO-MATHEUS.md` como P05, com a consulta que confirma.

2. **Leitor de tela para de receber duas regiões vivas aninhadas (A55).** O painel de colar tinha um
   `role="alert"` dentro de uma `div` com `aria-live="polite"`. Agora é uma região só, `alert` na
   recusa e `status` no aceite. O aceite antes não era anunciado de jeito nenhum: a montagem nova
   acontece dentro do canvas, onde quem não enxerga não recebe notícia.

3. **Voltar anda entre as telas (A56).** `irPara` usava `replaceState`. Medido antes:
   `history.length` parado em 28 em três navegações seguidas, e Voltar saía do app. Agora empilha, e
   um ouvinte de `popstate` relê a tela da URL. Conferido no navegador: 28, 29, 30, e Voltar e
   Avançar trazem título e conteúdo juntos.

4. **O F5 não perde mais a composição (A57).** Antes: cabedal pintado de `#22aa44`, F5, `#1f4fa8`.
   Depois: `#22aa44`. O que fica no `localStorage` é o mesmo JSON do botão de copiar, e ele volta
   pelo mesmo guarda da colagem. Gravação velha que o acervo não aceita mais é recusada e apagada, e
   a tela abre no padrão, inteiro e correto. Armazenamento bloqueado não derruba nada. Custo medido:
   **0,048 ms por gravação**.

5. **O segundo parâmetro de uma peça passa a existir na tela (A58).** Eram dois defeitos na mesma
   linha: a tela lia `parametros[0]`, e mexer num parâmetro mandava um objeto com uma chave só, que
   substituía o anterior. Nenhum dos dois aparecia porque o acervo de prova só tem peça de um
   parâmetro; o primeiro acervo real com peça de dois é que teria descoberto. O teste usa uma peça
   sintética de dois.

6. **A tela da composição cai de 457 para 195 linhas (A54).** Quatro painéis em arquivos próprios.
   Os catorze testes da tela ficaram intocados, e um teste descartável mostrou o HTML da tela
   **idêntico byte a byte** antes e depois, na abertura e depois de uma colagem.

### As medidas, antes e depois

| Medida | Abertura da rodada 7 | Fechamento |
|---|---|---|
| Testes verdes | 1275, 58 pulados | **1308**, 58 pulados |
| Testes contra o banco real | 58 de 58 | **58 de 58** |
| Testes em navegador | 25 | **25** |
| Chunk principal | 218,97 kB (gzip 70,15 kB) | **219,12 kB** (gzip 70,19 kB) |
| Chunk tardio da tela da composição | não medido na abertura | **27,22 kB** (26,90 kB depois do A58) |
| CSS | 24,67 kB | **24,77 kB** |
| Chunk do three.js | 619,51 kB | 619,51 kB |
| `npm audit` | 0 | **0** |
| `TelaDaComposicao.tsx` | 447 linhas | **195 linhas** |
| Chaves estrangeiras sem índice que as lidere, nas migrations | 2 | **0, e com varredura** |

### Mutações

Todas as mutações à mão morreram no fim, 21 no total. **Uma sobreviveu no meio do caminho**, no A56:
o teste da limpeza do ouvinte disparava `popstate` depois de desmontar e conferia que o título não
mudava, só que numa árvore desmontada o título não muda com limpeza ou sem ela. O teste perguntava a
coisa errada. Foi reescrito para afirmar a identidade da função removida, e a mutação morre agora.

### Dois critérios estavam errados, e foram corrigidos às claras

- **A56:** eu escrevi "a primeira carga continua usando `replaceState`", e a primeira carga nunca
  usou. A cláusula está corrigida na nota do item, e não apagada.
- **A54:** eu escrevi "os seis testes de comportamento da tela", e quando o item rodou já eram
  catorze, porque A55 e A57 somaram oito. A garantia valeu para os catorze.

### Vistos de passagem, anteriores a esta rodada, para a reauditoria

- **200 eventos de cor no MESMO tique** fazem o React lançar "Maximum update depth exceeded" três
  vezes na tela da composição. Acontece igual com o A57 guardado em `git stash`, então não é deste
  lote. Com um evento por quadro, que é o que um arrasto de verdade produz, 120 eventos deram zero
  erros. Precisa de sonda antes de virar achado, porque pode ser só o limite de um cenário que não
  existe.
- **`TelaDoPalco3d.tsx` tem o mesmo `parametros[0]`** que o A58 consertou na outra tela. Ficou fora
  porque não estava no escopo escrito do item.

### Limites de verificação, ditos por inteiro

- **O A53 não tem `explain` do plano de consulta.** Daqui não há acesso direto ao Postgres, só pelo
  cliente do Supabase, e a migration nem foi aplicada no banco real. O que está provado é que o
  índice existe nas migrations e que a varredura reprova sem ele. O ganho em tempo de consulta não
  foi medido e não está afirmado.
- **O editor logado continua sem conferência no navegador**, pelo mesmo motivo de sempre: eu não
  preencho credencial.
