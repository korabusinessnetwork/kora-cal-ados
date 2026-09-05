# src/features — o app por funcionalidade

Cada pasta aqui é uma funcionalidade fechada: componentes, hooks e o acesso ao banco que
só ela usa. O que é compartilhado por mais de uma feature sobe para `src/lib/`.

| Pasta | O que resolve |
|---|---|
| `sessao/` | Quem entrou e em qual marca (tenant ativo). Nada protegido renderiza sem as duas coisas |

Regra de dependência: feature pode importar de `src/lib/`, **nunca** de outra feature.
Se duas precisarem da mesma coisa, ela vira módulo em `src/lib/` — importar de vizinho
cria o acoplamento que faz mudar uma tela quebrar outra sem aviso.

Estilo fica em `<feature>.css`, separado do JSX (white-label — ver CLAUDE.md), e é
importado uma vez em `src/main.tsx`.
