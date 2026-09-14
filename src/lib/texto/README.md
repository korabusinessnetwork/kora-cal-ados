# src/lib/texto, frases que mais de uma tela escreve

O que vive aqui: texto de interface que **mais de uma tela precisa escrever igual**. Nada de
formatação de dado (isso fica junto do dado) e nada de JSX.

| Arquivo | O que resolve |
|---|---|
| `contarElementos.ts` | "N elementos", com o plural certo e o adjetivo flexionado junto |

Por que existe esta pasta: a contagem de elementos estava escrita em quatro telas, de três jeitos, e
a quarta ocorrência esquecia o plural. Regra de interface repetida em cada tela é regra que só vale
enquanto ninguém acrescenta a quinta tela.

O critério para um texto subir para cá é o mesmo de `src/lib/`: usado por mais de uma feature. Frase
que só uma tela diz continua na tela que a diz, perto de quem decide dizê-la.
