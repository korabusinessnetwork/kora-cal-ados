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

### A01 | eixo: ux | onde: `src/palco3d/palco3d.css:12` (regra `.palco3d__colunas`)

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

### A02 | eixo: produto | onde: `src/palco3d/TelaDaComposicao.tsx`, `src/palco3d/composicaoDaTela.ts:98`

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

### A03 | eixo: robustez | onde: `src/features/produtos/hooks/useAssetBase.ts`, `VisualizacaoDoProduto.tsx:41`

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

### A04 | eixo: qualidade | onde: `src/features/sessao/ContextoDeSessao.tsx` (190 linhas)

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

### A05 | eixo: ux | onde: `index.html:12`

- **hoje:** o título da aba é `Esboço · editor de zonas` nas quatro telas. Quem abre o configurador
  e o editor lado a lado vê duas abas idênticas. `document.title` não é escrito em lugar nenhum de
  `src/`.
- **depois:** cada tela escreve o próprio título, e o padrão do `index.html` passa a ser o nome do
  produto, não o de uma das telas.
- **evidência:** `grep -rn "document.title" src/` não devolve nada, e as quatro telas foram abertas.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A06 | eixo: ux | onde: `src/palco3d/TelaDaComposicao.tsx:190`

- **hoje:** o botão da categoria opcional escreve `sem {categoria}`, e como `categoria` é a chave
  crua, a tela mostra **"sem cadarco"**, sem cedilha, dentro de uma frase em português.
- **depois:** rótulo neutro, que não costura chave de dado dentro de prosa. `CategoriaDaForma` não
  tem campo `rotulo`, e inventar um é mudança de modelo, então o caminho barato é não usar a chave
  na frase.
- **evidência:** visto na tela `?tela=composicao`, categoria `cadarco`.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A07 | eixo: ux | onde: `src/palco3d/TelaDaComposicao.tsx:213`

- **hoje:** o controle de parâmetro mostra o valor atual, mas nunca a faixa. A pessoa arrasta sem
  saber onde está dentro do permitido. A tela irmã `?tela=palco3d` mostra "Faixa 10,0 mm a 40,0 mm"
  com o mesmo dado.
- **depois:** a faixa aparece junto do valor, no mesmo formato em milímetros que já existe.
- **evidência:** as duas telas abertas lado a lado, com a mesma peça.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A08 | eixo: ux | onde: `src/palco3d/TelaDaComposicao.tsx:175`

- **hoje:** o botão da peça escolhida se distingue **só pela classe CSS** `palco3d__peca--ativa`.
  Não há `aria-pressed` em lugar nenhum de `src/`. Para leitor de tela, os botões de peça são
  idênticos e nenhum deles diz qual está valendo.
- **depois:** `aria-pressed` no botão de cada peça e no botão da categoria dispensada, refletindo a
  escolha.
- **evidência:** `grep -rn "aria-pressed" src/` não devolve nada.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A09 | eixo: qualidade | onde: `src/features/zonas/listarZonasDoProduto.ts`

- **hoje:** é o único módulo de `src/features/zonas/` sem teste ao lado. Os outros doze têm. Ele tem
  três comportamentos escritos em comentário e não presos por ninguém: recusa id vazio antes da
  rede, ordena por `created_at` (sem isso a lista embaralha a cada carga), e deixa o erro subir em
  vez de devolver `[]`.
- **depois:** teste com cliente falso para os três.
- **evidência:** `ls src/features/zonas/`, um `.test` para cada arquivo menos este.
- valor: 3 | esforço: 1 | risco: 1 | **score: 3**

### A10 | eixo: robustez | onde: `src/features/sessao/ContextoDeSessao.tsx:95` e `RotaProtegida.tsx:43`

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

### A11 | eixo: ux | onde: `src/palco3d/PalcoDeModelo3d.tsx`, `TelaDaComposicao.tsx:124`

- **hoje:** o `<canvas>` da cena não tem nome acessível, e o resultado do clique numa peça aparece
  num `<code>` que muda sem nenhuma região viva. Não há `aria-live` em lugar nenhum de `src/`.
- **depois:** nome acessível no canvas, e a caixa "Peça clicada" como região viva educada.
- **evidência:** `grep -rn "aria-live" src/` não devolve nada; árvore de acessibilidade lida na tela.
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
