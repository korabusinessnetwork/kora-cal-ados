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
- **Tarefa atual:** T05 `montarCatalogoParaModelo` — o recorte do acervo que vai para o modelo de linguagem
- **Próximo passo:** rodar o ciclo spec → build → review de `montarCatalogoParaModelo.ts`. O
  ponto que carrega o risco: ele decide o que um tenant vê do acervo, e peça de uma marca
  jamais pode entrar no catálogo que vai para o modelo de linguagem de outra (ADR-008 D6).
- **Progresso:** 4 de 10 tarefas concluídas, 3 bloqueadas no acervo

## Motivo da parada (só se AGUARDANDO_MATHEUS ou PAUSADO)
<vazio>

## Vigia de limite
Não instalado. O hook de continuidade e o vigia vivem em `.claude/`, e a instalação está
bloqueada (ver P01 em PENDENCIAS-DO-MATHEUS.md). Sem eles não há retomada automática:
se a sessão cair, o Matheus retoma lendo este arquivo.
