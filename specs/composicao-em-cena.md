# Montagem da composição em cena (T14)

> Regra de escrita: sem travessão. Vírgula, dois pontos ou parênteses no lugar.

## 0. De onde esta tarefa vem, e por que ela é a mais importante da fase

Duas metades foram construídas separadas e nunca se encontraram. T11 deu o guarda da composição
(`validarComposicao`: a saída do modelo de linguagem vira escolha de peça, ou recusa). T12 deu o
combustível (5 peças em glTF 2.0 válido, geradas por código). T13 pôs uma peça na tela, girando,
identificável por clique, e o dono conferiu a olho em 2026-09-10.

T14 é o encontro: **uma composição validada vira um calçado montado, colorido, na tela.**

E é aqui que o princípio nº1 passa a valer em três dimensões. Até agora a promessa "cor no editor
igual à cor da API, mesmo motor nos dois lados" valia para SVG. O `recolorirModelo3d` existe desde
o ADR-007 e nunca pintou nada que alguém tenha visto. Esta é a entrega em que ele pinta.

### O que já existe e não vai ser reescrito

| Peça | O que ela já faz |
|---|---|
| `validarComposicao` | Recusa peça inventada, forma misturada, categoria repetida ou faltando, parâmetro fora da faixa. Devolve `ComposicaoValidada` com a **entrada do catálogo**, nunca o id que veio de fora |
| `gltfDaPecaDeProva(id, parametros)` | O texto glTF de uma peça, com o parâmetro já aplicado como escala do nó |
| `normalizarModelo3d` | Nome próprio e material próprio por malha. As peças de prova já nascem canônicas |
| `recolorirModelo3d(canonico, zonas, cores)` | O motor de cor 3D. Valida tudo antes de pintar, converte sRGB para linear, recusa zona ausente ou não recolorível |
| `PalcoDaPeca` + `orbita` + `nomeDaMalhaNoPonto` | O palco de T13: um texto glTF vira cena girável e clicável |

## 1. Escopo

Uma tela `?tela=composicao`, sem login e sem banco, que monta uma composição validada num **único
glTF** (cada peça um nó com nome próprio, assentada sobre a de baixo, com a cor da sua zona) e o
entrega ao palco de T13 para aparecer, girar e ser clicada.

## 2. Fora de escopo

- **Escolher a peça de cada categoria por menu.** É T15, o configurador. T14 monta a composição
  demo que já existe, e deixa mexer em cor e parâmetro.
- **A chamada ao modelo de linguagem.** Adiada por decisão do dono; o configurador ocupa o lugar.
- **Schema do acervo no banco, RLS, Storage.** Adiado (T06). A peça continua vindo de código.
- **Endpoint HTTP que devolve o calçado montado.** O ADR-009 vai precisar dele; a montagem sai
  como glTF exatamente para que ele não tenha que reescrever nada, mas a rota não entra aqui.
- **Rotação de peça.** A montagem translada e escala; girar peça é problema de outra forma.
- **Sombra, oclusão, materiais de verdade.** As peças continuam caixas foscas.

## 3. Decisões que o build não pode redecidir

### D1. A montagem produz **glTF**, não objetos de cena

A alternativa era montar direto em three.js (carregar cada peça e posicionar o `Object3D`). Seria
menos código hoje e é a decisão errada: o ADR-009 promete ao cliente a saída completa em formato
aberto, e a API vai precisar do calçado montado como arquivo. Uma montagem que só existisse como
objeto de three teria que ser reescrita lá, e "duas implementações que podem divergir" é o que o
CLAUDE.md proíbe no primeiro parágrafo.

Consequência boa e não prevista: o palco de T13 **não muda em nada**. Ele recebe um texto glTF, e
o calçado montado é um texto glTF. A composição inteira vira "um modelo com N zonas", que é
exatamente a forma que o motor de cor já sabe tratar.

