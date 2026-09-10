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
- **Tarefa atual:** T12 acervo de prova gerado por código
- **Próximo passo:** rodar o ciclo spec, build, review de T12: gerar por script 5 peças em glTF
  2.0 válido (2 solas, 2 cabedais, 1 cadarço) de uma forma só. Geometria grosseira de propósito.
  O projeto já escreve glTF à mão em `src/lib/render/fixtures/gltfDeTeste.ts`, então isto é
  extensão de algo provado, não técnica nova.
- **Progresso:** 6 de 13 concluídas, 4 pendentes e desbloqueadas, 3 adiadas por decisão do dono

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
