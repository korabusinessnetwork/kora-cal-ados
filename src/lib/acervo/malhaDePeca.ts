// A malha de uma peça: as listas de números que `montarGltfDePeca` embrulha em buffer, e as
// quatro contas que toda geometria do acervo precisa fazer do mesmo jeito.
//
// Existe porque a partir da segunda geometria (a sola com contorno de pé) as mesmas contas
// apareceriam em cada arquivo, e duas cópias de uma conta de geometria não divergem alto: elas
// divergem em silêncio, na direção de uma normal ou na última casa de um `max`. As quatro:
//
// 1. arredondar para a precisão em que o número vai ser gravado (float32);
// 2. calcular a normal de cada vértice a partir dos triângulos de verdade;
// 3. tirar `min`/`max` das posições gravadas, e não das medidas pedidas;
// 4. juntar duas partes somando o deslocamento certo nos índices.

/** A malha antes de ganhar normais: só posições e triângulos. É o que os construtores produzem. */
export interface MalhaCrua {
  /** `x, y, z` por vértice, já em precisão de float32. */
  posicoes: number[];
  /** Três índices por triângulo, na ordem que deixa o triângulo virado para fora. */
  indices: number[];
}

/** A malha pronta para virar accessor: com normais e com os extremos que o glTF 2.0 exige. */
export interface MalhaDePeca extends MalhaCrua {
  /** Uma normal unitária por vértice, na mesma ordem das posições. */
  normais: number[];
  /** O canto mínimo das posições gravadas. Vira `accessors[POSITION].min`. */
  minimo: [number, number, number];
  maximo: [number, number, number];
}

/**
 * Força o número para a precisão em que ele vai ser gravado.
 *
 * O buffer do glTF guarda POSITION em float32; o JavaScript calcula em float64. Sem este
 * arredondamento, `minimo` e `maximo` sairiam do cálculo em float64 e o vértice sairia do
 * buffer em float32, e os dois discordariam na última casa. O validador da Khronos chama isso
 * de `ACCESSOR_MAX_MISMATCH` e é o primeiro erro que um gerador de glTF escrito à mão comete.
 *
 * Efeito colateral aceito: `0,28` vira `0.2800000011920929` no JSON. Ninguém lê este arquivo à
 * mão, e o número está certo, apenas escrito por extenso.
 */
export function arredondarParaFloat32(valor: number): number {
  return Math.fround(valor);
}

/**
 * A malha crua vira malha de peça: ganha normais calculadas e os extremos das posições.
 *
 * É o último passo de toda geometria do acervo, e é de propósito que ele seja o mesmo para
 * todas: normal digitada à mão erra em silêncio (a luz do palco fica do lado errado e ninguém
 * sabe dizer por quê), e `max` derivado da medida pedida em vez do vértice reprova no validador
 * assim que uma conta de meio-extente arredondar diferente.
 */
export function malhaDePeca(crua: MalhaCrua): MalhaDePeca {
  return {
    posicoes: crua.posicoes,
    indices: crua.indices,
    normais: normaisPorArea(crua),
    minimo: extremoDaMalha(crua.posicoes, Math.min),
    maximo: extremoDaMalha(crua.posicoes, Math.max),
  };
}

/**
 * A normal de cada vértice, como média das normais dos triângulos que o usam, ponderada pela área.
 *
 * O produto vetorial de dois lados do triângulo já tem comprimento igual ao dobro da área, então
 * somar o vetor **cru** (sem normalizar antes) pondera pela área de graça. A ponderação importa:
 * sem ela, um canto onde se encontram um triângulo enorme e dez fatias finas teria a normal
 * decidida pelas fatias, e a superfície ficaria com um vinco onde não há vinco.
 *
 * Quina de verdade se faz **separando vértices**, nunca escrevendo a normal na mão: dois
 * vértices na mesma posição, um por face, mantêm cada face com a sua normal. É assim que a borda
 * da tampa da sola continua sendo uma quina, e a lateral dela continua redonda.
 */
