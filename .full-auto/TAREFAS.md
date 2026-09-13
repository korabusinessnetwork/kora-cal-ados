# Tarefas

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluída e verificada · `[!]` bloqueada (com diagnóstico)

Formato: `- [ ] ID título | trilha: <nome> | depende: <IDs ou nenhum> | pronto quando: <critério>`

A ordem geral é a do ADR-008: **acervo, depois composição, depois prompt**, nunca o contrário. O
que está `[x]` foi verificado de verdade (suíte verde, typecheck limpo, mutação matando teste),
não marcado por otimismo.

**Revisão de 2026-09-10**: as quatro decisões do dono mudaram o plano. O acervo deixou de ser
bloqueio (vira acervo de prova em geometria grosseira), o prompt saiu do caminho crítico (o
configurador ocupa o lugar dele), a zona 3D não precisa de schema, e a política de saída virou
ADR-009. Registro completo em `memory/restrictions.md` e em `docs/08_DECISOES/`.

## Fase A: Fundação do rumo 3D (o que não depende de artista)

- [x] T01 `normalizarModelo3d` + `nomeDeMalha` | trilha: render | depende: nenhum | pronto quando: canônico com nome único e material próprio por malha, e recusa explícita para arquivo inválido , **feito**, 576 testes verdes, 3 mutações mataram 5/2/1 testes
- [x] T02 `recolorirModelo3d` + `corSrgbLinear` + `lerGltf` | trilha: render | depende: T01 | pronto quando: cor pedida chega ao `baseColorFactor` convertida de sRGB para linear, num lugar só, com guarda de fonte , **feito**, 638 testes verdes
- [x] T03 Termos do ADR-008 no glossário | trilha: docs | depende: nenhum | pronto quando: acervo, peça, categoria de peça, composição e forma no glossário antes do código , **feito** em `5cebbe5`

## Fase B: Composição

- [x] T04 `validarComposicao.ts` | trilha: composicao | depende: T03 | pronto quando: recusa com código explícito para id de peça inexistente, categoria faltando, categoria repetida, peças de formas diferentes e parâmetro fora de faixa; nasce com teste , **feito**, 699 testes verdes, 5 mutações mataram 3/2/2/1/1 testes
- [x] T11 ADR-009, política de saída do cliente | trilha: docs | depende: decisão 4 do dono | pronto quando: existe ADR dizendo o que sai, o que não sai e por quê, indexado no README e refletido em `restrictions.md` , **feito** em 2026-09-10

## Fase C: Provar a esteira com o acervo de prova (destravada pela decisão 1)

O objetivo desta fase não é o produto final, é **provar que a esteira funciona de ponta a ponta**
com combustível grosseiro, antes de qualquer investimento em modelagem de verdade.

- [x] T12 Acervo de prova gerado por código | trilha: acervo | depende: T04 | pronto quando: existem 5 peças em glTF 2.0 válido (2 solas, 2 cabedais, 1 cadarço) de uma forma só, cada uma com nome próprio e material próprio, geradas por script e não por Blender; `normalizarModelo3d` aceita todas sem recusa; `validarComposicao` monta uma composição sobre elas , **feito** em 2026-09-10, 787 testes verdes (93 no módulo novo), 24 de 24 critérios, 6 mutações mataram 1/4/3/11/17/1 testes. Validado pelo validador de referência da Khronos, zero erro e zero aviso nas 5 peças. Spec e revisão em `specs/acervo-de-prova.md`
- [x] T13 Palco 3D no navegador | trilha: front | depende: T12 | pronto quando: o modelo aparece na tela, gira com o mouse, e clicar numa peça a identifica pelo nome da malha (ADR-007 D1/D2/D4). Verificação obrigatória em navegador real, porque o princípio nº1 exige conferência a olho | **feita** em 2026-09-10: `specs/palco-3d.md` com 23 de 23 critérios em sim, 60 testes em `src/palco3d/`, 850 na suíte, typecheck e build limpos, 10 mutações e 10 mortas. **Conferência a olho aprovada pelo dono**, os cinco itens da §7 em navegador de verdade, sem defeito encontrado. Primeira vez que um modelo 3D aparece na tela neste projeto
- [x] T14 Montagem da composição em cena | trilha: front | depende: T13 | pronto quando: uma composição validada vira calçado montado na tela, com cada peça no lugar, e trocar a cor de uma zona muda só aquela peça | **fechada em 2026-09-12**, os 5 itens da §8 conferidos numa TERCEIRA passada, desta vez no navegador da própria sessão, com leitura do framebuffer: cabedal 220° contra 219° pedidos, cadarço 42° contra 42°, sola neutra contra neutra; pintar a sola de vermelho deixou cabedal e cadarço com a contagem de pixels IDÊNTICA (12017, 4371, 1062 e 1055), ou seja nenhum pixel deles mudou; engrossar a sola de 18,25 para 40 mm subiu cabedal e cadarço 11 px cada, mantendo os 95 px de distância entre eles; clicar no azul devolveu `prova-cabedal-baixo` e no vermelho `prova-sola-plana`. Três sondas independentes concordando (a de 09-11, esta, e agora o teste permanente de T17) é o que substitui o portão a olho, ver D05. Construída e revisada em 2026-09-10: `specs/composicao-em-cena.md` com 33 de 33 critérios em sim, 980 testes na suíte, typecheck e build limpos, 47 mutações e 46 mortas (a única sobrevivente provada equivalente). Três módulos de render novos (`medidaDoModelo3d`, `deslocarModelo3d`, `juntarModelos3d`) entregues por agentes em paralelo com dono exclusivo por arquivo. A tela `?tela=composicao` monta as peças numa cena só, e `PalcoDeModelo3d` não precisou de uma linha de mudança
- [x] T15 Configurador (o fallback grátis do ADR-008, Alternativa 3) | trilha: front | depende: T14 | pronto quando: dá para escolher peça por categoria, cor e parâmetro por menu, sem IA nenhuma, e o resultado é uma composição válida. **É produto vendável por si só**, não só um degrau para o prompt | **feita** em 2026-09-11/12: a tela `?tela=composicao` tem os três controles por categoria (peça por botão, cor por seletor, parâmetro por faixa), a categoria opcional tem o botão "sem cadarço", e toda mudança passa por `montarDaTela`, que chama `validarComposicao`, então não existe caminho da tela para uma composição inválida. **Zero IA no caminho**, que é o ponto da Alternativa 3. Conferida em navegador de verdade nos dois sentidos da troca de peça. O BUG-019 nasceu e morreu aqui, commit `11f4e9d`. Limitação latente em D07: a tela expõe só o PRIMEIRO parâmetro de cada peça, o que hoje cobre 100% do acervo porque as 5 peças de prova têm exatamente um
- [x] T17 Conferência em navegador virando teste | trilha: front | depende: T14 | pronto quando: existe um teste que sobe o Chrome headless, monta o calçado e **mede a cor na tela contra o hex escolhido**, pulável quando não houver Chrome | **feita** em 2026-09-12, commit `e49bf84`: 25 testes novos (5 no navegador, 20 na régua), 1013 na suíte, typecheck e build limpos, **zero dependência nova**. O eixo da saturação foi comprado com uma mutação SOBREVIVENTE: a primeira versão comparava só matiz e deixou passar a conversão de sRGB para linear quebrada, que desloca o matiz só 8°, exatamente a folga; a saturação cai de 0,815 para 0,537 e é ela que acusa. Três mutações conferidas, 1, 3 e 4 testes mortos. Spec e fragilidade assumida em `specs/cor-na-tela.md`

