# Aprendizados — Kora Calçados (codinome)

## Objetivo
- Manter memória viva do que aprendemos construindo o produto
- Documentar raciocínios antes de virarem padrão ou decisão
- Evitar repetir o mesmo erro 6 meses depois — num projeto sem dev humano, "6 meses depois"
  é a próxima sessão: o que não estiver escrito aqui não volta

## Contexto
- **Ainda não há produção nem usuário real** (a Fase 1 é venda manual e o primeiro tenant
  ainda não subiu catálogo). Por isso todo aprendizado registrado até hoje vem de: validação
  adversarial do código, revisão de schema/CSS, e **abrir a tela num navegador de verdade**
- Aprendizado que consolida = migra para `memory/patterns.md` ou `memory/decisions.md`

## Regras Gerais
- Aprendizado é **observação real**, não especulação
- Data + contexto são obrigatórios
- Ação recomendada (implementar, pesquisar, descartar) sempre presente
- Escrever o **porquê**, não só o quê: lista seca de fatos envelhece sem ninguém perceber

## Validações
- Aprendizado veio de situação real (não teoria)?
- Tem recomendação de ação concreta?

## Permissões
- O agente documenta o aprendizado no mesmo commit que o produziu
- Dono (Matheus): promove para padrão ou decisão

## Exceções
- Aprendizado crítico (segurança/compliance): entra imediatamente mesmo in-progress

## Auditoria
- Revisar a cada entrega, não por calendário: aprendizado que não é escrito na hora se perde
  com a sessão que o produziu
- Descartar aprendizados superados sem remorso

## Casos de Uso
- "Por que essa decisão foi tomada assim?"
- "Já fizemos isso antes? Como?"
- Pesquisa de causa-raiz pós-incidente

## Critérios de Aceite
- [ ] Mínimo 1 linha por tabela de área preenchida
- [ ] Cada aprendizado linkado a issue ou PR quando aplicável
- [ ] Ação clara (implementar agora / pesquisar / descartar)

---

## Aprendizados Técnicos

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| 2026-08-12 | Trocar `fill` por atributo só funciona em SVG feito à mão. Em export de Illustrator/Figma, `style` inline e regra CSS de classe têm precedência maior que o atributo — a cor não muda e nada acusa | Motor precisa **normalizar o SVG no upload** (achatar style/classe em atributo, remover `<style>`/`<script>`) em vez de tentar adivinhar na hora de gerar — proposta em ADR-004. Bugs: BUG-001/002 |
| 2026-08-12 | Uma zona real quase nunca é um elemento: é um grupo `<g>` ou N paths (o próprio SVG de teste já tem `zona-cadarco` em 2 paths) | Contrato de zona precisa endereçar **conjunto** de elementos, não um `id` único (ADR-004) |
| 2026-08-12 | `console.warn` dentro de função serverless é falha silenciosa do ponto de vista do cliente da API — o log fica no servidor, o chamador recebe 200 | Zona não aplicada ou cor inválida = erro explícito no envelope de resposta, nunca aviso (BUG-003) |
| 2026-09-05 | **Capacidade nova cria defeito que nunca foi regressão.** Enquanto as zonas eram escritas à mão em `produtoDemo.ts`, ninguém conseguia marcar o mesmo elemento em duas zonas — o editor passou a conseguir, e aí a ordem das chaves do JSON decidia a cor (BUG-013). O código de pintura não mudou: mudou quem podia alimentá-lo | Ao planejar feature que **amplia o que o usuário consegue produzir**, perguntar por escrito "que estado inválido isso passa a permitir?" e ler o código que consome esse estado — foi assim que o BUG-013 apareceu antes de existir UI que o criasse. A recusa entra no mesmo commit que a detecção |
| 2026-09-05 | **Recusar no clique torna o caminho de falha inalcançável pela tela — e ele continua alcançável na vida real.** Desde a Etapa 4 o editor recusa, no clique, elemento de outra zona e elemento que não aceita cor chapa. Ótimo para quem marca; péssimo para verificar: ninguém consegue mais *produzir* o estado que a tela precisa saber tratar. E ele existe assim mesmo — mapeamento gravado antes da regra, importação futura, correção manual no banco | Quando a prevenção fecha a porta da frente, o estado passa a ser **semeado no banco** para continuar verificável: `supabase/scripts/semearZonasDeTeste.ts` (`npm run semear-zonas`) planta zona de gradiente e zonas sobrepostas no produto de demonstração. Sem isso, "a tela reage bem a mapeamento quebrado" viraria uma crença sem nada a sustentá-la |
| 2026-09-08 | **Uma promessa sobre relógio só é verificável medindo o relógio.** O ADR-006 D1 diz que o tempo de resposta não revela se um prefixo de chave existe. Medido na passada local (12 amostras cada): prefixo existente com segredo errado = 74,8 ms, prefixo inexistente = 72,8 ms — indistinguíveis, como prometido. Mas chave **malformada** = 12,8 ms, ~6× mais rápido. O gap existe e não é vazamento: ele separa "bem formada" de "malformada", e o formato da chave está publicado em `docs/07_APIS/autenticacao.md` | Teste automatizado não mede tempo, e nenhum dos 45 testes de banco pegaria uma regressão aqui. A medição virou passo do roteiro (`api/_local/roteiroDePassada.md`), com os números e a interpretação escritos — para que quem medir de novo e vir o 6× não "conserte" o que está certo, e para que quem vir as duas primeiras linhas divergirem saiba que aí sim há saída antecipada nova em `autenticarChaveDeApi.ts` |
| 2026-09-09 | **Duas metades verdes não fazem um elo verde.** O editor grava `product_zones` com o JWT do dono, sob RLS; a API lê a mesma linha com `service_role`, sem RLS. Cada lado tinha teste de integração contra o banco real, e nenhum atravessava os dois — `apiDeVariante.test.ts` montava os próprios `svg_selector` chamando `montarSeletorDeZona` direto, o que prova que a API CONSOME o formato, não que o editor o PRODUZ | Onde dois caminhos de privilégio diferentes tocam a mesma linha, existe uma costura que nenhum dos dois lados testa sozinho, e ela não aparece na cobertura: os dois arquivos ficam verdes. `eloEditorApi.test.ts` grava por `marcarZona` + `gravarZonaNoBanco` com o cliente do dono e lê pela API. Procurar essa costura por escrito ao fechar qualquer feature de duas pontas |