### D2. Cada peça assenta **no topo da peça de baixo**, e o topo é lido da geometria

O `assento` que T12 gravou em cada peça é o lugar dela no calçado padrão. Quando a composição
engrossa a sola, o cabedal precisa subir junto: T12 escreveu, em comentário, que "essa conta é de
T14".

A conta não usa nenhuma altura declarada. Ela lê a **caixa envolvente do modelo**, do próprio
JSON do glTF:

```
deslocamento(categoria) = 0                                    , se ela não assenta sobre ninguém
deslocamento(categoria) = topo(base) - base(categoria)         , caso contrário
topo(categoria)         = maximo_y(categoria) + deslocamento(categoria)
```

Escrito como **deslocamento** e não como posição absoluta de propósito, e a diferença importa:
categoria que não assenta sobre ninguém mantém o assento em que foi modelada, em vez de ser
empurrada para o chão. Assim uma forma que ainda não declarou empilhamento nenhum continua
montando exatamente como as peças dela foram modeladas, que é o comportamento que não surpreende.
A regra sem essa ressalva empilharia tudo no zero e desmontaria a forma sem empilhamento.

Conferindo contra o acervo de prova, com os valores padrão: sola em 0, altura 0,018; cabedal em
0 + 0,018 = **0,018**, que é o `assento` gravado; cadarço em 0,018 + 0,075 = **0,093**, que é o
`ALTURA_DA_SOLA + 0,075` gravado. A regra derivada reproduz os números escritos à mão, e passa a
valer também quando o parâmetro muda.

Ler da geometria em vez de um campo declarado é a mesma escolha do BUG-013: **campo redundante
que pode divergir é a família de defeito que este projeto persegue**. Uma peça cuja malha não bate
com a altura declarada existiria; uma peça cuja malha não bate com a própria malha, não.

### D3. Quem sabe o que assenta sobre o quê é a **forma**

`CategoriaDaForma` ganha `assenta_sobre?: string`. A forma já é quem declara suas categorias
(ADR-008 D4), justamente porque não existe lista fixa de categorias no código: chinelo não tem
cadarço. Anatomia é o mesmo tipo de conhecimento. Campo **opcional**: categoria sem ele mantém o
assento em que foi modelada, que é o certo para a sola (modelada no chão) e para qualquer forma
que ainda não tenha declarado empilhamento.

### D4. A cor é aplicada **uma vez, no modelo montado**, e não peça por peça

Poderia ser peça por peça, antes de juntar. Aplicar no montado é melhor por três razões, em ordem
de peso: é uma chamada só ao mesmo motor que a API vai chamar; a sobreposição de zonas
(`ZONAS_SOBREPOSTAS`) só é detectável olhando o modelo inteiro, porque duas peças caindo no mesmo
material é exatamente o que o motor existe para pegar; e o `zone_key` da zona é a **categoria**
(ADR-008 D3), que só faz sentido no calçado, não dentro de uma peça solta.

### D5. `PalcoDaPeca` vira `PalcoDeModelo3d`

Ele nunca soube o que é uma peça: recebe texto glTF e desenha. A partir de T14 o que ele recebe é
um calçado inteiro. Manter o nome faria "busca por nome de conceito bate com nome de arquivo"
(ADR-003) virar mentira já na primeira reutilização. Renomear custa quatro arquivos hoje e fica
mais caro a cada tarefa.

### D6. A montagem **não normaliza**

`montarComposicao` assume modelos canônicos, exatamente como `recolorirModelo3d` documenta. A
normalização é do upload da peça, não do momento de montar (ADR-005: o editor nunca normaliza nem
regrava o asset-base). O que entra no lugar é um **teste**: passar cada peça de prova por
`normalizarModelo3d` não muda nada, ou seja, ela já nasce canônica.

## 4. Arquivos afetados

