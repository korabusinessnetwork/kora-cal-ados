// A pegada do pé vira sólido: uma pilha de contornos, tampada em cima e embaixo.
//
// Cada nível é a mesma pegada num Y diferente, e pode ser um pouco menor que o vizinho. É assim
// que a lateral de uma sola ganha o bisel de baixo e a leve caída do topo sem nenhum caso
// especial: o construtor não sabe o que é bisel, ele só liga nível com nível.
//
// **Onde há quina, há vértice separado.** A tampa tem os vértices dela e a parede tem os dela,
// mesmo onde as duas se encostam. Sem isso, a normal do topo se misturaria com a da lateral e a
// borda da sola sairia derretida. Pelo mesmo motivo, dentro da parede os vértices **são**
// compartilhados entre níveis e entre estações vizinhas: ali a superfície é lisa de verdade.

import { juntarMalhas, type MalhaCrua } from './malhaDePeca';
import type { EstacaoDoContorno } from './contornoDoPe';

/** Uma pegada posta numa altura. A pilha delas, de baixo para cima, é o sólido. */
export interface NivelDoContorno {
  /** Metros, eixo Y. */
  y: number;
  estacoes: readonly EstacaoDoContorno[];
}

/**
 * O sólido fechado: tampa de baixo, parede e tampa de cima.
 *
 * Todos os níveis precisam ter a mesma contagem de estações, porque a parede liga a estação `i`
 * de um nível à estação `i` do nível de cima. Contagens diferentes ligariam o bico de um ao meio
 * do outro, e a peça sairia torcida em vez de reprovar.
 */
export function extrusaoDoContorno(niveis: readonly NivelDoContorno[]): MalhaCrua {
  const primeiro = niveis[0];
  const ultimo = niveis[niveis.length - 1];

  if (primeiro === undefined || ultimo === undefined || niveis.length < 2) {
    throw new Error('A extrusão do contorno precisa de pelo menos 2 níveis.');
  }

  for (const nivel of niveis) {
    if (nivel.estacoes.length !== primeiro.estacoes.length) {
      throw new Error(
        `Todos os níveis precisam da mesma contagem de estações. O primeiro tem ${primeiro.estacoes.length} e um outro tem ${nivel.estacoes.length}.`,
      );
    }
  }

  return juntarMalhas([
    tampaDoContorno(primeiro.estacoes, primeiro.y, false),
    paredeDosNiveis(niveis),
    tampaDoContorno(ultimo.estacoes, ultimo.y, true),
  ]);
}

/**
 * A tampa: a pegada preenchida num plano horizontal.
 *
 * A triangulação é uma faixa entre estações vizinhas, e não um leque a partir de um centro. Sai
 * de graça da forma como a pegada é descrita (cada estação já é o segmento que vai do lado de
 * dentro ao lado de fora), e é o que mantém os triângulos com proporção parecida ao longo da
 * peça inteira.
 *
 * Nas duas pontas a pegada tem largura zero, então ali a estação é **um vértice só** e um dos
 * dois triângulos da faixa não existe. Emiti-lo assim mesmo criaria um triângulo de área zero,
 * que não tem normal e que o olho não vê: defeito perfeito para passar despercebido.
 */
