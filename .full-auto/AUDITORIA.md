# Auditoria do refino

O backlog vivo. Cada linha é algo que eu **vi**, com a evidência do que vi. Achado sem evidência
não entra, e preferência de estilo minha não é defeito.

**Score = (valor x 2) menos esforço menos (risco x 2)**, cada um de 1 a 5. Score abaixo de 2 fica no
backlog e não entra em rodada.

Primeira passada em 2026-09-12, sobre o commit `08e4d1d`, branch `refino/kora-calcados`.

## Como esta lista foi levantada

- App rodando em `npm run dev`, as telas abertas em navegador de verdade (`?tela=composicao`,
  `?tela=palco3d`, `?tela=esboco`, e `/` até o formulário de login), em 1440x900 e em 1024x768.
  **O editor de zonas logado não foi percorrido nesta passada**, porque entrar exige conta de um
  tenant real. Por isso os achados que tocam `src/features/` saíram de leitura de código, e estão
  marcados com a evidência que têm, não com uma tela que eu não vi.
- Leitura dirigida dos arquivos citados em cada achado, para separar sintoma de causa.
- `npm audit`, `tsc --noEmit`, `npm run build` com o aviso de chunk ligado, contagem de testes por
  diretório, e busca por `aria-pressed`, `aria-live` e `document.title` em `src/`.
- O que está registrado em ADR, `CLAUDE.md`, `memory/` ou `DECISOES.md` foi tratado como **decisão
  tomada**, não como defeito. Por isso não há linha sobre "o acervo é geometria grosseira", "não há
  prompt de IA" nem "a composição não é gravada".

---

## Acima do corte

### A01 FEITO na rodada 1, commit `14796e4` | eixo: ux | onde: `src/palco3d/palco3d.css:12` (regra `.palco3d__colunas`)

- **hoje:** o grid de três colunas vira uma coluna só abaixo de 1100 px, e a cena 3D é a do meio.
  Numa janela de 1024x768 os controles ocupam de y=309 a y=602 e o canvas começa em **y=789**, ou
  seja, inteiramente abaixo da dobra. Quem escolhe a cor não vê o calçado enquanto escolhe.
- **depois:** entre aproximadamente 860 e 1100 px a cena fica ao lado dos controles, como a tela de
  esboço já faz com três colunas no mesmo intervalo. Uma coluna só continua valendo no celular.
- **evidência:** medido com `getBoundingClientRect` nas duas larguras, 1024x768 e 1440x900. Em
  1440x900 as três colunas funcionam, o defeito é só do intervalo do meio.
- **por que dói:** é a tela onde o princípio nº1 é julgado a olho. Se o resultado não está na tela
  junto com o controle, a conferência "a cor escolhida é a cor que aparece" não acontece.
- valor: 5 | esforço: 2 | risco: 1 | **score: 6**

### A02 FEITO na rodada 1, commit `bdcd6de` | eixo: produto | onde: `src/palco3d/TelaDaComposicao.tsx`, `src/palco3d/composicaoDaTela.ts:98`

- **hoje:** não existe nenhuma forma de levar a composição montada para fora da tela. O objeto
  `{ forma_id, pecas }` é construído dentro de `montarDaTela` e morre lá. Por decisão do ADR-008 D6
  a composição também não é gravada no banco, então fechar a aba perde a montagem inteira.
- **depois:** um botão "Copiar composição" que põe no clipboard o mesmo JSON que a API recebe, com
  confirmação visível de que copiou.
- **evidência:** tela percorrida inteira, nenhum controle de saída; e a leitura de
  `composicaoDaTela.ts:98-104` mostra o objeto existindo só como variável local.
- **por que dói:** o ADR-008 diz que a composição é "JSON de algumas linhas". O configurador produz
  exatamente esse JSON e não deixa ninguém pegá-lo, o que quebra a ponte entre a tela e a API.
- valor: 4 | esforço: 2 | risco: 1 | **score: 4**

### A03 FEITO na rodada 1, commit `24e28ac` | eixo: robustez | onde: `src/features/produtos/hooks/useAssetBase.ts`, `VisualizacaoDoProduto.tsx:41`

- **hoje:** um asset-base que baixa com sucesso mas vem **vazio** (arquivo de 0 byte no bucket,
  truncado, ou conteúdo que não é SVG) vira `estado: 'pronto'` com `svg` falsy.
  `VisualizacaoDoProduto` então revela a área (`hidden={estado !== 'pronto'}`) enquanto
  `TelaDeProdutos.tsx:68` se recusa a montar o editor com `svg` vazio. Resultado: **painel em
  branco, sem erro, sem aviso, com o botão "Tentar de novo" escondido**, porque o estado diz que
  deu certo.
- **depois:** conteúdo vazio ou sem raiz `<svg>` é falha nomeada, cai no mesmo caminho de erro que
  já existe, com a mensagem dizendo qual arquivo veio vazio.
- **evidência:** leitura dos três arquivos. `baixarAssetBase` devolve `await resposta.text()` sem
  conferir nada, e nenhum dos dois consumidores trata "texto vazio".
- **por que dói:** é a família de defeito que este projeto caça, falha silenciosa que parece tela
  funcionando.
- valor: 5 | esforço: 2 | risco: 2 | **score: 4**

### A04 FEITO na rodada 1, commit `12701c5` | eixo: qualidade | onde: `src/features/sessao/ContextoDeSessao.tsx` (190 linhas)

- **hoje:** o `ProvedorDeSessao` é a máquina de seis estados que decide quem entra e com que tenant,
  e **não tem teste nenhum**. O único teste da pasta, `RotaProtegida.test.tsx`, monta o
  `ContextoDeSessao.Provider` com uma `Sessao` de mentira e testa só a tela.
- **depois:** teste do provedor com um cliente Supabase falso, cobrindo: sessão nula vira `anonimo`,
  zero tenants vira `sem-tenant`, um tenant entra direto em `pronta`, dois abrem
  `escolhendo-tenant`, tenant lembrado é respeitado, e `escolherTenant` com id de fora da lista é
  ignorado.
- **evidência:** `grep -rl ProvedorDeSessao src/` não devolve nenhum arquivo de teste.
- **por que dói:** é o caminho crítico de multi-tenant. `escolherTenant` já tem uma guarda contra id
  forasteiro (`ContextoDeSessao.tsx:148`) que hoje ninguém prende.
- valor: 4 | esforço: 2 | risco: 1 | **score: 4**

### A05 FEITO na rodada 1, commit `34d56a6` | eixo: ux | onde: `index.html:12`

- **hoje:** o título da aba é `Esboço · editor de zonas` nas quatro telas. Quem abre o configurador
  e o editor lado a lado vê duas abas idênticas. `document.title` não é escrito em lugar nenhum de
  `src/`.
- **depois:** cada tela escreve o próprio título, e o padrão do `index.html` passa a ser o nome do
  produto, não o de uma das telas.
- **evidência:** `grep -rn "document.title" src/` não devolve nada, e as quatro telas foram abertas.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A06 FEITO na rodada 1, commit `367539a` | eixo: ux | onde: `src/palco3d/TelaDaComposicao.tsx:190`

- **hoje:** o botão da categoria opcional escreve `sem {categoria}`, e como `categoria` é a chave
  crua, a tela mostra **"sem cadarco"**, sem cedilha, dentro de uma frase em português.
- **depois:** rótulo neutro, que não costura chave de dado dentro de prosa. `CategoriaDaForma` não
  tem campo `rotulo`, e inventar um é mudança de modelo, então o caminho barato é não usar a chave
  na frase.
- **evidência:** visto na tela `?tela=composicao`, categoria `cadarco`.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A07 FEITO na rodada 1, commit `231fdb2` | eixo: ux | onde: `src/palco3d/TelaDaComposicao.tsx:213`

- **hoje:** o controle de parâmetro mostra o valor atual, mas nunca a faixa. A pessoa arrasta sem
  saber onde está dentro do permitido. A tela irmã `?tela=palco3d` mostra "Faixa 10,0 mm a 40,0 mm"
  com o mesmo dado.
