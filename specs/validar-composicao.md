# Spec — `validarComposicao`: o guarda da saída do modelo de linguagem

**Data**: 2026-09-10 · **Origem**: ADR-008 D1/D2/D4/D7 e as Notas de Implementação dele
**Tarefa**: T04 de `.full-auto/TAREFAS.md`

---

## 0. Por que isto, e por que agora

O ADR-008 fecha com "nada disto começa antes das ~15 peças da forma de demonstração
existirem", e ao mesmo tempo manda, nas Notas de Implementação, que "a validação de D1 é um
módulo próprio e nasce com teste". Não é contradição: o bloqueio é do **modo gerado como
experiência** (palco, montagem em cena, prompt), que precisa de geometria para ser verificável
a olho. A validação não precisa de peça nenhuma existir, porque ela recebe o catálogo como
parâmetro e compara identificadores. É a mesma razão que autorizou `normalizarModelo3d` com o
ADR-007 bloqueado.

E há uma razão para ser **agora** e não depois do acervo. O ADR-008 escreve, nas consequências
negativas, que "a saída do modelo passa a ser superfície de ataque. Um prompt é entrada de
usuário, e a resposta do modelo vira escolha de arquivo. A validação de D1 é o que separa isso
de uma vulnerabilidade; ela não é opcional e não é tratamento de erro". Construir o acervo
primeiro e o guarda depois significa ter o acervo em uso antes de existir o guarda, que é a
ordem errada de exatamente uma dessas duas coisas.

---

## 1. Escopo

Um módulo puro em `src/lib/composicao/` que recebe uma **composição** (as escolhas de peça, uma
por categoria, com cor e parâmetros) e o **catálogo do acervo visível**, e devolve a composição
**resolvida contra o catálogo** ou recusa com código de erro explícito — sem nunca deixar passar
um identificador de peça que o catálogo não contenha.

---

## 2. Fora de escopo

- three.js, palco 3D, montagem da composição em cena — bloqueados no acervo (T07/T08)
- a chamada ao modelo de linguagem e a construção do prompt — T09, e além disso dependem de
  decisão de custo do dono (P03)
- o schema do banco do acervo, migrations e RLS — T06, e depende de banco real
- `montarCatalogoParaModelo` (o recorte do acervo que vai para o modelo) — T05
- carregar geometria de peça, resolver caminho de arquivo, tocar em Storage
- a aplicação dos parâmetros de D7 como transformação na cena — isto valida os números, quem
  os aplica é o palco
- qualquer coisa que precise das ~15 peças reais existirem

---

## 3. Arquivos afetados

### Novos

| Arquivo | Papel |
|---|---|
| `src/lib/composicao/README.md` | Índice do diretório novo, como o CLAUDE.md exige de todo diretório |
| `src/lib/composicao/tiposDaComposicao.ts` | `Forma`, `PecaDoAcervo`, `ParametroDePeca`, `CatalogoDoAcervo`, `Composicao`, `EscolhaDePeca`, `ComposicaoValidada` |
| `src/lib/composicao/validarComposicao.ts` | A validação inteira. Único export de comportamento |
| `src/lib/composicao/validarComposicao.test.ts` | Teste co-locado, nasce junto |
| `src/lib/composicao/fixtures/acervoDeTeste.ts` | Construtor de catálogo mínimo escrito à mão, o gêmeo de `fixtures/gltfDeTeste.ts` |

### Modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/render/erros.ts` | Quatro códigos novos (ver critério 1). O comentário de topo passa a dizer que o vocabulário é do motor de domínio, render **e** composição |
| `api/_lib/traduzirParaFalhaDaApi.ts` | O `Record<CodigoDeErro, …>` vira erro de compilação até os quatro entrarem na tabela. É o tripwire funcionando, não um efeito colateral |
| `api/_lib/traduzirParaFalhaDaApi.test.ts` | Bloco nomeado para os quatro, como já existe para os dois códigos 3D |
| `docs/07_APIS/endpoints.md` | Quatro linhas na tabela de status, com a prosa do porquê |
| `src/lib/README.md` | Linha para o diretório novo |
| `.full-auto/{ESTADO,TAREFAS,LOG}.md` | Estado do maestro |

---

## 4. Critérios de aceite

### O vocabulário de erro

