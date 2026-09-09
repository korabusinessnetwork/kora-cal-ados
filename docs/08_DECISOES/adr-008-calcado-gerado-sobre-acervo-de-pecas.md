# ADR-008 — Calçado gerado por prompt sobre **acervo de peças**, e por que a zona nasce pronta

**Status**: Aceito — **implementação bloqueada no acervo** (ver "O gargalo mudou de lugar")
**Data**: 2026-09-09
**Decisores**: Matheus Bonato
**Supersede**: ADR-001 **parcialmente** — o "MVP sem componente de IA" deixa de valer para o
modo generativo. Nada do ADR-001 muda para produto SVG. Não supersede o ADR-007: **completa**
ele, respondendo a pergunta que o deixou bloqueado ("de onde vem o modelo 3D?").
**Supersedido por**: (nenhum)

---

## Contexto

Em 2026-09-09, depois de o ADR-007 registrar a escolha por 3D, o dono descreveu o produto
que ele quer, e ele não é o produto que a documentação descreve:

> O designer de calçado entra sem nada na mão. Escreve um prompt e o sistema **gera** um
> calçado — tênis, chinelo, o que for. Não gostou: escreve prompts **por parte** ("sola mais
> robusta", "cadarço encerado preto"). Gira o modelo com o mouse, vê todas as partes, e edita
> cada uma individualmente.

Isso contradiz o que está escrito em quase todo lugar. `memory/identity.md` diz que o time
marca zonas **num modelo que a marca já tem**; a persona Ana quer **escalar catálogo**, não
explorar forma; o ADR-001 diz que o MVP é "deliberadamente vetor-only para manter o motor sem
IA"; `memory/restrictions.md` proíbe GPU e processo longo. Um agente que lesse a documentação
de ontem construiria outro produto.

### A pergunta que decidiu a arquitetura

Quando o designer escreve *"sola mais robusta"*, o que muda: a **aparência** da sola, ou a
**forma** dela? Três respostas possíveis foram postas ao dono, e ele escolheu a do meio:

1. só aparência (cor, material, textura) — barato, e não é o que ele quer;
2. **a forma, escolhida de um acervo de peças** — ← **escolhida**;
3. a forma gerada do zero por IA de 3D — o que ele descreveu ao pé da letra.

A rota 3 é a fronteira, e vale registrar por quê, porque é o motivo de este ADR existir. Gerar
um calçado 3D inteiro por prompt já funciona razoavelmente hoje. O problema é que a saída vem
como **uma malha fundida**, com textura assada por cima: sem "sola", sem "cadarço", sem
"cabedal" separados. E sem partes separadas não há clicar numa parte, não há editar uma parte,
e não há zona — ou seja, some metade do produto. Regenerar só a sola de modo que ela continue
encaixando no resto é mais difícil ainda.

**A separação em partes é o problema central deste produto, não um detalhe de implementação.**
A rota 2 o resolve por construção, em vez de apostar que a tecnologia o resolva.

---

## Decisão

### D1 — Existe um **acervo de peças**, e a IA **escolhe e estiliza**; nunca esculpe

O sistema mantém um acervo de peças de calçado em glTF — solas, entressolas, cabedais,
cadarços, línguas, ilhoses, contrafortes, biqueiras, logos. Cada peça é modelada uma vez,
normalizada uma vez (ADR-007 D4/D5: nome próprio, material próprio) e reusada em qualquer
número de produtos.

O prompt do designer não vira geometria. Vira **escolha sobre o acervo** mais **estilização**
(cor e material por peça). O modelo de linguagem recebe o catálogo das peças que existem e
devolve quais usar; ele **nunca inventa uma peça**.

Isto tem uma consequência de segurança que é o motivo de a decisão ser esta e não outra: a
saída do modelo é **validada contra o acervo** antes de qualquer coisa. Id de peça que não
existe é **recusa explícita**, nunca um calçado com um buraco no lugar da sola. É a mesma
regra que o projeto já aplica em toda parte — "zona não aplicada é erro, nunca aviso"
(ADR-004) — agora aplicada à saída de um modelo generativo, que é justamente o componente do
sistema em que não se pode confiar por construção.

### D2 — O calçado gerado é uma **composição**: dado pequeno, não geometria

Uma composição é a lista de peças escolhidas (uma por categoria) mais a cor/material de cada
uma. É JSON de algumas linhas. **Não é um arquivo 3D**: o 3D é montado a partir dela, no
navegador, carregando as peças do acervo e posicionando-as.

Isto é o análogo exato do que o projeto já faz: hoje uma variante é `zone_colors` sobre um
canônico, e não um SVG guardado. Amanhã um calçado gerado é uma composição sobre o acervo, e
não uma malha guardada. As propriedades que vêm de graça:

- **gerar é barato** — uma chamada de modelo de linguagem que devolve algumas linhas de JSON.
  Sem GPU, sem processo longo, sem fila, sem binário nativo. `memory/restrictions.md` continua
  valendo quase inteiro;
- **reprodutível** — a mesma composição sempre monta o mesmo calçado. Um calçado gerado pode
  ser aberto de novo daqui a um ano;
- **diffável** — "o que mudou entre esta versão e a anterior" é uma linha de JSON, não uma
  comparação de malhas. Editar uma parte é trocar um campo;
- **leve de guardar e de mandar** — o acervo é pesado e é o mesmo para todo mundo; o que é por
  produto é minúsculo.

### D3 — **Cada peça é uma zona.** A etapa de marcar zona desaparece no produto gerado

Este é o ganho que quase compensa o resto do custo sozinho.

Hoje, uma zona é um conjunto de elementos que **alguém teve que marcar clicando**, e o editor
inteiro existe para isso. No acervo, cada peça já é uma parte nomeada, separada e com material
próprio. Um calçado montado por composição **nasce zoneado**: a sola é a zona `sola` porque é
uma peça da categoria sola, não porque alguém a marcou.

Então, para produto gerado: não há marcação, não há `svg_selector`, não há sobreposição de
zonas possível (duas peças nunca compartilham malha), e o relatório de zonas é a própria
composição. Clicar numa peça para editá-la é raycast direto (ADR-007 D4).

O editor de marcação **continua existindo inteiro** para produto SVG trazido pela marca. Ele
não é jogado fora; ele deixa de ser obrigatório.

### D4 — O acervo é organizado por **forma**, e peça só combina com peça da mesma forma

Peças precisam encaixar. Uma sola só serve num cabedal se as duas foram modeladas sobre a
mesma **forma** — o molde do pé, que na indústria calçadista é literalmente o que define se
duas peças casam.

Portanto o acervo não é "um monte de solas": é um conjunto de formas, e cada forma tem suas
peças. Uma composição escolhe **uma forma** e depois peças **daquela forma**. Misturar formas é
estado inválido, recusado na validação de D1.

Isto é a restrição real de crescimento do acervo, e é melhor escrevê-la agora: **cada forma
nova multiplica o trabalho de modelagem**. Uma forma de tênis não serve para chinelo. "Qualquer
sapato" — o que o dono pediu — é, em termos de acervo, uma forma por família de calçado.

### D5 — Os dois modos **convivem**, como o ADR-007 já decidiu para SVG × 3D

Um produto é **trazido** (a marca sobe o SVG dela, o time marca zonas, a API escala — tudo o
que já existe e está testado) **ou gerado** (composição sobre o acervo). Nenhum produto
existente é migrado, nenhuma linha do motor atual é tocada, e a Fase 1 continua vendável
enquanto o modo generativo amadurece.

A coluna de tipo em `products` que o ADR-007 D6 já previa passa a distinguir três coisas, não
duas — e essa é decisão de schema, para a spec, não para aqui.

### D6 — Acervo base é da Kora; acervo do tenant é **privado**, sob RLS

O acervo tem duas camadas:

- **acervo base** — modelado ou licenciado pela Kora, visível a todos os tenants;
- **acervo do tenant** — peças que a própria marca sobe, visíveis **só** a ela.

A segunda camada não é um extra: sem ela, a marca que subir sua sola proprietária a estaria
entregando ao concorrente que usa o mesmo sistema. `memory/identity.md` chama isolamento entre
tenants concorrentes de "inegociável", e `restrictions.md` o marca CRÍTICA. Toda tabela de
acervo nasce com RLS, e a peça de um tenant nunca aparece no catálogo que vai para o modelo de
linguagem de outro.

### D7 — Variação paramétrica é o que impede o acervo de parecer LEGO

Peças discretas produzem combinações discretas, e um designer percebe isso na terceira
tentativa. A saída é dar a cada peça alguns **parâmetros contínuos** — altura da entressola,
espessura da sola, largura da biqueira — aplicados como transformação, não como malha nova.

Com isso "sola mais robusta" não precisa achar outra sola no acervo: pode ser a mesma peça com
o parâmetro de espessura mais alto. Um acervo pequeno passa a cobrir um espaço grande, e é
isso que separa "ferramenta de design" de "montador de kit".

Os parâmetros entram na composição como números, mantendo D2 inteiro.

---

## Alternativas Consideradas

### 1. Text-to-3D de verdade — gerar a malha do calçado por prompt

- **Prós**: é literalmente o que foi pedido; silhueta genuinamente nova, sem teto de acervo
- **Contras**: a saída é malha fundida com textura assada. Separar em partes semânticas
  ("isto é a sola") é pesquisa recente e não confiável em produção; regenerar uma peça que
  continue encaixando é mais difícil ainda. Custo por geração, latência de minutos, e
  dependência de serviço pago — os três contra `restrictions.md`
- **Descartado porque**: **o dono escolheu a rota do acervo.** E registrado aqui inteiro porque
  D2 é uma abstração sobre *de onde vem a geometria*: no dia em que a separação em partes for
  confiável, uma peça gerada entra na composição no lugar de uma peça do acervo **sem mudar o
  editor, as zonas ou a API**. Esta decisão não fecha aquela porta; constrói o corredor até ela

### 2. Só aparência — a forma vem da geração inicial e nunca muda

- **Prós**: o mais barato de todos; construível em cima do ADR-007 sem nada novo
- **Contras**: "sola mais robusta" viraria "sola vermelha". O designer descobre o teto no
  primeiro prompt
- **Descartado porque**: não responde ao pedido. Mas é o subconjunto que já funciona, e é por
  onde a implementação começa

### 3. Um configurador com menus, sem prompt

- **Prós**: mesma arquitetura de acervo, sem custo de IA nenhum; totalmente previsível
- **Contras**: é a experiência que já existe no mercado (Nike By You e afins), e o dono foi
  explícito que a porta de entrada é o prompt
- **Descartado porque**: o prompt é o produto. Vale registrar, porém, que o configurador é o
  **fallback grátis** desta arquitetura: se a chamada ao modelo falhar ou ficar cara demais, a
  composição continua editável à mão, e o sistema não para

### 4. Malha paramétrica de verdade (CAD/SDF), sem acervo

- **Prós**: espaço contínuo de formas, sem teto de biblioteca
- **Contras**: exige um motor de geometria próprio e um modelador de calçado que traduza
  linguagem em parâmetros de superfície. É um produto inteiro antes do produto
- **Descartado porque**: D7 captura a parte útil disto (parâmetros contínuos sobre peças
  reais) por uma fração do custo

---

## Consequências

### Positivas

- **A zona nasce pronta** (D3). O passo mais trabalhoso do produto atual — marcar zona
  clicando, com todas as suas recusas e o BUG-013/BUG-014 em volta — simplesmente não existe no
  modo gerado
- **Sobreposição de zonas fica impossível por construção** no modo gerado: duas peças nunca
  compartilham malha. Um erro de estado inteiro deixa de ser alcançável
- **O custo de IA fica em chamada de texto**, não em GPU. O bootstrap gratuito sobrevive quase
  intacto, e a restrição "motor precisa caber em função serverless" continua verdadeira
- **O que já existe continua valendo**: motor de recolor, API de variante, chave por tenant,
  RLS, o editor de marcação, o palco 3D do ADR-007. Nada é jogado fora (D5)
- **O caminho para a rota 1 fica aberto** e barato de tomar depois (ver Alternativa 1)

### Negativas / Trade-offs

- **O gargalo vira conteúdo, não código.** Ver a seção abaixo. É a mudança mais importante que
  este ADR causa no projeto, e a mais fácil de subestimar
- **Teto de originalidade.** Um designer que queira uma silhueta que não está no acervo não a
  terá. D7 empurra o teto para longe; não o remove
- **"Qualquer sapato" custa uma forma por família** (D4). Tênis, chinelo, bota, sapatilha e
  social são cinco acervos, não cinco peças
- **A saída do modelo passa a ser superfície de ataque.** Um prompt é entrada de usuário, e a
  resposta do modelo vira escolha de arquivo. A validação de D1 é o que separa isso de uma
  vulnerabilidade; ela não é opcional e não é "tratamento de erro"
- **Aparece a primeira dependência de serviço pago recorrente** do projeto. Modesta, mas
  recorrente, e `restrictions.md` precisa de linha nova com decisão explícita do dono
- **Duas experiências para manter.** Modo trazido e modo gerado dividem conceitos (zona, cor,
  variante) mas não dividem telas. É custo permanente de produto, aceito em troca de não jogar
  fora o que funciona

---

## O gargalo mudou de lugar: agora é o acervo

O ADR-007 ficou bloqueado em "não existe um glTF neste projeto". Este ADR responde de onde ele
vem — e move o bloqueio para um lugar diferente, que precisa ser dito com todas as letras:

**A dificuldade deste produto deixou de ser técnica e passou a ser de acervo.** Nenhuma linha
de código aqui é difícil. O que é difícil é ter, para **uma** forma de tênis, um conjunto de
peças que encaixam entre si, cada uma com nome próprio, material próprio e um punhado de
parâmetros — modeladas ou licenciadas.

A recomendação, que é a menor coisa capaz de provar o produto inteiro: **uma forma de tênis,
com cerca de 3 opções por categoria** (3 solas, 3 cabedais, 3 cadarços, 3 línguas, e o resto
fixo). São ~15 peças. Isso já dá centenas de combinações com D7, é suficiente para o designer
sentir se o produto funciona, e é o análogo exato do papel que o `tenis-demo.svg` cumpre hoje.

Enquanto essas peças não existirem, o modo gerado não pode ser construído com honestidade —
pelo mesmo motivo que o ADR-007 registrou: seria um motor que nunca viu o combustível.

---

## Referências

- `docs/08_DECISOES/adr-007-modelo-3d-manipulavel.md` — glTF, modo cor chapa, zona como lista de
  nomes de malha, material separado no provisionamento. Este ADR **depende** dele inteiro
- `docs/08_DECISOES/adr-001-stack-e-motor-de-render.md` — o "MVP sem IA" que este ADR supera no
  modo generativo
- `docs/08_DECISOES/adr-002-multi-tenant-white-label.md` — a regra que D6 aplica ao acervo
- `docs/08_DECISOES/adr-004-contrato-de-zona-e-normalizacao-de-svg.md` — "zona não aplicada é
  erro, nunca aviso", que D1 estende à saída do modelo de linguagem
- `memory/identity.md` — a identidade que este ADR obriga a reescrever
- `memory/restrictions.md` — a proibição de GPU/processo longo, que D2 preserva

---

## Notas de Implementação

- A ordem de construção é **acervo → composição → prompt**, nunca o contrário. Com o acervo e
  a composição editável à mão já existe produto (a Alternativa 3, o configurador); o prompt é a
  última camada e a mais fácil de trocar
- A validação de D1 é um módulo próprio e nasce com teste: id de peça inexistente, categoria
  faltando, peças de formas diferentes, parâmetro fora de faixa. Nenhuma composição chega ao
  palco sem passar por ele
- A montagem em cena é do navegador; o servidor nunca renderiza (ADR-007 D1 continua valendo).
  A API de variante, para produto gerado, opera sobre a **composição**
- O acervo é dado, e dado tem RLS (D6). Tabela nova nasce com policy, como sempre
- Termos novos entram no glossário **antes** do código: acervo, peça, categoria de peça,
  composição, forma
- Nada disto começa antes das ~15 peças da forma de demonstração existirem