## Fase D: Adiadas por decisão, não por bloqueio

- [!] T05 `montarCatalogoParaModelo.ts` | trilha: composicao | **adiada junto com T09**: o catálogo existe para ser lido por um modelo de linguagem, e formatar para um leitor que foi adiado é trabalho especulativo
- [!] T09 Prompt vira composição | trilha: ia | **adiada pela decisão 2 do dono** (2026-09-10): o configurador ocupa o lugar dela sem custo. Revisitar quando T15 estiver rodando sobre o acervo de prova
- [!] T06 Schema do acervo com RLS | trilha: dados | **adiada**: para provar a esteira, o acervo de prova pode viver como arquivo, sem banco. A tabela entra quando houver acervo de verdade e mais de um tenant com peça própria (ADR-008 D6). Antecipá-la seria schema para dado que não existe
- [x] T10 Typecheck de `supabase/scripts/` | trilha: base | **já estava resolvida**: a pasta está no `include` do `tsconfig.json` e `tsc --noEmit --listFiles` confirma os 6 arquivos `.ts` sendo lidos, com a suíte limpa. A pendência anotada estava vencida. Fica de fora só `executar.mjs`, que é JS e exigiria `allowJs`
- [x] T16 `exportarTenant.ts` | trilha: base | depende: T15 | pronto quando: o script produz o zip do ADR-009 e o teste confere que uma zona marcada aparece dentro dele | **feita** em 2026-09-12: o critério do ADR cumprido em letra, `supabase/tests/exportarTenant.test.ts` semeia as 5 zonas, exporta e confere as `zone_key` com o seletor DENTRO do pacote, contra o banco real. 10 testes de banco novos (58/58 no `test:banco`), 34 testes puros novos (`zip.ts` com os vetores conhecidos de CRC-32, `montarPacoteDeSaida.ts` com a política), 1047 na suíte, typecheck limpo, **zero dependência nova**: o ZIP é escrito à mão sobre `node:zlib`. O escritor foi conferido por dois leitores de terceiro, `Expand-Archive` do .NET e `bsdtar` do Windows, com nome acentuado e conteúdo binário byte a byte. Rodado de ponta a ponta contra o projeto real: `npm run exportar-tenant -- --slug aurora-demo` produziu 4,0 kB com 1 produto e 6 zonas. 6 mutações, 4 mortas com 4/1/1/2 testes; a de `rendered_path` SOBREVIVEU e rendeu o teste de forma dos campos (a defesa estava em `montarPacoteDeSaida`, não no `select` que o comentário prometia); a do filtro de zonas sobreviveu e fica registrada como limite conhecido, porque o agrupamento é o guarda de verdade e nenhuma asserção sobre a saída consegue matá-la. Spec em `specs/saida-do-cliente.md`. **O script não apaga nada** (ADR-009 D5), e a exclusão continua sem existir de propósito

## Zona 3D: sem tarefa, por decisão

A decisão 3 do dono fechou a questão sem código: no modo gerado a zona vem da composição, cada
peça é uma zona, então nada precisa ser gravado. Coluna nova só quando existir a primeira marca
querendo subir o glTF dela, e aí ela entra junto com o caso de uso real.

## T07 e T08 foram renumeradas

O que era T07 (palco) e T08 (montagem em cena) virou T13 e T14, e deixou de estar bloqueado
porque o acervo de prova de T12 dá a elas o que faltava: algo para mostrar na tela.

---

# Refino, rodada 1 (2026-09-12)

A construção do Full Automático está encerrada (`RELATORIO-FINAL.md`). Daqui para baixo é a skill de
refino: a lista não veio de plano nenhum, veio da auditoria que eu mesmo fiz, e cada item tem
evidência em `.full-auto/AUDITORIA.md`. As regras desta fase, em duas linhas: **refino nunca piora o
que já funciona**, e o que quebrar qualquer linha do `BASELINE.md` volta por `git revert` na hora,
sem conserto em cima. Um item, um commit.

Lote de 8, nenhum com risco 4 ou 5, com pelo menos um item de cada eixo que tem achado acima do
corte.

- [x] R1-A01 Cena 3D ao lado dos controles entre 860 e 1100 px | trilha: ux | depende: nenhum | pronto quando: em 1024x768 o canvas de `?tela=composicao` começa acima de 768 px de altura de página, medido, e em 1440x900 e em 375 px nada muda em relação a hoje
- [x] R1-A04 Teste do `ProvedorDeSessao` | trilha: qualidade | depende: nenhum | pronto quando: existe teste do provedor com cliente falso cobrindo os seis estados e a guarda de `escolherTenant`, e uma mutação na escolha do tenant lembrado mata pelo menos um teste
- [x] R1-A03 Asset-base vazio é falha nomeada | trilha: robustez | depende: nenhum | pronto quando: baixar um asset-base vazio ou sem raiz `<svg>` leva a tela ao estado de erro com "Tentar de novo" visível, com teste, e nunca ao painel em branco
- [x] R1-A02 Copiar a composição em JSON | trilha: produto | depende: nenhum | pronto quando: `?tela=composicao` tem um botão que copia o mesmo JSON que a API recebe, com confirmação na tela, e a função que monta esse JSON é pura e tem teste
- [x] R1-A05 Título de aba por tela | trilha: ux | depende: nenhum | pronto quando: cada uma das quatro telas escreve o próprio `document.title`, com teste da função que decide o texto
- [x] R1-A06 Categoria dispensada sem chave crua na frase | trilha: ux | depende: nenhum | pronto quando: o botão da categoria opcional não mostra mais "sem cadarco", e nenhuma `zone_key` aparece dentro de prosa em português nessa tela
- [x] R1-A07 Faixa do parâmetro visível no configurador | trilha: ux | depende: nenhum | pronto quando: o controle mostra mínimo e máximo em milímetros junto do valor, no mesmo formato da tela `?tela=palco3d`
- [x] R1-A08 `aria-pressed` nos botões de peça | trilha: ux | depende: R1-A06 | pronto quando: o botão da peça escolhida e o da categoria dispensada anunciam o estado por `aria-pressed`, conferido na árvore de acessibilidade

# Refino, rodada 2 (2026-09-12)

Lote de 8, nenhum com risco 4 ou 5. A reauditoria está em `AUDITORIA.md`, na seção da rodada 2.

Sem item do eixo **produto** nesta rodada, e isto é declarado, não esquecido: nenhum achado de
produto ficou acima do corte. O candidato forte, mostrar a chamada de API equivalente dentro do
editor real, deu score -1 pelo risco de fazer uma segunda cópia do contrato, e virou a ideia I06.