### Novos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/render/medidaDoModelo3d.ts` | A caixa envolvente lida do JSON do glTF, sem three. Anda pelos nós aplicando translação e escala |
| `src/lib/render/deslocarModelo3d.ts` | Soma um deslocamento à translação dos nós raiz. Gêmeo de `recolorirModelo3d` em forma: recebe canônico, devolve canônico |
| `src/lib/render/juntarModelos3d.ts` | N modelos canônicos viram um só, reindexando acessores, bufferViews, buffers, malhas, materiais, texturas e nós |
| `src/lib/composicao/empilharComposicao.ts` | O D2 virando função: de quanto cada peça precisa subir |
| `src/lib/composicao/montarComposicao.ts` | A orquestração: composição validada + provedor de glTF → um glTF só, já colorido |
| `src/palco3d/TelaDaComposicao.tsx` | A tela: o calçado montado, cor por zona, parâmetro por peça, nome do que foi clicado |
| os `.test.ts` de cada um acima | Co-locados, no padrão do projeto |

### Modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/composicao/tiposDaComposicao.ts` | `CategoriaDaForma` ganha `assenta_sobre?: string` |
| `src/lib/acervo/acervoDeProva.ts` | A forma de prova declara o empilhamento: cabedal sobre sola, cadarço sobre cabedal. Mais `composicaoDeProva()`, a composição demo |
| `src/palco3d/PalcoDaPeca.tsx` | Renomeado para `PalcoDeModelo3d.tsx` (D5), com a prop `textoGltf` intacta |
| `src/palco3d/fronteiraSemGpu.test.ts`, `TelaDoPalco3d.tsx`, `README.md` | Acompanham o rename |
| `src/palco3d/palco3d.css` | O estilo da tela nova, na mesma folha (as duas telas são o mesmo palco) |
| `src/telaInicial.ts` + `.test.ts` | `composicao` entra na lista de telas sem banco |
| `src/App.tsx` | Rota da tela nova, antes da checagem de configuração do Supabase |
| `src/lib/render/README.md`, `src/lib/composicao/README.md`, `src/lib/acervo/README.md` | Índices |
| `.full-auto/ESTADO.md`, `.full-auto/TAREFAS.md` | Estado da máquina |

## 5. Critérios de aceite

### A caixa envolvente sai do JSON, sem three (`medidaDoModelo3d`)

1. Para as 5 peças de prova, a medida lida do glTF bate com a que o three mede depois de carregar,
   dentro da tolerância de float32. É o teste que impede as duas de divergirem, e ele só é possível
   porque T13 já sabe carregar.
2. A medida acompanha a escala do nó: a mesma peça com o parâmetro no mínimo e no máximo dá alturas
   diferentes, na proporção dos valores pedidos.
3. A medida acompanha a translação do nó: peça assentada acima do chão tem `minimo.y` igual ao
   assento, não zero.
4. Modelo com nó em `rotation` ou `matrix` é **recusado** com `MODELO_3D_NAO_NORMALIZAVEL`, e não
   medido errado em silêncio. Uma caixa alinhada aos eixos calculada sobre geometria girada mente,
   e mentira de medida vira peça flutuando na tela sem explicação.

### O deslocamento (`deslocarModelo3d`)

5. Deslocar por `[0, 0.01, 0]` soma 0,01 à translação de cada nó raiz, e a caixa envolvente sobe
   exatamente 0,01.
6. Deslocar por `[0, 0, 0]` devolve um documento **byte a byte idêntico** ao que entrou.
7. Deslocar não toca em `accessors`, `bufferViews` nem `buffers`: é transformação de nó, nunca
   malha nova. É o mesmo princípio do ADR-008 D7, e é verificável comparando os bytes.
8. Nó filho **não** é deslocado junto explicitamente: ele já herda a translação do pai. Deslocar os
   dois somaria o movimento duas vezes.

### A junção (`juntarModelos3d`)

