# Fase E: o prompt vira composição (2026-09-13)

**Branch:** `full-auto/prompt-composicao`, a partir de `refino/kora-calcados`. **Sem merge em `main` e sem deploy.**
**Origem:** sua resposta "B" à escalação da T09 (D12): construir a esteira inteira com um modelo falso, custo zero.

## Em uma frase

Em `?tela=composicao` agora existe "Descrever o calçado": a frase vira uma composição, passa pelo mesmo guarda da colagem e da API, troca o calçado em cena, e um aviso perto do calçado diz quem compôs e que só foram escolhidas e coloridas peças que já existiam no acervo.

## Como conferir em 1 comando

```bash
npm run dev
```

Abra `http://localhost:5173/?tela=composicao`, escreva `sola tratorada branca, cabedal cano alto vermelho sem cadarço` e clique em "Gerar composição".

## O que ficou pronto

| Tarefa | O que | Commit |
|---|---|---|
| T18 | Os termos novos no glossário antes do código | `3d2a2c7` |
| T05 | `montarCatalogoParaModelo.ts`: o acervo de uma forma, em texto, para o modelo ler | `09d0961` |
| T09a | `gerarComposicaoPorPrompt.ts` e `lerRespostaDoModelo.ts`: prompt recusado antes de gastar chamada, resposta tratada como não confiável e validada pelo guarda, falha do modelo sem vazar a mensagem de dentro | `4a3e737` |
| T09b | `modeloDeLinguagemDeProva.ts`: o gerador de prova | `c8afec1` |
| T09c | `PainelDePrompt.tsx` e `textosDoPrompt.ts`, ligados na tela, com o aviso de transparência | `e811d63` |

## Números medidos

- Testes: de 1376 para 1395 passando no fechamento da T09c (58 pulados, os de banco, que rodam à parte e passaram 58 de 58). Navegador 25 de 25.
- Mutações feitas à mão: T05 4/4, T09a 8/8, T09b 9/9 (uma sobreviveu e ganhou teste), T09c 9/9.
- Build: 570 ms.

## Mockado, dito de frente

- **O gerador de prova não é IA.** Ele reconhece nome de categoria, palavras do nome da peça, cor por nome ou hex, "sem" antes de categoria opcional, "grossa" e "fina". Frase livre sem palavra-chave monta o calçado padrão. A ajuda do painel e o aviso perto do calçado dizem "não é IA", para a regra de transparência não virar mentira ao contrário.
- Trocar para um fornecedor de verdade é uma linha na tela mais uma função de servidor. Está na **P06**.

## O que NÃO foi feito, e por quê

- **Fornecedor real e função serverless:** custam dinheiro por uso e a chave precisa morar no servidor, com sessão autenticada e limite por tenant. É a P06.
- **Guardar quem compôs no F5:** o aviso não sobrevive ao recarregar, de propósito. A gravação guarda a composição, e não a origem dela; depois de recarregar, a tela não afirma nada que não saiba.

---

# Relatório final do refino

**Projeto:** Kora Calçados (codinome)
**Período do refino:** 2026-09-12 a 2026-09-13
**Branch:** `refino/kora-calcados`, a partir de `08e4d1d`. **Sem merge em `main` e sem deploy**: os
dois são decisão sua.
**Motivo do fim:** a reauditoria da rodada 11 não achou nada novo acima do corte, e o que resta no
backlog está todo abaixo dele.

O relatório da construção, que veio antes do refino, continua inteiro abaixo deste.

## 1. Em uma frase

Dez rodadas, **56 itens entregues e nenhum revertido**, com o baseline verde na abertura e no
fechamento de cada rodada: o configurador e o esboço ficaram mais difíceis de enganar (cor, parâmetro,
seleção, colagem, recomeço), mais legíveis para quem usa teclado, leitor de tela e celular, e os
testes passaram a provar o que diziam provar.

## 2. Como conferir em 1 comando

```bash
npm ci && npm run typecheck && npm run build && npm test
```

Na última verificação, a partir de instalação limpa: `tsc` limpo, build sem erro e sem aviso,
1346 testes passando e 58 pulados. Os 58 pulados são os do banco real, que rodam à parte com
`npm run test:banco` (58 de 58) e pedem `.env.local`. Os de navegador rodam com
`npm run test:navegador` (25 de 25). Depois, `npm run dev` e <http://localhost:5173/?tela=composicao>,
que abriu com o calçado montado de 3 zonas.

