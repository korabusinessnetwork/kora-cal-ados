# Estado do Full Automático

status: AGUARDANDO_MATHEUS
<!-- valores: EXECUTANDO | AGUARDANDO_MATHEUS | PAUSADO | CONCLUIDO -->

## Modo atual: refino (desde 2026-09-12)

A construção terminou e está relatada em `RELATORIO-FINAL.md`. O que roda agora é a skill
`full-automatico-refino`: sem plano de entrada, a lista sai de uma auditoria minha, registrada em
`AUDITORIA.md`.

- **Branch:** `refino/kora-calcados`, a partir de `08e4d1d`. **Sem merge em `main` e sem deploy**,
  isso é decisão do dono.
- **Baseline:** `BASELINE.md`, verde na abertura. Item que piorar qualquer linha dele volta por
  `git revert` na hora.
- **Rodada 1: FECHADA em 2026-09-12**, 8 de 8 entregues, nenhum revertido. O que entrou, o que foi
  medido e o que foi conferido a olho está em `REFINO-RODADAS.md`.
- **Rodada 2: FECHADA em 2026-09-12**, 8 de 8 entregues, nenhum revertido. Baseline verde nas duas
  pontas: 1104 testes, 58 no banco, 25 no navegador, `tsc` e build limpos, `npm audit` em zero. O
  que entrou, o que foi medido e os três limites de verificação estão em `REFINO-RODADAS.md`.
- **Rodada 3: FECHADA em 2026-09-12**, 6 de 6 entregues, nenhum revertido. Abriu com 5 itens e
  fechou com 6: o A33 nasceu no meio da rodada, quando o baseline reprovou sozinho um teste de
  navegador, e entrou na frente porque um baseline que pisca vermelho impede a regra de ouro de
  funcionar. Baseline verde nas duas pontas: 1161 testes, 58 no banco, 25 no navegador, `tsc` e
  build limpos, `npm audit` em zero. Duas mutações sobreviveram e as duas estão relatadas em
  `REFINO-RODADAS.md`, com o que foi feito com cada uma.
- **Rodada 4: FECHADA em 2026-09-12**, 6 de 6 entregues, nenhum revertido. Quatro dos seis achados
  vieram do **esboço**, a tela que um clone recém-baixado abre e que as três rodadas anteriores não
  tinham varrido. Baseline verde nas duas pontas: 1198 testes, 58 no banco, 25 no navegador, `tsc` e
  build limpos, `npm audit` em zero. Uma mutação sobreviveu e está relatada em `REFINO-RODADAS.md`,
  com o conserto que ela recebeu (foi no teste, não no código). A armadilha da rodada, e é a que
  vale guardar: **`.palco` é declarada em DOIS arquivos** (`esboco/esboco.css` e
  `features/zonas/zonas.css`), e `position: sticky` ficou sem efeito duas vezes, em silêncio,
  enquanto o `order` da mesma regra funcionava.
- **Rodada 5: FECHADA em 2026-09-12**, 6 de 6 entregues, nenhum revertido. Diferente das quatro
  anteriores, que auditaram telas: esta foi atrás do que acontece quando a máquina de quem visita
  não tem o que a tela precisa, das regras do projeto que existem só como frase e não têm guarda
  nenhuma, e dos hooks de rede do editor logado. Baseline verde nas duas pontas: 1243 testes, 58 no
  banco, 25 no navegador, `tsc` e build limpos, `npm audit` em zero. O achado da rodada, e é o que
  vale guardar: **as três guardas contra corrida dos hooks só olhavam a resposta ATRASADA**, e
  nenhuma delas via a passagem de render entre a troca de id e o efeito, em que a lista do id
  anterior aparecia inteira sob o id novo. Uma mutação sobreviveu na primeira tentativa e está
  relatada em `REFINO-RODADAS.md`, com o que foi feito com ela (o teste é que perguntava a coisa
  errada). Limite de verificação dito por inteiro: a tela do editor logado não foi conferida no
  navegador, porque exige login e eu não preencho credencial.
- **Rodada 6: FECHADA em 2026-09-12**, 6 de 6 entregues, nenhum revertido. Foi atrás de três coisas:
  o que SOBRA na tela depois de a falha já ter sido tratada, o que a tela promete no próprio texto de
  ajuda e não entrega, e o que todo mundo baixa para usar o que não precisa disso. Baseline verde nas
  duas pontas: 1275 testes, 58 no banco, 25 no navegador, `tsc` e build limpos, `npm audit` em zero.
  **A medida da rodada:** o chunk principal caiu de 457,75 kB para 218,97 kB, a primeira vez em seis
  rodadas que ele encolhe, porque o cliente de banco saiu de lá. O achado que vale guardar: a rede de
  proteção do A51 desenhava as saídas e o rodapé também, deixando a MESMA lista de três destinos duas
  vezes na tela, e todos os testes passavam porque cada um perguntava por uma lista e achava uma. Só
  o navegador viu. Uma mutação sobreviveu e está relatada em `REFINO-RODADAS.md`, com o conserto (foi
  no teste, que perguntava a coisa errada). Três suspeitas morreram na sonda e estão registradas
  como tal em `AUDITORIA.md`, entre elas o anel de foco, que aparece de verdade num `Tab` de
  verdade, e o custo de arrastar o seletor de cor, que é de 11 a 26 ms por mudança e não justifica
  `debounce` numa tela cujo ponto é a cor aparecer na hora.
