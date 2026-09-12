// Copiar um texto para a área de transferência, com o resultado à vista.
//
// A regra é curta e as três decisões dentro dela é que importam:
//
// 1. FALHA É VISÍVEL. A área de transferência é negada fora de HTTPS, em aba sem foco e por
//    permissão do navegador. Sumir em silêncio seria pior que não ter o botão: a pessoa colaria o
//    que estivesse na área de transferência antes e acharia que era o texto daqui. Por isso
//    `falhou` é um estado, e não um `console.error`.
//
// 2. O AVISO DE "COPIADA" MORRE QUANDO O TEXTO MUDA. Senão ele passa a falar de um texto que não
//    está mais na tela, o que é a mesma classe de mentira do item 1, só que mais difícil de notar.
//    O descarte acontece no RENDER, e não num `useEffect`, pelo mesmo motivo de
//    `usePreviewDeCor.ts`: com efeito existiria um render mostrando "copiada" sobre o texto novo.
//
// 3. QUEM ESCREVE A FRASE É A TELA, MENOS O DIAGNÓSTICO DA FALHA. O hook devolve o estado, não a
//    mensagem: "Composição copiada" e "Corpo copiado" são frases diferentes sobre coisas
//    diferentes, e centralizá-las aqui obrigaria a inventar uma genérica que não serve bem a
//    nenhuma das duas. A CAUSA da falha, porém, não é sobre o que está sendo copiado, é sobre o
//    navegador, e é a mesma em qualquer tela: essa metade mora aqui, em `AVISO_DE_COPIA_NEGADA`.
//    Cada tela acrescenta a instrução, que aí sim depende de onde o texto está na tela dela.
//
// Por que virou `src/lib/`: isto nasceu dentro de `TelaDaComposicao.tsx` e o esboço precisou do
// mesmo botão. Pela regra de dependência de `src/features/README.md`, o que passa a ser usado por
// mais de um lugar sobe, em vez de ser copiado. Copiado, as duas telas divergiriam no primeiro dia
// em que uma das duas aprendesse algo que a outra não aprendeu.

import { useCallback, useState } from 'react';

/** Estado do botão de copiar. `falhou` é visível de propósito: cópia silenciosa engana. */
export type EstadoDaCopia = 'pronta' | 'copiada' | 'falhou';

/**
 * A CAUSA da falha, sem a instrução do que fazer.
 *
 * Está aqui, e não em cada tela, porque é a metade que não depende do que está sendo copiado: o
 * navegador nega pelo mesmo motivo nos dois botões. Duas cópias desta frase divergiriam no
 * primeiro dia em que alguém melhorasse uma delas. A instrução ("selecione o texto abaixo", "o
 * corpo no bloco abaixo") fica na tela, porque aí sim depende de onde o texto está.
 */
export const AVISO_DE_COPIA_NEGADA =
  'O navegador não deixou copiar (acontece fora de HTTPS ou sem permissão).';

export interface CopiaDeTexto {
  estado: EstadoDaCopia;
  /** Dispara a cópia. Não devolve promessa: quem chama é um `onClick`, que não espera nada. */
  copiar(): void;
}

/**
 * `texto` é o que vai para a área de transferência e é também a chave do descarte: mudou o texto,
 * o aviso volta para `pronta`.
 */
export function useCopiaDeTexto(texto: string): CopiaDeTexto {
  const [estado, setEstado] = useState<EstadoDaCopia>('pronta');
  const [textoDoAviso, setTextoDoAviso] = useState(texto);

  // Reset no próprio render, não em `useEffect`. Ver o item 2 do cabeçalho.
  const trocouDeTexto = textoDoAviso !== texto;
  if (trocouDeTexto) {
    setTextoDoAviso(texto);
    setEstado('pronta');
  }

  const copiar = useCallback(() => {
    // `void` no lugar de `await`: o `onClick` não tem o que fazer com a promessa, e o resultado
    // chega pelo estado, que é o que a tela lê.
    void (async () => {
      try {
        await navigator.clipboard.writeText(texto);
        setEstado('copiada');
      } catch {
        setEstado('falhou');
      }
    })();
  }, [texto]);

  return { estado: trocouDeTexto ? 'pronta' : estado, copiar };
}
