# src/lib/copia — levar texto da tela para a área de transferência

O que vive aqui: a mecânica de copiar, que é a mesma em qualquer tela. Nada de frase de interface
(isso fica na tela que a diz) e nada de JSX.

| Arquivo | O que resolve |
|---|---|
| `useCopiaDeTexto.ts` | Copia um texto e devolve o estado da tentativa, inclusive a falha |

Por que existe esta pasta: o botão de copiar nasceu dentro de `TelaDaComposicao.tsx`, e quando o
esboço precisou do mesmo botão havia duas saídas, copiar o trecho ou subi-lo. A regra de dependência
de `src/features/README.md` decide: o que passa a ser usado por mais de um lugar sobe para
`src/lib/`. Copiado, as duas telas divergiriam no primeiro dia em que uma aprendesse algo que a
outra não aprendeu, e a coisa que este hook sabe e que é fácil esquecer é justamente a que ninguém
testa à mão: **que a área de transferência pode ser negada, e que sumir em silêncio faz a pessoa
colar outra coisa achando que colou a certa**.

O hook devolve estado, não mensagem, de propósito. "Composição copiada" e "Chamada copiada" são
frases sobre coisas diferentes; centralizá-las obrigaria a inventar uma frase genérica que não
serviria bem a nenhuma das duas.