## Aprendizados de Produto

Vazio de propósito: não há usuário real ainda. A primeira linha aqui deve sair de um time de
tenant usando o editor, não de suposição sobre o que ele vai achar.

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| — | — | — |

## Aprendizados de Processo

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| 2026-08-12 | Doc afirmava "protótipo validado" mas `node_modules` nunca tinha sido instalado neste checkout — o script jamais rodou aqui. Documentação registrou intenção como se fosse fato | "Validado" só entra em doc quando houver comando executado ou teste no repositório provando. Ação: os 9 casos viraram `src/lib/render/gerarVarianteDeCor.test.ts` |
| 2026-08-12 | Fundação gerada a partir de template trouxe vocabulário de outro projeto Kora (PDV de bar) para `memory/` — e `patterns.md` ensinava `abrirCaixa`/`fecharComanda` como exemplo de nomenclatura, contradizendo o glossário que ele manda seguir | Num projeto lido só por agentes (ADR-003), resíduo de template é desinformação ativa: agente novo aprende o vocabulário errado. Limpar `memory/` faz parte de fechar a fundação, não é cosmético |
| 2026-09-05 | **Suíte verde não prova que a tela mostra o que ela afirma — e isso já aconteceu três vezes.** O comparativo do esboço renderizava a mesma imagem dos dois lados (BUG-011) e caía em `<img src="">` quando o motor recusava o pedido (BUG-012), com tudo verde. Depois, com 233 testes verdes, `tsc` limpo e o teste de banco 7/7, acrescentar um ilhós a uma zona **apagava o `label` gravado** por um colega (BUG-014) — cada metade estava certa isolada (`marcarZona` distingue ausente de nulo; a tela é que escolhia mal entre os dois), então nenhum teste unitário podia pegar. Nenhum dos três é detectável em jsdom: um é diferença de pixel, outro é o navegador reagindo a atributo vazio, o terceiro só aparece conferindo a **linha gravada no banco** depois de usar a tela | Toda peça de UI cuja razão de existir é *mostrar* algo ganha uma passada dirigida em navegador real antes de ser considerada pronta — com o banco aberto ao lado quando ela escreve. O que a passada descobrir vira teste no mesmo commit (`ComparativoDeNormalizacao.test.tsx`, `EditorDeZonas.test.ts`). O erro a **não** cometer é o inverso: tratar suíte verde como licença para pular o navegador, que foi o que abriu as três |
| 2026-09-05 | **Teste de componente prova o que o React escreve, nunca o que o navegador desenha.** BUG-015 saiu de uma **revisão de CSS**, não do navegador nem do vitest: `.produto__area { display: grid }` é declaração de autor e vence o `[hidden] { display: none }` da folha do navegador, então a área do editor continuava visível durante o "Baixando…" — palco vazio ao lado do carregando, que se lê como "modelo sem desenho". O teste `a área do editor fica oculta até o asset-base chegar` estava verde e **continuou** verde: `renderToStaticMarkup` devolve markup, e a markup nunca esteve errada. Defeito pré-existente desde a Etapa 4 | Esse teto vale para **todo** teste de componente deste projeto: onde a verdade mora no CSS, a garantia tem de ler o CSS. A guarda nova abre `produtos.css` e exige a regra `[hidden]`. Regra prática: elemento escondido por `hidden` que tenha `display` declarado precisa da regra `[hidden]` explícita na mesma folha — e revisão de folha de estilo é uma passada própria, não um apêndice da revisão de componente |
| 2026-09-08 | **Guarda que lê o próprio fonte passa em falso quando a string vigiada também aparece em comentário — e o modo de falha é invisível: verde antes e depois de o defeito entrar.** Apareceu duas vezes na mesma leva, escrita por agentes diferentes. Em `carregarProdutoDoTenant.ts`, o cabeçalho citava `.eq('tenant_id'` em prosa, então apagar a linha de código deixava a guarda verde — o filtro de tenant sumia sem nenhum teste reclamar, sob `service_role`, onde não há RLS para segurar. Em `autenticarChaveDeApi.test.ts` era pior: `expect(fonte).toContain('timingSafeEqual')` passava só pela linha de `import`, que sobrevive intacta à remoção da chamada. Nenhuma execução normal mostra a diferença | Guarda de fonte lê **código**, não prosa: tire os comentários antes de comparar, e para identificador importado exija ao menos **duas** ocorrências (o `import` não é uso). E ela só vale depois de ser mutada uma vez — apagar a linha protegida, ver vermelho, restaurar. Guarda nunca mutada é guarda não verificada, e neste projeto ela é a última defesa do isolamento entre marcas concorrentes |
| 2026-09-08 | **Teste que nunca rodou não é teste verde — é teste desconhecido.** `apiDeVariante.test.ts` nasceu com 16 casos, `npx vitest run` verde e `tsc` limpo, porque sem as variáveis de ambiente ele **pula**. Na primeira vez que rodou de verdade (migration aplicada), 1 dos 16 falhou: eu afirmava que o corpo do 200 **começa** com `<svg`, e um SVG legítimo pode começar com declaração XML ou comentário — o asset-base do demo começa com um comentário do próprio arquivo. Defeito da asserção, não do produto | Asserção sobre formato de artefato se prende ao **contrato** (`<svg` presente, `</svg>` no fim, sem JSON em volta), nunca aos primeiros bytes de um fixture. E, mais amplo: enquanto `skipIf` estiver pulando, o verde da suíte não diz nada sobre aqueles casos — o README de `supabase/tests/` marca explicitamente quais já rodaram e quando, porque "pulou" e "passou" são a mesma cor no terminal |

