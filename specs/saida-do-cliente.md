# Saída do cliente: o pacote de exportação de um tenant (T16)

## 0. De onde esta tarefa vem

O ADR-009 decide que uma marca pode sair da Kora levando o que é dela, em formato aberto, e escreve
qual é o teste que prova isso: **não é "o zip foi gerado", é "o zip contém uma zona que foi
marcada"**. A marcação de zona é, palavras do próprio ADR, "a parte cara de refazer". Um pacote
bonito sem ela é um arquivo, não uma saída.

A tarefa também é, na prática, uma decisão comercial virando código. O produto é SaaS B2B
multi-tenant onde marcas concorrentes coabitam, e a pergunta "e se eu quiser sair?" é feita ANTES
da assinatura, não depois. Ter a resposta pronta e executável é argumento de venda; tê-la só no
contrato é promessa.

## 1. Escopo

Um script de linha de comando que produz o pacote de saída de um tenant em zip, e um teste contra o
banco de verdade que confere que a zona marcada está lá dentro.

## 2. Fora de escopo

- **Excluir os dados.** É operação separada de propósito (D5 abaixo), e o script de exclusão não
  existe ainda justamente porque esta é a ordem certa de construir as duas coisas.
- **Tela de autoatendimento.** ADR-009 D4 põe a exportação no mesmo balcão de `provisionarTenant` e
  `criarChaveDeApi`: operação rara, de dono. Construir UI para algo que acontece uma vez por
  cliente cancelado é investir no lugar errado. Quando houver self-serve, vira botão.
- **Renderizar as variantes.** Elas saem como receita de cor. O motivo está em D3.

## 3. Decisões que o build não pode redecidir

### D1. O ZIP é escrito à mão, sobre `node:zlib`

A alternativa era uma dependência nova (`archiver`, `jszip`) para um script que roda raramente. O
`zlib` já vem no Node, e o formato ZIP é cabeçalho local, diretório central e EOCD: três estruturas
de campos fixos. Custou um arquivo de ~220 linhas com 16 testes, incluindo os vetores conhecidos de
CRC-32 (`crc32('') === 0`, `crc32('123456789') === 0xcbf43926`), que é o que impede um erro de
tabela de passar despercebido.

Um escritor de formato só vale se um leitor de terceiro concordar com ele, então o pacote foi
aberto por dois programas que não são nossos: o `Expand-Archive` do .NET e o `bsdtar` do Windows.
Os dois leram a estrutura de pastas, o nome de arquivo acentuado (`cadarço`) e o conteúdo binário
byte a byte.

### D2. Quatro arquivos, e a fronteira é o que cada um decide

| Arquivo | Decide |
|---|---|
| `zip.ts` | formato |
| `montarPacoteDeSaida.ts` | política: o que sai, como fica organizado, o que o cliente lê |
| `lerSaidaDoTenant.ts` | banco: quais consultas, quais campos |
| `exportarTenant.ts` | linha de comando: argumentos, disco, o que aparece no terminal |

A razão está na seção Consequências do ADR-009: **código que roda raramente apodrece sem ninguém
notar.** Com formato e política separados do banco, as duas partes que carregam a decisão têm teste
puro rodando todo dia (34 testes), e sobra para o teste de banco só o que exige Postgres e Storage
de verdade.

A separação entre `lerSaidaDoTenant.ts` e `exportarTenant.ts` tem uma segunda razão, prática: o
script de CLI roda `principal()` ao ser importado, então um teste não consegue chamá-lo sem
disparar o programa inteiro. A leitura precisava ser uma função normal para o teste de banco
existir.

### D3. `rendered_path` fica de fora, e a variante sai como receita

O campo aponta para o Storage da Kora e não significa nada fora daqui. Exportá-lo entregaria ao
cliente um endereço que ele não consegue abrir, o que é pior do que omitir: parece que veio e não
veio. A variante sai como `zone_colors`, a cor de cada zona, que é o dado que permite gerar de
novo em qualquer lugar.

Consequência que o cliente precisa saber na hora certa, e por isso está escrita dentro do próprio
pacote: **gerar as imagens pela API antes de encerrar o contrato**, enquanto a chave ainda
responde. É o único passo da saída que tem hora marcada.