- [x] R2-A18 Confirmação ao gravar a zona | trilha: ux | depende: nenhum | pronto quando: gravar mostra uma mensagem que nomeia a zona e diz se ela foi criada ou se ganhou elementos, a mensagem some quando a próxima marcação começa, e há teste dos dois textos | **feita** em 2026-09-12, commit `53078f8`: gravar mostra "Zona \"sola\" criada com 3 elementos." ou "...atualizada com a marcação de 3 elementos.", e a mensagem some no primeiro clique da próxima marcação. A frase é montada por `mensagemDeZonaGravada`, função pura, ANTES de `marcacao.limpar()`, senão a contagem já teria ido a zero. 4 testes, 3 mutações, 3 e 1 testes mortos. **Limite declarado**: que a mensagem some no clique seguinte foi verificado por leitura, não por teste, porque montar `EditorDeZonas` sem rede exigiria mock de módulo e este projeto não usa `vi.mock` em lugar nenhum. Virou o achado A25
- [x] R2-A09 Teste de `listarZonasDoProduto` | trilha: qualidade | depende: nenhum | pronto quando: existe teste com cliente falso para a recusa de id vazio, a ordenação por `created_at` e o erro que sobe em vez de virar lista vazia, e uma mutação em cada um dos três mata pelo menos um teste | **feita** em 2026-09-12, commit `640234c`: 6 testes com cliente falso no formato do vizinho `listarProdutos.test.ts`, cobrindo campos explícitos sem `select *`, o filtro, a ordem por `created_at`, a recusa de id vazio ANTES da rede (`pedido.tabela` fica em `''`), o erro que sobe e o `data: null` que vira `[]`. 3 mutações, 3, 1 e 1 testes mortos
- [x] R2-A19 A contagem de marcados vira região viva | trilha: ux | depende: R2-A18 | pronto quando: clicar num elemento do palco muda um texto dentro de uma região `aria-live` educada, com teste de que o atributo está no elemento que contém a contagem | **feita** em 2026-09-12, commit `06dc545`: a contagem do formulário virou `aria-live="polite" aria-atomic="true"`, e já usa `contarElementos` de A22. 3 testes novos no `FormularioDeNovaZona.test.tsx`, 1 mutação, 1 teste morto
- [x] R2-A22 Uma função só para "N elementos" | trilha: qualidade | depende: nenhum | pronto quando: os quatro lugares que escrevem a contagem usam a mesma função, `VisualizacaoDoProduto` mostra "1 elemento marcável" no singular, e a função tem teste de 0, 1 e 2 | **feita** em 2026-09-12, commit `5d5fc02`: `src/lib/texto/contarElementos.ts` novo, com README do diretório, e os quatro lugares passaram a chamá-lo. `VisualizacaoDoProduto` era o que não tinha plural e mostrava "1 elementos marcáveis". O adjetivo chega flexionado nas duas formas em vez de derivado, porque "marcado/marcados" e "marcável/marcáveis" não são a mesma regra. 5 testes, 2 mutações, 3 e 2 testes mortos
- [x] R2-A10 Falha de rede deixa de virar "conta não vinculada" | trilha: robustez | depende: nenhum | pronto quando: com `carregarTenantsDoUsuario` falhando, a tela diz que não deu para carregar e oferece "Tentar de novo" ao lado de "Sair", o caso de zero vínculos continua com o texto de cadastro, e os dois estão no teste do provedor | **feita** em 2026-09-12, commit `433e8eb`: `falha-ao-carregar` é estado próprio, a tela diz "Não deu para carregar suas marcas" com o motivo em `role="alert"` e "Tentar de novo" ao lado de "Sair", e `sem-tenant` voltou a ser só o caso legítimo, sem alerta e sem botão de repetir. 9 testes novos nos dois arquivos. 4 mutações, 3, 1 e 1 testes mortos; a quarta, remover a guarda de usuário nulo em `tentarDeNovo`, SOBREVIVEU, e por isso a guarda foi apagada: `aplicarUsuario(null)` já faz a mesma coisa, então ela era código morto
- [x] R2-A11 Nome acessível no palco 3D e peça clicada como região viva | trilha: ux | depende: nenhum | pronto quando: o canvas das duas telas do palco tem nome acessível e a caixa da peça clicada é `aria-live` educada, conferido no DOM renderizado | **feita** em 2026-09-12, commit `cf00aab`: `PalcoDeModelo3d` recebe `rotulo` por prop (o arquivo não sabe o que desenha, quem sabe são as telas) e vira `role="group" aria-label`, e a caixa da peça clicada é `aria-live="polite" aria-atomic="true"` nas duas telas. Conferido no DOM renderizado das duas, com clique de verdade: `prova-sola-plana` em `?tela=palco3d` e `prova-cabedal-baixo` em `?tela=composicao`. **Não** pela árvore de acessibilidade do navegador embutido, que não calcula nome de conteúdo aninhado nem expõe estado ARIA
- [x] R2-A17 Esboço cabe na tela | trilha: ux | depende: nenhum | pronto quando: em 1024 e em 375 o `scrollWidth` do documento é igual à largura da janela, medido, e em 1440 nada muda em relação a hoje | **feita** em 2026-09-12, commit `01e8841`: duas quebras, em 1220 px o painel da API desce para a linha inteira e em 860 px tudo vira uma coluna. Medido no navegador: `scrollWidth` igual à largura da janela em 1024 e em 375, e 1440 sem mudança
- [x] R2-A20 O editor de cor do esboço anuncia o que está errado | trilha: ux | depende: nenhum | pronto quando: os dois campos de cor têm rótulo acessível, hex inválido tem `aria-invalid` e mensagem escrita, e a zona selecionada na lista tem `aria-pressed` | **feita** em 2026-09-12, commit `77281f9`: os dois campos ganharam `aria-label` com a zona no nome, hex incompleto tem `aria-invalid` e a frase escrita ligada por `aria-describedby`, e a zona da lista anuncia por `aria-pressed`. Sem `role="alert"` de propósito: alerta a cada tecla ensina o time a ignorar alerta. `PainelDeZonas.test.tsx` novo com 5 testes, 2 mutações, 2 testes mortos

# Refino, rodada 3 (2026-09-12)

Lote de 5, nenhum com risco 4 ou 5. A reauditoria está em `AUDITORIA.md`, na seção da rodada 3.

Cinco e não oito porque cinco é o que passou do corte com evidência. Encher o lote com o backlog
abaixo do corte seria trocar a régua do score por vontade de ter uma lista maior. Os quatro eixos
estão representados: dois de qualidade, um de produto, um de ux, um de robustez.

Esta rodada tem um item de **produto**, que faltou na rodada 2.

- [x] R3-A27 Digitar o hex no configurador | trilha: produto | depende: nenhum | pronto quando: cada categoria da tela `?tela=composicao` tem um campo de texto ao lado do seletor de cor, `#RGB` e `#RRGGBB` são aceitos, hex incompleto não muda o preview e diz em palavras o que falta, e a função que decide válido/inválido tem teste → FEITO em 2 commits (995912c, acd3a97). A regra de "quando o hex está completo" virou `lib/render/estadoDoHexDigitado.ts` e passou a ser a MESMA nos três lugares, ANTES de a tela nova existir: sem isso a composição seria a quarta implementação. Campo em arquivo próprio, `CampoDeCorDaCategoria.tsx`, com 11 testes em jsdom, possível porque ele não mora dentro da tela que exige WebGL.
- [x] R3-A26 Teste dos dois hooks que descartam estado ao trocar de produto | trilha: qualidade | depende: nenhum | pronto quando: `useMarcacaoDeZona` e `usePreviewDeCor` têm teste com componente-sonda provando que trocar o `productId` zera o estado NO MESMO render, e uma mutação que troque o descarte em render por `useEffect` mata pelo menos um teste → FEITO (a5b713a). Sonda grava o que o hook devolveu em TODAS as passagens, inclusive na que o React descarta. As duas mutações que trocam o descarte em render por `useEffect` matam exatamente o teste novo, e só ele.
- [x] R3-A29 Empate de especificidade e seletor descendente presos por teste | trilha: qualidade | depende: nenhum | pronto quando: existe teste de que duas regras de mesma especificidade são decididas pela ordem e de que o descendente ganha da classe solta, e uma mutação em `calcularEspecificidade` mata pelo menos um → FEITO (4870294). Nove mutações, oito mortas de primeira. A nona (tirar a âncora do regex de elemento) SOBREVIVEU à primeira versão do teste, porque com afirmação só relativa a conta inteira anda junto; o teste passou a fixar a escala em número cheio e ela morre.
- [x] R3-A30 O palco aparece antes dos controles na tela estreita | trilha: ux | depende: nenhum | pronto quando: em 375 px a moldura do palco começa acima de 400 px do topo nas duas telas do palco, medido, e em 1440 px a ordem na tela não muda em relação a hoje → FEITO (a98a953). Medido: moldura de 1158 para 177 px do topo na composição e de 657 para 160 no palco, em 375x812. `sticky` junto do `order`, porque só `order` entregaria "vê ao abrir" e não "vê enquanto escolhe". Em 1440 px nada mudou, mesmos top e left das três colunas.
- [x] R3-A33 O baseline para de piscar vermelho sozinho | trilha: qualidade | depende: nenhum | pronto quando: a leitura de pixel que vem depois de uma mudança na tela espera pela condição em vez de por um número fixo de quadros, em todos os pontos do arquivo onde isso acontece, e o arquivo continua reprovando quando a cor está errada de verdade → FEITO (1788a10). Achado NO MEIO da rodada, não na auditoria de abertura. Duas mutações no caminho real provam que cor errada continua reprovando. NÃO consegui reproduzir a corrida sob demanda, e isso está dito no commit e na AUDITORIA.
- [x] R3-A28 Contexto WebGL perdido para de mentir | trilha: robustez | depende: nenhum | pronto quando: forçar `WEBGL_lose_context.loseContext()` faz o laço de render parar e a tela dizer que o 3D caiu, em vez de seguir afirmando "Peça na cena", conferido no navegador → FEITO (37b96a6). Ciclo inteiro conferido no navegador nas duas telas: cai, avisa em vermelho, volta e desenha. A mutação que apaga a guarda do laço sobrevive a toda a suíte (jsdom não tem WebGL) e passou a ser pega por varredura de fonte.