9. Juntar os 5 modelos de prova produz um glTF que o **validador de referência da Khronos aceita
   com zero erro e zero aviso**. É o mesmo critério que T12 usou, e pelo mesmo motivo: um validador
   escrito por nós julgando arquivos escritos por nós não prova nada.
10. O modelo junto tem exatamente 5 nós com nome, e os nomes são os ids das 5 peças.
11. Cada peça continua com o **material próprio** dela: 5 materiais, nenhum compartilhado. Material
    compartilhado é o defeito que o ADR-007 D5 existe para impedir, e juntar documentos é
    exatamente onde ele voltaria.
12. A geometria de cada peça sobrevive: carregar o modelo junto no three dá 5 malhas, e a caixa
    envolvente de cada uma bate com a que ela tinha sozinha.
13. Juntar um modelo só devolve esse modelo, com a mesma medida e os mesmos nomes.
14. Juntar zero modelos é **recusa explícita**, não um glTF vazio. Cena vazia com sucesso é o
    BUG-001 por outro caminho.
15. Modelo com `animations`, `skins` ou `cameras` é recusado com `MODELO_3D_NAO_NORMALIZAVEL`, em
    vez de ser juntado com os índices apontando para o lugar errado.

### O empilhamento (`empilharComposicao`)

16. Com os parâmetros padrão, o deslocamento de toda peça é **zero**: a regra derivada reproduz os
    assentos que T12 escreveu à mão. É a contraprova de que a conta está certa.
17. Engrossar a sola de 0,018 para 0,04 sobe o cabedal em exatamente 0,022, e o cadarço na mesma
    medida. O que muda embaixo empurra tudo que está em cima.
18. Aumentar a altura do cano sobe o cadarço e **não** mexe na sola. O que muda em cima não empurra
    o que está embaixo.
19. Categoria que não declara `assenta_sobre` fica no chão.
20. `assenta_sobre` apontando para categoria que a forma não declara, ou formando ciclo, é recusa,
    e não laço infinito.
21. Categoria opcional ausente da composição não quebra a pilha: sem cadarço, sola e cabedal
    continuam nos lugares certos.

### A montagem inteira (`montarComposicao`)

22. Uma `ComposicaoValidada` com as 3 peças demo vira **um** texto glTF, com as 3 assentadas na
    ordem e cada uma na cor pedida.
23. Trocar a cor de **uma** zona muda o `baseColorFactor` daquela peça e deixa os outros materiais
    byte a byte iguais. É o princípio nº1 em forma de assertion.
24. A cor que sai no glTF é a que `recolorirModelo3d` produziria sozinho, porque é ele que pinta:
    a montagem não converte cor, não normaliza e não escreve em `baseColorFactor`.
    `soUmLugarEscreveCorNoGltf.test.ts` continua verde sem nenhum nome novo na lista de licença.
25. Peça sem cor na composição fica com a cor própria dela, e não com preto nem branco forçado.
26. Cor inválida na composição já morreu em `validarComposicao`; se chegar aqui mesmo assim, o
    motor recusa com `COR_INVALIDA` em vez de pintar aproximado.
27. As 5 peças de prova passam por `normalizarModelo3d` **sem nenhuma mudança** (relatório com
    todos os contadores em zero), ou seja, elas já nascem canônicas e a montagem pode assumir isso
    (D6).

### A tela

28. `lerTelaDaUrl('?tela=composicao')` devolve `'composicao'`, e `?tela=admin` continua caindo em
    `app`. Nenhum valor de query alcança a área protegida.
29. `App.tsx` trata `composicao` antes da checagem de configuração do Supabase.
30. Clicar numa peça do calçado montado mostra o nome do nó dela, que é o id da peça, e é o
    endereço que o ADR-007 D4 define.

### Higiene

31. `npm test` verde, `npm run typecheck` limpo, `npm run build` passa.
32. Sem `console.log`, sem TODO sem justificativa.
33. Todo diretório novo com README, e os READMEs tocados atualizados.

