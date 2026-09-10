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
- [ ] T13 Palco 3D no navegador | trilha: front | depende: T12 | pronto quando: o modelo aparece na tela, gira com o mouse, e clicar numa peça a identifica pelo nome da malha (ADR-007 D1/D2/D4). Verificação obrigatória em navegador real, porque o princípio nº1 exige conferência a olho | **construída e revisada, aguardando a conferência a olho**: `specs/palco-3d.md` com 23 de 23 critérios em sim, 60 testes em `src/palco3d/`, 844 na suíte, typecheck e build limpos, 10 mutações e 10 mortas. Continua `[ ]` de propósito: a §7 do spec só o dono pode responder, em <http://localhost:5173/?tela=palco3d>
- [ ] T14 Montagem da composição em cena | trilha: front | depende: T13 | pronto quando: uma composição validada vira calçado montado na tela, com cada peça no lugar, e trocar a cor de uma zona muda só aquela peça
- [ ] T15 Configurador (o fallback grátis do ADR-008, Alternativa 3) | trilha: front | depende: T14 | pronto quando: dá para escolher peça por categoria, cor e parâmetro por menu, sem IA nenhuma, e o resultado é uma composição válida. **É produto vendável por si só**, não só um degrau para o prompt

## Fase D: Adiadas por decisão, não por bloqueio

- [!] T05 `montarCatalogoParaModelo.ts` | trilha: composicao | **adiada junto com T09**: o catálogo existe para ser lido por um modelo de linguagem, e formatar para um leitor que foi adiado é trabalho especulativo
- [!] T09 Prompt vira composição | trilha: ia | **adiada pela decisão 2 do dono** (2026-09-10): o configurador ocupa o lugar dela sem custo. Revisitar quando T15 estiver rodando sobre o acervo de prova
- [!] T06 Schema do acervo com RLS | trilha: dados | **adiada**: para provar a esteira, o acervo de prova pode viver como arquivo, sem banco. A tabela entra quando houver acervo de verdade e mais de um tenant com peça própria (ADR-008 D6). Antecipá-la seria schema para dado que não existe
- [x] T10 Typecheck de `supabase/scripts/` | trilha: base | **já estava resolvida**: a pasta está no `include` do `tsconfig.json` e `tsc --noEmit --listFiles` confirma os 6 arquivos `.ts` sendo lidos, com a suíte limpa. A pendência anotada estava vencida. Fica de fora só `executar.mjs`, que é JS e exigiria `allowJs`
- [ ] T16 `exportarTenant.ts` | trilha: base | depende: T15 | pronto quando: o script produz o zip do ADR-009 e o teste confere que uma zona marcada aparece dentro dele. Não urgente: o ADR existe justamente para a resposta estar pronta antes da pergunta

## Zona 3D: sem tarefa, por decisão

A decisão 3 do dono fechou a questão sem código: no modo gerado a zona vem da composição, cada
peça é uma zona, então nada precisa ser gravado. Coluna nova só quando existir a primeira marca
querendo subir o glTF dela, e aí ela entra junto com o caso de uso real.

## T07 e T08 foram renumeradas

O que era T07 (palco) e T08 (montagem em cena) virou T13 e T14, e deixou de estar bloqueado
porque o acervo de prova de T12 dá a elas o que faltava: algo para mostrar na tela.
