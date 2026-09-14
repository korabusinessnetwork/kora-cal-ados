// O cabedal: uma casca que sobe da borda do contorno do pé, arqueia por cima e deixa a boca aberta.
//
// É uma grade de estações por colunas. Cada estação é um arco que vai do lado de dentro, no chão,
// passa pela crista e desce ao lado de fora. Nas estações de trás da frente da boca o meio do arco
// não existe: é a boca, e o que sobra são as duas paredes que abraçam o calcanhar e o tornozelo.
//
// A casca é aberta embaixo (ela assenta sobre a sola, que fecha o calçado) e aberta na boca. Por
// isso o material dela é de dupla face (decisão D4 da spec `acervo-com-cara-de-tenis`): olhando
// pela boca se vê o lado de dentro da parede, que o renderizador descartaria.
//
// Continua valendo a regra do acervo: a base em Y = 0, a altura modelada igual ao `padrao` do
// parâmetro, e o parâmetro escala o eixo Y do nó (ADR-008 D7).

import { contornoDoPe } from './contornoDoPe';
import { arredondarParaFloat32, malhaDePeca, type MalhaDePeca } from './malhaDePeca';
import { cristasDoCabedal, TRANSICAO_DA_BOCA, type PerfilDoCano } from './perfilDoCabedal';

export interface MedidasDoCabedal {
  /** Metros, eixo X. */
  comprimento: number;
  /** Metros, eixo Z, a largura do contorno do pé na base. */
  largura: number;
  /** Metros, eixo Y, o ponto mais alto. É a altura fixa declarada da peça (cabedal não tem parâmetro). */
  altura: number;
  /** Metros. Igual em todo cabedal da forma, ver `perfilDoCabedal.ts`. */
  alturaDoPeito: number;
  cano: PerfilDoCano;
}

/** 33 estações: uma a mais que a sola seria pouco, e a biqueira do cabedal é a curva mais vista. */
const ESTACOES_DO_CABEDAL = 33;

/** Colunas de cada meio arco, da borda no chão até a crista. A crista é a coluna do meio. */
const COLUNAS_POR_LADO = 10;

/**
 * A última coluna que existe nas estações da boca. A borda da boca fica nela, a cerca de 72% da
 * meia largura do contorno: é uma abertura em que um tornozelo cabe, e ainda sobra parede para o
 * cabedal abraçar o calcanhar em vez de parecer uma banheira.
 *
 * De lado, a frente da boca aparece como um degrau acima da borda: a borda chega nela a cerca de
 * 85% da crista, e o arco da frente da boca sobe até a crista inteira. É de propósito, é o lugar em
 * que a língua de um tênis de verdade fica acima das laterais. Uma tentativa de fazer a borda subir
 * até a crista antes da frente da boca foi descartada em 2026-09-14: com as estações espaçadas em
 * cosseno, a última estação da boca fica 1,2 cm atrás da frente, e a subida só criava um V nela.
 */
const COLUNA_DA_BORDA_DA_BOCA = 7;

/**
 * O expoente da superelipse do arco. 2 seria um arco de circunferência, que faz o cabedal parecer
 * um túnel; 3 dá parede quase reta embaixo e teto mais cheio, que é a seção de um tênis.
 */
const EXPOENTE_DO_ARCO = 3;

/**
 * O quanto as colunas se juntam perto do chão. A parede sobe quase na vertical ali, e com colunas
 * igualmente espaçadas no ângulo a primeira faixa acima da sola ficaria alta e chapada.
 */
const DENSIDADE_PERTO_DO_CHAO = 1.5;

interface ColunaDoArco {
  /** -1 lado de dentro, 0 crista, +1 lado de fora. */
  lado: -1 | 0 | 1;
  /** Fração da meia largura, 1 na borda e 0 na crista. */
  lateral: number;
  /** Fração da crista, 0 no chão e 1 no topo. */
  subida: number;
}

/**
 * A malha do cabedal, com normais e extremos.
 *
 * As duas pontas (calcanhar e biqueira) têm largura zero, então ali a coluna `j` e a coluna
 * espelhada dela caem no mesmo ponto. Elas viram **o mesmo vértice**: dois vértices coincidentes
 * teriam normais diferentes e a ponta sairia com um vinco vertical que não existe no calçado.
 */
