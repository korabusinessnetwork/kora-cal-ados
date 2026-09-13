// O painel da peça clicada na tela da composição: o nó atingido, a zona dele, e o atalho para a
// cor daquela zona. Mais a lista das zonas do calçado em cena.
//
// Saiu de `TelaDaComposicao.tsx` no R7-A54. Recebe o que foi clicado e as zonas da montagem, e
// não o catálogo: a pergunta que ele responde é sobre a cena, não sobre o acervo.

import type { Zona3d } from '../lib/render/recolorirModelo3d';
import { idDoCampoDeCor } from './CampoDeCorDaCategoria';
import { zonaDaMalha } from './composicaoDaTela';

interface PainelDaPecaClicadaProps {
  /** O nome do nó atingido pelo clique, ou `null` quando nada foi clicado. */
  selecionada: string | null;
  zonas: readonly Zona3d[];
}

export function PainelDaPecaClicada({ selecionada, zonas }: PainelDaPecaClicadaProps) {
  // O outro lado do endereço da peça clicada. Sai das zonas da montagem EM CENA, e não do catálogo:
  // a pergunta não é "a que categoria esta peça serve", é "a peça que eu cliquei, nesta cena, é de
  // que zona". Malha fora de toda zona devolve `null`, e a tela diz isso em vez de inventar.
  const zonaClicada = zonaDaMalha(zonas, selecionada);

  return (
    <section className="painel palco3d__painel-inspecao">
      <h2 className="painel__titulo">Peça clicada</h2>
      <p className="painel__ajuda">
        O nome do nó é o id da peça (ADR-007 D4), e a zona que a API recolore é a categoria
        dela. São os dois lados do mesmo endereço.
      </p>
      {/* Mesma região viva da outra tela do palco, e pelo mesmo motivo: o clique é no
          canvas e a resposta aparece em outro canto.

          Os DOIS lados aparecem aqui desde o R6-A50. A frase de ajuda acima já prometia isso e
          a tela entregava um lado só, o do nó: a categoria, que é o lado que a API recolore e o
          único que tem controle de cor, ficava para a pessoa achar casando com o olho este id
          com a lista de zonas mais abaixo. Quem clica numa peça quer pintar aquela peça, e o
          caminho entre uma coisa e outra era a memória de quem estava olhando. */}
      <div aria-live="polite" aria-atomic="true">
        {selecionada === null ? (
          <p className="palco3d__vazio">Nada selecionado. Clique numa peça do calçado.</p>
        ) : (
          <dl className="palco3d__endereco">
            <dt>nó</dt>
            <dd>
              <code className="palco3d__nome">{selecionada}</code>
            </dd>
            <dt>zona</dt>
            <dd>
              {zonaClicada === null ? (
                // Falha alto e visível, em vez de uma categoria chutada: a malha clicada não
                // está em zona nenhuma desta montagem, então não existe cor para mexer nela.
                <span className="palco3d__sem-zona">
                  esta malha não está em nenhuma zona do calçado em cena
                </span>
              ) : (
                <>
                  <code className="palco3d__nome">{zonaClicada}</code>
                  <button
                    type="button"
                    className="palco3d__ir-para-cor"
                    onClick={() => focarACorDa(zonaClicada)}
                  >
                    mexer na cor desta zona
                  </button>
                </>
              )}
            </dd>
          </dl>
        )}
      </div>

      <h2 className="painel__titulo painel__titulo--espacado">Zonas do calçado</h2>
      <ul className="palco3d__zonas">
        {zonas.map(({ zone_key, malhas }) => (
          <li key={zone_key} className="palco3d__zona">
            <code>{zone_key}</code>
            <span>{malhas.join(', ')}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Leva o foco até o seletor de cor de uma zona.
 *
 * Mexe no DOM direto, que é a exceção nesta base e por isso está numa função com nome: o controle
 * de cor mora em outra coluna da tela, dentro de um componente que não é filho deste painel, e
 * levantar o foco por estado significaria um `ref` atravessando dois componentes para resolver o
 * que um id resolve. O id vem de `idDoCampoDeCor`, o mesmo que o campo usa.
 *
 * É foco, e não só rolagem: quem clicou na peça quer MEXER na cor, e foco é o que serve também a
 * quem navega por teclado. `scrollIntoView` é opcional na chamada porque jsdom não o implementa, e
 * um teste não pode cair por causa de um detalhe de apresentação.
 */
function focarACorDa(categoria: string): void {
  const campo = document.getElementById(idDoCampoDeCor(categoria));
  campo?.scrollIntoView?.({ block: 'nearest' });
  campo?.focus();
}