## 3. As rodadas

| Rodada | Itens | Revertidos | Destaque |
|---|---|---|---|
| 1 | 8 | 0 | cena 3D ao lado dos controles, asset-base vazio vira falha nomeada |
| 2 | 8 | 0 | confirmação ao gravar zona, contagem de marcados em região viva |
| 3 | 6 | 0 | digitar o hex no configurador, com a regra do hex num lugar só |
| 4 | 6 | 0 | o calçado antes da lista de zonas a 375 px, um rodapé de saídas para as quatro telas |
| 5 | 6 | 0 | WebGL negado vira estado em vez de página em branco, varredura de RLS nas migrations |
| 6 | 6 | 0 | rede de proteção na raiz, a peça clicada mostra nó e zona |
| 7 | 6 | 0 | índices de chave estrangeira (migration pendente, P05), a composição sobrevive ao F5 |
| 8 | 5 | 0 | voltar ao calçado de prova com Desfazer, build sem aviso, textos sem travessão |
| 9 | 4 | 0 | trocar de peça não carrega valor da anterior, frase do hex igual nas duas telas |
| 10 | 1 | 0 | hex curto sobe na forma longa, que o seletor de cor aceita |

O detalhe de cada item, com commit, mutações e limites de verificação, está em `REFINO-RODADAS.md`,
e cada linha de `TAREFAS.md` tem a nota de como foi conferida.

## 4. O que melhorou, com números medidos

| Medida | Abertura do refino | Fim do refino |
|---|---|---|
| Testes verdes | 1047, 58 pulados, 70 arquivos | **1346**, 58 pulados, 108 arquivos |
| Testes contra o banco real | 58 de 58 | 58 de 58 |
| Testes em navegador | 25 | 25 |
| `npm run build` | sem erro, **com aviso de chunk** | **sem erro e sem aviso** |
| Chunk principal | 455,03 kB (gzip 131,84 kB) | **219,52 kB** (gzip 70,35 kB) |
| Chunk do three.js, sob demanda | 618,87 kB | 619,63 kB |
| CSS | 20,76 kB | 25,14 kB |
| `npm audit` | 0 | 0 |
| Arquivos `.ts`/`.tsx` | 169 | 226 |
| Linhas de TypeScript | 25.598 | 33.686 |
| `any`, `@ts-ignore`, `catch` vazio | zero | zero |

O CSS cresceu 4,38 kB e o three.js 0,76 kB: é o peso do que passou a existir (estados de erro,
regiões vivas, alvos de toque, painéis novos), dito aqui para não parecer ganho. O chunk principal
caiu à metade porque a área protegida passou a entrar por `import()` tardio (rodada 6). O tempo de build variou
entre 388 ms e 695 ms nas medições, na mesma máquina fazendo outras coisas, e não é número de ganho.

## 5. O que foi revertido

Nada. Nenhum item de nenhuma rodada precisou de `git revert`.

## 6. O que está atrás de flag ou mockado

Nada atrás de flag: nenhum item alterou fluxo principal de um jeito que pedisse chave de
configuração. Mockado só em teste: o dublê do palco 3D nos testes das duas telas (rodada 9), que
desenha o palco de verdade por dentro e existe só para entregar a seleção que o jsdom não consegue
clicar.

## 7. O que eu disse errado e corrigi às claras

- **Rodadas 1 a 7:** a linha do build dizia "limpo" com o aviso de chunk lá, porque eu lia só o fim
  da saída. Corrigido no R8-A61, nas oito colunas, sem apagar.
- **R8-A62 e R8-A63:** critérios escritos largos demais, corrigidos na nota de cada um.
- **R9-A69:** a primeira contraprova exigia uma moldura que some de propósito sem WebGL.

## 8. Limites que continuam valendo

- **O editor logado nunca foi conferido no navegador pelo refino**, porque eu não preencho
  credencial. O que mudou nele foi conferido por teste.
- **O seletor preto do R10-A73 não foi visto**: este Chrome mostra a cor com a forma curta e só
  avisa no console.
- **Nenhuma sessão rodou com o hook de continuidade**, que continua sendo a pendência P01.