- **depois:** a faixa aparece junto do valor, no mesmo formato em milímetros que já existe.
- **evidência:** as duas telas abertas lado a lado, com a mesma peça.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A08 FEITO na rodada 1, commit `5e35551` | eixo: ux | onde: `src/palco3d/TelaDaComposicao.tsx:175`

- **hoje:** o botão da peça escolhida se distingue **só pela classe CSS** `palco3d__peca--ativa`.
  Não há `aria-pressed` em lugar nenhum de `src/`. Para leitor de tela, os botões de peça são
  idênticos e nenhum deles diz qual está valendo.
- **depois:** `aria-pressed` no botão de cada peça e no botão da categoria dispensada, refletindo a
  escolha.
- **evidência:** `grep -rn "aria-pressed" src/` não devolve nada.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A09 FEITO na rodada 2, commit `640234c` | eixo: qualidade | onde: `src/features/zonas/listarZonasDoProduto.ts`

- **hoje:** é o único módulo de `src/features/zonas/` sem teste ao lado. Os outros doze têm. Ele tem
  três comportamentos escritos em comentário e não presos por ninguém: recusa id vazio antes da
  rede, ordena por `created_at` (sem isso a lista embaralha a cada carga), e deixa o erro subir em
  vez de devolver `[]`.
- **depois:** teste com cliente falso para os três.
- **evidência:** `ls src/features/zonas/`, um `.test` para cada arquivo menos este.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A10 FEITO na rodada 2, commit `433e8eb` | eixo: robustez | onde: `src/features/sessao/ContextoDeSessao.tsx:95` e `RotaProtegida.tsx:43`

- **hoje:** se `carregarTenantsDoUsuario` falhar por rede, o `catch` põe o estado em `sem-tenant`.
  A tela então mostra o título **"Sua conta ainda não está vinculada a uma marca"** com a mensagem
  de rede embaixo, e o único botão é "Sair". Uma queda de rede é anunciada como problema de
  cadastro, e a saída oferecida destrói a sessão em vez de tentar de novo.
- **depois:** estado próprio de falha, com título que diz que não deu para carregar, e botão
  "Tentar de novo" ao lado de "Sair".
- **evidência:** leitura das duas passagens. O `sem-tenant` legítimo (zero vínculos) sai por
  `ContextoDeSessao.tsx:84`, e o de falha por `:97`, com o mesmo valor.
- **depende:** A04, porque mexer na máquina de estados sem teste é refatorar no escuro.
- valor: 4 | esforço: 2 | risco: 2 | **score: 2**

### A11 FEITO na rodada 2, commit `cf00aab` | eixo: ux | onde: `src/palco3d/PalcoDeModelo3d.tsx`, `TelaDaComposicao.tsx:124`

- **hoje:** o `<canvas>` da cena não tem nome acessível, e o resultado do clique numa peça aparece
  num `<code>` que muda sem nenhuma região viva. Não há `aria-live` em lugar nenhum de `src/`.
- **depois:** nome acessível no canvas, e a caixa "Peça clicada" como região viva educada.
- **evidência:** `grep -rn "aria-live" src/` não devolve nada; árvore de acessibilidade lida na tela.
- valor: 3 | esforço: 2 | risco: 1 | **score: 2**

---

## Achados da reauditoria da rodada 2 (2026-09-12)

Esta leva saiu de onde a auditoria da rodada 1 admitiu não ter ido: o editor de zonas logado. Sem
senha do `aurora-demo` registrada, e sem provisionar tenant novo só para olhar (criar linha no banco
real para auditoria é como nasceu o P04), a leitura do editor logado foi de CÓDIGO, com endereço de
linha. O que foi percorrido no navegador de verdade: a tela de login e o esboço do motor, que é o
editor 2D rodando sem banco.

### A18 FEITO na rodada 2, commit `53078f8` | eixo: ux | onde: `src/features/zonas/EditorDeZonas.tsx:164`, `FormularioDeNovaZona.tsx`

- **hoje:** gravar zona não diz que gravou. `aoSalvar` limpa marcação, rótulo, chave e cor, e mais
  nada acontece: não há mensagem, não há região viva. Quem CRIA zona vê a lista crescer, mas quem
  acrescenta elemento a uma zona existente tem como única prova a contagem daquela zona mudando de
  "3 elementos" para "4 elementos", num painel que pode estar fora da vista.
- **depois:** confirmação nomeada, dizendo qual zona e o que aconteceu com ela, apagada assim que a
  próxima marcação começa.
- **evidência:** leitura de `aoSalvar` e do formulário inteiro. O `CLAUDE.md` cobra os quatro
  estados com "feedback humano", e carregando, erro e vazio existem nesta tela; sucesso é o único
  que não existe.
- valor: 4 | esforço: 2 | risco: 1 | **score: 4**

### A19 FEITO na rodada 2, commit `06dc545` | eixo: ux | onde: `src/features/zonas/FormularioDeNovaZona.tsx:62`

- **hoje:** clicar numa parte do calçado muda "3 elementos marcados" e não anuncia nada. O clique
  acontece num SVG, o contorno é a confirmação, e contorno não é lido. Não existe **nenhum**
  `aria-live` em `src/` (`grep -rn "aria-live" src/` devolve zero).
- **depois:** a contagem vira região viva educada, que é o par do contorno para quem não o enxerga.
- **evidência:** `grep` acima, mais a leitura do palco (`PalcoDeMarcacao.tsx`), cujo realce é uma
  camada `aria-hidden="true"`, de propósito.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A22 FEITO na rodada 2, commit `5d5fc02` | eixo: qualidade | onde: `src/features/produtos/VisualizacaoDoProduto.tsx:43`

- **hoje:** a mesma frase, "N elementos", está escrita em quatro lugares, de três jeitos:
  `PainelDeZonas.tsx:151` tem a função `contar`, `FormularioDeNovaZona.tsx:63` repete a regra em
  linha, `esboco/PainelDeZonas.tsx:52` repete de novo, e `VisualizacaoDoProduto.tsx:43` **não trata
  o plural**: um modelo com 1 elemento marcável mostra "1 elementos marcáveis".
- **depois:** uma função só, usada pelos quatro, com o plural certo em todos.
- **evidência:** os quatro trechos, lidos. O comentário do próprio projeto em `PainelDeZonas.tsx:150`
  diz que "1 elementos" na tela do time lê como bug do sistema, o que torna a quarta ocorrência uma
  regra já decidida e esquecida, não uma preferência minha.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A17 FEITO na rodada 2, commit `01e8841` | eixo: ux | onde: `src/esboco/esboco.css:50` (regra `.colunas`)

- **hoje:** o esboço tem três colunas fixas e **nenhuma media query**. Medido: em 1024 px de
  viewport o documento fica com **1208 px** e a página rola na horizontal; em 375 px o viewport
  reportado vira 1208, ou seja, o celular desenha a página inteira encolhida. Só a partir de ~1425
  px o layout cabe.
- **depois:** o mesmo tratamento que A01 deu ao palco, duas quebras: painel que pode esperar desce,
  e abaixo disso empilha.
- **evidência:** `document.documentElement.scrollWidth` contra `window.innerWidth` nas três
  larguras, no navegador.
- **por que dói:** é a tela que o README aponta como a que funciona num clone recém-baixado, sem
  conta e sem `.env.local`. É a primeira coisa que alguém abre, e abre torta.
- valor: 3 | esforço: 2 | risco: 1 | **score: 2**

### A20 FEITO na rodada 2, commit `77281f9` | eixo: ux | onde: `src/esboco/PainelDeZonas.tsx:41` e `:88`

- **hoje:** no editor de cor do esboço, digitar hex inválido muda **só a classe CSS**: sem
  `aria-invalid`, sem mensagem, sem rótulo em nenhum dos dois campos (nem o `type="color"` nem o
  texto). E os botões de zona marcam a selecionada só pela classe `zona--ativa`, sem `aria-pressed`,
  que é o mesmo defeito que A08 consertou nas telas do palco.
- **depois:** rótulo nos dois campos, estado inválido anunciado com o motivo escrito, e a zona
  selecionada anunciada.
