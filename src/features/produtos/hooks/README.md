# produtos/hooks, o carregamento da lista de produtos

Dois hooks, os dois com teste ao lado. O que mora aqui é o **carregamento**, não a tela: a
lista é componente burro que recebe o que estes devolvem, e é isso que a deixa testável como
função de props, sem rede.

| Hook | O que resolve |
|---|---|
| [`useProdutos.ts`](useProdutos.ts) | Lê os produtos do tenant ativo e devolve os quatro estados obrigatórios do `CLAUDE.md`: `carregando`, `erro`, `vazia`, `pronta` |
| [`useAssetBase.ts`](useAssetBase.ts) | Busca o SVG canônico do produto selecionado, que é o que o editor de zonas desenha por cima |

## A decisão que não pode ser desfeita sem quebrar a tela

`useProdutos` guarda estado, lista e erro **num objeto só**, etiquetado com a marca de onde a
leitura veio, e não em três `useState` separados. Em três, existe o instante em que o estado já é
de um tenant e a lista ainda é do anterior, e num produto white-label multi-tenant esse instante
mostra o produto de uma marca sob o nome de outra. O comentário no topo do arquivo diz isso.

`useAssetBase` é somente-leitura sobre o canônico (ADR-005): o editor **nunca** normaliza nem
regrava o asset-base, porque o SVG que a API recolore tem de ser o mesmo que o editor mostrou, e é
disso que vive o "cor no editor = cor na API".