export function normaisPorArea({ posicoes, indices }: MalhaCrua): number[] {
  const acumulado = new Float64Array(posicoes.length);

  for (let triangulo = 0; triangulo + 2 < indices.length; triangulo += 3) {
    const a = (indices[triangulo] ?? 0) * 3;
    const b = (indices[triangulo + 1] ?? 0) * 3;
    const c = (indices[triangulo + 2] ?? 0) * 3;

    const primeiroX = (posicoes[b] ?? 0) - (posicoes[a] ?? 0);
    const primeiroY = (posicoes[b + 1] ?? 0) - (posicoes[a + 1] ?? 0);
    const primeiroZ = (posicoes[b + 2] ?? 0) - (posicoes[a + 2] ?? 0);
    const segundoX = (posicoes[c] ?? 0) - (posicoes[a] ?? 0);
    const segundoY = (posicoes[c + 1] ?? 0) - (posicoes[a + 1] ?? 0);
    const segundoZ = (posicoes[c + 2] ?? 0) - (posicoes[a + 2] ?? 0);

    const x = primeiroY * segundoZ - primeiroZ * segundoY;
    const y = primeiroZ * segundoX - primeiroX * segundoZ;
    const z = primeiroX * segundoY - primeiroY * segundoX;

    for (const vertice of [a, b, c]) {
      acumulado[vertice] = (acumulado[vertice] ?? 0) + x;
      acumulado[vertice + 1] = (acumulado[vertice + 1] ?? 0) + y;
      acumulado[vertice + 2] = (acumulado[vertice + 2] ?? 0) + z;
    }
  }

  const normais: number[] = [];

  for (let vertice = 0; vertice < posicoes.length; vertice += 3) {
    const x = acumulado[vertice] ?? 0;
    const y = acumulado[vertice + 1] ?? 0;
    const z = acumulado[vertice + 2] ?? 0;
    const comprimento = Math.sqrt(x * x + y * y + z * z);

    // Vértice sem triângulo nenhum (ou só com triângulos de área zero) não tem normal que se
    // possa calcular. Fica apontando para cima porque o glTF 2.0 exige NORMAL unitária e o
    // validador recusa o vetor nulo, e um vértice assim é invisível de qualquer jeito.
    if (comprimento === 0) {
      normais.push(0, 1, 0);
      continue;
    }

    normais.push(
      arredondarParaFloat32(x / comprimento),
      arredondarParaFloat32(y / comprimento),
      arredondarParaFloat32(z / comprimento),
    );
  }

  return normais;
}

/**
 * Junta partes numa malha só, somando em cada índice o deslocamento da parte.
 *
 * Nenhum vértice é soldado: duas partes que se encostam continuam com vértices próprios, e é
 * exatamente o que se quer. Soldar faria a normal atravessar a quina entre a tampa e a lateral,
 * e a sola ficaria com a borda derretida.
 */
export function juntarMalhas(partes: readonly MalhaCrua[]): MalhaCrua {
  const posicoes: number[] = [];
  const indices: number[] = [];

  for (const parte of partes) {
    const deslocamento = posicoes.length / 3;

    for (const valor of parte.posicoes) posicoes.push(valor);
    for (const indice of parte.indices) indices.push(indice + deslocamento);
  }

  return { posicoes, indices };
}

/** A mesma malha, movida no espaço. As posições voltam arredondadas, porque a soma sai de float64. */
export function transladarMalha(
  malha: MalhaCrua,
  deslocamento: readonly [number, number, number],
): MalhaCrua {
  return {
    posicoes: malha.posicoes.map((valor, indice) =>
      arredondarParaFloat32(valor + (deslocamento[indice % 3] ?? 0)),
    ),
    indices: [...malha.indices],
  };
}

/**
 * O canto mínimo ou máximo da nuvem de pontos, eixo a eixo.
 *
 * Percorre em laço em vez de `Math.min(...posicoes)`: espalhar um vetor de dezenas de milhares
 * de números como argumentos estoura a pilha, e uma sola com cravos já passa dos dez mil.
 */
function extremoDaMalha(
  posicoes: number[],
  escolher: (a: number, b: number) => number,
): [number, number, number] {
  const extremo: [number, number, number] = [
    posicoes[0] ?? 0,
    posicoes[1] ?? 0,
    posicoes[2] ?? 0,
  ];

  for (let indice = 0; indice < posicoes.length; indice += 3) {
    extremo[0] = escolher(extremo[0], posicoes[indice] ?? 0);
    extremo[1] = escolher(extremo[1], posicoes[indice + 1] ?? 0);
    extremo[2] = escolher(extremo[2], posicoes[indice + 2] ?? 0);
  }

  return extremo;
}