- **evidência:** digitado hex inválido na tela; o campo ficou com `editor__hex--invalido` e
  `aria-invalid` nulo, sem nenhum texto de erro no bloco. O editor de verdade
  (`features/zonas/PainelDeZonas.tsx`) já faz tudo isto certo, então a tela de demonstração do motor
  é a que está atrás.
- valor: 3 | esforço: 2 | risco: 1 | **score: 2**

---

## Abaixo do corte (backlog, não entra em rodada)

### A12 | eixo: ux | `sair()` sem estado de carregando

Os três botões que chamam `sair()` (`BarraDaSessao.tsx:35`, `RotaProtegida.tsx:50` e `:58`) não
desabilitam durante a chamada, então dois cliques disparam dois `signOut`. Na prática é inofensivo,
porque `signOut` é idempotente e a tela troca logo em seguida.
valor: 2 | esforço: 2 | risco: 1 | **score: 0**

### A13 | eixo: qualidade | não existe linter

Nem eslint nem prettier. Hoje o typecheck estrito com `noUncheckedIndexedAccess` e a revisão por
ciclo seguram a maior parte do que um linter pegaria, e ligar um agora produziria centenas de avisos
de estilo num código que não tem defeito de estilo conhecido.
valor: 4 | esforço: 4 | risco: 2 | **score: 0**

### A14 | eixo: qualidade | não existe CI

Não há `.github/`. Escrever o workflow cabe no projeto, mas **ligar** o Actions no repositório é
ação do dono, e a suíte depende de Chrome e de `.env.local` para não sumir em silêncio, o que exige
segredos que só ele pode cadastrar. Fica como pendência dele, não como tarefa minha.
valor: 4 | esforço: 3 | risco: 2 | **score: 1**

### A15 | eixo: robustez | chunk principal de 455 kB

455,03 kB, 131,84 kB comprimido, na primeira tela. O three.js já está separado e sob demanda, que
era o corte grande. Partir o resto exigiria rotas, e não existe roteador no projeto por decisão.
valor: 2 | esforço: 3 | risco: 3 | **score: -5**

### A16 | eixo: qualidade | 14 arquivos de produção acima de 200 linhas

O ADR-003 pede arquivo pequeno de responsabilidade única, e `zonas.css` tem 575 linhas. Quebrar
arquivo grande sem necessidade concreta é refatorar por métrica, e o risco de mexer em CSS sem
teste visual passa o ganho.
valor: 2 | esforço: 4 | risco: 3 | **score: -6**

### A25 | eixo: qualidade | `EditorDeZonas` não é montável em teste neste projeto

Nasceu dentro do A18. A confirmação de gravação some quando a próxima marcação começa, e isso
ficou verificado por leitura, não por teste: montar `EditorDeZonas` exige o cliente Supabase, e
substituí-lo exigiria mock de módulo, que este projeto não usa em lugar nenhum (`grep -rn "vi.mock"
src/` devolve zero). A saída seria injetar as dependências de rede por prop, como `ProvedorDeSessao`
já faz com `cliente`, e aí o componente inteiro passa a ser testável com o mesmo cliente falso dos
outros arquivos.

Não é defeito de comportamento, é um buraco de verificação num componente de 200 linhas que fica no
caminho crítico do princípio nº1. O risco 3 é honesto: mexer na assinatura de um componente que
ninguém consegue testar hoje é exatamente o tipo de mudança que quebra calada.
valor: 3 | esforço: 3 | risco: 3 | **score: -3**

### A23 | eixo: produto | a lista de modelos não diz quantos são

`ListaDeProdutos.tsx` tem o título "Modelos" e nenhuma contagem, e o cabeçalho do produto aberto
mostra "N elementos marcáveis" mas não quantas zonas já foram mapeadas.
valor: 2 | esforço: 1 | risco: 1 | **score: 1**

### A24 | eixo: ux | o foco não começa no primeiro campo do login

`TelaDeLogin.tsx` não põe foco no e-mail ao abrir. Quem usa teclado tabula duas vezes antes de
digitar. Foco automático também tem contra: rouba a rolagem em tela pequena.
valor: 2 | esforço: 1 | risco: 2 | **score: -1**

---

## Achados da reauditoria da rodada 3 (2026-09-12)

As duas primeiras rodadas varreram o que se vê. Esta foi atrás de duas coisas mais difíceis de
olhar: o que não tem teste no caminho crítico do editor, e o que acontece quando uma peça de
infraestrutura falha por baixo. O método foi o de sempre, sondar em vez de supor, e duas suspeitas
morreram na sonda, registradas abaixo em "o que eu achei que era defeito e não era".

### A27 | eixo: produto | onde: `src/palco3d/TelaDaComposicao.tsx:267` — **FEITO na rodada 3**

- **hoje:** o configurador escolhe cor SÓ pelo seletor do sistema operacional. O único campo é um
  `<input type="color">`, e o hex ao lado é um `<code>`, texto morto. Não existe onde digitar
  `#C0392B`.
- **depois:** campo de texto ao lado do seletor, como o esboço já tem, aceitando `#RGB` e `#RRGGBB`,
  com o preview mudando só quando a cor fecha.
- **evidência:** as linhas 267 a 273 lidas, e o contraste com `src/esboco/PainelDeZonas.tsx`, que
  tem os dois campos desde sempre. A marca chega com o hex do manual dela na mão; o configurador é
  a tela que o ADR-008 chama de produto vendável por si só, e nela a cor exata só dá para ser
  perseguida no conta-gotas. É o princípio nº1 pelo avesso: a cor que sai é a que entrou, mas não há
  como fazer entrar a cor certa.
- valor: 4 | esforço: 2 | risco: 1 | **score: 4**

### A26 | eixo: qualidade | onde: `src/features/zonas/hooks/useMarcacaoDeZona.ts:37` e `usePreviewDeCor.ts:43` — **FEITO na rodada 3**

- **hoje:** os dois hooks descartam o estado quando o `productId` muda, e esse descarte é a única
  coisa que impede a marcação de um modelo de ser gravada em outro e a cor de um calçado de pintar
  o calçado seguinte, porque `sola` existe nos dois. Os dois fazem isso com a técnica delicada de
  chamar `setState` DURANTE o render, e os dois comentários explicam que um `useEffect` deixaria
  passar um render intermediário. Nada disso tem teste: `grep -rln "useMarcacaoDeZona" src/*.test.*`
  e o mesmo para `usePreviewDeCor` devolvem zero.
- **depois:** teste de cada um montando um componente-sonda, trocando o `productId` e afirmando que
  o estado zerou no MESMO render, não no seguinte.
- **evidência:** os dois arquivos lidos e o grep. Diferente do A25, aqui não há obstáculo nenhum:
  nenhum dos dois toca a rede, e a rodada 1 já deixou no projeto o padrão de montar React em jsdom
  com sonda (`ContextoDeSessao.test.tsx`), sem testing-library e sem `vi.mock`.
- valor: 4 | esforço: 2 | risco: 1 | **score: 4**

### A29 | eixo: qualidade | onde: `src/lib/render/lerRegrasCss.ts:52` — **FEITO na rodada 3**

- **hoje:** `calcularEspecificidade` decide qual regra CSS ganha quando duas pintam o mesmo
  elemento, e é ela que define a cor do canônico que vai para o Storage. Os testes cobrem id contra
  classe, inline contra classe e `!important`, mas **não** o empate de especificidade, onde vence a
  última declarada, nem o seletor descendente. Achatar errado aqui muda a cor do arquivo canônico
  em silêncio, e o canônico é o que o editor e a API leem.
- **depois:** teste dos dois casos.
- **evidência:** sondei o comportamento atual antes de chamar de achado, e ele está **certo**:
  `.st0{#111} .st1{#222}` num elemento com as duas classes dá `#222222`, e `#g .st0` (10100) ganha
  de `.st0` (100). O achado não é bug, é comportamento correto que ninguém prende. O arquivo diz de
  si mesmo que é parser conservador porque errar aqui custa caro, e é justamente a parte cara que
  está descoberta.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A30 | eixo: ux | onde: `src/palco3d/palco3d.css` (`.palco3d__colunas`) — **FEITO na rodada 3**

