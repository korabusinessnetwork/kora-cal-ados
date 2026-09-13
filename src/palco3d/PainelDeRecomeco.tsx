// O caminho de volta ao calçado de prova, com desfazer (R8-A59).
//
// Existe por causa do R7-A57. Antes dele, recarregar a página ERA o jeito de recomeçar; depois dele a
// composição sobrevive ao F5, e nada na tela levava de volta ao padrão. O único caminho que sobrou
// era apagar os dados do site no navegador.
//
// Com desfazer, e não com confirmação. Uma caixa "tem certeza?" interrompe toda vez, inclusive
// quem tem certeza, e é respondida no automático. Desfazer não pergunta nada e deixa voltar atrás
// depois de ver o resultado, que é quando a pessoa sabe se queria mesmo.
//
// O foco é levado de propósito nos dois sentidos. Voltar ao padrão desabilita o próprio botão, e
// desabilitar o elemento focado joga o foco no `body` (conferido no navegador na reauditoria da
// rodada 8), então quem usa teclado perderia o lugar exatamente no gesto que pede desfazer. O foco
// vai para Desfazer, e de Desfazer volta para o botão de recomeço.

import { useEffect, useRef, useState } from 'react';

interface PainelDeRecomecoProps {
  /** A montagem em cena já é a do calçado de prova: recomeçar não mudaria nada. */
  ehPadrao: boolean;
  /** Existe uma montagem guardada para o Desfazer devolver. */
  podeDesfazer: boolean;
  aoVoltarAoPadrao: () => void;
  aoDesfazer: () => void;
}

export function PainelDeRecomeco({ ehPadrao, podeDesfazer, aoVoltarAoPadrao, aoDesfazer }: PainelDeRecomecoProps) {
  const botaoDeVoltar = useRef<HTMLButtonElement>(null);
  const botaoDeDesfazer = useRef<HTMLButtonElement>(null);
  const [ultimoGesto, setUltimoGesto] = useState<'voltou' | 'desfez' | null>(null);

  // Roda depois do render em que o botão de destino já existe e já está habilitado. Chamar `focus`
  // dentro do clique não serve: naquele instante o Desfazer ainda não foi desenhado.
  useEffect(() => {
    if (ultimoGesto === 'voltou') botaoDeDesfazer.current?.focus();
    if (ultimoGesto === 'desfez') botaoDeVoltar.current?.focus();
  }, [ultimoGesto, podeDesfazer]);

  return (
    <div className="palco3d__recomeco">
      <button
        ref={botaoDeVoltar}
        type="button"
        className="palco3d__copiar"
        disabled={ehPadrao}
        onClick={() => {
          aoVoltarAoPadrao();
          setUltimoGesto('voltou');
        }}
      >
        Voltar ao calçado de prova
      </button>
      {/* Região viva sempre presente e vazia na abertura: uma região que nasce junto com o texto
          nem sempre é anunciada. O botão Desfazer fica FORA dela, para o anúncio ser só a frase. */}
      <p className="palco3d__saida-ajuda" role="status" aria-atomic="true">
        {podeDesfazer ? 'Voltou ao calçado de prova. A montagem anterior pode ser desfeita.' : ''}
      </p>
      {podeDesfazer && (
        <button
          ref={botaoDeDesfazer}
          type="button"
          className="palco3d__desfazer"
          onClick={() => {
            aoDesfazer();
            setUltimoGesto('desfez');
          }}
        >
          Desfazer
        </button>
      )}
    </div>
  );
}
