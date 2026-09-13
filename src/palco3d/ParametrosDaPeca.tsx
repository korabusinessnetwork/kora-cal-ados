// Os parâmetros da peça isolada, na tela `?tela=palco3d`: um controle por parâmetro que a peça declara.
//
// Existe por causa do R8-A63, que é a outra metade do R7-A58. A tela da composição lia
// `peca?.parametros[0]` e o A58 consertou lá; esta tela tinha a mesma leitura, e numa peça de dois
// parâmetros o segundo não tinha controle e ficava travado no padrão. Nenhum teste reprovava porque
// o acervo de prova só tem peça de um parâmetro, e a tela não recebe catálogo de fora. Separado
// dela, um teste monta uma peça de dois.
//
// Não é `ControlesDeParametro`, e é de propósito: as duas telas desenham o mesmo dado com marcação
// diferente (aqui título, ajuda e medida em linhas próprias; lá um rótulo compacto por zona). Juntar
// as duas mudaria o HTML de uma delas, e o critério do item é que esta tela, com o acervo de prova,
// continue com o mesmo HTML.
//
// O que as duas dividem sem mudar marcação, a medida em milímetros e o passo do controle, mora em
// `medidaDoParametro.ts` (R9-A68).

import { Fragment } from 'react';

import type { ParametroDePeca } from '../lib/composicao/tiposDaComposicao';
import { milimetros, passoDoParametro } from './medidaDoParametro';

interface ParametrosDaPecaProps {
  parametros: readonly ParametroDePeca[];
  valores: Readonly<Record<string, number>>;
  aoMudar: (nome: string, valor: number) => void;
}

export function ParametrosDaPeca({ parametros, valores, aoMudar }: ParametrosDaPecaProps) {
  return (
    <>
      {parametros.map((parametro, indice) => {
        const valor = valorDoParametro(parametro, valores);

        return (
          <Fragment key={parametro.nome}>
            <h2 className="painel__titulo painel__titulo--espacado">{parametro.nome}</h2>
            {/* A explicação vale para todos os parâmetros e aparece uma vez só, no primeiro. */}
            {indice === 0 ? (
              <p className="painel__ajuda">
                O parâmetro é escala do nó, nunca malha nova (ADR-008 D7). Engrossar a peça faz ela
                crescer para cima, a partir de onde assenta.
              </p>
            ) : null}
            <input
              type="range"
              className="palco3d__faixa"
              min={parametro.minimo}
              max={parametro.maximo}
              step={passoDoParametro(parametro)}
              value={valor}
              aria-label={parametro.nome}
              onChange={(evento) => aoMudar(parametro.nome, Number(evento.target.value))}
            />
            <p className="palco3d__medida">
              <strong>{milimetros(valor)}</strong>
              <span>
                faixa {milimetros(parametro.minimo)} a {milimetros(parametro.maximo)}
              </span>
            </p>
          </Fragment>
        );
      })}
    </>
  );
}

/** O valor em vigor: o que o usuário mexeu, ou o padrão que a própria peça declara. */
export function valorDoParametro(parametro: ParametroDePeca, valores: Readonly<Record<string, number>>): number {
  return valores[parametro.nome] ?? parametro.padrao;
}

/**
 * Todos os parâmetros que a peça declara, cada um no valor em vigor. É o que vai para o glTF.
 *
 * Todos, e não só o primeiro: com `parametros[0]` o segundo parâmetro ficava fora do glTF, e a peça
 * saía no padrão dele sem nada na tela dizendo isso.
 */
export function valoresEmVigor(
  parametros: readonly ParametroDePeca[],
  valores: Readonly<Record<string, number>>,
): Record<string, number> {
  return Object.fromEntries(parametros.map((parametro) => [parametro.nome, valorDoParametro(parametro, valores)]));
}