- **hoje:** em 375 px, na tela da composição, o palco 3D começa a **1158 px** do topo, numa página
  de 2116 px. Quem troca a cor de uma peça mexe num controle lá em cima e o calçado está três telas
  abaixo. A tela que existe para mostrar a cor escolhida não mostra nada enquanto se escolhe. No
  palco 3D é o mesmo, começando a 657 px de 1590.
- **depois:** abaixo da quebra estreita, o palco vem ANTES dos controles, ou fica preso no topo.
- **evidência:** medido no navegador em 375x812, `getBoundingClientRect().top` da moldura contra
  `scrollHeight` do documento, nas duas telas do palco.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A28 | eixo: robustez | onde: `src/palco3d/PalcoDeModelo3d.tsx:236` — **FEITO na rodada 3**

- **hoje:** não há escuta de `webglcontextlost`. Contexto WebGL se perde na vida real: reset de
  driver, troca de GPU em notebook híbrido, contextos demais abertos. Quando acontece, o painel
  fica vazio, o laço de render continua chamando `render()` num contexto morto para sempre, e a
  frase embaixo do palco **continua dizendo "Peça na cena. Arraste para girar, clique para
  identificar."**
- **depois:** o evento é escutado, o laço para e a tela diz que o 3D caiu e como voltar.
- **evidência:** forçado no navegador com `WEBGL_lose_context.loseContext()`. `gl.isContextLost()`
  virou `true`, a captura de tela mostra o painel vazio, e o texto de estado seguiu afirmando que a
  peça está em cena. É o modo de falha que o `CLAUDE.md` proíbe em letra: estado sempre visível, e
  aqui a tela afirma o contrário do que mostra.
- valor: 3 | esforço: 2 | risco: 1 | **score: 2**

### A31 | eixo: ux | marcar zona é tarefa só de mouse (backlog)

`PalcoDeMarcacao.tsx:93` é um `<div onClick>` sobre o SVG injetado, e os elementos de dentro não
são focáveis. Não existe caminho de teclado para a tarefa central do editor. O conserto não é
barato e tem um obstáculo concreto: o comentário do arquivo registra que o markup precisa bater
BYTE A BYTE com a saída de `gerarVarianteDeCor` num teste, então acrescentar `tabindex` ao markup
quebraria essa comparação, e a alternativa é mexer no DOM por ref depois de montado, no arquivo
mais delicado do editor.
valor: 4 | esforço: 4 | risco: 4 | **score: -4**

### A32 | eixo: ux | o projeto não define nenhum estilo de foco (backlog)

`grep -rn ":focus" src/ --include="*.css"` devolve zero. Conferido no navegador com Tab de verdade:
`:focus-visible` casa e o Chrome desenha o anel padrão dele, visível sobre o fundo escuro. Ou seja,
hoje **funciona**, por conta do navegador, não por decisão do projeto. Fica anotado porque um anel
que ninguém escolheu é um anel que ninguém garante em outro navegador, não porque eu tenha visto
foco sumir.
valor: 2 | esforço: 2 | risco: 1 | **score: 0**

### A33 | eixo: qualidade | o baseline pisca vermelho sozinho — **FEITO na rodada 3**

`testes-de-navegador/corNaTela.test.ts > trocar a cor de uma zona muda só aquela peça` reprovou
sozinho, sem ninguém ter tocado no código, com **"a sola não ficou vermelha: expected undefined to
be defined"**. Capturado em 12/09/2026: 1 reprovação em 4 execuções de `npm test` completo, e o
mesmo arquivo passa 6 de 6 quando roda sozinho.

Por que isto é o achado mais caro da rodada, apesar de ser "só um teste": a regra de ouro do refino
é que toda rodada começa e termina com baseline verde, e ela pressupõe que vermelho significa "eu
quebrei". Um baseline que pisca destrói essa leitura, e o risco não é o teste, é o hábito que ele
cria: o vermelho intermitente ensina a rodar de novo em vez de investigar, e é exatamente assim que
uma regressão de verdade passa batida.

Causa provável, lida no código e não medida: `escreverNoControle` dispara o evento, e a leitura vem
logo em seguida esperando dois `requestAnimationFrame`, o que garante que o quadro é RECENTE, não
que ele já contenha a mudança pedida. Entre as duas coisas há o commit do React e o desenho seguinte
do palco. O leitor só repete a leitura quando o quadro vem inteiro vazio, nunca quando ele vem
pintado com a cor ANTIGA, que é justamente este caso.

Honestidade sobre a evidência: **não consegui reproduzir a corrida sob demanda**. Tentei duas vezes,
e as duas tentativas estão registradas no item "o que eu achei que era defeito e não era" abaixo,
porque falharam em provar o que eu queria provar.
valor: 5 | esforço: 1 | risco: 1 | **score: 7**

### O que eu achei que era defeito e não era

Registrado porque suspeita descartada também é resultado, e porque quem reler isto merece saber que
o caminho foi sondado em vez de suposto.

1. **"O canvas do palco renderiza em 300x150 e é esticado."** Medi o buffer do canvas e ele estava
   em 300 por 150, o padrão do HTML, dentro de uma caixa CSS de 607 por 476. Parecia render borrado
   e esticado. Era artefato da MEDIÇÃO: com o painel do navegador escondido o `requestAnimationFrame`
   fica parado, e é dentro dele que `setSize` roda. Com o painel à vista, o buffer é 607x476, igual
   à caixa. Não há defeito.
2. **"Falta limite de tamanho nos campos do editor."** Não há `maxLength` em nenhum input do
   projeto, mas `validarZoneKey` corta em 40 caracteres com mensagem que diz o que corrigir, e a
   gravação recusa antes da rede. É prevenção, só que na camada de baixo.
3. **As duas tentativas de reproduzir a corrida do A33 que não funcionaram.** A primeira leu o
   framebuffer sem esperar quadro nenhum: reproduziu "quadro vazio", que é outro caso, e que o
   leitor já trata com retry. A segunda rodou o arquivo seis vezes com seis processos ocupando a
   CPU, e passou seis vezes. Ou seja, a correção do A33 foi feita com a falha capturada em mãos mas
   sem reprodução sob demanda, e isso está dito no commit dela também.

4. **"Duplo clique em gravar pode criar zona duas vezes."** `FormularioDeNovaZona` desabilita os
   três campos e os dois botões enquanto `salvando` é verdadeiro. Já estava resolvido.

## Achados da reauditoria da rodada 4 (2026-09-12)

As três primeiras rodadas varreram o editor logado, o palco 3D e o motor. Esta foi atrás do que
sobrou sem varredura nenhuma: o **esboço**, que é a tela que um clone recém-baixado abre, a
**superfície de entrada do serverless**, e a **navegação entre as quatro telas**. O método foi usar
o sistema com o navegador em 375 px e forçar os estados chatos, mais leitura da borda da API.

Duas suspeitas morreram na sonda e estão registradas no fim da seção.

### A39 | eixo: ux | onde: `src/esboco/` (a folha de estilo do esboço) | **FEITO na rodada 4**

- **hoje:** em 375x812, na tela do esboço, o SVG do calçado começa a **998 px** do topo, numa página
  de 2529 px, enquanto o primeiro controle de zona está a **396 px**, dentro da primeira tela. Quem
  escolhe uma cor no celular mexe num controle visível e o calçado está 186 px abaixo da dobra. É o
  mesmo defeito que o A30 consertou nas duas telas do palco, na tela que o A30 não olhou.
- **depois:** abaixo da quebra estreita, o preview do calçado vem antes da lista de zonas, ou fica
  preso no topo, como o palco ficou.
- **evidência:** medido no navegador, `getBoundingClientRect().top + scrollY` do `<svg>` (998) contra
  o do botão da zona Cabedal (396) e o `scrollHeight` do documento (2529), em 375x812.
- **por que vale mais que o A30 valeu:** o esboço é a única tela que abre num clone sem `.env.local`
  e sem conta, é a que o README manda abrir primeiro, e o princípio nº1 é literalmente "marcar uma
  zona e ver a cor". Aqui não se vê.