## 6. Edge cases conhecidos

- **Buffers múltiplos.** glTF 2.0 permite vários `buffers` num documento, então juntar N modelos
  **não** exige concatenar binário: basta reindexar. É o que torna `juntarModelos3d` viável sem
  aritmética de offset de bytes, que é onde este tipo de código costuma errar.
- **Índice zero é falsy.** `primitiva.material` e `no.mesh` valem `0` legitimamente. Reindexar com
  `if (indice)` pularia o primeiro material de cada documento, e o defeito apareceria como uma peça
  com a cor de outra. Comparar com `undefined`, sempre.
- **Peça sem parâmetro.** O acervo permite peça sem variação (`parametros: []`). A altura dela vem
  da malha, não de parâmetro nenhum, e a pilha tem que continuar funcionando.
- **Ordem das peças na composição.** A composição é uma lista, e a ordem dela é do modelo de
  linguagem, não da anatomia. O empilhamento não pode depender da ordem em que as peças aparecem.
- **Duas peças no mesmo material depois de juntar.** Não pode acontecer (critério 11), mas se
  acontecer o motor de cor recusa com `ZONAS_SOBREPOSTAS`, e é a recusa certa.

## 7. Definição de "aprovado sem ressalvas"

Os 33 critérios em "sim" com evidência, `npm test`, `npm run typecheck` e `npm run build` verdes,
pelo menos 5 mutações matando teste, **e** a conferência a olho da §8 feita pelo dono.

## 8. O que só o dono pode confirmar, em navegador de verdade

Abrir <http://localhost:5173/?tela=composicao> e conferir:

1. **O calçado aparece montado**: sola embaixo, cabedal em cima dela, cadarço sobre o cabedal.
   Nenhuma peça flutuando no ar nem enterrada dentro da outra.
2. **A cor escolhida é a cor que aparece.** Este é o princípio nº1, literal. Se o hex escolhido e o
   que está na tela não forem a mesma cor, nada mais importa nesta entrega.
3. **Trocar a cor de uma zona muda só aquela peça.** A sola vermelha não pode pintar o cadarço.
4. **Engrossar a sola faz o cabedal e o cadarço subirem junto**, encaixados, sem abrir fresta nem
   afundar um no outro.
5. **Clicar numa peça mostra o nome dela**, e o nome bate com a peça em que se clicou.

O item 2 é o mais importante dos cinco: os testes conferem o número escrito no glTF, e número no
arquivo não é cor na tela. Entre um e outro há a conversão sRGB para linear e o renderizador, e é
justamente essa distância que o princípio nº1 existe para vigiar.

## 9. Revisão

Auditoria feita contra o código já escrito, critério por critério, com a evidência ao lado.

### A caixa envolvente (`medidaDoModelo3d.ts`, 322 linhas, 27 testes)

| # | | Evidência |
|---|---|---|
| 1 | sim | `medidaDoModelo3d.test.ts:104`, a medida lida do JSON é comparada com a que o three mede depois de carregar, para as 5 peças |
| 2 | sim | `:125` e `:146`, a altura vem do parâmetro pedido e a peça cresce para cima |
| 3 | sim | `:164`, peça assentada mede a partir do assento; `:183`, a sola continua com o piso em zero |
| 4 | sim | `:237` e `:246`, `rotation` e `matrix` recusados com `MODELO_3D_NAO_NORMALIZAVEL`, **por presença e não por valor**: rotação identidade também é recusada, para não existir "quase identidade" aceitável |

### O deslocamento (`deslocarModelo3d.ts`, 234 linhas, 40 testes)

| # | | Evidência |
|---|---|---|
| 5 | sim | `deslocarModelo3d.test.ts:100` soma na translação existente, e `:112` confere a subida na cena carregada, não só o número no JSON |
| 6 | sim | `:203`, cada uma das 5 peças deslocada por zero volta byte a byte igual |
| 7 | sim | `:195`, `accessors`, `bufferViews` e `buffers` comparados intocados |
| 8 | sim | `:222` e `:234`, o conjunto sobe uma vez e o filho sai com a translação intocada |