1. **Quatro códigos novos em `erros.ts`**, e cada um ensina um conserto diferente — é o mesmo
   argumento que fez `MODELO_3D_INVALIDO` não reusar `SVG_INVALIDO`:
   - `PECA_NAO_ENCONTRADA` — o id não está no catálogo. **É o código de D1**, o que separa
     escolha de arquivo de vulnerabilidade
   - `COMPOSICAO_INVALIDA` — a estrutura está errada: não é objeto, falta forma, falta uma
     categoria obrigatória, categoria repetida, categoria que não é `zone_key` válida
   - `FORMAS_MISTURADAS` — a peça existe, mas é de outra forma. Conserto diferente de todos os
     outros: não é "corrija o id", é "escolha peças que encaixam" (ADR-008 D4)
   - `PARAMETRO_INVALIDO` — parâmetro fora da faixa, não numérico, ou não declarado pela peça
2. Nenhum código existente muda de texto. `erros.ts` promete que **mudar** um código quebra
   cliente; acrescentar não quebra ninguém, e o arquivo passa a dizer isso com todas as letras.
3. Os quatro entram em `traduzirParaFalhaDaApi` como **422**, e a mensagem de cada um nomeia o
   que corrigir. Justificativa escrita no código: a composição chega no corpo do pedido, então é
   literalmente o pedido que é improcessável. O dia em que uma composição **já gravada** ficar
   inválida porque o acervo mudou é outro ponto de chamada e vira 409, resolvido na origem como
   `ZONA_NAO_ENCONTRADA` já foi (pré-checagem no handler).

### A forma do dado

4. **A composição é uma lista de escolhas, não um `Record<categoria, escolha>`.** Esta é a
   decisão de desenho que mais importa aqui e precisa estar escrita no código: um objeto com
   chave por categoria tornaria categoria repetida **indetectável**, porque `JSON.parse`
   descarta a chave duplicada em silêncio e fica com a última. É o BUG-013 outra vez, por um
   terceiro caminho: a última chave do JSON decidindo sozinha. Com lista, `sola` duas vezes é
   visível e vira `COMPOSICAO_INVALIDA`.
5. **A categoria de peça é a `zone_key` do produto gerado** (ADR-008 D3: cada peça é uma zona),
   e por isso ela passa por `validarZoneKey`, o mesmo validador do produto trazido. Uma
   consequência que precisa estar comentada: `validarCor(valor, zoneKey)` é chamado com a
   categoria no lugar da `zone_key`, e a mensagem de erro sai correta por construção, não por
   coincidência.
6. **A faixa de cada parâmetro mora na peça, no catálogo** (`minimo`, `maximo`, `padrao`), nunca
   no módulo de validação. Um limite escrito no validador seria o mesmo limite para uma sola de
   tênis e uma de chinelo.
7. **A forma declara quais categorias são obrigatórias e quais são opcionais.** Não há lista
   fixa de categorias no código: chinelo não tem cadarço, e uma lista fixa transformaria isso em
   `COMPOSICAO_INVALIDA` permanente.

### A validação

8. Id de peça que não está no catálogo → `PECA_NAO_ENCONTRADA`, com o id na mensagem.
9. Peça que existe mas pertence a outra forma → `FORMAS_MISTURADAS`, nomeando as duas formas.
10. Categoria obrigatória ausente → `COMPOSICAO_INVALIDA`, nomeando a categoria que falta.
11. Categoria repetida → `COMPOSICAO_INVALIDA`, nomeando a categoria repetida.
12. Categoria que não existe na forma → `COMPOSICAO_INVALIDA` (peça sobrando é tão inválido
    quanto peça faltando).
13. Cor presente e inválida → `COR_INVALIDA` vinda de `validarCor`, **sem** o módulo
    reimplementar validação de hex. Cor ausente é válida: a peça mantém a cor própria dela.
14. Parâmetro fora de `[minimo, maximo]` → `PARAMETRO_INVALIDO` com o valor, o nome e a faixa.
15. Parâmetro `NaN`, `Infinity` ou não numérico → `PARAMETRO_INVALIDO`. (`NaN` passa por
    qualquer comparação de faixa sem disparar, então precisa de checagem própria — é o mesmo
    buraco que `limitar` tapa em `corSrgbLinear.ts`.)
16. Parâmetro que a peça não declara → `PARAMETRO_INVALIDO`. Ignorar em silêncio faria "sola
    mais robusta" não ter efeito nenhum sem ninguém saber.
