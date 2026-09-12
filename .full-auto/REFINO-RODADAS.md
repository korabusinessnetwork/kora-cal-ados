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