### D4. O `LEIA-ME.md` diz o que NÃO está no pacote

Uma saída que entrega a receita e guarda os ingredientes, sem avisar, é promessa falsa que o
cliente descobre no pior momento possível. O documento diz de frente as três ausências: o acervo
base da Kora (o calçado gerado depende de peças que continuam sendo da Kora), as variantes
renderizadas, e dado pessoal de usuário. E traz a contagem do que veio, para dar para conferir o
pacote sem abrir arquivo por arquivo.

### D5. Exportar não apaga nada

Duas operações separadas. Assim não existe o caso em que o pacote saiu incompleto e o original já
não existe. O teste de banco confere isso depois de exportar: tenant, zonas e o objeto no Storage
continuam lá.

### D6. A pasta do produto leva nome legível E pedaço do id

`produtos/runner-2026-f8989c4f`. Só o nome não serve: dois produtos do mesmo tenant podem se chamar
igual, e duas pastas de mesmo nome dentro de um ZIP fazem uma sobrescrever a outra na extração, com
o cliente perdendo um produto inteiro sem nenhum aviso. Só o id também não serve: um pacote de
pastas UUID é ilegível para quem abre.

### D7. Slug inexistente é erro, nunca pacote vazio

Um erro de digitação no `--slug` produziria um pacote com zero produtos, indistinguível de um
tenant que nunca subiu nada. Entregar isso a quem está cancelando um contrato seria o pior desfecho
desta operação. `TenantNaoEncontrado` é classe própria para quem chama conseguir distinguir "não
existe" de "existe e está vazio", e o CLI a traduz numa linha em vez de um stack trace.

### D8. Asset que sumiu do Storage não derruba a exportação

O download avisa e segue. Quem está exportando está cancelando um contrato: entregar o pacote sem
um arquivo, com o aviso no terminal, vale mais do que não entregar pacote. O CLI repete a contagem
de produtos sem asset no fim da saída, porque é a única coisa ali que pede decisão de quem operou.

A leitura usa `products.base_asset_path`, o caminho que foi GRAVADO, e nunca remonta o path com
`caminhoDoAssetBase` (o comentário daquele módulo pede isso em letra). Remontar faria a exportação
procurar o arquivo onde ele deveria estar, em vez de onde ele está, e um produto migrado sairia sem
asset nenhum.

## 4. Arquivos

### Novos

| Arquivo | O que é |
|---|---|
| `supabase/scripts/zip.ts` | Escritor e leitor de ZIP sobre `node:zlib` |
| `supabase/scripts/zip.test.ts` | 16 testes, incluindo vetores conhecidos de CRC-32 |
| `supabase/scripts/montarPacoteDeSaida.ts` | Puro: o conteúdo e a organização do pacote |
| `supabase/scripts/montarPacoteDeSaida.test.ts` | 18 testes de política, sem banco |
| `supabase/scripts/lerSaidaDoTenant.ts` | As quatro consultas, de campos explícitos |
| `supabase/scripts/exportarTenant.ts` | O CLI |
| `supabase/tests/exportarTenant.test.ts` | 10 testes contra o banco de verdade |
| `specs/saida-do-cliente.md` | este documento |

### Modificados

| Arquivo | Mudança |
|---|---|
| `package.json` | script `exportar-tenant` |
| `supabase/scripts/README.md` | índice dos quatro arquivos novos e a seção de uso |
| `testes-de-navegador/chrome.ts` | apagar o perfil vira best-effort (ver §7) |

## 5. Critérios de aceite

| # | Critério | Resultado |
|---|---|---|
| 1 | O zip contém uma zona que foi marcada, semeada e conferida contra banco | sim, as 5 `zone_key` com o seletor |
| 2 | Nada do tenant concorrente aparece no pacote | sim, busca em todos os bytes, nomes inclusive |
| 3 | O asset-base sai byte a byte igual ao objeto do Storage | sim |
| 4 | `rendered_path` não sai, mesmo com valor preenchido no banco | sim, o teste preenche de propósito |
| 5 | Exportar não apaga nada | sim, tenant, zonas e objeto conferidos depois |
| 6 | Slug inexistente falha com erro próprio | sim, `TenantNaoEncontrado` |
| 7 | Asset sumido do Storage não derruba a exportação | sim, o pacote sai sem ele |
| 8 | Nenhuma dependência nova | sim, 0 |
| 9 | Nenhum `select *` | sim, 4 consultas de campos explícitos, com teste de forma |
| 10 | Um leitor de ZIP de terceiro abre o pacote | sim, .NET `Expand-Archive` e `bsdtar` |
| 11 | O script roda de ponta a ponta contra o projeto real | sim, `aurora-demo`: 1 produto, 6 zonas, 4,0 kB |
| 12 | Suíte inteira verde e typecheck limpo | sim, 1047 testes e 58/58 no banco |

