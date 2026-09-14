// A altura da superfície de uma malha num ponto visto de cima.
//
// Existe para o cadarço deitar sobre o cabedal **como ele foi gravado**, triângulo por triângulo, e
// não sobre a curva que gerou o cabedal. As duas diferem em décimos de milímetro entre uma coluna e
// outra, e é essa diferença que decide se o cadarço encosta, flutua ou atravessa a peça de baixo.
// Conferir contra a malha é também o que o teste faz, então gerador e teste medem a mesma coisa.

import type { MalhaCrua } from './malhaDePeca';

/**
 * A maior altura em que a vertical por `(x, z)` cruza a malha, ou `undefined` se não cruza.
 *
 * A **maior**, porque o cabedal é uma casca: a vertical cruza a parede de fora e, na boca, pode
 * cruzar a de dentro também, e o que se vê de cima (onde algo deita) é sempre a de cima.
 *
 * Força bruta sobre todos os triângulos. O cabedal tem pouco mais de mil, e o cadarço pergunta umas
 * cem alturas: é ordem de cem mil contas, feitas uma vez por geração, e uma estrutura de busca
 * espacial seria código a mais para errar sem ganho que se meça.
 */
export function alturaDaSuperficie(malha: MalhaCrua, x: number, z: number): number | undefined {
  const { posicoes, indices } = malha;
  let maisAlta: number | undefined;

  for (let triangulo = 0; triangulo + 2 < indices.length; triangulo += 3) {
    const a = (indices[triangulo] ?? 0) * 3;
    const b = (indices[triangulo + 1] ?? 0) * 3;
    const c = (indices[triangulo + 2] ?? 0) * 3;

    const ax = posicoes[a] ?? 0;
    const az = posicoes[a + 2] ?? 0;
    const bx = posicoes[b] ?? 0;
    const bz = posicoes[b + 2] ?? 0;
    const cx = posicoes[c] ?? 0;
    const cz = posicoes[c + 2] ?? 0;

    // Coordenadas baricêntricas no plano XZ. Área zero é triângulo de pé (parede vertical vista de
    // cima), que a vertical não cruza num ponto só: fica de fora, e a parede ao lado responde.
    const area = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
    if (area === 0) continue;

    const pesoDeB = ((x - ax) * (cz - az) - (cx - ax) * (z - az)) / area;
    const pesoDeC = ((bx - ax) * (z - az) - (x - ax) * (bz - az)) / area;
    const pesoDeA = 1 - pesoDeB - pesoDeC;

    // Uma folga de 1e-9 nas bordas: o ponto que cai exatamente na aresta entre dois triângulos não
    // pode escapar dos dois por arredondamento.
    if (pesoDeA < -1e-9 || pesoDeB < -1e-9 || pesoDeC < -1e-9) continue;

    const altura =
      pesoDeA * (posicoes[a + 1] ?? 0) + pesoDeB * (posicoes[b + 1] ?? 0) + pesoDeC * (posicoes[c + 1] ?? 0);

    if (maisAlta === undefined || altura > maisAlta) maisAlta = altura;
  }

  return maisAlta;
}
