# zonas/hooks, o editor de zonas por dentro

O `CLAUDE.md` manda a manipulação do SVG morar em hook, nunca misturada com componente de UI. É
este diretório. Cada hook tem teste ao lado.

| Hook | O que resolve |
|---|---|
| [`useZonasDoProduto.ts`](useZonasDoProduto.ts) | Carrega e salva as zonas do produto, com os quatro estados visíveis |
| [`useMarcacaoDeZona.ts`](useMarcacaoDeZona.ts) | O clique no SVG vira uma zona: qual elemento foi atingido e qual seletor o identifica |
| [`usePreviewDeCor.ts`](usePreviewDeCor.ts) | Pinta a zona no SVG que está na tela, para a pessoa ver a cor antes de salvar |

## A regra que o preview não pode furar

O preview usa **o mesmo motor de recolor** de [`../../../lib/render/`](../../../lib/render/), que é
o que a API usa do outro lado. Não existe uma segunda implementação "leve" para a tela: duas
implementações podem divergir, e divergir aqui é o único defeito que o princípio nº1 chama de
inegociável. Se o preview algum dia parecer lento, a saída é acelerar o motor, e não reescrevê-lo
em versão curta.

E o preview pinta uma cópia em memória. O asset-base não é tocado (ADR-005): o editor lê o
canônico e escreve só a lista de zonas, que é metadado, no banco.

## Falhar alto quando a zona é a errada

Marcação cuja zona não resolve para um alvo único é recusada em vez de aceita. É o princípio nº1 na
forma dura: zona ambígua faria a API recolorir o lugar errado sem avisar ninguém, e cor errada num
pedido de produção é prejuízo da marca cliente, não bug de tela.
