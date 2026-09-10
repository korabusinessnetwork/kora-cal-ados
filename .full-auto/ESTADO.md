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
- **Tarefa atual:** T13 palco 3D no navegador
- **Próximo passo:** rodar o ciclo spec, build, review de T13: pôr o modelo na tela com three.js,
  girando com o mouse, e clicar numa peça identificando-a pelo nome da malha (ADR-007 D1/D2/D4).
  O combustível já existe: `gltfDaPecaDeProva(id)` devolve o texto e `GLTFLoader.parse(texto)` o
  recebe direto, sem arquivo em disco.
  **Atenção:** T13 é a primeira tarefa desta fase que o princípio nº1 obriga a conferir a olho,
  em navegador de verdade. Suíte verde não prova que a peça aparece. O servidor de dev já está
  rodando em http://localhost:5173.
- **Progresso:** 7 de 13 concluídas, 3 pendentes e desbloqueadas, 3 adiadas por decisão do dono

## Motivo da parada (só se AGUARDANDO_MATHEUS ou PAUSADO)
<vazio, voltou a executar em 2026-09-10 depois das quatro decisões do dono>

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
