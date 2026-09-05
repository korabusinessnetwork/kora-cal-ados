# src/features — o app por funcionalidade

Cada pasta aqui é uma funcionalidade fechada: componentes, hooks e o acesso ao banco que
só ela usa. O que é compartilhado por mais de uma feature sobe para `src/lib/`.

| Pasta | O que resolve |
|---|---|
| `sessao/` | Quem entrou e em qual marca (tenant ativo). Nada protegido renderiza sem as duas coisas |
| `produtos/` | Listar os modelos do tenant e abrir um deles, baixando o asset-base canônico do Storage |
| `zonas/` | Marcar zona no calçado aberto e gravar em `product_zones` — o palco, o formulário e as regras que recusam mapeamento inválido |

Regra de dependência: feature importa de `src/lib/`, e de outra feature **só na direção
declarada abaixo**. Se duas precisarem da mesma coisa fora dessas setas, ela vira módulo em
`src/lib/` — importar de vizinho à vontade cria o acoplamento que faz mudar uma tela quebrar
outra sem aviso.

| Direção permitida | Por quê |
|---|---|
| `produtos/` → `zonas/` | Marcar zona só existe dentro de um modelo aberto: quem sabe qual produto está na tela e já tem o asset-base baixado é `produtos/`, e é ele que monta o palco |

A seta é de mão única e a volta é proibida: `zonas/` nunca importa de `produtos/`. Ela
recebe o SVG canônico e os ids por props, e por isso continua testável sem rede e sem
saber o que é um produto.

Estilo fica em `<feature>.css`, separado do JSX (white-label — ver CLAUDE.md), e é
importado uma vez em `src/main.tsx`.
