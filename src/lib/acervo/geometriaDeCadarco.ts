// O cadarço reto: fileiras paralelas que cruzam o peito do pé de um lado ao outro, deitadas nele.
//
// Cada fileira é uma fita de seção retangular. A face de baixo segue a superfície da peça de baixo
// ponto a ponto, e a de cima fica a uma espessura acima dela. É o que faz o cadarço acompanhar a
// curva do peito do pé nas duas direções: caindo para a biqueira ao longo do comprimento e caindo
// para os lados ao longo da largura.
//
// A malha sai **no espaço da superfície**: X centrado no cadarço, Y na altura absoluta da superfície.
// Quem assenta a peça (`cadarcoSobreOCabedal.ts`) é que desce a base para Y = 0 e guarda a diferença
// no assento, porque só ele sabe em que peça o cadarço deita.

import { arredondarParaFloat32, juntarMalhas, type MalhaCrua } from './malhaDePeca';

export interface MedidasDoCadarco {
  /** Metros, eixo X: da borda de trás da primeira fileira à borda da frente da última. */
  comprimento: number;
  /** Metros, eixo Z: de uma ponta das fileiras à outra. */
  largura: number;
  /** Metros: a espessura da fita, medida na vertical. É o `padrao` do parâmetro `espessura`. */
  altura: number;
  /** A altura da superfície em que o cadarço deita, em `(x, z)` no espaço do cadarço. */
  superficie: (x: number, z: number) => number;
}

/**
 * Cinco fileiras. A spec pede ao menos quatro (critério 14); cinco é o que um tênis de corrida tem
 * no trecho do peito do pé que é igual nos dois cabedais, e ainda deixa vão entre elas para o
 * cabedal aparecer.
 */
export const FILEIRAS_DO_CADARCO = 5;

/** A largura da fita no eixo do pé. Um cadarço chato de tênis tem de 5 a 8 mm. */
const LARGURA_DA_FITA = 0.006;

/**
 * Pedaços de cada fileira ao longo da largura: um a cada 2 mm numa fita de 5 cm. A face de baixo é
 * reta entre dois pontos, e mais pedaços é o que a deixa rente ao peito do pé em vez de cortar as
 * curvas por dentro.
 */
const PEDACOS_POR_FILEIRA = 24;

/**
 * Onde a altura da superfície é conferida dentro de cada pedaço, além das duas pontas dele.
 *
 * A superfície de baixo é uma malha, e ela dobra nas arestas dos triângulos. Quando uma dobra cai
 * no meio de um pedaço, a face reta da fita passa por baixo dela: medido, quase meio milímetro com
 * 24 pedaços, e mais pedaços só diminuem isso na proporção. Conferir dentro do pedaço e erguer as
 * duas pontas o que faltou é o que garante a fita por cima, sem depender de onde as dobras caem.
 */
const CONFERENCIAS_POR_PEDACO = 4;

/**
 * O quanto a face de baixo fica acima da superfície. Encostada exatamente, a fita e o cabedal
 * disputariam o mesmo pixel na borda de baixo (o piscar que o renderizador mostra quando duas faces
 * coincidem). Três décimos de milímetro somem na tela e ficam bem dentro do 1 mm do critério 13.
 */
export const FOLGA_DO_APOIO = 0.0003;

/**
 * A malha crua do cadarço. As normais ficam para `malhaDePeca`, depois de a peça ser assentada.
 *
 * Cada face da fita tem vértices próprios (decisão D3): a fita tem quina de verdade nas quatro
 * arestas, e vértices compartilhados arredondariam a luz nelas.
 */
export function geometriaDeCadarco(medidas: MedidasDoCadarco): MalhaCrua {
  const passo = (medidas.comprimento - LARGURA_DA_FITA) / (FILEIRAS_DO_CADARCO - 1);

  return juntarMalhas(
    Array.from({ length: FILEIRAS_DO_CADARCO }, (_, fileira) =>
      fita(medidas, -medidas.comprimento / 2 + LARGURA_DA_FITA / 2 + fileira * passo),
    ),
  );
}

type Ponto = readonly [number, number, number];

/**
 * Uma fileira, centrada em `xDaFileira`, como um sólido fechado de seis faces.
 *
 * Os pontos andam em Z crescente. Cada face é uma faixa entre duas linhas de pontos, e a ordem das
 * duas linhas decide para que lado a face olha: a normal é `+Z × (segunda - primeira)`. As quatro
 * chamadas abaixo escolhem a ordem que deixa cada face virada para fora da fita.
 */