## 6. Verificação por mutação

Seis mutações, todas em código de produção, todas revertidas depois.

| Mutação | Onde | Efeito esperado | Testes mortos |
|---|---|---|---|
| A. tirar o filtro de tenant dos produtos | `lerSaidaDoTenant.ts` | o pacote do A leva o produto do B | 4 |
| B. `rendered_path` volta ao `select` de variantes | `lerSaidaDoTenant.ts` | campo a mais sai do banco | 1 (0 antes, ver abaixo) |
| C. o asset-base nunca é baixado | `lerSaidaDoTenant.ts` | pacote sem o arquivo da marca | 1 |
| D. tenant ausente vira tenant vazio | `lerSaidaDoTenant.ts` | pacote vazio em vez de erro | 1 |
| E. tirar o filtro de produto das zonas | `lerSaidaDoTenant.ts` | lê zona de todo mundo | **0, sobreviveu** |
| F. agrupar joga fora tudo menos a última linha | `lerSaidaDoTenant.ts` | zonas somem do pacote | 2 |

### A mutação B sobreviveu primeiro, e isso rendeu um teste

Devolver `rendered_path` no `select` passava por tudo, porque `montarPacoteDeSaida` reescolhe os
campos na saída e o valor morria lá. A defesa em profundidade é boa, mas deixava o `select` deste
módulo sem ninguém olhando, **e é justamente ele que o comentário do arquivo promete que é
explícito**. O teste novo confere a forma do que a leitura devolve, campo por campo, nas quatro
tabelas. Agora um `select *` escrito ali falha ali, que é onde ele foi escrito.

### A mutação E sobreviveu, e fica registrada em vez de virar teste falso

Tirar `.in('product_id', produtoIds)` da consulta de zonas não muda um byte do pacote, porque o
agrupamento por `product_id` é o guarda de verdade de qual zona vai para qual produto. O defeito é
real mas de outra natureza: a consulta leria linhas de outros tenants para a memória sem
necessidade, e isto roda com `service_role`, que não tem RLS para segurar. Não existe asserção
sobre a SAÍDA capaz de matá-la, e escrever um teste que espia a chamada seria testar a
implementação, não o comportamento. Fica anotado aqui como limite conhecido da suíte.

## 7. Um achado fora do escopo, consertado no caminho

A suíte completa reprovou uma vez com 1047 testes passando: o `afterAll` do teste de navegador
(T17) tentava apagar a pasta de perfil do Chrome e batia em `EPERM`. No Windows o evento `exit` do
processo chega ANTES de o sistema soltar os handles dos arquivos. A limpeza agora tenta cinco
vezes, espaçadas, e no pior caso avisa e deixa para o `TEMP` do sistema. **Falha de faxina não é
falha de teste**, e tratar as duas igual ensina quem lê a ignorar vermelho. Confirmado com três
execuções seguidas limpas.

## 8. O que esta tarefa ainda NÃO responde

- **A exclusão dos dados.** É o outro lado do ADR-009 e não existe ainda, por decisão de ordem
  (D5). Até ela existir, apagar um tenant é operação manual de quem tem acesso ao banco.
- **Composições de calçado gerado (ADR-008) não saem no pacote.** Hoje não há composição gravada em
  tabela; a tela monta e a API recebe. Quando houver persistência, ela entra aqui, e o parágrafo do
  `LEIA-ME.md` sobre o acervo base já está escrito esperando por isso.
- **O pacote não é assinado nem tem checksum próprio.** O CRC-32 de cada arquivo prova integridade
  contra corrupção de transporte, não contra adulteração. Para o uso atual, entrega direta de dono
  para cliente, é suficiente; se um dia o pacote circular por terceiros, não é.