# Refino, rodada 4 (2026-09-12)

Lote de 6, nenhum com risco 4 ou 5. A reauditoria está em `AUDITORIA.md`, na seção da rodada 4.

Os quatro eixos estão representados: três de ux, um de robustez, um de produto, um de qualidade.

O que esta rodada tem de diferente das três anteriores: quase tudo aqui está no **esboço**. As
rodadas 1 a 3 varreram o editor logado, o palco 3D e o motor, e a tela que um clone recém-baixado
abre ficou sem varredura nenhuma até agora.

- [x] R4-A39 O calçado aparece antes da lista de zonas na tela estreita | trilha: ux | depende: nenhum | pronto quando: em 375x812 o `<svg>` do esboço começa acima de 400 px do topo, medido no navegador, e em 1440 px a ordem das colunas não muda em relação a hoje → FEITO (637cf15). Medido em 375x812: o `<svg>` saiu de **1000 px** para **199 px** do topo do documento, com a regra neutralizada e recolocada em tempo de execução para as duas pontas serem medidas do mesmo jeito. Em 1440 px nada mudou. A armadilha desta tarefa virou linha em `REFINO-RODADAS.md`: `.palco` é declarada em DOIS arquivos, e `position: sticky` ficou sem efeito duas vezes, em silêncio, enquanto o `order: -1` da mesma regra funcionava.
- [x] R4-A37 Corpo grande demais é recusado antes de ser lido | trilha: robustez | depende: nenhum | pronto quando: um POST autenticado com corpo acima do teto responde `CORPO_INVALIDO` 400 sem que `Request.json()` chegue a ser chamado, existe teste do caminho com `content-length` e do caminho sem ele, e o teto está num lugar só com o porquê do número escrito ao lado → FEITO (c8f65f1). `api/_lib/lerCorpoDoPedido.ts`, teto de 64 kB com a conta do número escrita ao lado, DUAS conferências (o cabeçalho, que é barato, e a contagem durante a leitura, que não depende da palavra do cliente). 11 testes. Duas asserções minhas eram apertadas demais e foram afrouxadas com o motivo escrito: o runtime adianta pedaços do stream por conta própria, então contar bytes mede o prefetch dele, não o que o módulo leu. Uma mutação SOBREVIVEU (apagar `{ stream: true }`) e o conserto foi no TESTE: um corpo pequeno chega num pedaço só, então o teste passou a partir o `ç` (0xC3 0xA7) entre dois pedaços à força.
- [x] R4-A40 Os tipos do three passam a ser os da versão que roda | trilha: qualidade | depende: nenhum | pronto quando: `@types/three` está em `^0.186.0`, a versão instalada bate com a de `three`, `tsc --noEmit` fica limpo e o build continua limpo → FEITO em 2 commits (5edce98, f5ee209). O segundo é o que impede a volta: `src/palco3d/tiposDoThreeAcompanhamOThree.test.ts` é varredura de fonte, compara a minor declarada das duas faixas e o que está instalado contra o que está declarado. As asserções têm guarda `not.toBeNull()` de propósito, senão duas leituras nulas passariam por "iguais".
- [x] R4-A36 Os atalhos de cor viram alvo de 24 px com nome que se lê | trilha: ux | depende: nenhum | pronto quando: cada um dos oito atalhos mede 24x24 px ou mais em 375x812, medido, e tem nome acessível que diz a cor por extenso com o hex junto, com teste do nome → FEITO (8798467). Medido em 375x812 no fechamento da rodada: os 8 atalhos em 24x24 px, o primeiro com nome acessível `preto (#1B1B1F)`. O nome por extenso passou a viver junto do hex em `produtoDemo.ts`, e não numa tabela paralela na tela, porque tabela paralela é a forma como um oitavo hex entra sem nome.
- [x] R4-A34 O esboço oferece as três irmãs, como as outras telas oferecem | trilha: ux | depende: nenhum | pronto quando: o rodapé do esboço leva ao palco 3D, ao calçado montado e ao editor, e existe teste de que as quatro telas oferecem o mesmo conjunto de saídas → FEITO (2259266). Consertada a CLASSE do defeito, não a instância: quatro rodapés escritos à mão viraram um módulo de dados (`saidasDaTela.ts`) mais um componente burro (`RodapeDeTelas.tsx`), usados nos cinco pontos de chamada do `App.tsx`, então uma quinta tela não nasce com o mesmo buraco. O chunk principal ENCOLHEU de 457,00 para 455,98 kB. Uma asserção minha era tautológica (`expect(X).toBe(X)`) e virou a afirmação de verdade: nenhuma saída oferecida cai num rótulo que não existe.
- [x] R4-A38 Copiar a chamada equivalente do esboço | trilha: produto | depende: nenhum | pronto quando: o painel da chamada equivalente tem um botão que copia o corpo JSON, o aviso de falha de área de transferência aparece quando a cópia é negada, e a regra da cópia é a MESMA do botão da composição, num módulo só, com teste → FEITO em 3 commits (9520052, a7caf05, edf3d40). A ordem é a lição do R3-A27 aplicada: a regra SOBE primeiro (`src/lib/copia/`, 9 testes) e a composição migra, e só então o esboço ganha o botão, então a segunda tela não é a segunda implementação. Duas coisas entraram no hook que antes eram responsabilidade de quem chamava: o descarte do aviso, chaveado pelo texto (era um `setCopia('pronta')` à mão dentro do `mudar()`), e o diagnóstico da falha, que não fala do que está sendo copiado. O botão copia SÓ o corpo, não o bloco: a chave de exemplo colada junto pareceria chave pronta, e dois testes afirmam isso pelo lado negativo. Verificado no navegador com a área de transferência negada pelo painel: o aviso aparece legível. Duas mutações rodadas, as duas morreram.

