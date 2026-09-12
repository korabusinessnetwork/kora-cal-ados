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