### A junção (`juntarModelos3d.ts`, 312 linhas, 29 testes)

| # | | Evidência |
|---|---|---|
| 9 | sim | `juntarModelos3d.test.ts:138`, validador da Khronos sem erro e sem aviso. E `:154` corrompe o modelo de propósito e exige que o validador reprove, senão este critério passaria vazio para sempre |
| 10 | sim | `:167`, 5 nós com nome, todos na cena |
| 11 | sim | `:179` e `:187`, cada nó alcança o material com o próprio id, e os índices são disjuntos |
| 12 | sim | `:222`, a caixa de cada peça depois da junção é a que ela tinha sozinha |
| 13 | sim | `:240` e `:249` |
| 14 | sim | `:341`, lista vazia é recusa explícita |
| 15 | sim | `:351`, os três campos recusados com `MODELO_3D_NAO_NORMALIZAVEL`, e `:362` deixa `"skins": []` passar, porque a recusa é sobre conteúdo e não sobre a chave existir |

### O empilhamento (`empilharComposicao.ts`, 13 testes)

| # | | Evidência |
|---|---|---|
| 16 | sim | `empilharComposicao.test.ts:37`, `[0, 0, 0]` com os tamanhos padrão. É a contraprova da conta inteira |
| 17 | sim | `:46`, 0,022 no cabedal e no cadarço; `:56` confere o simétrico com valor negativo de verdade |
| 18 | sim | `:65`, o cadarço sobe e a sola não se move |
| 19 | sim | `:117`, forma sem anatomia declarada monta as peças como foram modeladas |
| 20 | sim | `:128` (base inexistente) e `:142`, `:154` (ciclo, inclusive o que passa só por categorias ausentes) |
| 21 | sim | `:97` e `:107`: sem o cabedal, o cadarço desce até a sola em vez de ficar pendurado |

### A montagem inteira (`montarComposicao.ts`, 11 testes)

| # | | Evidência |
|---|---|---|
| 22 | sim | `montarComposicao.test.ts:55`, um documento com os 3 nós e as 3 zonas, aprovado pelo validador da Khronos; `:96` confere que nos tamanhos padrão nada se move, e `:112` que a sola grossa levanta o que está acima |
| 23 | sim | `:134`, o material da zona trocada muda e o `JSON.stringify` dos outros é idêntico |
| 24 | sim | `:156`, o modelo montado é **idêntico** ao que `recolorirModelo3d` produz sozinho sobre o mesmo montado sem cor. `soUmLugarEscreveCorNoGltf.test.ts` segue verde sem nome novo na licença |
| 25 | sim | `:170`, peça sem cor sai sem `baseColorFactor`, enquanto a com cor sai com |
| 26 | sim | `:187`, composição forjada com cor inválida é recusada pelo motor |
| 27 | sim | `:203`, as 5 peças passam por `normalizarModelo3d` com o relatório inteiro em zero |

### A tela

| # | | Evidência |
|---|---|---|
| 28 | sim | `telaInicial.test.ts`, `?tela=composicao` e `?tela=COMPOSICAO` abrem a tela; `?tela=composicoes` e `?tela=admin` caem em `app` |
| 29 | sim | `App.tsx:91`, o bloco de `composicao` está acima de `conferirConfiguracao()`, na linha 114 |
| 30 | sim | O nó de cada peça se chama com o id dela (`montarGltfDePeca.ts:82`), e `nomeDaMalhaNoPonto` já devolve o nome do nó desde T13. Conferência a olho na §8, item 5 |

### Higiene