# Refino, rodada 5 (2026-09-12)

Lote de 6, nenhum com risco 4 ou 5. A reauditoria está em `AUDITORIA.md`, na seção da rodada 5.

Os quatro eixos estão representados: três de qualidade, um de robustez, um de produto, um de ux.

O que esta rodada tem de diferente: as quatro anteriores auditaram telas. Esta foi atrás do que
acontece quando a máquina de quem visita não tem o que a tela precisa, das regras do projeto que
existem só como frase e não têm guarda nenhuma, e do editor logado por baixo dos componentes, pelos
hooks que falam com a rede e que nunca foram olhados.

A42 ficou de fora do lote e está no backlog com o motivo escrito: é o menor score dos sete achados
e o lote já leva três itens de qualidade.

- [x] R5-A46 Navegador sem WebGL deixa de apagar a página inteira | trilha: robustez | depende: nenhum | pronto quando: com `HTMLCanvasElement.prototype.getContext` devolvendo `null` para `webgl*`, as duas telas do palco mostram uma frase dizendo que o 3D não pôde ser iniciado, o rodapé continua clicável e o esboço continua alcançável, conferido no navegador, e existe teste do caminho de falha
      feito em `2077f0a`. Estado novo `contexto-negado`, separado do `contexto-perdido` que já
      existia: no perdido o contexto caiu e costuma voltar, no negado nunca nasceu e recarregar
      não muda nada. O `criarPalco` passou a rodar dentro de `try`. Conferido no navegador com o
      `getContext` remendado: 0 canvas nas duas telas, a frase própria de cada uma, rodapé com as
      três saídas e o botão do esboço levando ao esboço com as 9 zonas. Teste em
      `palcoSemWebgl.test.tsx`, 4 casos em jsdom, os 4 conferidos vermelhos sem o conserto.
- [x] R5-A41 Tabela nova sem RLS vira teste vermelho | trilha: qualidade | depende: nenhum | pronto quando: existe varredura de fonte sobre `supabase/migrations/*.sql` que reprova quando uma tabela criada não tem `enable row level security`, ela roda em `npm test` sem banco e sem `.env.local`, e uma tabela de mentira acrescentada ao texto de uma migration faz o teste reprovar
      feito em `88d273d`. `supabase/migrations/rlsEmTodaTabela.test.ts`, 7 testes. A regra vive em
      `tabelasSemRls(sql)`, que recebe texto e não lê disco, para o teste poder fazer a mesma
      pergunta sobre as migrations de verdade e sobre um texto inventado que precisa reprovar.
      Quatro dos 7 existem para a guarda não virar decoração: a contraprova das 6 tabelas de hoje,
      comentário não conta como RLS ligada, tabela citada só em comentário não conta como criada, e
      `public.x` casa com `x`. Conferido no arquivo de verdade: um `create table` acrescentado a
      `20260908_chave_de_api_por_tenant.sql` deixou 5 testes vermelhos, com o nome da tabela na
      mensagem.
- [x] R5-A45 As citações de ADR passam a dizer a verdade, e uma varredura confere | trilha: qualidade | depende: nenhum | pronto quando: nenhum lugar do código afirma "ADR-008 D6" para a não persistência da composição, existe varredura que reprova quando um `ADR-XXX DN` escrito em `src/`, `api/` ou `supabase/` não resolve para decisão existente naquele ADR, ela aceita as duas grafias de numeração que os ADRs usam, e uma citação inventada faz o teste reprovar
      feito em `7738fc9` e `5c25cdc`. Eram seis lugares, não quatro: duas das citações erradas eu
      mesmo escrevi hoje no R5-A46, copiando de um vizinho, que é como uma citação errada se
      multiplica. Corrigidos também `IDEIAS-DE-PRODUTO.md`, que justificava não criar a tabela de
      composições com um ADR que não decidiu isso, e `RELATORIO-FINAL.md`. A guarda é
      `docs/08_DECISOES/citacoesDeAdrExistem.test.ts`, 6 testes, e ela pega a metade mecânica; a
      semântica continua sendo leitura, e isso está dito no arquivo. O `7738fc9` é um buraco achado
      no meio do caminho: o `tsconfig.json` não incluía `supabase/migrations`, então o teste do
      R5-A41 rodava sem ser conferido por `tsc`.
- [x] R5-A47 Colar a composição de volta na tela | trilha: produto | depende: nenhum | pronto quando: existe onde colar o JSON da composição na tela do calçado montado, um JSON válido monta o calçado descrito, um inválido é recusado por `validarComposicao` com a frase na tela e sem chegar ao palco, e existe teste dos dois caminhos
      feito em `84279b6`. `escolhasDoTextoColado` é o inverso exato de `composicaoDasEscolhas` e
      mora em `composicaoDaTela.ts`, fora do componente. Passa pelo mesmo `validarComposicao` da
      API, e a recusa carrega o código do contrato. Uma conferência é da tela e não do validador:
      forma trocada, porque para o validador uma composição de outra forma é válida e quem está
      presa a uma forma só é a tela. Essa guarda pegou um erro meu de verdade no navegador: colei
      um `forma_id` que eu tinha inventado e a tela recusou sem derrubar o calçado. Conferido
      também que as cores coladas são as cores na tela, e que uma peça inexistente mostra
      `PECA_NAO_ENCONTRADA` sem encostar na montagem. 7 testes novos.
- [x] R5-A44 Os três hooks de rede do editor saem do escuro | trilha: qualidade | depende: nenhum | pronto quando: `useProdutos`, `useAssetBase` e `useZonasDoProduto` recebem o cliente por parâmetro com o valor por omissão de hoje, os pontos de chamada existentes não mudam, e cada um tem teste com componente-sonda provando que a resposta em voo do produto anterior NÃO pinta a tela do produto novo
      feito em dois commits: `04e890b` (o cliente por parâmetro, nenhum ponto de chamada mudou) e
      `f699fb3` (os 16 testes e o defeito que eles acharam). As duas guardas que já existiam,
      `vivo` e `produtoAberto.current`, só olhavam a resposta ATRASADA. Nenhuma das duas olhava a
      janela entre o render que troca de id e o efeito que limpa o estado, e nessa janela a lista,
      o desenho e as zonas do anterior apareciam inteiros sob o id novo. Uma passagem de render é a
      tela: em `useProdutos` é nome de produto de uma marca na tela de uma CONCORRENTE, e no editor
      é o desenho errado aceitando clique. A correção é uma etiqueta `de` na leitura, conferida
      durante o render. As guardas antigas continuam, e não são decorativas: sem elas a resposta
      morta apagaria o que o id novo já mostrou. Segundo defeito achado no caminho: trocar de
      produto no meio de um `gravar` deixava `salvando` ligado para sempre. Quatro mutações, uma
      por guarda, todas mortas. A tela do editor não foi conferida no navegador porque exige
      login, e eu não preencho credencial.
- [x] R5-A43 O palco 3D para de negar o que a composição já faz | trilha: ux | depende: nenhum | pronto quando: a frase do painel "Peça" não afirma mais que montar as cinco peças é a próxima tarefa, aponta para a tela que faz isso, e existe teste de que ela não voltou
      feito em `d5c262f`. A frase aponta para o calçado montado com o MESMO nome que o rodapé usa
      para aquele destino, e o teste lê esse nome de `ROTULO_DA_SAIDA` em vez de repetir a string,
      para os dois não divergirem (ADR-003). O teste monta a tela de verdade em jsdom e lê a frase
      do DOM, não do arquivo-fonte: só é possível por causa do R5-A46, que fez a tela sobreviver à
      falta de WebGL. Três testes, sendo um de contraprova (a tela montou mesmo), e a frase antiga
      de volta no lugar deixa 2 dos 3 vermelhos. Conferido no navegador em `?tela=palco3d`, e o
      botão que a frase cita leva mesmo ao calçado montado.

