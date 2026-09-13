// O caminho de volta da composição: colar um JSON e montá-lo, ou dizer por que não.
//
// Saiu de `TelaDaComposicao.tsx` no R7-A54, e levou junto o texto colado e o desfecho da colagem,
// que só este painel usa. O que ele NÃO guarda são as escolhas: a colagem aceita sobe por
// `aoAceitar`, e a recusada não sobe nada, que é o que garante que colar errado não encosta no
// calçado que está na tela.

import { useState } from 'react';

import type { CatalogoDoAcervo, Forma } from '../lib/composicao/tiposDaComposicao';
import { escolhasDoTextoColado, type EscolhaDaTela } from './composicaoDaTela';

/**
 * O desfecho da última colagem, que é o que a região viva do painel anuncia.
 *
 * União marcada, e não um `string | null` de erro, porque os dois desfechos precisam de anúncios
 * com PRIORIDADES diferentes, `alert` para a recusa e `status` para o aceite, e "erro é `null`"
 * não distingue "deu certo" de "ainda não tentou".
 */
type ResultadoDaColagem = { tipo: 'recusada'; motivo: string } | { tipo: 'aceita' };

interface PainelDeColarProps {
  forma: Forma;
  catalogo: CatalogoDoAcervo;
  /** Só é chamado com uma composição que passou pelo guarda. */
  aoAceitar: (escolhas: Map<string, EscolhaDaTela>) => void;
}

export function PainelDeColar({ forma, catalogo, aoAceitar }: PainelDeColarProps) {
  // O texto colado e o diagnóstico dele. Separados das `escolhas` porque uma colagem recusada não
  // pode encostar no calçado que está na tela: a pessoa perderia a montagem boa por ter colado
  // errado, que é o oposto do que este campo veio fazer.
  const [colado, setColado] = useState('');
  // `null` é "ainda não colou nada", que é diferente de "colou e deu certo": sem essa terceira
  // possibilidade, a região viva nasceria com texto dentro e seria anunciada na abertura da tela,
  // dizendo o desfecho de uma colagem que ninguém fez.
  const [resultadoDaColagem, setResultadoDaColagem] = useState<ResultadoDaColagem | null>(null);

  function montarOColado() {
    const colagem = escolhasDoTextoColado(colado, forma, catalogo);

    if (colagem.escolhas === null) {
      setResultadoDaColagem({ tipo: 'recusada', motivo: colagem.erro ?? 'Composição recusada.' });
      return;
    }

    setResultadoDaColagem({ tipo: 'aceita' });
    aoAceitar(colagem.escolhas);
  }

  return (
    <>
      {/* O caminho de volta, colado ao de ida de propósito: copiar sem colar resolvia metade
          do problema, e as duas metades do mesmo ciclo separadas na tela deixariam a segunda
          parecendo recurso avançado. */}
      <div className="palco3d__entrada">
        <label className="palco3d__entrada-rotulo" htmlFor="composicao-colada">
          Colar uma composição
        </label>
        <textarea
          id="composicao-colada"
          className="palco3d__entrada-texto"
          rows={4}
          spellCheck={false}
          placeholder='{"forma_id": "…", "pecas": [ … ]}'
          value={colado}
          onChange={(evento) => setColado(evento.target.value)}
        />
        <button type="button" className="palco3d__copiar" onClick={montarOColado}>
          Montar o que está colado
        </button>
        {/* Texto fixo, e por isso FORA de qualquer região viva. Ele não muda com nada que a
            pessoa faça, e anunciá-lo de novo a cada colagem seria ler em voz alta uma frase
            que continua igual. */}
        <p className="palco3d__saida-ajuda">
          Passa pelo mesmo guarda que a API usa. Recusa aqui é recusa lá.
        </p>
        {/* UMA região viva, e só uma, para o resultado da colagem.
            Antes eram duas, uma dentro da outra: uma `div` com `aria-live="polite"` envolvendo
            um `<p role="alert">`, e `role="alert"` já implica `aria-live="assertive"`. Região
            viva dentro de região viva não está prevista em lugar nenhum da especificação, e o
            que cada leitor de tela faz com isso é escolha dele: pode ler duas vezes, pode
            rebaixar o assertivo, pode ignorar o de fora. Nenhuma das três é o que se quis.
            O `role` muda com o desfecho, e essa é a decisão que importa: recusa interrompe,
            porque a pessoa precisa saber AGORA que o calçado na tela não é o que ela colou;
            aceite espera a vez, porque a mudança boa já aconteceu.
            O caso aceito precisa existir aqui porque quem não enxerga o palco não recebe
            notícia nenhuma da montagem nova: ela acontece dentro do canvas, em outro canto da
            tela. */}
        {resultadoDaColagem !== null &&
          (resultadoDaColagem.tipo === 'recusada' ? (
            <p className="palco3d__saida-erro" role="alert" aria-atomic="true">
              {resultadoDaColagem.motivo} O calçado na tela continua sendo o de antes.
            </p>
          ) : (
            <p className="palco3d__saida-ok" role="status" aria-atomic="true">
              Composição montada. O calçado na tela agora é o que você colou.
            </p>
          ))}
      </div>
    </>
  );
}
