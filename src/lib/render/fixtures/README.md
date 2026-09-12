# render/fixtures, o material de prova do motor

Dois arquivos, usados pelos testes de [`../`](../) e por nada em produção.

| Arquivo | Para que serve |
|---|---|
| [`gltfDeTeste.ts`](gltfDeTeste.ts) | Constrói um glTF mínimo a partir de uma descrição curta ("dois nós apontam para a mesma malha"), em vez de cada teste carregar 40 linhas de `bufferViews` e `accessors` irrelevantes |
| [`teste-zona.svg`](teste-zona.svg) | Um calçado de duas zonas, `zona-cabedal` e `zona-sola`, com a sola desenhada por cima, para o recolor de SVG ter um alvo estável |

## O detalhe do glTF que é asserção disfarçada

Todas as primitivas do construtor apontam para o **mesmo** accessor, de propósito. É isso que torna
verificável a promessa de que duplicar malha não copia geometria: se `accessors` crescer, o teste
vê. Trocar por accessors independentes "para ficar mais realista" apagaria a prova sem quebrar
teste nenhum, que é o tipo de mudança que este parágrafo existe para impedir.

## Por que o SVG é arquivo e não string no teste

Porque o motor lê SVG de fora em produção também, e um SVG commitado é a forma de o teste passar
pelo mesmo `parse` do caminho real. O arquivo é pequeno e legível de propósito: quem precisar
entender uma falha de recolor abre ele e vê as duas zonas.

`montarGltfDePeca.ts`, em [`../../acervo/`](../../acervo/), NÃO reusa o construtor daqui, e o
comentário no topo dele diz por quê: aquele monta peça de verdade, com geometria, e este monta
documento mínimo para provar regra de estrutura. Juntar os dois faria o de produção carregar as
concessões do de teste.