| 2026-09-10 | **Verificação por mutação em arquivo recém-criado não pode usar `git checkout --`** — o arquivo ainda é untracked, e o comando falha ou, pior, o agente segue achando que restaurou. Na rodada do `normalizarModelo3d` os dois arquivos mutados (`normalizarModelo3d.ts`, `nomeDeMalha.ts`) tinham acabado de nascer no mesmo `/build`, então a receita escrita no spec não servia. O risco real não é a mutação falhar: é ela **ficar** no código, porque a mutação de material compartilhado é exatamente o defeito silencioso que o módulo existe para impedir | Antes de mutar, copiar o arquivo para o scratchpad e conferir o `md5sum` **depois** de restaurar — a igualdade do hash é a prova, não a lembrança de ter copiado de volta. Vale para todo `/build` que estreia arquivo: as três mutações do critério 14 acontecem antes do primeiro commit, quando `git` ainda não tem cópia nenhuma |

| 2026-09-10 | **Teste de ida e volta não prova conversão nenhuma, e a prova disso é numérica.** Na conversão sRGB→linear do glTF, trocar as **duas** direções por `c / 255` deixou **55 de 57 testes verdes**, incluindo uma varredura exaustiva dos 256 tons de cinza e o recolor ponta a ponta que pinta e lê a cor de volta. `linearParaHex(hexParaLinear(x)) === x` passa com qualquer fórmula, certa ou errada, porque a volta desfaz exatamente o que a ida fez. As duas únicas asserções que perceberam foram as que fixam o **valor no meio**: `#808080` vira `0.2159` em linear, não `0.502`, e a faixa perto do preto usa a reta (divisão por 12.92), não a potência. Detalhe que quase me enganou: mutar só a ida mata 16 testes, o que dá a falsa impressão de suíte robusta, mas o erro que um humano comete de verdade é o simétrico, ao "simplificar" a conversão inteira | Toda função com inversa ganha, além do ida e volta, pelo menos uma asserção de **valor conhecido no meio do caminho**, tirada da especificação e não da própria implementação. E toda mutação de função invertível é aplicada nos **dois** sentidos, senão ela testa o caso fácil e mente sobre a cobertura |