## 9. Backlog restante, por score (todos abaixo do corte de 2)

| Item | Eixo | Score | O que é |
|---|---|---|---|
| A14 | qualidade | 1 | não existe CI; ligar o Actions e cadastrar segredos é seu (I05) |
| A65 | ux | 1 | o foco cai no `body` depois de um login recusado |
| A66 | ux | 1 | `?tela=` com erro de digitação abre o login sem dizer nada |
| A71 | ux | 1 | a colagem recusada fala de parâmetro em metros, a tela em milímetros |
| A13 | qualidade | 0 | não existe linter |
| A74 | ux | 0 | o editor logado não diz "falta o #" (evidência só de código) |
| A35 | ux | -1 | o canvas 3D não gira por teclado |
| A64 | robustez | -1 | nenhuma chamada de rede tem tempo-limite (evidência só de código) |
| A75 | ux | -1 | a roda de cor do esboço sobe minúsculo |
| A72 | robustez | -2 | chunk tardio sumido depois de deploy mostra a mensagem crua (não visto) |

## 10. O que você precisa decidir

**Pendências** (`PENDENCIAS-DO-MATHEUS.md`), na ordem:

1. **P01**, alta: instalar o hook de continuidade.
2. **P02**, alta: revogar a chave de API da passada dirigida.
3. **P04**, média: apagar 8 tenants de teste órfãos no Supabase real.
4. **P05**, média: aplicar a migration dos dois índices no Supabase real.
5. **P03**, baixa: normalizar o travessão no repositório inteiro. O código de produção já está sem
   travessão desde o R8-A62, e o que sobra é documentação e teste.

E o merge da branch `refino/kora-calcados` em `main`, que é seu.

**Ideias de produto** (`IDEIAS-DE-PRODUTO.md`), que não executei porque são decisão de produto:

- **I01**, guardar a composição do configurador numa tabela, com nome e reabertura.
- **I02**, apagar e remarcar zona pelo painel.
- **I03**, busca e filtro na lista de modelos, quando houver tenant com dezenas.
- **I04**, seletor visual de cor no editor de zonas.
- **I05**, ligar integração contínua.
- **I06**, o editor real mostrar a chamada de API equivalente, como o esboço mostra.

## 11. Como retomar

`/full-automatico-refino continuar`. A reauditoria parte do backlog acima e do que tiver mudado no
código desde `refino/kora-calcados`.

---

# Relatório final do Full Automático

**Projeto:** Kora Calçados (codinome)
**Período:** 2026-09-10 a 2026-09-12
**Plano de origem:** ADR-007 + ADR-008 + `docs/09_BACKLOG/features.md` (ver D01 em `DECISOES.md`)
**Branch:** `main`, 4 commits nesta execução, todos verificados antes de entrar

---

## 1. Em uma frase

A esteira do ADR-008 está provada de ponta a ponta: **dá para montar um calçado escolhendo peça,
cor e medida numa tela, ver o resultado em 3D, e a cor que aparece é a cor que foi pedida**, com um
teste automático que mede isso no pixel e não no arquivo. E a marca que quiser sair leva o que é
dela num zip que qualquer programa abre.

## 2. Como rodar

```bash
npm install && npm run dev
```

Depois abrir <http://localhost:5173/?tela=composicao>. Nenhuma chave, nenhuma conta, nenhum banco:
essa tela roda sozinha.

As outras portas de entrada:

| Endereço | O que é |
|---|---|
| `?tela=composicao` | O configurador 3D, o produto desta fase |
| `?tela=palco3d` | Uma peça só, para inspecionar geometria |
| `?tela=esboco` | O motor 2D e a chamada equivalente da API |
| `/` sem parâmetro | O editor de zonas, pede login |

Comandos de verificação:

```bash
npm test            # 1047 testes, ~50 s
npm run test:banco  # 58 testes contra o Supabase real, precisa de .env.local
npm run typecheck   # limpo
npm run build       # limpo
```

## 3. O que ficou pronto nesta execução