function tampaDoContorno(
  estacoes: readonly EstacaoDoContorno[],
  y: number,
  paraCima: boolean,
): MalhaCrua {
  const posicoes: number[] = [];
  const indices: number[] = [];
  const doLadoDeDentro: number[] = [];
  const doLadoDeFora: number[] = [];

  estacoes.forEach((estacao, ordem) => {
    const ponta = ordem === 0 || ordem === estacoes.length - 1;
    const proximo = posicoes.length / 3;

    if (ponta) {
      posicoes.push(estacao.x, y, 0);
      doLadoDeDentro.push(proximo);
      doLadoDeFora.push(proximo);
      return;
    }

    posicoes.push(estacao.x, y, -estacao.dentro, estacao.x, y, estacao.fora);
    doLadoDeDentro.push(proximo);
    doLadoDeFora.push(proximo + 1);
  });

  // A ordem `dentro, fora, fora seguinte` tem produto vetorial apontando para +Y quando X
  // cresce. É a regra inteira do sentido desta tampa; a de baixo é a mesma invertida.
  const emitir = (primeiro: number, segundo: number, terceiro: number): void => {
    if (paraCima) indices.push(primeiro, segundo, terceiro);
    else indices.push(primeiro, terceiro, segundo);
  };

  for (let ordem = 0; ordem + 1 < estacoes.length; ordem += 1) {
    const dentroAqui = doLadoDeDentro[ordem] ?? 0;
    const foraAqui = doLadoDeFora[ordem] ?? 0;
    const dentroAdiante = doLadoDeDentro[ordem + 1] ?? 0;
    const foraAdiante = doLadoDeFora[ordem + 1] ?? 0;

    if (dentroAqui !== foraAqui) emitir(dentroAqui, foraAqui, foraAdiante);
    if (dentroAdiante !== foraAdiante) emitir(dentroAqui, foraAdiante, dentroAdiante);
  }

  return { posicoes, indices };
}

/**
 * A parede: a faixa fechada que liga cada nível ao de cima.
 *
 * Os vértices são compartilhados entre níveis e entre pontos vizinhos do anel, então a normal de
 * cada um é a média dos quatro quadriláteros que o cercam. É o que deixa a lateral da sola
 * redonda no calcanhar e na biqueira, onde o anel vira depressa, sem nenhuma conta de suavização
 * à parte.
 */
function paredeDosNiveis(niveis: readonly NivelDoContorno[]): MalhaCrua {
  const posicoes: number[] = [];
  const indices: number[] = [];

  for (const nivel of niveis) {
    for (const [x, z] of anelDoContorno(nivel.estacoes)) posicoes.push(x, nivel.y, z);
  }

  const pontosDoAnel = posicoes.length / 3 / niveis.length;

  for (let nivel = 0; nivel + 1 < niveis.length; nivel += 1) {
    for (let ponto = 0; ponto < pontosDoAnel; ponto += 1) {
      const adiante = (ponto + 1) % pontosDoAnel;
      const baixoAqui = nivel * pontosDoAnel + ponto;
      const baixoAdiante = nivel * pontosDoAnel + adiante;
      const cimaAqui = (nivel + 1) * pontosDoAnel + ponto;
      const cimaAdiante = (nivel + 1) * pontosDoAnel + adiante;

      indices.push(baixoAqui, cimaAqui, cimaAdiante, baixoAqui, cimaAdiante, baixoAdiante);
    }
  }

  return { posicoes, indices };
}

/**
 * O anel fechado da pegada, em `x, z`: do calcanhar pelo lado de dentro até a biqueira, e de
 * volta pelo lado de fora.
 *
 * Esta ordem é o que faz a parede ficar virada para fora com a regra de sentido usada em
 * `paredeDosNiveis`. Inverter a lista aqui viraria o sólido do avesso, e no navegador ele
 * sumiria (o renderizador descarta a face de trás), que é o sintoma mais confuso que uma malha
 * pode ter.
 *
 * As pontas entram uma vez só, porque ali os dois lados se encontram no mesmo ponto.
 */
export function anelDoContorno(estacoes: readonly EstacaoDoContorno[]): Array<[number, number]> {
  const anel: Array<[number, number]> = [];
  const ultima = estacoes.length - 1;

  anel.push([estacoes[0]?.x ?? 0, 0]);

  for (let ordem = 1; ordem < ultima; ordem += 1) {
    anel.push([estacoes[ordem]?.x ?? 0, -(estacoes[ordem]?.dentro ?? 0)]);
  }

  anel.push([estacoes[ultima]?.x ?? 0, 0]);

  for (let ordem = ultima - 1; ordem >= 1; ordem -= 1) {
    anel.push([estacoes[ordem]?.x ?? 0, estacoes[ordem]?.fora ?? 0]);
  }

  return anel;
}
