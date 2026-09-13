// O caminho de ida da composição: copiar o JSON, e o texto à vista quando copiar é negado.
//
// Saiu de `TelaDaComposicao.tsx` no R7-A54. O estado da cópia não mora aqui, mora no hook, porque
// quem sabe quando o texto mudou é a tela, e é a mudança do texto que apaga o aviso.

import { AVISO_DE_COPIA_NEGADA, type CopiaDeTexto } from '../lib/copia/useCopiaDeTexto';

interface PainelDeSaidaProps {
  copia: CopiaDeTexto;
  /** O MESMO JSON que a API recebe, mostrado inteiro quando o navegador nega a cópia. */
  texto: string;
}

export function PainelDeSaida({ copia, texto }: PainelDeSaidaProps) {
  return (
    <>
      {/* A composição fica só neste navegador (`composicaoGuardada.ts`), não existe tabela
          para ela, então levá-la a outro lugar é por aqui. O que sai daqui é o MESMO JSON que
          a API recebe. */}
      <div className="palco3d__saida">
        <button type="button" className="palco3d__copiar" onClick={copia.copiar}>
          Copiar composição
        </button>
        <p className="palco3d__saida-ajuda" role="status">
          {copia.estado === 'copiada'
            ? 'Composição copiada. É o mesmo JSON que a API recebe.'
            : 'Leva o JSON desta montagem para onde você quiser, inclusive para a API.'}
        </p>
        {copia.estado === 'falhou' && (
          <>
            <p className="palco3d__saida-erro" role="alert">
              {AVISO_DE_COPIA_NEGADA} Selecione o texto abaixo e copie à mão.
            </p>
            <pre className="palco3d__saida-texto">{texto}</pre>
          </>
        )}
      </div>
    </>
  );
}