| # | Entrega | Prova |
|---|---|---|
| T01 | Normalização de modelo 3D: nome e material próprios por malha | 576 testes, 3 mutações |
| T02 | Motor de cor 3D, a conversão sRGB para linear num lugar só | 638 testes |
| T03 | Termos do ADR-008 no glossário, antes do código | commit `5cebbe5` |
| T04 | `validarComposicao`, o guarda da saída do modelo de linguagem | 699 testes, 5 mutações |
| T10 | Typecheck de `supabase/scripts/` | já estava resolvida, pendência vencida |
| T11 | ADR-009, a política de saída do cliente | commit `93c356a` |
| T12 | Acervo de prova: 5 peças em glTF 2.0 gerado por código | validador da Khronos, 0 erro e 0 aviso |
| T13 | Palco 3D no navegador, peça identificada por clique | conferência a olho aprovada pelo dono |
| T14 | Calçado montado em cena, cada peça no lugar | 47 mutações, 46 mortas, 3 sondas independentes |
| T15 | O configurador, sem IA nenhuma | conferido em navegador nos dois sentidos da troca |
| T16 | A saída do cliente em zip, e o teste da zona marcada | 10 testes de banco, 2 leitores de terceiro |
| T17 | A conferência a olho virando teste permanente | 25 testes, mede a cor no framebuffer |

### O número que importa

**1047 testes na suíte** (eram 576 no começo desta execução), **58 contra o banco real**, typecheck
limpo, build limpo, **zero dependência nova em todo o período**.

## 4. As três coisas que valem mais do que a lista

### O princípio nº1 deixou de ser vigiado por fé

Até 2026-09-11 este projeto tinha centenas de testes sobre cor, e **nenhum deles olhava para um
pixel**. Todos conferiam o número escrito no glTF, e entre esse número e o que uma pessoa enxerga
ainda estavam a conversão de sRGB para linear e o renderizador. "Não dá para testar 3D" era verdade
sobre o jsdom, não sobre a máquina: há Chrome instalado, ele roda WebGL por software em modo
headless, e o Node 24 fala o protocolo de DevTools sem dependência nenhuma. Agora a cor é medida.

### Uma mutação sobrevivente valeu mais do que cinco testes verdes

A primeira régua de cor comparava só o matiz. Quebrar de propósito a conversão de sRGB para linear,
que é literalmente o defeito que o princípio nº1 existe para vigiar, **passou pelos cinco testes**:
o matiz do cabedal andou 8°, exatamente a folga. A saturação, no mesmo par de rodadas, caiu de
0,769 para 0,537. O eixo novo entrou por causa disso, e a folga dele é só para baixo, porque luz
difusa multiplica os canais e erro de gama aplica uma curva. Está em D06 e em `specs/cor-na-tela.md`.

O mesmo aconteceu em T16, em escala menor: devolver `rendered_path` no `select` passava por tudo,
porque a montagem do pacote reescolhe os campos depois. A defesa estava lá, mas não estava onde o
comentário do arquivo prometia que estava.

### A resposta para "e se eu quiser sair?" existe e roda

`npm run exportar-tenant -- --slug <slug>` produz o pacote do ADR-009. Rodado contra o projeto real:
4,0 kB, 1 produto, 6 zonas, aberto por dois leitores de ZIP que não são nossos. Numa venda B2B essa
pergunta é feita antes da assinatura, e agora ela tem demonstração em vez de cláusula.

## 5. O que está mockado ou simulado, dito de frente

| O quê | Situação real |
|---|---|
| **O acervo de peças 3D** | São 5 peças de **geometria grosseira geradas por código**, não modelos de calçado. Servem para provar a esteira, não para vender. O acervo de verdade é trabalho de modelagem e continua adiado por decisão (T12 e `memory/restrictions.md`) |
| **O prompt em linguagem natural** | Não existe. Foi trocado pelo configurador, que faz o mesmo trabalho sem custo de IA (T09, adiada por decisão sua de 2026-09-10) |
| **A composição 3D no banco** | Não é gravada. A tela monta e a API recebe; não há tabela para ela, e nenhum ADR decidiu que devesse haver |
| **A migration de chaves de API** | `20260908_chave_de_api_por_tenant.sql` está escrita e revisada, **não aplicada em banco nenhum**. Os scripts de chave falham até ela rodar |
| **O hook de continuidade** | Não instalado. Ver P01 |

Nada aqui é mock escondido: os três primeiros são decisões registradas, e os dois últimos são
pendências suas.

## 6. Suas pendências, em ordem