- valor: 5 | esforço: 2 | risco: 2 | **score: 4**

### A37 | eixo: robustez | onde: `api/v1/products/[productId]/variants.ts:219` (`lerCorpoJson`) | **FEITO na rodada 4**

- **hoje:** `await pedido.json()` lê e parseia o corpo INTEIRO sem teto de bytes. O teto que existe é
  o de 90 zonas em `lerCoresPedidas`, e ele só é conferido depois do parse. O comentário do próprio
  `lerCoresPedidas` enumera as três dimensões do corpo e conclui que as outras duas já estão
  limitadas pelo motor, o que é verdade, mas as três são conferidas DEPOIS de o corpo inteiro já
  estar na memória. A dimensão em bytes é a única que ninguém limita, e o teto de zonas existe,
  segundo o próprio comentário dele, como "mitigação de custo zero contra cliente com laço mal
  escrito", que é exatamente este ator.
- **depois:** recusa por `content-length` antes de ler o corpo, e leitura com corte de bytes para o
  caso de a requisição chegar sem `content-length`. Código `CORPO_INVALIDO`, como as outras recusas
  de forma, decidido pela tabela de `traduzirParaFalhaDaApi`, nunca escrito no arquivo da rota.
- **evidência:** medido, não estimado. Um corpo de **7.088.891 bytes** com 300.000 pares foi
  inteiramente parseado por `Request.json()` em **202 ms**, custando **13,4 MB** de heap, antes de
  `lerCoresPedidas` poder recusá-lo por passar de 90 zonas.
- **o que limita o alcance, e está dito de propósito:** o corpo só é lido no passo 5, depois de
  autenticação e de o produto ser do tenant. Nenhum anônimo chega aqui. O ator real é chave válida
  com laço errado, ou chave vazada, que é o ator que o teto de zonas já mira.
- valor: 4 | esforço: 2 | risco: 2 | **score: 2**

### A38 | eixo: produto | onde: `src/esboco/` (o painel "Chamada equivalente") | **FEITO na rodada 4**

- **hoje:** o esboço monta na tela a chamada inteira, rota, `Authorization`, `Content-Type` e o JSON
  das 9 zonas, que é precisamente o que um integrador quer levar para o terminal ou para o ERP, e
  não existe um único botão de copiar na tela. A tela da composição, que mostra menos, tem
  "Copiar composição" com estado de falha e tudo.
- **depois:** copiar o corpo JSON da chamada equivalente, com o mesmo comportamento do botão da
  composição, inclusive a falha de área de transferência negada.
- **evidência:** `[...document.querySelectorAll('button')].filter(b => /copi/i.test(b.textContent))`
  devolve `[]` no esboço e o botão na composição.
- **como não virar a segunda implementação:** o estado da cópia hoje mora dentro de
  `TelaDaComposicao.tsx`. Pela regra de dependência de `src/features/README.md`, o que passa a ser
  usado por duas telas sobe para `src/lib/`. Primeiro commit sobe a regra, segundo usa nas duas.
- valor: 3 | esforço: 2 | risco: 1 | **score: 2**

### A40 | eixo: qualidade | onde: `package.json` (`@types/three`) | **FEITO na rodada 4**

- **hoje:** `three` roda em **0.186.0** e `@types/three` está preso em **^0.185.4**. O `tsc --noEmit`
  confere todas as chamadas de three contra a superfície da r185 enquanto a r186 executa. Num
  projeto cuja verificação inteira é typecheck mais testes, e cujo palco 3D é a parte que nenhum
  teste unitário alcança, isso é um buraco silencioso: o que a r186 renomeou passa verde no
  typecheck e falha no navegador.
- **depois:** `@types/three` em `^0.186.0`, typecheck limpo.
- **evidência:** `require('./node_modules/three/package.json').version` devolve `0.186.0` e o de
  `@types/three` devolve `0.185.4`; o `<canvas>` da tela da composição carrega
  `data-engine="three.js r186"`.
- **risco real:** nenhum em tempo de execução, tipo não executa. O único risco é o typecheck passar
  a acusar erro, que é justamente o que o item existe para descobrir, e é visível na hora.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A36 | eixo: ux | onde: `src/esboco/` (`.editor__atalho`, a paleta de atalhos) | **FEITO na rodada 4**

- **hoje:** os oito atalhos de cor são botões de **22x22 px**, colados uns nos outros, e o único
  nome acessível deles é o `title` com o hex (`#B23A2E`). Dois problemas num só: 22 px está abaixo
  do mínimo de 24x24 da WCAG 2.2 (2.5.8), e num celular errar o alvo aplica a cor errada na zona
  marcada; e ler "sustenido B 2 3 A 2 E" em voz alta não identifica cor nenhuma.
- **depois:** alvo de 24 px para cima e nome acessível que diga o que a cor é, com o hex junto.
- **evidência:** `getBoundingClientRect()` de cada um dos oito em 375x812 devolve 22x22, e
  `outerHTML` mostra `title="#1B1B1F"` sem `aria-label` nem texto.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A34 | eixo: ux | onde: `src/App.tsx:57` (o rodapé do esboço) | **FEITO na rodada 4**

- **hoje:** o rodapé do esboço tem **uma** saída, "ir para o editor (pede login)". As outras três
  telas oferecem as três irmãs cada uma. Ou seja: a tela que um clone abre sem conta oferece como
  único caminho justamente a que vai pedir credencial, e o palco 3D e o calçado montado, que também
  rodam sem banco, ficam indescobríveis para quem chegou pelo esboço.
- **depois:** o rodapé do esboço oferece as três irmãs, como os outros três oferecem.
- **evidência:** as quatro listas de botões lidas em `src/App.tsx` (linhas 57, 76, 116 e 154) e
  conferidas no navegador: o esboço renderiza um botão no rodapé, as outras telas renderizam três.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

## Abaixo do corte na rodada 4

### A35 | eixo: ux | onde: `src/palco3d/PalcoDeModelo3d.tsx` (o `<canvas>`) | **abaixo do corte, continua no backlog**

- **hoje:** o `<canvas>` do palco não tem `tabindex`, nem `role`, nem `aria-label`. Girar o calçado
  é só arrasto de mouse, então quem usa teclado não gira, e quem usa leitor de tela não recebe uma
  palavra sobre a única coisa que a tela mostra.
- **evidência:** o `outerHTML` do canvas traz `data-engine`, `width`, `height` e `style`, sem um
  atributo de acessibilidade sequer.
- **por que fica fora:** girar por teclado é trabalho de verdade, tratador de teclas mais a
  matemática da órbita, e o nome acessível sozinho, que seria barato, não resolve a metade que
  importa. Fica no backlog inteiro em vez de entrar pela metade.
- valor: 3 | esforço: 3 | risco: 2 | **score: -1**

## O que eu achei que era defeito e não era (rodada 4)

1. **A zona de gradiente aceitando cor.** Achei ter achado o avesso do princípio nº1: a zona
   "Detalhe (gradiente)" mostra "gradiente" em vez de hex, mas deixa escolher uma cor. Sondei
   escrevendo `#00FF00` nela. O sistema respondeu como devia e melhor do que eu esperava: recusou o
   pedido inteiro com `ZONA_NAO_RECOLORIVEL`, escreveu na tela que a zona usa `url(#brilho)` e não
   vira cor chapa, avisou que "a variante sai inteira ou não sai", **manteve o preview da última
   variante válida** e ofereceu um botão "Desfazer". Zero elementos verdes no SVG. Não é achado, é
   o princípio nº1 funcionando.

2. **Dependências atrasadas.** `npm outdated` lista nove pacotes com versão nova, entre eles React,
   Vite e Supabase. `npm audit --omit=dev` devolve **0 vulnerabilidades**. Sem CVE, atualizar por
   atualizar é risco sem valor medido, e a regra de custo do `CLAUDE.md` não pede isso. A única
   exceção é o `@types/three`, que não é atraso de versão, é divergência entre o tipo e o que roda,
   e por isso virou o A40.