| 2026-09-10 | **A mutação também diz quando um teste passa pelo motivo errado.** Em `validarComposicao`, o caso `Infinity` está num `it.each` chamado "não passa por número", junto com `NaN`. Ao remover o `Number.isFinite`, só o `NaN` ficou vermelho: `Infinity` continua sendo recusado, mas pela **checagem de faixa** (`Infinity > maximo`), não pelo mecanismo que o nome do teste anuncia. O comportamento está certo, e a cobertura anunciada estava errada — se um dia a faixa sair, o caso `Infinity` some junto sem ninguém notar, porque ele nunca protegeu o que dizia proteger | A mutação não serve só para achar teste ausente: quando um caso **sobrevive** à quebra do mecanismo que ele nomeia, ele está sendo segurado por outra coisa. Nesse ponto ou o nome do teste muda para dizer a verdade, ou o caso é reescrito para atingir só o mecanismo. Vale sobretudo em `it.each`, onde um caso fraco se esconde no meio de irmãos fortes e o contador de testes mostra o mesmo verde |
| 2026-09-10 | **Validador externo tem tolerância, e a tolerância dele vira buraco no seu critério.** O acervo de prova é aceito pelo validador de referência da Khronos, que é externo de propósito: um validador escrito por nós julgando arquivos escritos por nós não prova nada. Só que ao mutar o gerador para NÃO arredondar as posições para float32, o validador **continuou passando**: ele tolera um epsilon ao comparar `min`/`max` de accessor de float. Quem pegou foram 4 testes nossos. A spec dizia, escrito, que esse critério era coberto pelo validador | Adotar um validador externo é bom e não é suficiente. Todo critério que a spec declara "coberto por outro critério" precisa ser provado por mutação, senão é um critério descoberto que se acredita coberto. O mesmo caso apareceu duas vezes na mesma revisão: a ausência de `target` no bufferView é **Informação** e não erro para o validador, então também passava. Regra prática: mutar contra o guarda externo antes de confiar nele |
| 2026-09-10 | **Quando o arame de tropeço dispara, a pergunta certa é se o desenho está errado, não se cabe uma licença.** `soUmLugarEscreveCorNoGltf.test.ts` reprovou o gerador de peças novo, porque ele escrevia `baseColorFactor: [1, 1, 1, 1]`, o branco padrão do glTF. O caminho fácil era adicionar o arquivo à lista de licença, com a justificativa verdadeira de que branco não é cor escolhida. O caminho certo foi tirar o campo: a peça declara só o acabamento (`metallicFactor`, `roughnessFactor`), que é físico, e nenhum campo de cor | Licença concedida é permanente e silenciosa: uma vez na lista, trocar aquela constante por uma cor de verdade passa calada para sempre. Antes de flexibilizar uma guarda, procurar o desenho em que ela não precisa ser flexibilizada. Aqui esse desenho existia, era mais simples, e ainda deixou a arquitetura mais nítida (a peça descreve superfície, a composição descreve cor) |
| 2026-09-10 | **Estimativa de custo dita ao dono precisa ser refeita depois de reler o projeto.** Ao apresentar a decisão do acervo, ofereci "modelar no Blender, algumas horas suas". Relendo o repositório, glTF é JSON e `fixtures/gltfDeTeste.ts` já escrevia glTF à mão, então o acervo de prova saiu **gerado por código**, versionado, testado e regenerável, custando zero hora do dono | O dono decidiu com base num custo que eu apresentei, e o custo estava errado para cima. Custo errado para cima faz o dono adiar coisa barata, que é tão caro quanto o contrário. Antes de levar opção com preço, procurar no próprio repositório se a capacidade já existe por outro nome |
| 2026-09-10 | **Código defensivo escrito para um caso que os dados de hoje não produzem nasce sem cobertura, e o comentário que explica o porquê dele dá a impressão contrária.** Em `nomeDaMalhaNoPonto`, a função sobe a hierarquia até achar um nó com nome, porque o carregador do three pendura malhas sem nome sob o nó quando ele tem várias primitivas. Trocar toda essa subida por `primeiro.object.name` passava nos **10 testes que existiam**: as 5 peças do acervo de prova têm uma primitiva só, então o caminho nunca era percorrido. O arquivo tinha um comentário caprichado explicando a subida, e nenhuma linha provando que ela funciona | O comentário que justifica um ramo defensivo é o sinal de que ele precisa de um teste que **fabrique** o caso, em vez de esperar que os dados atuais o produzam. Regra prática: se a mutação que apaga o ramo sobrevive, ou o ramo é morto e sai, ou nasce o teste que monta a situação à mão. Segundo caso desta fase; o primeiro foi a tolerância do validador da Khronos |
| 2026-09-10 | **Teste que nasce errado sobre uma convenção de interação é pior que teste ausente, porque ele pede para "consertar" o código certo.** Dois testes de órbita afirmavam que arrastar para cima levanta a câmera. O código fazia o contrário, e o código estava certo: os dois eixos seguem "agarrar a peça" (arrastar para a direita gira a peça para a direita), e pela mesma lógica arrastar para **baixo** é que levanta o ponto de vista. É a convenção do `OrbitControls` do three. O que quebra a sensação de controle não é o sentido escolhido, é os dois eixos discordarem | Convenção de interação com dois eixos se decide uma vez, por escrito, e a decisão fica **dentro do teste**, não só no módulo: um teste vermelho é uma ordem para mudar o código, então o teste é o lugar onde a nota "isto já nasceu errado uma vez" trabalha. Vale para todo par de eixos com sinal: giro, rolagem, zoom |

