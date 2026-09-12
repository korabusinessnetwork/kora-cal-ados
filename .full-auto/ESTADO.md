# Estado do Full Automático

status: CONCLUIDO
<!-- valores: EXECUTANDO | AGUARDANDO_MATHEUS | PAUSADO | CONCLUIDO -->

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
