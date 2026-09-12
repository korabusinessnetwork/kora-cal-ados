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