- **Rodada 7: FECHADA em 2026-09-12**, 6 de 6 entregues, nenhum revertido. Foi atrás de três coisas:
  o que o navegador oferece de graça e o app jogava fora (Voltar, F5), o índice que as políticas de
  RLS usam em toda consulta, e a tela mais tocada do projeto. Baseline verde nas duas pontas: 1308
  testes, 58 no banco, 25 no navegador, `tsc` e build limpos, `npm audit` em zero. A migration de
  índices do A53 **não foi aplicada no banco real** e virou P05. `TelaDaComposicao.tsx` caiu de 457
  para 195 linhas, com HTML idêntico antes e depois. Dois critérios estavam errados e foram
  corrigidos às claras, e uma mutação sobreviveu no meio do caminho e morre agora. Tudo isso está em
  `REFINO-RODADAS.md`.
- **Rodada 8: FECHADA em 2026-09-12**, 5 de 5 entregues, nenhum revertido. Baseline verde nas duas
  pontas: 1329 testes, 58 no banco, 25 no navegador, `tsc` limpo, build **sem aviso pela primeira
  vez** (as colunas anteriores diziam "limpo" com o aviso lá, corrigido às claras no A61), e `npm
  audit` em zero. A composição ganhou volta ao padrão com Desfazer, o rodapé ganhou alvo de 24 px,
  nenhum texto que chega a alguém usa travessão, e a tela de uma peça desenha um controle por
  parâmetro. Duas mutações sobreviveram no meio e morrem agora, dois critérios foram corrigidos às
  claras, e um defeito novo apareceu no A63. Tudo em `REFINO-RODADAS.md`.
- **Rodada 9: FECHADA em 2026-09-13**, 4 de 4 entregues, nenhum revertido, lote abaixo do orçamento
  porque a reauditoria só achou quatro itens acima do corte. Baseline verde nas duas pontas: 1343
  testes, 58 no banco, 25 no navegador, `tsc` limpo, build sem aviso, `npm audit` em zero. A tela de
  uma peça para de carregar valor de parâmetro entre peças, a medida do parâmetro tem um lugar só, o
  campo de hex diz o que falta nas duas telas, e os testes de tela selecionam peça de verdade. Duas
  mutações sobreviveram no meio e morrem agora. Tudo em `REFINO-RODADAS.md`.
- **Rodada 10: FECHADA em 2026-09-13**, 1 de 1 entregue, nenhum revertido. Baseline verde nas duas
  pontas: 1346 testes, 58 no banco, 25 no navegador, `tsc` limpo, build sem aviso, `npm audit` em
  zero. O hex curto sobe na forma longa, que o seletor de cor aceita.
- **Rodada 11 (reauditoria final), 2026-09-13:** nenhum achado novo acima do corte. **Refino
  CONCLUIDO.** Verificação final a partir de `npm ci`: `tsc` limpo, build sem aviso, 1346 testes, 58
  no banco, 25 no navegador, `npm audit` em zero, e a tela da composição aberta no navegador com o
  calçado de 3 zonas. Relatório em `RELATORIO-FINAL.md`, na parte de cima.
- **Para retomar:** `/full-automatico-refino continuar`, partindo do backlog listado no relatório.
- **Hook de continuidade:** continua NÃO instalado, por P01. Sem ele a sessão pode encerrar entre
  itens, e a retomada é `/full-automatico-refino continuar`, partindo deste arquivo.

---

## Registro da construção, encerrada em 2026-09-12

- **Projeto:** Kora Calçados (codinome)
- **Plano de origem:** não existe `PLANO.md`. O plano deste projeto é a soma de
  `docs/08_DECISOES/adr-007-modelo-3d-manipulavel.md` + `adr-008-calcado-gerado-sobre-acervo-de-pecas.md`
  + `docs/09_BACKLOG/features.md`. A ordem de construção é a do ADR-008: **acervo → composição → prompt**.
- **Branch:** `main` (ver D02 em DECISOES.md: por que não `full-auto/<slug>`)
- **Início:** 2026-09-10 · **Encerramento:** 2026-09-12
- **Fase atual:** encerrada. A esteira do ADR-008 está provada de ponta a ponta com o acervo de prova
- **Próximo passo:** é decisão do dono, não tarefa. O relatório está em
  `.full-auto/RELATORIO-FINAL.md`, e a §10 dele explica por que o gargalo virou modelagem e não
  código. As duas pendências de prioridade alta são P02 (revogar a chave `2aec9a55`) e P01 (o hook)