---

## Refino, rodada 6 (aberta em 2026-09-12)

Lote de 6 itens, saído da reauditoria registrada em `AUDITORIA.md`, seção "Achados da reauditoria da
rodada 6". Nenhum com risco 4 ou 5, e o mais alto é 2. Um item por eixo com achado acima do corte:
robustez (A51 e A52), produto (A50), qualidade (A49 e A42), ux (A48).

Ordem de execução pelo score, com o A52 por último porque é o único que mexe em como o `App.tsx`
carrega as telas, e quero o baseline conferido várias vezes antes dele.

- [x] R6-A51 A raiz ganha rede de proteção contra exceção de render | trilha: robustez | depende: nenhum | pronto quando: existe um `ErrorBoundary` acima das quatro telas, um componente que lança durante o render deixa a página COM conteúdo (mensagem do que houve mais as saídas para outra tela) em vez de `document.body` vazio, e existe teste que monta um filho que lança e afirma que a saída continua no DOM
      feito em `40d28c2`. A rede é uma classe (`src/RedeDeProtecao.tsx`), a única do projeto, porque
      `getDerivedStateFromError` só existe em classe. Cada tela entra dentro dela e o rodapé fica
      FORA: a exceção não leva junto a navegação, e o `key={tela}` impede que a falha antiga
      sobreviva à troca de tela. Uma segunda rede no `main.tsx` atende o caso em que quem lança é o
      próprio `App`. As saídas são `<a href>`, porque com a árvore morta não existe estado de
      navegação para um `onClick` mexer. Conferido no navegador com um `throw` proposital dentro da
      `TelaDoPalco3d`, revertido em seguida, e foi ALI que apareceu o defeito que o teste não via: a
      rede desenhando as próprias saídas deixava a mesma lista de três destinos duas vezes na tela,
      uma em links e outra em botões. Daí o `comSaidas={false}` que o `App` usa. 6 testes novos, e a
      mutação (`getDerivedStateFromError` devolvendo `{falha: null}`) deixa 4 deles vermelhos.
- [x] R6-A50 A peça clicada mostra os dois lados do endereço | trilha: produto | depende: nenhum | pronto quando: clicar numa peça no calçado montado mostra o id do nó E a categoria daquela peça, com o mesmo nome de categoria que a lista de zonas usa, e existe teste de que os dois vêm da MESMA composição em cena (id inventado não inventa categoria)
      feito em `df3e77c`. A resposta vem de `zonaDaMalha`, função pura sobre as zonas da montagem EM
      CENA, e não do catálogo: o catálogo sabe a que categoria uma peça PODE servir, e a pergunta da
      tela é "a peça que eu cliquei, nesta cena, é de que zona". Malha fora de toda zona devolve
      `null` e a tela escreve isso, em vermelho, em vez de chutar uma categoria. O botão "mexer na
      cor desta zona" leva o FOCO até o seletor daquela categoria, pelo mesmo id que o campo usa
      (`idDoCampoDeCor`), porque id escrito à mão em dois lugares diverge um dia e o sintoma seria um
      botão que não faz nada. 6 testes novos; a mutação (`zonaDaMalha` devolvendo sempre a primeira
      zona) deixa 3 vermelhos. Conferido no navegador: clicar no cadarço mostrou `prova-cadarco-reto`
      e `cadarco`, e o botão levou o foco a `composicao-cor-cadarco`, rolando a tela até ele.
- [x] R6-A49 A tela da composição ganha teste de comportamento | trilha: qualidade | depende: nenhum | pronto quando: `TelaDaComposicao` monta em jsdom e há teste de que colar um JSON válido troca o que está em cena, colar um JSON recusado mantém o calçado anterior e escreve o motivo, e trocar de peça não carrega o parâmetro da peça anterior
      feito em `44b2741`. 6 testes montando a tela em jsdom, possível só por causa do R5-A46. Duas
      mutações: apagar o `delete depois.parametros` deixa 6 vermelhos (1 aqui, 5 na regra pura), e
      fazer o `setErroDaColagem` receber sempre `null` deixa 2, e esses 2 existem só aqui, porque
      são a parte que teste de função pura nenhuma alcança. Fica registrado o erro da primeira
      versão do arquivo, que é o motivo de o `forma_id` agora ser lido do acervo: escrito à mão, e
      errado, ele fazia o teste do caminho de SUCESSO exercitar o da recusa, e passar.
- [x] R6-A48 A moldura preta some quando o 3D não vai abrir | trilha: ux | depende: nenhum | pronto quando: no estado `contexto-negado` não existe mais uma caixa preta vazia guardando espaço para o que não vem, a mensagem ocupa esse lugar nas duas telas do palco, e o `contexto-perdido` continua com a moldura de pé (com teste dos dois estados)
      feito em `9a1a72d`. Quem decide é o componente do palco, por estado local, e não a tela: a
      tela sabe qual frase escrever, e só o palco sabe que ali dentro não vai aparecer nada nunca
      mais. As duas telas ganharam o conserto de uma vez. Medido no navegador: a frase do erro passou
      de 365 px do topo para 143 px na janela de trabalho, e para 160 px em 375x812. A outra metade,
      o `contexto-perdido`, foi conferida forçando `WEBGL_lose_context` no navegador: a moldura
      continua com 532x320 px, porque ali o contexto pode voltar e ela é o lugar onde ele volta.
      Essa metade NÃO tem teste automático, e não dá para ter: criar um contexto de verdade em jsdom
      é impossível, que é o mesmo limite que o A46 já tinha. Um teste novo no arquivo do A46, e o
      teste vizinho perdeu a linha que exigia a moldura de pé depois da falha, que era a afirmação
      contrária a esta. Dois comentários que diziam "não existe `ErrorBoundary` em lugar nenhum"
      passaram para o passado no mesmo commit, porque o R6-A51 os tornou falsos.
- [x] R6-A42 README por diretório vira varredura, não lembrete | trilha: qualidade | depende: nenhum | pronto quando: todo diretório com código versionado tem `README.md`, e existe um teste que reprova quando um diretório novo com código nasce sem índice, com contraprova sintética que TEM de reprovar
      feito em `cc80ca4` e `ac2d3ae`. Nove diretórios estavam sem índice, e a RAIZ do projeto era
      um deles: um clone recém-baixado não tinha uma linha dizendo o que o projeto é nem como rodar.
      A raiz entrou de propósito, e não por completude: com ela escrita, a varredura não precisa de
      lista de exceção nenhuma, e lista de exceção é onde uma regra vai morrer devagar. Duas
      decisões separam a guarda de um alarme falso permanente, e as duas têm teste: diretório vazio
      não conta, senão as pastas de andaime nunca versionadas de uma cópia de trabalho antiga fariam
      a varredura reprovar numa máquina e passar noutra a partir do mesmo commit; e `.md` sozinho
      não é código, senão cada pasta de `docs/` precisaria de um índice para explicar os `.md` ao
      lado. A contraprova sintética cria uma árvore temporária e a varre com a MESMA função que
      varre o projeto: sem índice reprova, com índice passa. Três mutações mortas à mão: apagar o
      `README.md` de `src/lib/render/fixtures/` reprova e nomeia o diretório, `temIndice: true` mata
      a contraprova sintética, e `temCodigo` devolvendo sempre `false` derruba três dos cinco
      testes. A guarda mora ao lado dos ADRs, como a de citações, porque fica junto da autoridade
      que lê. O que ela NÃO promete, e está escrito nela: que o índice esteja bom, atualizado ou
      verdadeiro. Isso continua sendo leitura humana.
