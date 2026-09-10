# Estado do Full Automático

status: EXECUTANDO
<!-- valores: EXECUTANDO | AGUARDANDO_MATHEUS | PAUSADO | CONCLUIDO -->

- **Projeto:** Kora Calçados (codinome)
- **Plano de origem:** não existe `PLANO.md`. O plano deste projeto é a soma de
  `docs/08_DECISOES/adr-007-modelo-3d-manipulavel.md` + `adr-008-calcado-gerado-sobre-acervo-de-pecas.md`
  + `docs/09_BACKLOG/features.md`. A ordem de construção é a do ADR-008: **acervo → composição → prompt**.
- **Branch:** `main` (ver D02 em DECISOES.md: por que não `full-auto/<slug>`)
- **Início:** 2026-09-10
- **Fase atual:** Fase C, provar a esteira de ponta a ponta com o acervo de prova
- **Tarefa atual:** T14 montagem da composição em cena
- **Próximo passo:** rodar o ciclo spec, build, review de T14: uma composição validada
  (`validarComposicao`) vira calçado montado na tela, cada peça no seu lugar, e trocar a cor de uma
  zona muda só aquela peça. É onde as duas metades construídas separadamente se encontram, o
  validador de composição (T11) e o palco (T13), e é onde o princípio nº1 passa a valer em 3D:
  cor no editor igual à cor da API, com o mesmo motor nos dois lados.
  **Atenção:** T14 também exige conferência a olho, e por um motivo mais forte que T13. O que ela
  entrega é cor na tela, e cor é literalmente o princípio nº1.
- **Progresso:** 8 de 13 concluídas, 2 pendentes e desbloqueadas, 3 adiadas por decisão do dono

## Motivo da parada (só se AGUARDANDO_MATHEUS ou PAUSADO)

<vazio, voltou a executar em 2026-09-10 depois de o dono aprovar a conferência a olho de T13>

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