| # | | Evidência |
|---|---|---|
| 31 | sim | 980 testes verdes, `npm run typecheck` limpo, `npm run build` passa. O three continua fora do chunk principal: 455 kB no principal, 619 kB no chunk do palco, 21 kB na tela nova |
| 32 | sim | Sem `console.` e sem TODO nos arquivos da entrega |
| 33 | sim | Nenhum diretório novo. Atualizados os READMEs de `src/lib/render/`, `src/lib/composicao/`, `src/lib/acervo/` e `src/palco3d/` |

### Verificação por mutação

Os três módulos de render vieram com passada própria: 8 mutações em `medidaDoModelo3d` (7 mortas,
1 provada **equivalente**, porque trocar `min` por `max` nos dois cantos é no-op quando a função
ordena o par para tolerar escala negativa), 14 em `deslocarModelo3d` e 14 em `juntarModelos3d`,
todas mortas. Em `juntarModelos3d`, três sobreviveram na primeira rodada (índices de `indices`,
`children` e textura, que o acervo de prova não exercita) e viraram testes novos antes da segunda.

Passada dos dois arquivos escritos aqui, 11 mutações, 11 mortas, restauração conferida por md5:

| Mutação | Testes mortos |
|---|---|
| Deslocamento no eixo X em vez do vertical | 3 |
| Ignora o deslocamento, tudo fica onde foi modelado | 2 |
| Faixa vertical com base e topo trocados | 3 |
| Mede o eixo X em vez do vertical | 3 |
| Peça sem cor recebe branco forçado | 2 |
| `zone_key` vira o id da peça em vez da categoria | 12 |
| Não filtra a categoria opcional deixada de fora | 2 |
| Ordem vem do mapa da tela, não da anatomia da forma | 1 |
| Mensagem de erro sem o código público | 2 |
| Deixa a exceção subir e apagar a tela | 4 |
| Estado inicial perde a cor da composição | 2 |

### O que a construção descobriu, e a spec não previa

1. **A geometria é float32, e a pilha herda isso.** Medir a sola de 18 mm devolve
   `0,017999999225`, então "com os parâmetros padrão o deslocamento é exatamente zero" é verdade na
   aritmética de `empilharComposicao` e falso por um nanômetro na montagem real. Arredondar dentro
   da montagem inventaria precisão que o arquivo não tem; quem compara posição em teste compara em
   micrômetros. Está escrito em `montarComposicao.test.ts` e no README de `src/lib/composicao/`.
2. **A peça de prova não termina com quebra de linha, e o canônico termina.** Então
   `normalizarModelo3d(gltfDaPecaDeProva(id)).modelo` difere de `gltfDaPecaDeProva(id)` por **um
   byte**, mesmo com o relatório todo em zero. O critério 6 vale sobre o canônico, nunca sobre o
   texto cru do acervo, e o critério 27 fala de contadores do relatório, não de identidade textual.
   Quem comparar textos crus com canônicos vai perseguir uma quebra de linha.
3. **`matrix` junto de `translation` é proibido pelo glTF 2.0**, e escrever a translação por cima
   daria um arquivo em que o carregador honra a matriz e o deslocamento **some sem erro nenhum**.
   Recusa acrescentada em `deslocarModelo3d`, não pedida pela spec.
4. **Documento sem cena padrão** entraria na junção com nós que existem no arquivo e não aparecem
   na tela. Recusa acrescentada em `juntarModelos3d`, é o BUG-001 um nível abaixo do critério 14.
5. **O validador da Khronos roda sob jsdom**, mas isso precisou de canário: um teste que corrompe o
   modelo e exige reprovação. Sem ele, o critério 9 poderia ficar verde julgando nada.
6. **A tela nova não exigiu uma linha de mudança em `PalcoDeModelo3d`**, o que confirma a decisão
   D1 na prática: um calçado montado é só um modelo com N zonas, que é o que ele já recebia.

### Ressalva aberta

Nenhuma. Restam os 5 itens da §8, que são do dono e não têm substituto em teste.
