# Tarefas

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluída e verificada · `[!]` bloqueada (com diagnóstico)

Formato: `- [ ] ID título | trilha: <nome> | depende: <IDs ou nenhum> | pronto quando: <critério>`

A ordem geral é a do ADR-008: **acervo → composição → prompt**, nunca o contrário. O que já está
`[x]` foi verificado de verdade (suíte verde, typecheck limpo, mutação matando teste), não marcado
por otimismo.

## Fase A: Fundação do rumo 3D (o que não depende de artista)

- [x] T01 `normalizarModelo3d` + `nomeDeMalha` | trilha: render | depende: nenhum | pronto quando: canônico com nome único e material próprio por malha, e recusa explícita para arquivo inválido — **feito**, 576 testes verdes, 3 mutações mataram 5/2/1 testes
- [x] T02 `recolorirModelo3d` + `corSrgbLinear` + `lerGltf` | trilha: render | depende: T01 | pronto quando: cor pedida chega ao `baseColorFactor` convertida de sRGB para linear, num lugar só, com guarda de fonte — **feito**, 638 testes verdes
- [x] T03 Termos do ADR-008 no glossário | trilha: docs | depende: nenhum | pronto quando: acervo, peça, categoria de peça, composição e forma no glossário antes do código — **feito** em `5cebbe5`

## Fase B: Composição (a camada que o ADR-008 D1/D2 define)

- [x] T04 `validarComposicao.ts` | trilha: composicao | depende: T03 | pronto quando: recusa com código explícito para id de peça inexistente, categoria faltando, categoria repetida, peças de formas diferentes e parâmetro fora de faixa; nasce com teste — **feito**, 699 testes verdes, 5 mutações mataram 3/2/2/1/1 testes
- [!] T05 `montarCatalogoParaModelo.ts` | trilha: composicao | depende: T06 e P03 | **bloqueio:** o formato da saída é um palpite enquanto não existir o consumidor (a chamada ao modelo, que depende de aprovação de custo), e o critério que importa — nenhuma peça de outro tenant — é propriedade de consulta sob RLS, não de função pura. Construir agora seria formatar para um leitor que não existe. Critério original: pronto quando: dado o acervo visível a um tenant, devolve o catálogo que vai para o modelo de linguagem, **sem** peça de outro tenant, e o teste prova o vazamento impossível
- [!] T06 Schema do acervo com RLS | trilha: dados | depende: P04 e P05 | **bloqueio:** a migration guardaria peças que ainda não existem, e o critério exige teste de integração contra banco real, que este ambiente não tem autenticado. Além disso P05 (onde a zona 3D é guardada) toca as mesmas tabelas e é decisão de schema do dono. Critério original: pronto quando: migration cria forma/peça/composição com RLS ativa; peça de tenant não aparece para outro tenant; teste de integração prova

## Fase C: Bloqueadas no acervo (ADR-008, "o gargalo mudou de lugar")

- [!] T07 Palco 3D no navegador (ADR-007 D1/D2) | trilha: front | depende: acervo | **bloqueio:** precisa de um glTF real de calçado para ter o que mostrar. Um palco sem modelo não é verificável a olho, e o princípio nº1 exige exatamente a conferência a olho
- [!] T08 Montagem de composição em cena | trilha: front | depende: T07, acervo | **bloqueio:** ~15 peças de uma forma de tênis que encaixam entre si. É conteúdo, não código
- [!] T09 Prompt → composição | trilha: ia | depende: T05, T08, decisão do dono | **bloqueio duplo:** o acervo, e a primeira dependência paga recorrente do projeto, que `memory/restrictions.md` exige que o dono aprove por escrito

## Fase D: Dívida conhecida

- [x] T10 Typecheck de `supabase/scripts/` | trilha: base | depende: nenhum | **já estava resolvida**: a pasta está no `include` do `tsconfig.json` e `tsc --noEmit --listFiles` confirma os 6 arquivos `.ts` sendo lidos, com a suíte limpa. A pendência anotada estava vencida. Fica de fora só `executar.mjs`, que é JS e exigiria `allowJs`