3. **O log da requisição.** Fui atrás do que vaza para o log e não achei nada: `logDaRequisicao` não
   recebe o `Request`, não tem campo onde uma chave caiba, filtra o prefixo por uma regex de oito
   dígitos hexadecimais e descarta tudo depois do `?` da rota, com o porquê escrito ao lado.
   Endurecido de propósito.

4. **Contraste.** Varri as duas telas calculando a razão de contraste WCAG de todo elemento com
   texto contra o fundo herdado dele. Nenhum elemento abaixo do mínimo, nem na composição nem no
   esboço.

---

## Achados da reauditoria da rodada 5 (2026-09-12)

A rodada 4 varreu o esboço, a tela que um clone recém-baixado abre. Esta foi atrás de três coisas
que as quatro rodadas anteriores não tinham olhado: **o que acontece quando a máquina de quem
visita não tem o que a tela precisa**, **as regras do projeto que existem só como frase e não têm
guarda nenhuma**, e **o editor logado por baixo dos componentes**, que sempre foi auditado pela
tela e nunca pelos hooks que falam com a rede.

Método de sempre: sondar em vez de supor. Cinco suspeitas morreram na sonda e estão em "o que eu
achei que era defeito e não era", no fim desta seção.

### A46 FEITO na rodada 5, commit `2077f0a` | eixo: robustez | onde: `src/palco3d/PalcoDeModelo3d.tsx:159` (`criarPalco`)

**hoje:** `new WebGLRenderer()` é chamado dentro de um `useEffect` sem `try`. Num navegador sem
WebGL o three lança, o erro sobe do efeito, e **a página inteira fica em branco**. Não é só o
palco: some o cabeçalho, some o painel de peças, some o rodapé que levaria para o esboço, que não
precisa de WebGL nenhum. Não existe nenhum `ErrorBoundary` em `src/`, então não há onde o erro parar.

**evidência, medida no navegador e não deduzida:** com
`HTMLCanvasElement.prototype.getContext` devolvendo `null` para `webgl*` e o componente remontado
pela troca de tela, `document.body.innerText` ficou **vazio** e `document.querySelectorAll('canvas')`
devolveu **0**. O console mostrou `THREE.WebGLRenderer: Error creating WebGL context` seguido de
`Uncaught` vindo do `react-dom_client`.

**depois:** a falha de criação vira o mesmo estado de falha que o A28 já criou para o contexto
PERDIDO, com frase própria, e as outras telas continuam alcançáveis.

**por que o A28 não cobriu isto:** ele tratou o contexto que CAI depois de existir
(`webglcontextlost`). Aqui o contexto nunca chega a existir, e o caminho é outro: não há evento,
há exceção no construtor. A máquina de estado já está pronta (`EstadoDoPalco`, `ehFalha`), o que
falta é alguém entregar a falha a ela.

valor: 5 | esforço: 2 | risco: 2 | **score: 4**

### A41 FEITO na rodada 5, commit `88d273d` | eixo: qualidade | onde: `supabase/migrations/` e `supabase/tests/`

**hoje:** as 6 tabelas existentes têm RLS ligada e pelo menos uma policy, conferido uma a uma.
O que não existe é **guarda para a próxima**. O `CLAUDE.md` diz em letra: "Ao criar tabela/função
nova, lembrar que RLS precisa ser configurada", e "lembrar" é a palavra que denuncia: a regra vive
na memória de quem escreve. `isolamento.test.ts` confere o isolamento das tabelas que ele conhece
pelo nome, roda **contra o Supabase real** e é um dos 58 que **PULAM** numa máquina sem
`.env.local`. Ou seja, uma tabela nova sem RLS entra no repositório com a suíte verde.

**evidência:** `grep -c "create table" supabase/migrations/` devolve 6 e
`grep -c "enable row level security"` devolve 6, mas os dois números baterem hoje é coincidência
mantida à mão. `npx vitest run` mostra `58 skipped` nesta máquina quando `.env.local` não é
carregado, e é nesses 58 que o isolamento mora.

**depois:** varredura de fonte sobre `supabase/migrations/*.sql`, no molde de
`semServiceRoleNoFront.test.ts`, reprovando quando uma tabela criada não tem `enable row level
security`. Roda em `npm test`, sem banco, sem `.env.local` e sem rede.

**por que vale mais que parece:** `memory/identity.md` chama isolamento entre tenants concorrentes
de inegociável e o ADR-002 o trata como requisito comercial, não técnico. A verificação que protege
isso hoje é a que mais facilmente some em silêncio.

valor: 4 | esforço: 2 | risco: 1 | **score: 4**

### A45 FEITO na rodada 5, commits `7738fc9` e `5c25cdc` | eixo: qualidade | onde: `src/palco3d/` (quatro arquivos) e o projeto inteiro

**hoje:** quatro lugares afirmam que "a composição não é gravada em banco **(ADR-008 D6)**", e o D6
do ADR-008 é "Acervo base é da Kora; acervo do tenant é privado, sob RLS". Não fala de composição
nem de persistência. A decisão citada **não existe com esse número**, e olhando o ADR inteiro ela
não existe com número nenhum: o D2 chega a dizer o contrário em espírito, que a composição é "leve
de guardar e de mandar" e que "um calçado gerado pode ser aberto de novo daqui a um ano".

**evidência:** `grep -rn "ADR-008 D6" src/` devolve `composicaoDaTela.ts:90`,
`estadoDoPalco.test.ts:68`, `palco3d.css:215` e `TelaDaComposicao.tsx:109`, os quatro com a mesma
frase. `grep -E "^### D[0-9]" docs/08_DECISOES/adr-008-*.md` mostra D1 a D7, e o D6 é o do acervo.

**por que é perigoso e não só feio:** o `CLAUDE.md` decide conflito assim, em letra: "Se doc e
código conflitarem, **a documentação prevalece**". Um agente que for mexer nisso vai ler o D6, não
vai achar decisão nenhuma sobre persistir composição, e a conclusão razoável dele é que o código
está errado e a composição deveria ser gravada. A citação errada não confunde: ela aponta para a
conclusão oposta à verdadeira, e o mecanismo de resolver conflito do projeto a obedece.

**depois:** as quatro citações passam a dizer o que é verdade, e uma varredura de fonte confere que
todo `ADR-XXX DN` escrito em `src/`, `api/` e `supabase/` resolve para uma decisão que existe
naquele ADR. A varredura pega a metade mecânica (número inexistente); a metade semântica (número
que existe mas fala de outra coisa) continua sendo leitura, e isso fica dito no teste.

valor: 4 | esforço: 2 | risco: 1 | **score: 4**

### A47 FEITO na rodada 5, commit `84279b6` | eixo: produto | onde: `src/palco3d/TelaDaComposicao.tsx` (o bloco "Copiar composição")

**hoje:** dá para copiar o JSON da montagem e não dá para colá-lo de volta. O botão de copiar existe
justamente porque fechar a aba perde a montagem inteira, e sem o caminho de volta ele resolve
metade do problema: o JSON vai para a API, para o bloco de notas de alguém, para um chamado, e
nunca mais volta para a tela que o produziu.

**evidência:** os únicos caminhos que escrevem `escolhas` são `escolhasDaComposicao(DEMO)` na
montagem inicial e `mudarEscolhaDaTela` no clique. Não existe entrada de texto na tela, e recarregar
a página volta para a composição de demonstração.

**depois:** um campo onde colar o JSON, validado por `validarComposicao` antes de entrar na tela,
com a falha escrita em palavras. Composição inválida não chega ao palco.

**por que o esforço é 2 e não 4:** as três peças já existem e já têm teste.
`validarComposicao(entrada: unknown, catalogo)` aceita exatamente o que um `JSON.parse` devolve e já
recusa peça fora do acervo e forma misturada; `escolhasDaComposicao` converte composição validada em
estado de tela. O que falta é o campo e a ligação.

**por que o risco é 1:** o guarda que impede composição estragada de chegar ao palco é o mesmo que a
API usa, e ele já tem teste. O caminho novo não inventa validação própria, e é justamente inventar a
segunda validação que costuma ser o risco desse tipo de entrada.

valor: 4 | esforço: 2 | risco: 1 | **score: 4**