function fita(medidas: MedidasDoCadarco, xDaFileira: number): MalhaCrua {
  const tras = xDaFileira - LARGURA_DA_FITA / 2;
  const frente = xDaFileira + LARGURA_DA_FITA / 2;

  const trasEmbaixo = apoiosDaBorda(medidas, tras);
  const frenteEmbaixo = apoiosDaBorda(medidas, frente);
  const acima = (linha: readonly Ponto[]): Ponto[] =>
    linha.map(([x, y, z]) => [x, y + medidas.altura, z] as const);
  const trasEmCima = acima(trasEmbaixo);
  const frenteEmCima = acima(frenteEmbaixo);

  return juntarMalhas([
    faixa(trasEmCima, frenteEmCima), // +Z × +X = +Y: a face de cima olha para cima
    faixa(frenteEmbaixo, trasEmbaixo), // +Z × -X = -Y: a de baixo olha para o cabedal
    faixa(frenteEmCima, frenteEmbaixo), // +Z × -Y = +X: a da frente olha para a biqueira
    faixa(trasEmbaixo, trasEmCima), // +Z × +Y = -X: a de trás olha para o calcanhar
    ponta([trasEmbaixo[0], frenteEmbaixo[0], frenteEmCima[0], trasEmCima[0]], -1),
    ponta(
      [
        trasEmbaixo[PEDACOS_POR_FILEIRA],
        frenteEmbaixo[PEDACOS_POR_FILEIRA],
        frenteEmCima[PEDACOS_POR_FILEIRA],
        trasEmCima[PEDACOS_POR_FILEIRA],
      ],
      1,
    ),
  ]);
}

/**
 * A linha de baixo de uma borda da fita, do lado de dentro ao lado de fora do pé, rente à superfície.
 *
 * Cada ponto sobe o que o pedaço de cada lado dele precisou: se a superfície passa acima da reta
 * entre dois pontos em alguma conferência, os dois sobem essa diferença, e a reta inteira fica acima.
 */
function apoiosDaBorda(medidas: MedidasDoCadarco, x: number): Ponto[] {
  const zEm = (posicao: number): number => -medidas.largura / 2 + (posicao / PEDACOS_POR_FILEIRA) * medidas.largura;
  const alturas = Array.from({ length: PEDACOS_POR_FILEIRA + 1 }, (_, pedaco) => medidas.superficie(x, zEm(pedaco)));

  const falta = Array.from({ length: PEDACOS_POR_FILEIRA }, (_, pedaco) => {
    let maior = 0;

    for (let conferencia = 1; conferencia < CONFERENCIAS_POR_PEDACO; conferencia += 1) {
      const fracao = conferencia / CONFERENCIAS_POR_PEDACO;
      const reta = (alturas[pedaco] ?? 0) * (1 - fracao) + (alturas[pedaco + 1] ?? 0) * fracao;

      maior = Math.max(maior, medidas.superficie(x, zEm(pedaco + fracao)) - reta);
    }

    return maior;
  });

  return alturas.map((altura, ponto) => {
    const subida = Math.max(falta[ponto - 1] ?? 0, falta[ponto] ?? 0);

    return [x, altura + subida + FOLGA_DO_APOIO, zEm(ponto)] as const;
  });
}

/** Uma faixa de quadriláteros entre duas linhas de pontos, dois triângulos por quadrilátero. */
function faixa(primeira: readonly Ponto[], segunda: readonly Ponto[]): MalhaCrua {
  const posicoes: number[] = [];
  const indices: number[] = [];

  for (const ponto of [...primeira, ...segunda]) posicoes.push(...ponto.map(arredondarParaFloat32));

  const pontos = primeira.length;

  for (let pedaco = 0; pedaco + 1 < pontos; pedaco += 1) {
    const a = pedaco;
    const b = pedaco + 1;
    const c = pontos + pedaco + 1;
    const d = pontos + pedaco;

    indices.push(a, b, c, a, c, d);
  }

  return { posicoes, indices };
}

/**
 * A tampa da ponta da fileira: trás embaixo, frente embaixo, frente em cima, trás em cima.
 *
 * Nessa ordem a normal é `+X × +Y = +Z`, que é a tampa da ponta de Z positivo (`lado` 1). A de Z
 * negativo percorre os mesmos cantos ao contrário.
 */
function ponta(cantos: ReadonlyArray<Ponto | undefined>, lado: -1 | 1): MalhaCrua {
  const posicoes = cantos.flatMap((canto) => (canto ?? [0, 0, 0]).map(arredondarParaFloat32));

  return { posicoes, indices: lado === 1 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2] };
}
