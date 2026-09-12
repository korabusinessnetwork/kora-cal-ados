// O rodapé de navegação entre as telas. Um só, usado pelas quatro.
//
// Ele não decide nada: quem decide para onde cada tela leva e com que palavras é
// `saidasDaTela.ts`, que é puro e tem teste. Aqui só entra o JSX, que é a parte que nenhum teste
// deste projeto alcança sem montar React, e por isso é a parte que tem de ser burra.
//
// Existia como quatro trechos de JSX escritos à mão dentro do `App.tsx`, e foi assim que o esboço
// acabou com uma saída enquanto as outras três telas tinham três.

import type { Tela } from './telaInicial';
import { ROTULO_DA_SAIDA, saidasDe } from './saidasDaTela';

interface Props {
  /** A tela aberta. Ela não aparece no próprio rodapé. */
  atual: Tela;
  irPara: (destino: Tela) => void;
}

export function RodapeDeTelas({ atual, irPara }: Props) {
  return (
    <p className="rodape-telas">
      {saidasDe(atual).map((destino) => (
        <button key={destino} type="button" onClick={() => irPara(destino)}>
          {ROTULO_DA_SAIDA[destino]}
        </button>
      ))}
    </p>
  );
}