- [x] R6-A52 O cliente de banco sai do chunk que todo mundo baixa | trilha: robustez | depende: nenhum | pronto quando: o chunk principal do `npm run build` não contém mais `@supabase/supabase-js`, as três telas públicas abrem sem baixá-lo, a área protegida continua funcionando, e o número novo do chunk principal está medido no `BASELINE.md`
      feito em `55a91ca` e `cff0fe3`. O chunk principal caiu de 457,75 kB para 218,97 kB, e de
      133,12 kB para 70,15 kB em gzip: a palavra `supabase` aparecia 72 vezes nele e agora aparece
      zero, porque foi inteira para `AreaProtegida-*.js`, 239,74 kB, que só quem faz login baixa.
      Foi a primeira coluna do `BASELINE.md` em que esse número caiu, depois de cinco rodadas
      empurrando ele para cima em 2,72 kB somados. A conferência do `.env.local` mudou de casa junto,
      e não por arrumação: ela é a primeira coisa que a área protegida faz, e deixá-la no `App.tsx`
      obrigaria o chunk principal a continuar importando `lib/supabase/`. A ordem que importava
      continua de pé, a configuração só é conferida depois de saber qual tela vai abrir. O componente
      novo mora na RAIZ de `features/` porque dentro de `sessao/` precisaria importar de `produtos/`,
      e essa seta é proibida pela regra de dependência de lá. Conferido no navegador, as quatro
      telas: esboço, palco 3D e calçado montado abrem com ZERO requisição de módulo do Supabase, e a
      área protegida mostra a tela de login com um rodapé só (ela desenhava o próprio antes, e agora
      usa o do `App.tsx`, como as outras três). Duas guardas novas: uma lê os imports ESTÁTICOS do
      `App.tsx` e reprova se algum trouxer `features/`, `lib/supabase/` ou `@supabase/`, deixando o
      `import()` dinâmico passar, que é o jeito certo; a outra monta em jsdom a tela de "falta
      `.env.local`", que era a metade impossível de conferir no navegador sem apagar o arquivo e
      reiniciar o servidor. Mutação que prova o elo: devolver um `import` comum de
      `features/sessao/BarraDaSessao` ao `App.tsx` reprova a varredura E devolve as 72 ocorrências
      ao chunk principal, que sobe para 432,21 kB. Uma mutação SOBREVIVEU na primeira versão do teste
      da tela de configuração ausente, e está relatada em `REFINO-RODADAS.md`: o teste perguntava a
      coisa errada e foi corrigido. O editor logado em si continua sem conferência no navegador,
      porque exige credencial e eu não preencho credencial.

## Refino, rodada 7 (aberta em 2026-09-12)

Lote de 6 itens, saído da reauditoria registrada em `AUDITORIA.md`, seção "Achados da reauditoria da
rodada 7". Nenhum com risco 4 ou 5, e o mais alto é 2. Um item por eixo com achado acima do corte:
robustez (A53 e A58), qualidade (A54), ux (A55 e A56), produto (A57).

Ordem de execução pelo score, com duas exceções deliberadas. O A54, que parte a tela da composição
em pedaços, vai por ÚLTIMO, porque o A55, o A57 e o A58 mexem todos dentro dela e fazer o corte
antes deles transformaria três itens pequenos em três resoluções de conflito. E o A56, que mexe no
histórico do navegador, vai antes do A57, porque os dois falam do mesmo assunto pelos dois lados,
o endereço e o estado, e é melhor o endereço estar certo antes de o estado começar a ser gravado.

Abaixo do corte e fora do lote, pela sétima rodada seguida: **A35**, o canvas sem teclado. O motivo
continua o mesmo já escrito em `AUDITORIA.md`, e ele não mudou com nada que aconteceu desde então.

- [x] R7-A53 `tenant_members.user_id` ganha índice, e a regra ganha varredura | trilha: robustez | depende: nenhum | pronto quando: existe migration nova criando `tenant_members_user_id_idx`, e existe um teste que lê as migrations e reprova se alguma coluna `references` de alguma tabela não tiver um índice que a lidere (o `unique` composto conta só para a coluna da frente)
      feito em COMMIT. A varredura achou DOIS casos, não um: além do
      `tenant_members.user_id` que originou o item, ela encontrou `tenant_api_keys.created_by` na
      primeira vez que rodou, enquanto eu ainda escrevia os testes, depois de eu ter lido a mesma
      migration duas vezes sem ver. Os dois ganharam índice na mesma migration, com o porquê de
      cada um escrito: o primeiro é consulta (`auth_tenant_ids()` filtra só por `user_id`, e ela
      está em quinze predicados de policy, cobrindo as seis tabelas e o Storage), o segundo é ação
      referencial (`on delete set null` precisa achar as linhas filhas quando o usuário sai). A
      regra que a guarda cobra é "índice que LIDERE a coluna", não "índice que a contenha", e essa
      é a distinção inteira: `unique (tenant_id, user_id)` parece cobrir as duas e cobre uma, a da
      frente. As duas leituras de texto de SQL saíram para `lerSql.ts`, módulo normal e não arquivo
      de teste, porque importar um `.test.ts` de outro faz o vitest registrar os `describe` do
      importado duas vezes. Três mutações mortas à mão: apagar o `create index` do `user_id`
      reprova nomeando `tenant_members.user_id`, trocar a primeira coluna da lista pela última
      derruba três testes, e `semComentarios` virando identidade derruba outros três. Oito testes
      novos, 1275 para 1283. O que a guarda NÃO promete está escrito nela: que o índice esteja
      sendo USADO, o que exigiria `explain` contra banco de verdade, e este projeto não tem acesso
      direto a Postgres. **A migration não foi aplicada no banco real**, isso é P05 em
      `PENDENCIAS-DO-MATHEUS.md`, com o `select` de conferência junto.
- [x] R7-A55 A região viva do colar deixa de ser duas | trilha: ux | depende: nenhum | pronto quando: o parágrafo de recusa da colagem não é mais descendente de outro elemento com `aria-live`, o anúncio continua acontecendo, e existe teste que afirma que nenhum `[role=alert]` da tela tem ancestral com `[aria-live]`
      feito em COMMIT. Eram duas regiões vivas, uma dentro da outra: uma `div` com
      `aria-live="polite"` envolvendo um `<p role="alert">`, e `role="alert"` já implica
      `aria-live="assertive"`. Aninhamento assim não está previsto na especificação, e o que cada
      leitor de tela faz com ele é escolha dele. O conserto não foi só apagar a `div`: ela existia
      para anunciar a TROCA entre a ajuda e o erro, então apagá-la sozinha tiraria o único anúncio
      que o caso de sucesso tinha, que era a ajuda sendo relida depois de uma recusa. Ficou assim:
      o texto fixo saiu de qualquer região viva, porque ele nunca muda; e o desfecho da colagem
      virou uma região viva só, com o `role` mudando com o desfecho, `alert` para a recusa, que
      precisa interromper porque o calçado na tela NÃO é o que a pessoa colou, e `status` para o
      aceite, que pode esperar a vez porque a mudança boa já aconteceu. O caso do aceite não
      existia antes: a montagem nova acontece dentro do canvas, e quem não enxerga o palco não
      recebia notícia nenhuma de que deu certo. O estado virou união marcada
      (`{ tipo: 'recusada' | 'aceita' }`) e não `string | null`, porque "erro é nulo" não distingue
      "deu certo" de "ainda não tentou", e essa terceira possibilidade é o que impede a região de
      nascer com texto dentro e ser lida na abertura da tela. Cinco testes novos, um deles varrendo
      a tela INTEIRA atrás de região viva dentro de região viva, escrito assim de propósito para
      cobrir também os painéis que ainda vão nascer no R7-A54. Três mutações mortas à mão: devolver
      a `div` externa reprova a varredura, tirar o `role="status"` do aceite derruba dois testes, e
      não limpar a recusa ao aceitar derruba os mesmos dois. Conferido no navegador nos três
      estados, abertura, recusa e aceite: zero regiões aninhadas em todos.
