# src/lib/copia, levar texto da tela para a área de transferência

O que vive aqui: a mecânica de copiar, que é a mesma em qualquer tela, e o diagnóstico da falha,
que também é. Nada de JSX, e nada de frase que fale do que está sendo copiado.

| Arquivo | O que resolve |
|---|---|
| `useCopiaDeTexto.ts` | Copia um texto e devolve o estado da tentativa, inclusive a falha |

Quem usa: `src/palco3d/TelaDaComposicao.tsx` (botão "Copiar composição") e
`src/esboco/PainelDaApi.tsx` (botão "Copiar o corpo").

Por que existe esta pasta: o botão de copiar nasceu dentro de `TelaDaComposicao.tsx`, e quando o
esboço precisou do mesmo botão havia duas saídas, copiar o trecho ou subi-lo. A regra de dependência
de `src/features/README.md` decide: o que passa a ser usado por mais de um lugar sobe para
`src/lib/`. Copiado, as duas telas divergiriam no primeiro dia em que uma aprendesse algo que a
outra não aprendeu, e a coisa que este hook sabe e que é fácil esquecer é justamente a que ninguém
testa à mão: **que a área de transferência pode ser negada, e que sumir em silêncio faz a pessoa
colar outra coisa achando que colou a certa**.

O hook devolve estado, não mensagem, de propósito. "Composição copiada" e "Corpo copiado" são
frases sobre coisas diferentes; centralizá-las obrigaria a inventar uma frase genérica que não
serviria bem a nenhuma das duas.

A exceção é `AVISO_DE_COPIA_NEGADA`, que é a CAUSA da falha e não fala do que estava sendo
copiado: o navegador nega pelo mesmo motivo nas duas telas. Ela mora aqui; a instrução do que
fazer em seguida ("selecione o texto abaixo", "o corpo no bloco abaixo") fica na tela, porque
depende de onde o texto está naquela tela. A divisão é essa: causa aqui, instrução lá.
