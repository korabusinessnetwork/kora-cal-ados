# Estado do Full Automático

status: AGUARDANDO_MATHEUS
<!-- valores: EXECUTANDO | AGUARDANDO_MATHEUS | PAUSADO | CONCLUIDO -->

- **Projeto:** Kora Calçados (codinome)
- **Plano de origem:** não existe `PLANO.md`. O plano deste projeto é a soma de
  `docs/08_DECISOES/adr-007-modelo-3d-manipulavel.md` + `adr-008-calcado-gerado-sobre-acervo-de-pecas.md`
  + `docs/09_BACKLOG/features.md`. A ordem de construção é a do ADR-008: **acervo → composição → prompt**.
- **Branch:** `main` (ver D02 em DECISOES.md: por que não `full-auto/<slug>`)
- **Início:** 2026-09-10
- **Fase atual:** Fase C, provar a esteira de ponta a ponta com o acervo de prova
- **Tarefa atual:** T14 montagem da composição em cena, **construída e revisada**, parada na
  conferência a olho do dono
- **Próximo passo:** o dono abre <http://localhost:5173/?tela=composicao> e confere os 5 itens da
  §8 de `specs/composicao-em-cena.md`. Aprovados, T14 fecha e T15 (o configurador) começa. Achado
  um defeito, ele vira teste e correção no mesmo commit, e a conferência se repete.
- **Progresso:** 9 de 13 construídas (T14 aguardando conferência), 1 pendente e desbloqueada,
  3 adiadas por decisão do dono

## Motivo da parada (só se AGUARDANDO_MATHEUS ou PAUSADO)

**T14 exige conferência a olho, por um motivo mais forte que T13: o que ela entrega é cor na tela,
e cor é literalmente o princípio nº1.** Os 33 critérios automatizáveis estão em sim, com 980 testes
verdes, typecheck limpo, build passando e 11 mutações mortas nos arquivos escritos aqui (mais 36
nos três módulos de render entregues em paralelo).

Nenhum teste desta entrega desenhou um pixel, porque jsdom não tem WebGL. O que os testes provam é
o **número escrito no glTF**; entre esse número e a cor na tela ainda há a conversão de sRGB para
linear e o renderizador, e é justamente essa distância que o princípio nº1 existe para vigiar.

Abrir <http://localhost:5173/?tela=composicao> e conferir:

1. **O calçado aparece montado**: sola embaixo, cabedal em cima dela, cadarço sobre o cabedal.
   Nenhuma peça flutuando no ar nem enterrada dentro da outra.
2. **A cor escolhida é a cor que aparece.** Este é o princípio nº1, literal. Se o hex escolhido e o
   que está na tela não forem a mesma cor, nada mais importa nesta entrega.
3. **Trocar a cor de uma zona muda só aquela peça.** A sola vermelha não pode pintar o cadarço.
4. **Engrossar a sola faz o cabedal e o cadarço subirem junto**, encaixados, sem abrir fresta nem
   afundar um no outro.
5. **Clicar numa peça mostra o nome dela**, e o nome bate com a peça em que se clicou.

O item 2 é o mais importante dos cinco.

**Passada automática feita em 2026-09-11, sem defeito nos 5 itens.** Descobriu-se que "só o dono
pode conferir" era verdade sobre o jsdom, não sobre esta máquina: há Chrome instalado, ele roda
WebGL por software em modo headless, e o Node 24 dirige o protocolo de DevTools sem dependência
nenhuma. A cor na tela bateu com o hex escolhido por matiz nas três peças (sola 5 contra 6, cabedal
221 contra 219, cadarço 43 contra 42), clicar numa peça devolveu o id dela, e engrossar a sola
subiu o resto encaixado. Detalhes na seção da passada em `specs/composicao-em-cena.md`.

Isso **não fecha T14**: a GPU e o monitor do dono não são os da passada, e o portão formal é dele.
Mas a conferência passa a ser confirmação, e não descoberta.

Duas notas para não parecerem defeito:

- **O arraste continua o de T13**: arrastar para baixo levanta o ponto de vista, que é a convenção
  do `OrbitControls` do three.
- **A cor inicial da demo** é a de `composicaoDeProva()`: sola quase branca, cabedal azul, cadarço
  amarelo. Não é identidade de marca nenhuma, é só um calçado de demonstração.

## A conferência a olho de T13 (encerrada, aprovada em 2026-09-10)

**T13 exigia conferência a olho, e só o dono tem navegador.** É a primeira tarefa desta fase em que
o princípio nº1 morde: suíte verde não prova que a peça aparece na tela, porque jsdom não tem WebGL
e nenhum teste desta entrega desenhou um pixel. Os 23 critérios automatizáveis estão todos em sim.

Abrir <http://localhost:5173/?tela=palco3d> e conferir os cinco itens da §7 de `specs/palco-3d.md`:

1. A peça aparece, uma caixa branca com relevo, não uma silhueta chapada nem uma tela preta.
2. Ela gira arrastando com o mouse, e não vira de cabeça para baixo por mais que se arraste.
3. Clicar nela mostra o nome dela, e clicar no vazio limpa o nome.
4. Trocar a peça no seletor troca o que está na tela, e a peça nova continua enquadrada.
5. Mexer no parâmetro engrossa ou afina a peça, sem ela afundar no chão nem flutuar.

O item 5 é o mais importante: é o único que nenhum teste pode ver de verdade, porque os testes
conferem a caixa envolvente, e caixa envolvente não distingue uma peça que cresceu para cima de
uma que cresceu para os dois lados.

Nota sobre o arraste, para não parecer defeito: arrastar para **baixo** levanta o ponto de vista.
É a convenção do `OrbitControls` do three, e é a que mantém os dois eixos com a mesma lógica de
"agarrar a peça". Se preferir o contrário, é uma linha em `src/palco3d/orbita.ts` e dois testes.

**Resultado: os cinco itens passaram**, sem defeito encontrado. Nenhuma linha de código mudou
depois da conferência.

## As quatro decisões que destravaram o plano (2026-09-10)

1. **Acervo**: acervo de prova em geometria grosseira primeiro, para provar a esteira antes de
   investir em modelagem. Registrada em `memory/restrictions.md`.
2. **Custo da IA**: adiada, o configurador vem primeiro e custa zero. Registrada em
   `memory/restrictions.md`.
3. **Zona 3D**: não guardar, a zona vem da composição. Sem tarefa, sem schema.
4. **Saída do cliente**: saída completa em formato aberto, virou o ADR-009.

## Vigia de limite
Não instalado. O hook de continuidade e o vigia vivem em `.claude/`, e a instalação está
bloqueada (ver P01 em PENDENCIAS-DO-MATHEUS.md). Sem eles não há retomada automática:
se a sessão cair, o Matheus retoma lendo este arquivo.
