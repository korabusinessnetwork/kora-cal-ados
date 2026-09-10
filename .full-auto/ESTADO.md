# Estado do Full Automático

status: EXECUTANDO
<!-- valores: EXECUTANDO | AGUARDANDO_MATHEUS | PAUSADO | CONCLUIDO -->

- **Projeto:** Kora Calçados (codinome)
- **Plano de origem:** não existe `PLANO.md`. O plano deste projeto é a soma de
  `docs/08_DECISOES/adr-007-modelo-3d-manipulavel.md` + `adr-008-calcado-gerado-sobre-acervo-de-pecas.md`
  + `docs/09_BACKLOG/features.md`. A ordem de construção é a do ADR-008: **acervo → composição → prompt**.
- **Branch:** `main` (ver D02 em DECISOES.md: por que não `full-auto/<slug>`)
- **Início:** 2026-09-10
- **Fase atual:** rumo 3D / generativo, camada de composição
- **Tarefa atual:** T04 validação de composição
- **Próximo passo:** rodar o ciclo spec → build → review de `validarComposicao.ts`, o módulo que o
  ADR-008 D1 exige antes de qualquer composição chegar ao palco.
- **Progresso:** 3 de 9 tarefas concluídas, 3 bloqueadas no acervo

## Motivo da parada (só se AGUARDANDO_MATHEUS ou PAUSADO)
<vazio>

## Vigia de limite
Não instalado. O hook de continuidade e o vigia vivem em `.claude/`, e a instalação está
bloqueada (ver P01 em PENDENCIAS-DO-MATHEUS.md). Sem eles não há retomada automática:
se a sessão cair, o Matheus retoma lendo este arquivo.