### A44 FEITO na rodada 5, commits `04e890b` e `f699fb3` | eixo: qualidade | onde: `src/features/*/hooks/` (três arquivos)

**hoje:** `useZonasDoProduto` (135 linhas), `useProdutos` (55) e `useAssetBase` (55) não têm teste
nenhum, e os três guardam a MESMA regra, escrita três vezes à mão: a `let vivo = true` com limpeza
no `return` do efeito, que impede a resposta do produto anterior de pintar a tela do produto novo.
O `useZonasDoProduto` guarda mais quatro: a comparação `produtoAberto.current === alvo` depois de
cada `await`, a recusa sem tenant antes da rede, a falha de gravação que não pode apagar a lista já
carregada, e a falha da RELEITURA que devolve `true` porque a gravação passou.

**evidência:** `grep -rl "useZonasDoProduto\|useProdutos\|useAssetBase" --include=*.test.*` devolve
**vazio** para os três.

**por que isto é o princípio nº1 e não higiene:** o modo de falhar de todas essas regras é o
silêncio. A zona do produto anterior aparecendo sobre o desenho do produto novo é marcar zona em
cima do desenho errado, que é literalmente o que o `CLAUDE.md` proíbe em "zona errada falha alto e
visível, nunca aplica a cor silenciosamente no lugar errado".

**por que o risco é 1, e não o 3 do A25:** o A25 continua parado porque montar `EditorDeZonas` exige
o cliente Supabase e o projeto não usa `vi.mock` em lugar nenhum. Aqui o obstáculo não existe:
`listarZonasDoProduto`, `gravarZonaNoBanco`, `listarProdutos` e `baixarAssetBase` **já recebem o
cliente por parâmetro**, e `clienteSupabase()` é instância única memoizada. Um parâmetro opcional
com esse valor por omissão deixa os pontos de chamada existentes intactos e abre os três hooks para
o mesmo cliente falso que o resto da pasta já usa.

valor: 4 | esforço: 3 | risco: 1 | **score: 3**

### A43 FEITO na rodada 5, commit `d5c262f` | eixo: ux | onde: `src/palco3d/TelaDoPalco3d.tsx:67`

**hoje:** o painel "Peça" diz, para quem visita, "Uma peça por vez. Montar as cinco numa cena só, e
colori-las, **é a próxima tarefa**". Isso deixou de ser verdade: a tela da composição monta as cinco
e colore cada uma. Desde o R4-A34 a frase ficou pior, porque o rodapé logo abaixo dela oferece "ver
o calçado montado (as peças juntas)", ou seja, a tela contradiz o próprio botão a dois palmos de
distância.

**evidência:** a frase está na tela, conferida no navegador em `?tela=palco3d`. A capacidade que ela
nega está em `?tela=composicao`, que monta o calçado inteiro e tem campo de cor por categoria.

**depois:** a frase diz o que é verdade e aponta para onde a coisa acontece.

**por que é ux e não só texto:** é a única afirmação do projeto inteiro sobre o que ele ainda não
sabe fazer, e ela está errada. `grep -rniE "próxima tarefa|em breve|por enquanto"` nos `.tsx` não
devolve nenhuma outra, então é instância, não classe, e o conserto é uma frase.

valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A42 | eixo: qualidade | README por diretório sem guarda (backlog, entrou na rodada 6)

O ADR-003 manda que **todo diretório novo ganhe um README.md de índice**, e sete diretórios com
código não têm: `src`, `api/v1`, `api/v1/products`, `api/v1/products/[productId]`,
`src/features/produtos/hooks`, `src/features/zonas/hooks` e `supabase`. Nada confere isso, e a
prova de que a regra escapa é que **eu mesmo a furei na rodada 4**: `src/lib/copia/` entrou sem
linha no índice de `src/lib/`, e o conserto foi um terceiro commit depois de eu notar a olho.

Fica no backlog e não no lote por dois motivos ditos: é o menor score dos sete achados, e o lote já
leva três itens de qualidade. Um quarto tiraria atenção do A46, que é o que apaga a página inteira.

valor: 3 | esforço: 2 | risco: 1 | **score: 2**

---

### O que eu achei que era defeito e não era (rodada 5)

1. **Oito diretórios de andaime vazios em `src/`** (`components`, `components/shared`, `constants`,
   `context`, `hooks`, `pages`, `styles`, `utils`). Pareciam sobra de template contrariando o
   ADR-003, e um agente poria um componente em `src/components/` só porque a pasta existe. Mas
   `git ls-files` neles devolve **vazio**: o git não versiona diretório vazio, então eles são
   sujeira desta cópia de trabalho e **um clone não os tem**. Não é defeito do projeto.

2. **`ADR-004 D1` em `recolorirModelo3d.ts:149`.** Parecia a segunda citação quebrada, porque o
   ADR-004 não tem nenhum cabeçalho `### D1`. Mas ele numera as decisões do dono numa tabela
   (`| 1 | Zona com gradiente/pattern | Erro ZONA_NAO_RECOLORIVEL |`), e a decisão 1 é exatamente o
   que o comentário afirma. É notação diferente, não citação errada, e é por isso que a varredura
   do A45 tem de aceitar as duas grafias em vez de exigir `### D1`.

3. **Nove pacotes atrás no `npm outdated`.** Todos a uma minor de distância, `npm audit` em zero
   vulnerabilidades. Já tinha sido julgado assim na rodada 4 e continua valendo: atraso de minor
   sem CVE não é defeito, é rotina de manutenção.

4. **Troca rápida de peça no palco 3D.** Suspeita de vazar contexto WebGL ou deixar a peça errada
   na cena. Sondado com 30 trocas em cerca de 2 segundos: **um** canvas ao final, estado "Peça na
   cena", zero erro no console. O `pedidoAtual` numerado faz o que o comentário dele promete.

5. **RLS das tabelas de hoje.** Conferida uma a uma: as 6 têm `enable row level security` e pelo
   menos uma policy, inclusive `tenant_api_keys`, que é a mais nova. O A41 não é uma tabela
   desprotegida, é a ausência de guarda para a próxima, e a diferença importa para não relatar
   risco que não existe.

---

## Achados da reauditoria da rodada 6 (2026-09-12)

A rodada 5 foi atrás do que a máquina de quem visita não tem, das regras sem guarda e dos hooks de
rede. Esta foi atrás de três outras coisas: **o que sobra na tela quando a falha já foi tratada**,
**o que a tela promete no próprio texto de ajuda e não entrega**, e **o que todo mundo baixa para
usar o que não precisa disso**. Mais o backlog que atravessou as rodadas anteriores.

Método de sempre: sondar em vez de supor. Três suspeitas morreram na sonda e estão em "o que eu
achei que era defeito e não era", no fim desta seção.

### A51 | eixo: robustez | onde: `src/App.tsx` (a raiz, e o projeto inteiro)

**hoje:** não existe `ErrorBoundary` em lugar nenhum de `src/`. `grep -rn "componentDidCatch\|
getDerivedStateFromError\|ErrorBoundary" src api` devolve só dois comentários, os dois escritos no
R5-A46 dizendo que a coisa não existe. Qualquer exceção durante o render ou dentro de um efeito
desmonta a árvore inteira: a pessoa fica com a página EM BRANCO, sem cabeçalho, sem rodapé e sem
caminho para outra tela.

**evidência, medida e não deduzida:** é a mesma medida do R5-A46, feita no navegador com
`getContext` devolvendo `null`: `document.body.innerText` ficou **vazio**. O A46 consertou aquele
caminho específico, o `new WebGLRenderer`, e fez bem, mas consertou UMA porta. A ausência de rede de
proteção continua exatamente igual para a próxima exceção, e o palco carrega glTF, faz `raycast` e
fala com o `three`, que é o tipo de código onde a próxima aparece.

**depois:** um `ErrorBoundary` na raiz que mostra o que aconteceu e mantém o rodapé de saídas de pé,
para a pessoa ir para outra tela em vez de recarregar no escuro. Com teste: componente que lança,
boundary que renderiza a saída, e a prova de que o resto da página continua no DOM.