1. **P02, revogar a chave `2aec9a55` do `aurora-demo`**, `npm run revogar-chave -- --prefixo 2aec9a55`.
   Continua ativa. Não fiz porque revogar é irreversível.
2. **P01, instalar o hook de continuidade**, recusado três vezes pelo classificador do modo
   automático, e vale você saber por quê antes de instalar: o instalador escreve um
   `.worktreeinclude` que copia `.env.local` (com a `service_role`) para toda worktree, e o vigia
   relança o Claude com `--permission-mode auto`. A leitura completa está em P01.
3. **Aplicar a migration `20260908`** quando for usar chave de API, e atualizar `schema.sql` no
   mesmo commit.
4. **P03, o travessão no acervo antigo**, decisão de estilo, sem pressa.

Detalhes e passo a passo em `.full-auto/PENDENCIAS-DO-MATHEUS.md`.

## 7. O que NÃO foi feito, e por quê

- **T05, T06 e T09 continuam `[!]`**, adiadas por decisão sua, não por bloqueio técnico. T09 (o
  prompt) tem custo recorrente de IA; T05 formata catálogo para um leitor que foi adiado; T06 é
  schema para dado que ainda não existe.
- **A exclusão de dados do ADR-009 não foi construída** (D09). Exportar e excluir são separados de
  propósito, e um script que apaga tenant, num repositório tocado por agentes, é um gatilho no chão.
  Ele nasce quando houver um cliente cancelado de verdade.
- **A geometria em pixel não é testada.** "A sola está embaixo do cabedal" tem prova melhor no nível
  do glTF, e medir encaixe num render em perspectiva confundiria sobreposição com peça enterrada.

## 8. Fragilidade conhecida da suíte

O teste de navegador é o mais lento e o mais frágil, e some em silêncio numa máquina sem Chrome.
**Uma suíte verde não prova que a cor foi medida**; prova que nada do que rodou reprovou. Quem
quiser a garantia roda `npm run test:navegador` e confere que apareceram 5 testes, não 0.

Se um dia ele reprovar sem ninguém ter mexido em cor, o primeiro suspeito é uma atualização do
Chrome mudando o renderizador por software. A resposta certa é **remedir as duas versões**, nunca
afrouxar a folga no escuro.

## 9. Verificação final, feita hoje

| Passo | Resultado |
|---|---|
| Instalação limpa a partir do lockfile (`npm ci` num clone novo) | 9 s, sem erro |
| `npm audit` | tinha 2 avisos moderados no vitest; corrigido para 4.1.11 e reconferido, **0 avisos** |
| `npx tsc --noEmit` | limpo |
| `npm run build` | limpo (aviso de chunk > 500 kB é o three.js, conhecido) |
| `npm test` | 1047 passando, 58 pulados (os de banco, sem `.env.local`) |
| `npm run test:banco` | 58 de 58 contra o Supabase real |
| App rodando, fluxo principal | percorrido em navegador de verdade, ver abaixo |

O fluxo percorrido à mão, em `?tela=composicao`: o calçado apareceu montado (sola branca embaixo,
cabedal azul, cadarço amarelo em cima); trocar "Cabedal baixo" por "Cabedal cano alto" trocou a peça
na cena **sem apagar a tela** e trouxe o parâmetro próprio da peça nova, 140,0 mm no lugar de 75,0
(o conserto do BUG-019 de pé); clicar na peça devolveu `prova-cabedal-cano-alto`; e pintar o cabedal
de `#C0392B` deixou **a sola branca e o cadarço amarelo intactos**. A tela `?tela=esboco` também
abre e mostra as 9 zonas do tênis de demonstração.

---

## 10. Sugestão de próximo passo

O configurador é produto vendável hoje, sobre um acervo que não é vendável. **O gargalo virou
modelagem, não código.** A decisão que destrava a próxima fase é sua e é de investimento: 15 peças
de uma forma de calçado real, feitas por alguém que modela. Enquanto isso não existir, qualquer
código novo no rumo 3D é refinamento de uma esteira que já está provada.

O caminho barato, se quiser adiar a modelagem mais um pouco, é o outro lado do produto: aplicar a
migration de chaves de API e fechar a Fase 1 comercial, que roda sobre o acervo 2D que já existe e
não depende de artista nenhum.
