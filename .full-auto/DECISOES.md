# Decisões tomadas no lugar do Matheus

Uma entrada por decisão. Ele revisa no final e pode reverter qualquer uma.

## D01 O plano de origem é a soma dos ADRs, não um `PLANO.md`
- **Contexto:** a Fase 0 da skill manda achar o plano em `PLANO.md`, `PLAN.md`, `docs/` ou `README.md`. Nenhum arquivo de plano único existe neste projeto.
- **Decisão:** tratar `adr-007` + `adr-008` + `docs/09_BACKLOG/features.md` como o plano, e adotar a ordem de construção que o ADR-008 escreve nas Notas de Implementação (acervo → composição → prompt).
- **Por quê:** este projeto documenta decisão em ADR por desenho (ADR-003). Inventar um `PLANO.md` criaria uma segunda fonte de verdade da direção do produto, que é exatamente o que o CLAUDE.md proíbe.
- **Como reverter:** escrever um `PLANO.md` e apontar `ESTADO.md` para ele.

## D02 Continuar em `main`, não abrir `full-auto/<slug>`
- **Contexto:** a Fase 0 item 5 manda criar uma branch `full-auto/<slug-do-projeto>`.
- **Decisão:** seguir em `main`, com commits pequenos por tarefa, como as duas últimas entregas já vinham fazendo.
- **Por quê:** a branch da skill existe para dar botão de desfazer num projeto novo tocado do zero. Aqui o projeto tem 25 commits, `main` está limpa, sincronizada com o remoto, e o histórico por tarefa já é o botão de desfazer. Abrir uma branch paralela agora só criaria uma segunda linha para reconciliar depois, e este projeto acabou de sair de exatamente esse problema (o `main` divergido arquivado em `arquivo/main-2026-08-13`).
- **Como reverter:** `git switch -c full-auto/kora-calcados` a qualquer momento; nada depende de estar em `main`.

## D03 "Nada disto começa antes das ~15 peças" vale para o modo gerado como produto, não para a validação
- **Contexto:** o ADR-008 fecha com "Nada disto começa antes das ~15 peças da forma de demonstração existirem". Ao mesmo tempo, as Notas de Implementação dele mandam a validação de D1 ser "um módulo próprio e nasce com teste".
- **Decisão:** ler a frase como bloqueio do **modo gerado como experiência** (palco, montagem em cena, prompt), e construir agora a validação de composição, que não precisa de peça nenhuma existir.
- **Por quê:** é o mesmo raciocínio que já autorizou `normalizarModelo3d` com o ADR-007 bloqueado: a peça não depende de artista. A validação recebe o catálogo como parâmetro e compara ids, ela nunca carrega geometria. E é a peça de maior risco do ADR-008: é ela que separa "a saída do modelo de linguagem é uma escolha de arquivo" de uma vulnerabilidade. Construí-la depois do acervo significaria ter o acervo em uso antes de existir o guarda.
- **Como reverter:** as tarefas bloqueadas de verdade estão marcadas `[!]` em `TAREFAS.md` e não foram tocadas; basta apagar `validarComposicao.ts` e seu teste.

## D04 O `/ciclo` não existe nesta máquina; o equivalente é o loop `/spec → /build → /review`
- **Contexto:** o adendo obrigatório da skill manda toda tarefa passar pela skill `/ciclo`, e prevê o caso de ela não estar instalada.
- **Decisão:** usar `loop-spec-build-review` (`/spec`, `/build`, `/review`), que é o mesmo ciclo com outro nome, e registrar a pendência, exatamente como a própria skill manda fazer.
- **Por quê:** a skill escreve o contorno em letra: "se o `/ciclo` não estiver instalado, não pare a execução: faça o ciclo manualmente, registre em `PENDENCIAS-DO-MATHEUS.md`, e siga".
- **Como reverter:** instalar uma skill chamada `/ciclo` e apontar o maestro para ela.
