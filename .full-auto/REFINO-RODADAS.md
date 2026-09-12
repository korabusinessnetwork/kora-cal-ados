# Rodadas de refino

Uma seção por rodada. O que entrou, o que foi revertido e por quê, e as medidas antes e depois, só
as que foram medidas de verdade.

A regra que governa este arquivo: **refino nunca piora o que já funciona**. Toda rodada começa com o
`BASELINE.md` verde e termina com ele verde.

---

## Rodada 1, fechada em 2026-09-12

**Lote:** 8 itens, de `TAREFAS.md`, seção "Refino, rodada 1". Nenhum com risco 4 ou 5.
**Entregues: 8 de 8. Revertidos: nenhum.**

| Item | Eixo | Score | Situação | Commit |
|---|---|---|---|---|
| R1-A01 cena 3D ao lado dos controles entre 860 e 1100 px | ux | 6 | entregue | `14796e4` |
| R1-A04 teste do `ProvedorDeSessao` | qualidade | 4 | entregue | `12701c5` |
| R1-A03 asset-base vazio é falha nomeada | robustez | 4 | entregue | `24e28ac` |
| R1-A02 copiar a composição em JSON | produto | 4 | entregue | `bdcd6de` |
| R1-A05 título de aba por tela | ux | 3 | entregue | `34d56a6` |
| R1-A06 categoria dispensada sem chave crua na frase | ux | 3 | entregue | `367539a` |
| R1-A07 faixa do parâmetro visível | ux | 3 | entregue | `231fdb2` |
| R1-A08 `aria-pressed` nos botões de peça | ux | 3 | entregue | `5e35551` |

Mais um commit que não estava no lote: `e0f1ab6`, o `afterAll` sem teto em `exportarTenant.test.ts`.
Ele apareceu na primeira verificação de baseline da rodada, com os 58 testes VERDES e o arquivo
reprovando assim mesmo, porque quem estourava era a limpeza, depois do último `expect`. Baseline
vermelho é a única coisa que vem antes do lote, então foi consertado na hora.

**Baseline:** verde na abertura (`08e4d1d`) e verde no fechamento (`5e35551`), com o lote inteiro
junto: typecheck limpo, 1072 testes, 58 de 58 contra o banco real, 25 no navegador, build limpo,
`npm audit` sem vulnerabilidade. A tabela com os dois lados está em `BASELINE.md`.

### O que mudou, em números medidos

| Medida | Antes | Depois |
|---|---|---|
| Testes | 1047 | **1072** (+25, de A02, A03, A04 e A05) |
| Chunk principal | 455,03 kB | 455,58 kB (+0,55 kB) |
| CSS | 20,76 kB | 21,75 kB (+0,99 kB) |

### O que foi conferido a olho, e não por teste

Quatro itens são de tela e não têm teste automatizado, então a verificação foi no navegador de
verdade, e é isto que foi visto:

- **A01:** em 1024x768 o canvas começava em y=789, fora da tela, e passou para dentro dela. Medido
  nas três larguras, 1440, 1024 e 375, para provar que as outras duas não mudaram.
- **A02:** o navegador embutido NEGA `navigator.clipboard.writeText`, o que exercitou o caminho
  alternativo de graça: aparece o `<pre>` com o JSON para copiar à mão. Com a área de transferência
  espionada, o texto copiado bateu byte a byte com o `<pre>`, e mexer num controle apagou a
  confirmação antiga, com a cópia seguinte já trazendo o valor novo.
- **A07:** com o foco no controle, `End` mostra 40,0 mm e `Home` mostra 10,0 mm, exatamente os dois
  extremos escritos ao lado.
- **A08:** os seis botões da composição nascem `aria-pressed=true` nos três escolhidos e `false` no
  resto, e clicar em "Nenhuma peça" move o `true` para ele. A árvore de acessibilidade do navegador
  embutido não mostra estado ARIA, então o que foi conferido é o atributo no DOM renderizado.

### Nada ficou atrás de flag

Nenhum item da rodada altera fluxo principal de quem usa o sistema logado: A01, A02, A06, A07 e A08
são das telas de prova do palco, A05 é o título da aba, A03 troca uma tela em branco por uma
mensagem, e A04 é só teste. Por isso nenhum precisou de flag de configuração.

### Pendências novas do dono

- **P04**, em `PENDENCIAS-DO-MATHEUS.md`: 8 tenants de teste órfãos no Supabase real, deixados por
  uma limpeza que abortou antes do conserto do `afterAll`. Apagar linha de banco real é decisão dele.

### Decisão registrada nesta rodada

- **D10:** o `test:banco` vermelho por cota de autenticação do plano gratuito não ganhou timeout
  maior. A causa e o jeito de reconhecer o sintoma estão em `BASELINE.md`.

---

## Rodada 2, a montar

A reauditoria da rodada 2 parte do backlog de `AUDITORIA.md` acima do corte: A09, A10 e A11.
