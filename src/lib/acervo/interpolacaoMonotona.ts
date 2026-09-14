// Uma curva suave que passa pelos pontos dados e **não inventa ondulação entre eles**.
//
// É o método de Fritsch e Carlson (1980), o mesmo que o `pchip` do MATLAB e do SciPy. Ele existe
// aqui por um motivo muito concreto do acervo: os perfis do calçado (a meia largura do contorno
// do pé ao longo do comprimento, a altura do teto do cabedal) são descritos por meia dúzia de
// pontos de controle, e as estações da malha caem entre eles.
//
// Por que não interpolação linear: o contorno sairia poligonal, com um vinco visível em cada
// ponto de controle, e a sola pareceria lapidada.
//
// Por que não Catmull-Rom ou uma spline cúbica comum: as duas passam do valor dos pontos quando
// a sequência muda de direção. No contorno isso criaria uma barriga onde a cintura deveria
// afinar; na altura do cabedal, um pico acima do ponto mais alto, e o ponto mais alto do cabedal
// **é** a altura declarada da peça. Passar dela em meio milímetro quebraria a igualdade entre
// altura modelada e altura declarada, que é critério de aceite.
//
// O preço é a derivada: nos pontos de controle onde a sequência vira, a inclinação é zerada, e a
// curva chega neles horizontal. Para perfil de calçado isso é aparência boa, não defeito.

/**
 * Devolve a função que avalia a curva. Fora da faixa dos pontos, a curva é constante e igual ao
 * extremo mais próximo: nenhum perfil deste acervo é avaliado fora da faixa, e extrapolar cúbica
 * seria a forma mais rápida de inventar uma largura negativa sem ninguém notar.
 */
export function interpolacaoMonotona(
  pontos: readonly (readonly [number, number])[],
): (x: number) => number {
  const quantidade = pontos.length;

  if (quantidade < 2) {
    throw new Error('interpolacaoMonotona precisa de pelo menos 2 pontos de controle.');
  }

  const xs = pontos.map(([x]) => x);
  const ys = pontos.map(([, y]) => y);

  for (let indice = 1; indice < quantidade; indice += 1) {
    if ((xs[indice] ?? 0) <= (xs[indice - 1] ?? 0)) {
      throw new Error(
        `interpolacaoMonotona exige x estritamente crescente, e o ponto ${indice} tem x igual ou menor que o anterior.`,
      );
    }
  }

  const larguras: number[] = [];
  const inclinacoes: number[] = [];

  for (let intervalo = 0; intervalo < quantidade - 1; intervalo += 1) {
    const largura = (xs[intervalo + 1] ?? 0) - (xs[intervalo] ?? 0);

    larguras.push(largura);
    inclinacoes.push(((ys[intervalo + 1] ?? 0) - (ys[intervalo] ?? 0)) / largura);
  }

  const derivadas = derivadasDeFritschCarlson(larguras, inclinacoes);

  return (x: number): number => {
    if (x <= (xs[0] ?? 0)) return ys[0] ?? 0;
    if (x >= (xs[quantidade - 1] ?? 0)) return ys[quantidade - 1] ?? 0;

    let intervalo = 0;
    while (intervalo < quantidade - 2 && x >= (xs[intervalo + 1] ?? 0)) intervalo += 1;

    const largura = larguras[intervalo] ?? 1;
    const t = (x - (xs[intervalo] ?? 0)) / largura;
    const tAoQuadrado = t * t;
    const tAoCubo = tAoQuadrado * t;

    // Base de Hermite: os dois primeiros pesos levam os valores, os dois últimos as derivadas.
    return (
      (ys[intervalo] ?? 0) * (2 * tAoCubo - 3 * tAoQuadrado + 1) +
      largura * (derivadas[intervalo] ?? 0) * (tAoCubo - 2 * tAoQuadrado + t) +
      (ys[intervalo + 1] ?? 0) * (-2 * tAoCubo + 3 * tAoQuadrado) +
      largura * (derivadas[intervalo + 1] ?? 0) * (tAoCubo - tAoQuadrado)
    );
  };
}

/**
 * A inclinação em cada ponto de controle, escolhida para a curva não passar do valor dos pontos.
 *
 * A regra de Fritsch e Carlson tem duas metades. Quando a sequência **vira** no ponto (a
 * inclinação antes e depois têm sinais opostos, ou uma delas é zero), a curva recebe inclinação
 * zero ali: é o que faz o ponto ser o extremo local de verdade, e não o começo de um pico.
 * Quando a sequência **segue** na mesma direção, a inclinação é a média harmônica ponderada das
 * duas vizinhas, que é sempre menor que o triplo da menor delas, o limite acima do qual a cúbica
 * ondularia.
 */
function derivadasDeFritschCarlson(larguras: number[], inclinacoes: number[]): number[] {
  const quantidade = inclinacoes.length + 1;
  const derivadas: number[] = new Array<number>(quantidade).fill(0);

  derivadas[0] = inclinacoes[0] ?? 0;
  derivadas[quantidade - 1] = inclinacoes[inclinacoes.length - 1] ?? 0;

  for (let ponto = 1; ponto < quantidade - 1; ponto += 1) {
    const anterior = inclinacoes[ponto - 1] ?? 0;
    const seguinte = inclinacoes[ponto] ?? 0;

    if (anterior * seguinte <= 0) {
      derivadas[ponto] = 0;
      continue;
    }

    const pesoDoAnterior = 2 * (larguras[ponto] ?? 0) + (larguras[ponto - 1] ?? 0);
    const pesoDoSeguinte = (larguras[ponto] ?? 0) + 2 * (larguras[ponto - 1] ?? 0);

    derivadas[ponto] =
      (pesoDoAnterior + pesoDoSeguinte) / (pesoDoAnterior / anterior + pesoDoSeguinte / seguinte);
  }

  return derivadas;
}