## Aprendizados de Negócio

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| — | — | — |

---

## Aprendizados Promovidos → Padrão

| Aprendizado Original | Data Promo | Padrão Resultado | Status |
|---|---|---|---|
| "Zona não aplicada é erro, não aviso" | 2026-08-12 | `patterns.md` → Envelope de Resposta (nunca 200 com variante "quase certa") | ✅ Ativo |
| "Teste de componente não alcança o CSS" | 2026-09-07 | `patterns.md` → CSS separado do JSX: elemento com `display` de autor precisa da regra `[hidden]`, garantida por teste que lê a folha | ✅ Ativo |
| "Suíte verde não prova a tela" | 2026-09-07 | `patterns.md` → Fluxo de entrega, passo 4: abrir no navegador toda peça de UI cuja razão de existir é mostrar algo | ✅ Ativo |

## Aprendizados Promovidos → Decisão

| Aprendizado Original | Data Promo | ADR Resultado | Status |
|---|---|---|---|
| "Atributo `fill` não basta; zona não é um elemento" | 2026-08-12 | ADR-004 — contrato de zona e normalização de SVG | ✅ **Aceito** em 2026-08-12, implementado em `src/lib/render/` |
| "O editor não pode cunhar id no asset; o canônico é imutável" | 2026-09-05 | ADR-005 — editor de zonas em SVG DOM e quem cunha o `id` | ✅ Aceito, implementado em `idDeElemento.ts` + `src/features/zonas/` |

## Limpeza Periódica

**Última revisão**: 2026-09-07 (Etapa 6 — auditoria de docs vencidos)

Aprendizados obsoletos (superados por realidade nova):
- (nenhum descartado; três linhas foram **corrigidas** por estarem vencidas — ver abaixo)

## Atualizações deste documento

- **2026-09-07** — auditoria contra o código das Etapas 0–5. Corrigido o status do ADR-004,
  que ainda constava "🟡 Proposto (aguarda aprovação do dono)" enquanto o arquivo do ADR diz
  **Aceito** desde 2026-08-12 e o motor está implementado e em uso — status vencido em
  memória é pior que ausente, porque um agente evita construir sobre uma decisão que ele lê
  como pendente. Entram os aprendizados das Etapas 4 e 5 (suíte verde × navegador, o teto do
  teste de componente diante do CSS, semear no banco o estado que a tela recusa criar, e
  defeito nascido de capacidade nova). Sai o processo herdado de template que não existe
  aqui (PR, eventos `learning.*`) e a afirmação de que os aprendizados vêm de produção — não
  há produção ainda.