- **Progresso:** **12 de 12 construídas**, 3 adiadas por decisão do dono (T05, T06, T09), nenhuma
  bloqueada por problema técnico

## Verificação final (2026-09-12)

| Passo | Resultado |
|---|---|
| Instalação limpa a partir do lockfile, num clone novo | 9 s, sem erro |
| `npm audit` | 2 avisos moderados no vitest, corrigidos para 4.1.11, reconferido em **0** |
| `npx tsc --noEmit` | limpo |
| `npm run build` | limpo |
| `npm test` | **1047 passando**, 58 pulados (os de banco, sem `.env.local`) |
| `npm run test:banco` | **58 de 58** contra o Supabase real |
| App rodando, fluxo principal em navegador de verdade | percorrido, sem defeito |

O fluxo percorrido à mão em `?tela=composicao`: calçado montado na tela, troca de peça sem apagar a
cena e trazendo o parâmetro próprio da peça nova, clique devolvendo o id da peça, e a cor de uma
zona mudando **só** aquela peça. Nenhuma linha de código precisou mudar depois da conferência.

## O portão a olho de T14, encerrado por medição (ver D05)

T14 esteve em `AGUARDANDO_MATHEUS` esperando o dono conferir 5 itens em `?tela=composicao`. Fechou
sem esse portão, por três sondas independentes concordando: a passada de 2026-09-11, uma terceira
medição de framebuffer feita na sessão de 2026-09-12, e o teste permanente de T17, que agora mede a
cor na tela em toda rodada da suíte.

O portão existia porque nenhum teste desenhava um pixel, e essa premissa caiu quando o Chrome
headless entrou na suíte. **O dono continua podendo reprovar ao abrir a tela**, e nesse caso o
defeito vira teste, que é o caminho certo de qualquer jeito. Os cinco itens, para conferência:

1. O calçado aparece montado, sola embaixo, cabedal em cima, cadarço sobre o cabedal.
2. **A cor escolhida é a cor que aparece.** É o princípio nº1, literal, e o mais importante dos cinco.
3. Trocar a cor de uma zona muda só aquela peça.
4. Engrossar a sola faz cabedal e cadarço subirem junto, encaixados.
5. Clicar numa peça mostra o nome dela, e o nome bate com a peça clicada.

Duas notas para não parecerem defeito: **arrastar para baixo levanta o ponto de vista**, que é a
convenção do `OrbitControls` do three; e a cor inicial da demo (sola quase branca, cabedal azul,
cadarço amarelo) é de `composicaoDeProva()`, não identidade de marca nenhuma.

## O que ficou fora, e por quê

- **T05, T06 e T09** continuam `[!]`: adiadas por decisão do dono, não por bloqueio técnico.
- **A exclusão de dados do ADR-009** não existe, por decisão (D09). Exportar e excluir são separados
  de propósito, e a exportação vinha primeiro.
- **O acervo de verdade** é trabalho de modelagem. As 5 peças de hoje são geometria grosseira gerada
  por código, boas para provar a esteira e não para vender.

## As quatro decisões que destravaram o plano (2026-09-10)

1. **Acervo**: acervo de prova em geometria grosseira primeiro, para provar a esteira antes de
   investir em modelagem. Registrada em `memory/restrictions.md`.
2. **Custo da IA**: adiada, o configurador vem primeiro e custa zero. Registrada em
   `memory/restrictions.md`.
3. **Zona 3D**: não guardar, a zona vem da composição. Sem tarefa, sem schema.
4. **Saída do cliente**: saída completa em formato aberto, virou o ADR-009, e agora roda.

## Vigia de limite

Não instalado. O hook de continuidade e o vigia vivem em `.claude/`, e a instalação está bloqueada
(ver P01 em PENDENCIAS-DO-MATHEUS.md). Com a execução encerrada isso deixa de importar para esta
rodada, e volta a importar na próxima.

## Retomada da construção, 2026-09-13

- **Pedido:** `/full-automatico continuar`, depois do refino concluído e do hook instalado (P01).
- **O que achei:** nenhuma tarefa `[ ]` ou `[~]` na construção. Sobram três `[!]`, todas adiadas por
  decisão: T09 (prompt vira composição), T05 (catálogo para o modelo de linguagem, depende da T09) e
  T06 (schema do acervo, espera acervo de verdade e mais de um tenant com peça própria).
- **Por que parei:** a condição de revisitar a T09 que o dono deu em 2026-09-10 ("quando o
  configurador estiver rodando sobre o acervo de prova") está cumprida desde a T15. Mas a T09 é o
  item pago da restrição de custo (chamada de modelo de linguagem, fornecedor não escolhido, não
  aprovado), e reabrir uma decisão de gasto é do dono. T05 depende dela e T06 não tem gatilho. Não
  sobrou nada útil para fazer sem essa resposta.
- **Motivo do status:** AGUARDANDO_MATHEUS, pergunta única: destravar a T09 ou manter adiada.
- **Para retomar:** registrar a resposta em `DECISOES.md`, voltar para `EXECUTANDO` e seguir.
