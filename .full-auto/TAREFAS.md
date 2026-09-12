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