17. Parâmetro ausente → recebe o `padrao` declarado pela peça, e o `padrao` aparece na saída.
18. **Valida tudo antes de devolver qualquer coisa**, como `recolorirModelo3d` já faz: a
    composição sai inteira ou não sai.

### A propriedade de segurança

19. **`ComposicaoValidada` carrega a peça do catálogo, não o id que veio na entrada.** Este é o
    critério que faz o módulo ser um guarda e não um conferidor: quem consome a saída recebe a
    entrada do catálogo já resolvida e não tem como usar a string crua do modelo de linguagem
    para montar caminho de arquivo. Verificável por teste de identidade — o objeto na saída é o
    **mesmo** objeto do catálogo.
20. A validação é por **pertencimento ao catálogo**, nunca por formato do id. Um teste registra
    isso: um id sintaticamente perfeito (`sola-corrida-04`) que não está no catálogo é recusado.
21. Nenhuma leitura de arquivo, nenhuma rede, nenhum acesso a Storage no módulo — função pura,
    testável sem ambiente.

### Processo

22. Verificação por mutação: pelo menos três quebras deliberadas, cada uma matando ao menos um
    teste, com o arquivo restaurado e a restauração conferida por `md5sum` (arquivo novo é
    **untracked**, e `git checkout --` não o restaura — está em `memory/learnings.md`).
23. `npm test` verde na suíte inteira, `npx tsc --noEmit` limpo.
24. `src/lib/composicao/README.md` existe e indexa cada arquivo do diretório.

---

## 5. Edge cases conhecidos

| Caso | Resposta esperada |
|---|---|
| Composição sem nenhuma escolha (lista vazia) | `COMPOSICAO_INVALIDA` — falta toda categoria obrigatória, e a mensagem lista as que faltam |
| Forma que não existe no catálogo | `COMPOSICAO_INVALIDA` nomeando a forma. Não é `PECA_NAO_ENCONTRADA`: nenhuma peça foi consultada ainda |
| Catálogo vazio (tenant sem acervo visível) | Toda peça vira `PECA_NAO_ENCONTRADA`. Não é caso especial e **não** deve ganhar código próprio |
| Duas peças de categorias diferentes com o mesmo id | Catálogo malformado, não composição malformada. A validação usa o id como chave e o teste registra que ids são únicos no catálogo |
| Peça sem parâmetro nenhum declarado | Válida. Ausência de parâmetros não é erro, é uma peça sem variação (D7 é opcional por peça) |
| `parametros` presente mas vazio | Igual a ausente: todos recebem o padrão |
| Faixa invertida no catálogo (`minimo > maximo`) | Catálogo malformado. Nenhum valor passaria, e o erro apontaria a composição em vez do acervo — o teste registra o caso, a decisão de recusar o catálogo fica anotada |
| Cor `#F00` (forma curta) | Válida, expandida por `validarCor` para `#FF0000`. Uma única expansão, num lugar só |
| Categoria com acento (`cadarço`) | `COMPOSICAO_INVALIDA` via `validarZoneKey` — mesma regra do produto trazido, mesma mensagem |
| `parametros` com valor `null` | `PARAMETRO_INVALIDO`, não "ausente". `null` é alguém tendo mandado algo, e virar padrão em silêncio é conserto calado |

---

## 6. Definição de "aprovado sem ressalvas"

Todos os 24 critérios respondidos com sim; suíte inteira verde e `tsc --noEmit` limpo; três
mutações deliberadas mataram testes e o arquivo voltou com `md5sum` conferido; nenhum `TODO`
sem justificativa e nenhum `console.log`; nenhuma regressão nos fluxos existentes; e a
propriedade do critério 19 provada por teste — a saída carrega a peça do catálogo, de modo que
um id inventado pelo modelo de linguagem não tem como virar caminho de arquivo depois.

---

## 7. Resultado da revisão — 2026-09-10

**Veredito: aprovado sem ressalvas.** 24 de 24 critérios em sim. 698 testes verdes na suíte
inteira (eram 638), `tsc --noEmit` limpo, 56 testes no módulo novo.

### Cinco mutações, cinco mortes

Cada uma aplicada sobre `validarComposicao.ts`, com o arquivo copiado para o scratchpad antes
e conferido por `md5sum` depois (`dc7acd13fa8861a3d3b65a1131a5ebea` nas cinco restaurações).

