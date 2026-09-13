// Os controles de parâmetro de uma peça na tela da composição: um por parâmetro que a peça declara.
//
// Existe como arquivo próprio por causa do R7-A58. A tela lia `peca?.parametros[0]` e desenhava um
// controle só, então o segundo parâmetro de qualquer peça ficava inalcançável, travado no padrão,
// sem nada na tela dizendo que ele existia. O acervo de prova de hoje só tem peças de um
// parâmetro, e é exatamente por isso que o defeito não aparecia: a tela não tem como receber um
// catálogo de teste, então só um componente separado deixa um teste montar uma peça de dois.
//
// Não decide nada sobre o valor guardado. Quem soma a mudança aos outros parâmetros é
// `mudarEscolhaDaTela`, que é pura e tem teste; este componente só avisa QUAL parâmetro mudou.

import type { ParametroDePeca } from '../lib/composicao/tiposDaComposicao';

const PASSOS_DO_PARAMETRO = 40;

interface ControlesDeParametroProps {
  categoria: string;
  parametros: readonly ParametroDePeca[];
  valores: Readonly<Record<string, number>> | undefined;
  aoMudar: (nome: string, valor: number) => void;
}

export function ControlesDeParametro({ categoria, parametros, valores, aoMudar }: ControlesDeParametroProps) {
  return (
    <>
      {parametros.map((parametro) => {
        const valor = valores?.[parametro.nome] ?? parametro.padrao;

        return (
          <label key={parametro.nome} className="palco3d__parametro">
            <span>
              {parametro.nome}: <strong>{milimetros(valor)}</strong>
            </span>
            <input
              type="range"
              className="palco3d__faixa"
              min={parametro.minimo}
              max={parametro.maximo}
              step={(parametro.maximo - parametro.minimo) / PASSOS_DO_PARAMETRO}
              value={valor}
              aria-label={`${parametro.nome} da zona ${categoria}`}
              onChange={(evento) => aoMudar(parametro.nome, Number(evento.target.value))}
            />
            {/* A faixa escrita, e não só o trilho do controle. Sem ela o número muda enquanto a
                pessoa arrasta e não há como saber se 18,0 mm é o começo, o meio ou o fim do que a
                peça aceita: o trilho mostra a POSIÇÃO, nunca os extremos. Quem confere "a espessura
                que escolhi é a espessura que vai sair" precisa dos dois números à vista, que é o
                princípio nº1 valendo para parâmetro do mesmo jeito que vale para cor.
                Mesmo texto e mesma ordem da tela `?tela=palco3d`: é o mesmo dado, e duas telas do
                palco escrevendo a mesma medida de jeitos diferentes é o começo de elas divergirem. */}
            <span className="palco3d__limites">
              faixa {milimetros(parametro.minimo)} a {milimetros(parametro.maximo)}
            </span>
          </label>
        );
      })}
    </>
  );
}

/** Metros viram milímetros na tela: 0,018 m não se lê, 18 mm sim. */
function milimetros(metros: number): string {
  return `${(metros * 1000).toFixed(1).replace('.', ',')} mm`;
}
