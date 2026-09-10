# Estado do Full Automático

status: AGUARDANDO_MATHEUS
<!-- valores: EXECUTANDO | AGUARDANDO_MATHEUS | PAUSADO | CONCLUIDO -->

- **Projeto:** Kora Calçados (codinome)
- **Plano de origem:** não existe `PLANO.md`. O plano deste projeto é a soma de
  `docs/08_DECISOES/adr-007-modelo-3d-manipulavel.md` + `adr-008-calcado-gerado-sobre-acervo-de-pecas.md`
  + `docs/09_BACKLOG/features.md`. A ordem de construção é a do ADR-008: **acervo → composição → prompt**.
- **Branch:** `main` (ver D02 em DECISOES.md: por que não `full-auto/<slug>`)
- **Início:** 2026-09-10
- **Fase atual:** rumo 3D / generativo, camada de composição
- **Tarefa atual:** nenhuma — tudo o que restou depende do Matheus
- **Próximo passo:** ao retomar, T05 e T06 destravam com P03 (custo) e P04 (acervo). Se elas
  continuarem bloqueadas, não há trabalho útil restante neste plano — o gargalo é conteúdo e
  decisão, como o próprio ADR-008 previu.
- **Progresso:** 5 de 10 concluídas, 5 bloqueadas (3 no acervo, 2 em decisão do dono)

## Motivo da parada (só se AGUARDANDO_MATHEUS ou PAUSADO)

Não sobrou tarefa útil que não dependa dele. As cinco restantes precisam, nesta ordem: das ~15
peças da forma de demonstração (P04), da aprovação da primeira dependência paga recorrente
(P03) e de duas decisões de schema (P05). É exatamente o bloqueio que o ADR-008 anunciou ao
escrever "o gargalo mudou de lugar: agora é o acervo" — não é impedimento técnico, é conteúdo.

O modo automático em si também está pela metade: o Stop hook e o vigia de limite não puderam
ser instalados (P01), então não há retomada sem ele digitar.

## Vigia de limite
Não instalado. O hook de continuidade e o vigia vivem em `.claude/`, e a instalação está
bloqueada (ver P01 em PENDENCIAS-DO-MATHEUS.md). Sem eles não há retomada automática:
se a sessão cair, o Matheus retoma lendo este arquivo.