| # | Quebra deliberada | Testes mortos |
|---|---|---|
| a | Trocar pertencimento ao catálogo por checagem de **formato** do id | 3 |
| b | Derrubar o limite superior da faixa (`pedido < minimo` só) | 2 |
| c | Remover `Number.isFinite`, deixando `NaN` atravessar | 1 → 2 depois da correção |
| d | Devolver uma cópia da peça com o id da entrada, não o objeto do catálogo | 1 |
| e | Inverter a ordem das duas conferências de conjunto | 1 |

A mutação (a) é a que justifica o módulo: ela é literalmente a implementação errada que o
ADR-008 descreve, e mata os três testes de pertencimento, incluindo o do id sintaticamente
impecável. A (d) mata exatamente um teste, o do critério 19, e é o único que a pega — o que
está certo, porque é uma propriedade e não um comportamento visível.

### O que a mutação (c) revelou, e que virou correção

O caso `Infinity` estava num `it.each` chamado **"não passa por número"** junto com `NaN`. Ao
remover o `Number.isFinite`, só o `NaN` ficou vermelho: `Infinity` continua sendo recusado, mas
pela **checagem de faixa** (`Infinity > 40`), não pelo mecanismo que o nome anunciava.

O comportamento estava certo e a cobertura anunciada estava errada. Se um dia a faixa saísse,
aquele caso sumiria junto sem ninguém notar, porque ele nunca protegeu o que dizia proteger.
Corrigido: o `it.each` passou a se chamar "é recusado como valor de parâmetro", sem prometer
por onde, e `NaN` ganhou teste próprio nomeando o mecanismo — verificado morrendo pela
mutação (c). Generalizado em `memory/learnings.md`: **quando um caso sobrevive à quebra do
mecanismo que ele nomeia, ele está sendo segurado por outra coisa**, e isso se esconde
especialmente bem dentro de um `it.each`.

### Três desvios do spec

1. **`EscolhaDePeca` perdeu o campo `categoria`.** O spec desenhava
   `{categoria, peca_id, cor?, parametros?}`. A peça do catálogo já sabe a categoria dela, e um
   segundo campo dizendo a mesma coisa é um campo que **pode discordar** — a composição diria
   `cadarco` apontando para uma sola, e alguém teria que decidir qual vale. Campo redundante
   que diverge é a família de defeito que este projeto persegue desde o BUG-013. A detecção de
   categoria repetida não foi afetada, porque `pecas` continua sendo lista.
2. **O tripwire disparou em dois lugares, não um.** O spec previu a quebra de compilação em
   `traduzirParaFalhaDaApi.ts`. Quebrou também em `src/esboco/PainelDaApi.tsx`, que mantém a
   mesma tabela para a tela do esboço, e cujo comentário já dizia: "foi este erro de compilação
   que avisou que a tela existia, quando os códigos entraram". Aconteceu de novo, igual.
3. **`parametros` que não é objeto virou `COMPOSICAO_INVALIDA`, não `PARAMETRO_INVALIDO`.** O
   spec não decidiu o contêiner. Estrutura errada é `COMPOSICAO_INVALIDA`; os valores dentro
   dela é que são `PARAMETRO_INVALIDO`.

### Decisões escritas no código, como o critério 6 exige

- **Acervo malformado não recusa o pedido.** Id repetido no catálogo faz o primeiro vencer, e
  faixa invertida recusa com mensagem dizendo que o defeito é **nosso**. Quebrar o pedido do
  designer por causa de uma linha duplicada no nosso banco o deixaria sem saída nenhuma. Se o
  acervo crescer, isto merece validação própria **no cadastro da peça**, não no pedido — está
  em "Limites conhecidos" do README do módulo.
- **A ordem das duas conferências de conjunto não é indiferente:** repetida antes de ausente,
  porque uma sola escolhida duas vezes também satisfaz "sola presente", e reclamar da falta
  esconderia a duplicata. Coberto por teste próprio e pela mutação (e).

### Pendências registradas, não esquecidas

- **Onde a composição é gravada** é decisão de schema (tabela nova, RLS de D6), e é a T06 de
  `.full-auto/TAREFAS.md`. Nada aqui depende dela: o módulo recebe o catálogo como parâmetro.
- **O caso do 409** — composição já gravada que fica inválida porque o acervo mudou — está
  anotado em `docs/07_APIS/endpoints.md` com a saída pronta (pré-checagem no handler, como
  `ZONA_NAO_ENCONTRADA` já faz), para o dia em que existir esse ponto de chamada.