- [x] R7-A56 O botão Voltar do navegador anda entre as telas | trilha: ux | depende: nenhum | pronto quando: navegar pelo rodapé aumenta `history.length`, `history.back()` volta para a tela anterior e não para fora do app, a primeira carga continua usando `replaceState` (normalizar não é navegar), recarregar continua abrindo a tela do `?tela=`, e existe teste do par `pushState` mais `popstate`
      feito em COMMIT. `irPara` troca `replaceState` por `pushState`, e o `App` ganha um ouvinte de
      `popstate` que relê `?tela=` da URL. O par é inseparável, e o comentário do `App.tsx` diz por
      quê: `pushState` sozinho deixaria Voltar mudando o endereço com a tela anterior ainda
      desenhada, que é pior que o defeito original. O ouvinte lê da URL, e não de um estado guardado
      na entrada do histórico, porque a URL é a única fonte que também responde por link colado e
      por F5. **Uma cláusula do critério de pronto estava errada, e está corrigida aqui em vez de
      apagada:** eu escrevi "a primeira carga continua usando `replaceState`", e a primeira carga
      nunca usou; o `replaceState` só existia dentro do `irPara`. Nada mudou na primeira carga.
      Conferido no navegador: rodapé da composição para o esboço e do esboço para o palco levou
      `history.length` de 28 para 29 e 30; Voltar trouxe o esboço de volta com título e conteúdo
      juntos, outro Voltar trouxe a composição, e Avançar devolveu o esboço, com um rodapé só em
      todos os passos. Cinco testes em `App.navegacao.test.tsx`, montando o `App` inteiro em jsdom.
      Três mutações mortas à mão: voltar ao `replaceState` derruba os cinco, não registrar o
      ouvinte derruba três, e apagar a limpeza do ouvinte derruba um. **Uma mutação SOBREVIVEU** na
      primeira versão do teste de limpeza, e ele foi reescrito: ele disparava `popstate` depois de
      desmontar e conferia que o título não mudava, só que numa árvore desmontada o título não muda
      com limpeza ou sem ela. Agora o teste afirma a identidade da função removida. O chunk
      principal subiu de 218,97 kB para **219,12 kB**, 0,15 kB, que é o ouvinte.
- [x] R7-A57 A composição sobrevive ao F5 | trilha: produto | depende: R7-A56 | pronto quando: escolher peças, cores e parâmetro e recarregar devolve a MESMA montagem, uma gravação inválida ou de outra forma é recusada pelo mesmo `validarComposicao` que a colagem usa e a tela cai no padrão sem quebrar, `localStorage` indisponível não derruba a tela, e existe teste dos três casos (volta, recusa, ausência)
      feito em COMMIT. Arquivo novo, `composicaoGuardada.ts`, que grava no `localStorage` o MESMO
      JSON do botão de copiar e lê de volta por `escolhasDoTextoColado`, o caminho da colagem, que
      confere a forma e passa pelo `validarComposicao`. A tela lê no inicializador do `useState`, e
      não num efeito, para não desenhar o calçado de prova por um quadro e recarregar o glTF duas
      vezes; e grava num efeito amarrado ao texto da composição, não a cada `setEscolhas`. Gravação
      recusada é apagada. Armazenamento que não existe ou que lança, ao ler a propriedade, ao ler
      ou ao gravar, devolve o padrão e não derruba nada. Sete testes da função com armazenamento
      falso e três da tela em jsdom (volta depois de remontar, gravação de outra forma cai no
      padrão, `localStorage` que lança). O `beforeEach` do teste da tela agora limpa o
      `localStorage`, senão cada teste abriria com o calçado do anterior. Cinco mutações mortas à
      mão: não restaurar, não gravar, não apagar a recusa, tirar o `try` da leitura do
      `window.localStorage` e tirar o `try` da gravação. Conferido no navegador: cabedal pintado de
      `#22aa44`, F5 devolveu `#22aa44` (antes da mudança devolvia `#1f4fa8`); gravação com
      `forma_id` inválido, F5 abriu no `#1f4fa8` com as três zonas e a gravação ruim foi trocada
      pela do padrão. Custo medido: 197 gravações em 9,5 ms, **0,048 ms por gravação**. O chunk
      principal ficou em 219,12 kB, porque a tela entra por `import()` tardio. **Achado de
      passagem, anterior a este item e registrado para a reauditoria:** 200 eventos de cor
      disparados no MESMO tique fazem o React lançar "Maximum update depth exceeded" três vezes,
      e isso acontece igual com a mudança guardada (`git stash`), então não é deste item. Com um
      evento por quadro, como um arrasto de verdade, 120 eventos deram zero erros.
- [x] R7-A58 Todos os parâmetros da peça aparecem, e mexer num não apaga o outro | trilha: robustez | depende: nenhum | pronto quando: uma peça com dois parâmetros desenha dois controles, arrastar um preserva o valor do outro, e existe teste com peça de dois parâmetros no acervo de teste que reprova tanto o `[0]` quanto a substituição do objeto
      feito em COMMIT. Dois defeitos na mesma linha, dois commits. O primeiro está na transição
      pura: `mudarEscolhaDaTela` espalhava a mudança por cima da escolha, e `parametros` vinha com
      uma chave só, a do controle arrastado, substituindo o objeto inteiro. Agora soma, a não ser
      que a peça tenha trocado, que continua descartando tudo (BUG-019). O segundo está na tela:
      `peca?.parametros[0]` virou `ControlesDeParametro.tsx`, que desenha um controle por
      parâmetro declarado. O componente saiu da tela porque a tela não recebe catálogo, e o acervo
      de prova só tem peça de um parâmetro, então só separado um teste consegue montar peça de dois.
      Dois testes da transição e três do componente, com a peça sintética de dois parâmetros e a
      mudança passando por `mudarEscolhaDaTela` do mesmo jeito que a tela passa. Mutações mortas à
      mão: voltar à substituição derruba um da transição e um do componente, desenhar só o
      primeiro parâmetro derruba os três do componente, e anular a regra da troca de peça derruba
      seis. Conferido no navegador: três faixas, uma por peça como antes, arrastar o cano do
      cabedal até o máximo mostra 120,0 mm e grava `altura-do-cano: 0.12`. A tela caiu de 497
      para 457 linhas. **Visto de passagem e registrado para a reauditoria:** `TelaDoPalco3d.tsx`
      tem o mesmo `parametros[0]`, fora do escopo escrito deste item.
- [ ] R7-A54 A tela da composição vira tela mais painéis | trilha: qualidade | depende: R7-A55, R7-A57, R7-A58 | pronto quando: `TelaDaComposicao.tsx` tem menos de 200 linhas, cada painel extraído mora no seu arquivo com o seu `README.md` de diretório em dia, os seis testes de comportamento da tela continuam passando SEM alteração, e o build e o `tsc` continuam limpos