**por que não é o A46 de novo:** o A46 é uma guarda de um caminho conhecido, dentro do componente
que sabe o que fazer com aquela falha específica. Esta é a rede por baixo dos caminhos que ninguém
listou. As duas são necessárias, e a ordem certa é justamente essa: primeiro a guarda que sabe o
nome do problema, depois a rede que não sabe.

valor: 4 | esforço: 2 | risco: 1 | **score: 4**

### A50 | eixo: produto | onde: `src/palco3d/TelaDaComposicao.tsx:207` (painel "Peça clicada")

**hoje:** o painel diz, no próprio texto de ajuda, "O nome do nó é o id da peça (ADR-007 D4), e a
zona que a API recolore é a categoria dela. **São os dois lados do mesmo endereço**". E então mostra
**um lado só**: o id do nó. A categoria, que é o lado que a API usa e o lado que tem controle de cor
na tela, a pessoa tem de descobrir olhando outra lista, mais abaixo, e casando as duas com o olho.

**evidência:** clicado no cabedal azul no navegador, em `?tela=composicao`. O painel mostrou
`prova-cabedal-baixo` e nada mais. A palavra `cabedal` existe na tela, na lista "Zonas do calçado",
a três itens de distância, e não há nada ligando uma coisa à outra.

**depois:** a peça clicada mostra os dois lados, id e categoria, e leva ao controle daquela
categoria. É o princípio nº1 na sua forma mais direta: quem clicou na peça quer pintar aquela peça,
e hoje o caminho entre uma coisa e outra é a memória da pessoa.

**por que é produto e não texto:** a ligação entre malha clicada e controle de cor é a tarefa
central da tela. O texto de ajuda já descreve a funcionalidade certa; o que falta é ela existir.

valor: 4 | esforço: 2 | risco: 1 | **score: 4**

### A49 | eixo: qualidade | onde: `src/palco3d/TelaDaComposicao.tsx` (391 linhas)

**hoje:** é o arquivo mais tocado do projeto nos últimos 30 dias (**15 commits**, contra 9 do
segundo colocado) e não tem um único teste de comportamento. As funções que ele chama têm teste
(`composicaoDaTela.test.ts`, `validarComposicao`), a ligação entre elas e a tela não tem nenhum.

**evidência:** `git log --since="30 days ago" --name-only` com contagem por arquivo, e a ausência de
`TelaDaComposicao.test.tsx` em `git ls-files`. O R5-A47 inteiro, a área de colar composição, foi
verificado **só à mão**, no navegador, e está escrito assim no commit dele.

**depois:** teste de comportamento montando a tela em jsdom, no molde do `TelaDoPalco3d.test.tsx`
que o R5-A43 criou: colar JSON válido monta o que foi colado, colar JSON recusado mantém o calçado
anterior de pé e escreve o motivo, e trocar de peça descarta o parâmetro da anterior (BUG-019).

**por que só agora:** montar esta tela em jsdom era impossível até o R5-A46, porque o
`WebGLRenderer` lançava e derrubava o teste junto. O A43 provou o caminho na tela irmã.

valor: 4 | esforço: 3 | risco: 1 | **score: 3**

### A48 | eixo: ux | onde: `src/palco3d/palco3d.css` (`.palco3d__moldura`) e as duas telas do palco

**hoje:** quando o 3D não pode ser iniciado (`contexto-negado`), a moldura preta continua na tela,
vazia, para sempre. Não é o estado de espera: é uma caixa preta que nunca vai receber nada, ocupando
a coluna principal, com a explicação embaixo dela.

**evidência, medida nas duas telas com `getContext` devolvendo `null`:** a moldura fica com
**532x320 px** no tamanho de janela do navegador da sessão e **375x340 px** em 375x812, com fundo
`rgb(20, 20, 27)`, `canvas` nenhum dentro, e a frase do erro começando a 365 px do topo. Nas duas
telas, palco e composição, o mesmo.

**depois:** no `contexto-negado`, a moldura não guarda mais espaço para o que não vem. A mensagem
ocupa o lugar dela, e a saída para o esboço fica junto do texto que manda ir para o esboço.

**por que não vale no `contexto-perdido`:** lá a moldura deve ficar, porque o contexto pode voltar e
a caixa é o lugar onde ele volta. A diferença entre os dois estados é exatamente esta, e é por isso
que o A46 os separou.

valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A52 | eixo: robustez | onde: `src/App.tsx` (o que entra no chunk principal)

**hoje:** o `@supabase/supabase-js` inteiro, com o cliente de realtime junto, está no **chunk
principal**, que todo mundo baixa. As três telas públicas, esboço, palco 3D e calçado montado, não
importam uma linha de `features/`, não falam com o banco e não têm para onde mandar requisição. Quem
abre um clone recém-baixado em `?tela=esboco` paga por um cliente de banco que aquela tela nunca vai
usar.

**evidência:** no `dist/assets/index-*.js`, de 457.450 bytes, a palavra `supabase` aparece **72
vezes** e `realtime` **23**. E `grep -rn "features/" src/esboco/*.tsx src/palco3d/*.tsx` devolve
**vazio**: as telas públicas não tocam em nada que leve ao cliente.

**depois:** a área protegida entra por `import()` tardio, do mesmo jeito e pelo mesmo motivo que o
palco já entra, e o cliente de banco sai do chunk que todo mundo baixa. A medida do antes e do
depois é o próprio tamanho do chunk principal, que já está na tabela do `BASELINE.md`.

**por que é o mesmo raciocínio já decidido:** o `App.tsx` diz, em comentário, por que o three.js não
vai no chunk principal: "o peso é do palco, e quem paga por ele é quem o abre". O cliente de banco
está na mesma situação e não recebeu o mesmo tratamento.

valor: 4 | esforço: 2 | risco: 2 | **score: 2**

### A42 | eixo: qualidade | README por diretório, agora com a evidência refeita

Já estava no backlog desde a rodada 5, com o mesmo score. A lista foi refeita nesta auditoria e
mudou: os diretórios com código e **sem** `README.md` hoje são `src`, `supabase`,
`supabase/migrations`, `src/features/produtos/hooks`, `src/features/zonas/hooks`,
`api/v1/products/[productId]` e os dois de `fixtures`. O `supabase/migrations` entrou na lista
**nesta rodada**, quando o R5-A41 pôs uma varredura lá dentro sem índice nenhum ao lado dela.

A prova de que a regra escapa continua sendo eu mesmo: furei na rodada 4 (`src/lib/copia/`) e de
novo na 5 (a varredura em `supabase/migrations/`). Regra que o autor da regra fura duas vezes em
duas rodadas é regra sem guarda, e este projeto já tem duas guardas desse feitio funcionando (A41 e
A45).

valor: 3 | esforço: 2 | risco: 1 | **score: 2**

---

### O que eu achei que era defeito e não era (rodada 6)

1. **Foco invisível no teclado.** O projeto tem **uma** regra `:focus` em 5 arquivos CSS, criada no
   R5-A47 para a área de colar. Parecia que o resto da navegação por teclado estava sem anel de
   foco. Sondado com `Tab` de verdade, e não com `focus()` por script, que não aciona
   `:focus-visible`: o anel do navegador aparece, `outline: auto 1px rgb(229, 151, 0)`, e
   `elemento.matches(':focus-visible')` devolve `true`. Não mexer.

2. **Arrastar o seletor de cor remontando o calçado a cada evento.** O `input type=color` dispara
   `input` continuamente, e cada disparo passa por `montarDaTela`, que valida e remonta o glTF
   inteiro. Medido com 20 mudanças de cor em sequência, esperando um quadro entre elas: **11 a 26 ms
   por mudança**, 358 ms no total, um canvas só no fim. Cabe em dois quadros e não justifica
   `debounce`, que acrescentaria atraso a uma tela cujo ponto é a cor aparecer na hora.

3. **Nome acessível faltando nos controles das telas públicas.** Varridos os 21 elementos
   focáveis da tela do calçado montado, calculando o nome por `aria-label`, `<label>` associado,
   texto e `title`: **nenhum** sem nome. O A35, do canvas, continua sendo o caso real, e continua
   inteiro no backlog pelo motivo já escrito.
