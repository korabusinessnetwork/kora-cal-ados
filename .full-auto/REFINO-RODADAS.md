# Rodadas de refino

Uma seção por rodada. O que entrou, o que foi revertido e por quê, e as medidas antes e depois, só
as que foram medidas de verdade.

A regra que governa este arquivo: **refino nunca piora o que já funciona**. Toda rodada começa com o
`BASELINE.md` verde e termina com ele verde.

---

## Rodada 1, em andamento desde 2026-09-12

**Lote:** 8 itens, de `TAREFAS.md`, seção "Refino, rodada 1". Nenhum com risco 4 ou 5.

| Item | Eixo | Score | Situação |
|---|---|---|---|
| R1-A01 cena 3D ao lado dos controles entre 860 e 1100 px | ux | 6 | pendente |
| R1-A04 teste do `ProvedorDeSessao` | qualidade | 4 | pendente |
| R1-A03 asset-base vazio é falha nomeada | robustez | 4 | pendente |
| R1-A02 copiar a composição em JSON | produto | 4 | pendente |
| R1-A05 título de aba por tela | ux | 3 | pendente |
| R1-A06 categoria dispensada sem chave crua na frase | ux | 3 | pendente |
| R1-A07 faixa do parâmetro visível | ux | 3 | pendente |
| R1-A08 `aria-pressed` nos botões de peça | ux | 3 | pendente |

**Baseline na abertura da rodada:** verde, medido em 2026-09-12 sobre o commit `08e4d1d`. Os números
estão em `BASELINE.md` e são o ponto de comparação do fechamento.

Ordem de execução escolhida: A01 primeiro por ser o de maior score e o que mais atrapalha a
conferência do princípio nº1; A04 antes de qualquer coisa que toque a sessão, porque A10 (rodada 2)
depende de existir teste ali antes de mexer.