export function geometriaDeCabedal(medidas: MedidasDoCabedal): MalhaDePeca {
  const estacoes = contornoDoPe({
    comprimento: medidas.comprimento,
    largura: medidas.largura,
    estacoes: ESTACOES_DO_CABEDAL,
  });
  const arco = colunasDoArco();
  const ultimaColuna = arco.length - 1;
  const alcanceNaBoca = arco[COLUNA_DA_BORDA_DA_BOCA]?.subida ?? 1;

  const posicoesNoComprimento = estacoes.map(({ x }) => (x + medidas.comprimento / 2) / medidas.comprimento);
  const naBoca = posicoesNoComprimento.map((t) => t < TRANSICAO_DA_BOCA.inicio);
  const cristas = cristasDoCabedal({
    posicoes: posicoesNoComprimento,
    alcance: naBoca.map((aberta) => (aberta ? alcanceNaBoca : 1)),
    altura: medidas.altura,
    alturaDoPeito: medidas.alturaDoPeito,
    cano: medidas.cano,
  });

  const posicoes: number[] = [];
  const indiceDoVertice: number[][] = [];

  estacoes.forEach((estacao, ordem) => {
    const ponta = ordem === 0 || ordem === estacoes.length - 1;
    const linha: number[] = [];

    arco.forEach((coluna, j) => {
      if (naBoca[ordem] && j > COLUNA_DA_BORDA_DA_BOCA && j < ultimaColuna - COLUNA_DA_BORDA_DA_BOCA) {
        linha.push(-1);
        return;
      }

      if (ponta && j > COLUNAS_POR_LADO) {
        linha.push(linha[ultimaColuna - j] ?? -1);
        return;
      }

      const meiaLargura = coluna.lado < 0 ? -estacao.dentro : estacao.fora;
      linha.push(posicoes.length / 3);
      posicoes.push(
        estacao.x,
        arredondarParaFloat32((cristas[ordem] ?? 0) * coluna.subida),
        coluna.lado === 0 ? 0 : arredondarParaFloat32(meiaLargura * coluna.lateral),
      );
    });

    indiceDoVertice.push(linha);
  });

  return malhaDePeca({ posicoes, indices: triangulosDaGrade(indiceDoVertice) });
}

/**
 * Os triângulos entre cada estação e a seguinte, só onde os quatro cantos existem.
 *
 * A ordem `(j, j+1, j+1 adiante)` deixa o triângulo virado para fora: a coluna cresce do lado de
 * dentro para o de fora passando por cima, a estação cresce para a biqueira, e o produto vetorial
 * das duas direções nessa ordem (coluna, depois estação) aponta para longe do pé. Um triângulo cujos cantos caíram no mesmo
 * vértice (na ponta, onde as colunas se dobram) é pulado, porque não tem área nem normal.
 */
function triangulosDaGrade(indiceDoVertice: readonly (readonly number[])[]): number[] {
  const indices: number[] = [];

  const emitir = (a: number, b: number, c: number): void => {
    if (a === b || b === c || a === c) return;
    indices.push(a, b, c);
  };

  for (let estacao = 0; estacao + 1 < indiceDoVertice.length; estacao += 1) {
    const aqui = indiceDoVertice[estacao] ?? [];
    const adiante = indiceDoVertice[estacao + 1] ?? [];

    for (let j = 0; j + 1 < aqui.length; j += 1) {
      const a = aqui[j] ?? -1;
      const b = aqui[j + 1] ?? -1;
      const c = adiante[j + 1] ?? -1;
      const d = adiante[j] ?? -1;

      if (a < 0 || b < 0 || c < 0 || d < 0) continue;

      // A diagonal do quadrilátero é espelhada entre os dois lados do pé. Não é estética: na
      // biqueira as colunas do lado de fora se dobram sobre as do lado de dentro, e com a mesma
      // diagonal dos dois lados o primeiro quadrilátero do lado de fora vira um triângulo deitado
      // no eixo do pé, de pé e virado para o lado, dobrado para trás da superfície.
      if (j < COLUNAS_POR_LADO) {
        emitir(a, b, c);
        emitir(a, c, d);
      } else {
        emitir(a, b, d);
        emitir(b, c, d);
      }
    }
  }

  return indices;
}

/**
 * As colunas do arco, do chão do lado de dentro ao chão do lado de fora.
 *
 * O quarto de superelipse `(cos θ)^(2/n), (sin θ)^(2/n)` sai vertical do chão e chega horizontal na
 * crista, e o ângulo é espaçado com potência para juntar colunas onde a parede sobe depressa.
 */
function colunasDoArco(): ColunaDoArco[] {
  const colunas: ColunaDoArco[] = [];

  for (let j = 0; j <= 2 * COLUNAS_POR_LADO; j += 1) {
    const passo = j <= COLUNAS_POR_LADO ? j : 2 * COLUNAS_POR_LADO - j;
    const lado = j < COLUNAS_POR_LADO ? -1 : j > COLUNAS_POR_LADO ? 1 : 0;

    if (lado === 0) {
      // A crista escrita exata: `cos(π/2)` dá 6e-17 e não zero, e a raiz disso ainda deixaria a
      // crista a um trilionésimo de metro fora do eixo.
      colunas.push({ lado, lateral: 0, subida: 1 });
      continue;
    }

    const angulo = (Math.PI / 2) * (passo / COLUNAS_POR_LADO) ** DENSIDADE_PERTO_DO_CHAO;
    colunas.push({
      lado,
      lateral: Math.max(0, Math.cos(angulo)) ** (2 / EXPOENTE_DO_ARCO),
      subida: Math.sin(angulo) ** (2 / EXPOENTE_DO_ARCO),
    });
  }

  return colunas;
}
