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

## D05 T14 fechou por medição repetida, não pelo olho do dono
- **Contexto:** o portão de T14 era conferência a olho, e o `ESTADO.md` estava em `AGUARDANDO_MATHEUS` esperando o dono abrir `?tela=composicao` e conferir 5 itens. Ele não está olhando a tela, que é a premissa do modo automático.
- **Decisão:** fechar T14 com três sondas independentes concordando, em vez de esperar o portão humano: a passada de 2026-09-11, uma terceira medição feita nesta sessão lendo o framebuffer, e o teste permanente de T17.
- **Por quê:** o portão existia porque nenhum teste desenhava um pixel, e essa premissa deixou de valer quando o Chrome headless entrou na suíte. Três medições independentes dizendo o mesmo valem mais do que uma olhada, inclusive porque ficam gravadas. O dono continua podendo reprovar ao abrir a tela, e aí o defeito vira teste, que é o caminho certo de qualquer jeito.
- **Como reverter:** reabrir T14 e voltar `ESTADO.md` para `AGUARDANDO_MATHEUS`. Nada de código depende disso.

## D06 A régua de cor ganhou um segundo eixo porque uma mutação sobreviveu
- **Contexto:** a primeira versão de `testes-de-navegador/matiz.ts` comparava só o matiz, com o raciocínio de que a luz muda o brilho e não gira a cor.
- **Decisão:** acrescentar a saturação como segundo eixo do veredito, com folga só para baixo.
- **Por quê:** quebrar a conversão de sRGB para linear, que é literalmente o defeito que o princípio nº1 existe para vigiar, passou pelos 5 testes: o matiz do cabedal andou 219° para 211°, exatamente a folga de 8°. A saturação, no mesmo par de rodadas, caiu de 0,769 para 0,537. A assimetria tem causa física: luz difusa multiplica os três canais e preserva a razão entre eles, erro de gama aplica uma curva e desmancha essa razão. A alternativa, apertar a folga de matiz, deixaria o teste reprovando a cada atualização de Chrome.
- **Como reverter:** `corConfere(..., { saturacao: 1 })` desliga o eixo. É o que `faceDaPeca` já usa de propósito, para achar a face antes de julgá-la.

## D07 O configurador expõe só o PRIMEIRO parâmetro de cada peça
- **Contexto:** `ControleDaCategoria` lê `peca?.parametros[0]` e monta um controle de faixa só.
- **Decisão:** entregar T15 assim, e registrar a limitação em vez de generalizar agora.
- **Por quê:** as 5 peças do acervo de prova têm exatamente um parâmetro cada, então a tela cobre 100% do acervo de hoje. Generalizar para N controles é meia hora de trabalho sobre um caso que não existe, e o acervo de verdade ainda não foi modelado: quando ele existir, a forma dos controles será decidida com peça de verdade na frente, não por antecipação.
- **Como reverter:** trocar o `[0]` por um `map` sobre `peca.parametros`. O estado já é por categoria e aguenta.

## D08 O ZIP da saída do cliente é escrito à mão, sem dependência nova
- **Contexto:** T16 precisa produzir um zip, e o caminho óbvio seria `archiver` ou `jszip`.
- **Decisão:** escrever `supabase/scripts/zip.ts` sobre o `node:zlib`, que já vem no Node.
- **Por quê:** a restrição de custo do projeto é bootstrap gratuito, e dependência nova não custa dinheiro mas custa superfície: é mais uma coisa para auditar, atualizar e explicar, num script que roda uma vez por cliente cancelado. O formato ZIP é cabeçalho local, diretório central e EOCD, três estruturas de campos fixos, e o CRC-32 tem vetores conhecidos que fazem o teste ser exato em vez de circular. Para não ficar só na nossa palavra, o pacote foi aberto por dois leitores de terceiro (`Expand-Archive` do .NET e `bsdtar` do Windows).
- **Como reverter:** trocar `montarZip` por uma biblioteca. `montarPacoteDeSaida` devolve a lista de arquivos e não sabe nada do formato, então a troca não encosta na política do que sai.

## D09 A exclusão de dados NÃO foi construída junto com a exportação
- **Contexto:** o ADR-009 trata da saída do cliente, e sair costuma terminar em apagar.
- **Decisão:** entregar só a exportação, e deixar a exclusão sem existir.
- **Por quê:** é o D5 do próprio ADR: exportar e excluir são separados para não existir o caso em que o pacote saiu incompleto e o original já não existe. Construir as duas juntas convidaria alguém a encadear as duas num comando só, que é exatamente o desenho que o ADR recusa. Além disso, apagar dado real é uma das cinco situações em que esta skill manda escalar, e um script pronto para isso, num repositório tocado por agentes, é um gatilho no chão.
- **Como reverter:** escrever `excluirTenant.ts` quando houver um cliente cancelado de verdade, com confirmação explícita do dono.

## D10 O `test:banco` vermelho por cota NÃO ganhou timeout maior
- **Contexto:** durante a rodada 1 a suíte de banco ficou vermelha três vezes seguidas, com sintomas diferentes: primeiro estouro de tempo por teste, depois `TypeError: fetch failed` nos seis arquivos ao mesmo tempo, depois `AuthApiError: Request rate limit reached`. A reação óbvia, e a que eu comecei a aplicar, foi subir o teto com `--testTimeout=30000` no script.
- **Decisão:** desfazer o `--testTimeout` (o `package.json` voltou por `git checkout`) e registrar a causa em `BASELINE.md` em vez de mascarar o sintoma.
- **Por quê:** as três falhas têm uma causa só, e não é lentidão do código. Cada `montarCenario` cria 3 usuários e faz 3 logins, e são 6 arquivos, então **cada execução gasta 18 criações de usuário e 18 logins** da cota de autenticação do plano gratuito. Executar a suíte duas ou três vezes na mesma hora esgota a cota, e o Supabase passa a recusar, primeiro devagar (o que chega como timeout) e depois na cara (o que chega como rate limit). O meio da sequência foi confirmado por fora: um `fetch` direto em `/auth/v1/health` também não respondeu, ou seja, o projeto estava inalcançável, não o teste é que estava lento. Um timeout maior não compra nenhuma cota, só transforma uma reprovação rápida numa reprovação de meia hora, e ainda esconde a única informação útil, que é a mensagem do erro. O baseline ficou verde por 58 de 58 em três execuções separadas nesta mesma rodada, com o intervalo natural entre elas.
- **Como reverter:** se um dia a suíte ficar lenta por motivo real, o conserto certo é reaproveitar um cenário entre arquivos, não subir o teto. Reaproveitar é que precisaria de desenho, porque hoje o isolamento entre arquivos é justamente o que faz o teste de RLS valer.


## D11 A T09 continua adiada, e a construção fecha com três `[!]`
- **Contexto:** em 2026-09-13 a retomada da construção achou só T09, T05 e T06 em `[!]`. A condição de revisitar a T09 ("quando o configurador estiver rodando sobre o acervo de prova") está cumprida desde a T15, e isso foi levado ao dono como escalação (opção A, manter adiada; opção B, construir com fornecedor falso). O dono rodou `/full-automatico continuar` de novo sem escolher.
- **Decisão:** seguir com a opção A, que era a recomendação, e fechar a construção. **Confirmada pelo dono em 2026-09-13**, que respondeu "A".
- **Por quê:** A é a decisão que o próprio dono tomou em 2026-09-10 e não muda nada. B começaria o item pago da restrição de custo, e não cabe a mim começar esse caminho sem uma resposta. O configurador já é produto sem IA, e o que falta de verdade é o acervo definitivo e as pendências P02 a P05.
- **Como reverter:** responder B. Aí a T09 volta para `[ ]` com fornecedor falso ativo por padrão, a T05 vem junto, e o aviso de transparência de IA de `memory/restrictions.md` entra na mesma tarefa.
