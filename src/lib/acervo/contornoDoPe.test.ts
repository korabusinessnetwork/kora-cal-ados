import { describe, expect, it } from 'vitest';

import { contornoDoPe, dentroDoContorno, meiaLarguraEm, type EstacaoDoContorno } from './contornoDoPe';

const COMPRIMENTO = 0.28;
const LARGURA = 0.1;
const PEGADA = contornoDoPe({ comprimento: COMPRIMENTO, largura: LARGURA, estacoes: 29 });

/** As duas meias larguras somadas, que é a largura da pegada naquele ponto. */
function larguraEm(x: number): number {
  const { fora, dentro } = meiaLarguraEm(PEGADA, x);

  return fora + dentro;
}

/** Pontos de leitura em X, com o nome anatômico de cada um. */
const CALCANHAR = -0.099;
const CINTURA = -0.016;
const PLANTA = 0.074;

describe('contornoDoPe', () => {
  it('entrega uma estação por corte pedido', () => {
    expect(contornoDoPe({ comprimento: 0.2, largura: 0.08, estacoes: 15 })).toHaveLength(15);
  });

  it('recusa menos de 3 estações, porque com 2 não há nada entre as pontas', () => {
    expect(() => contornoDoPe({ comprimento: 0.2, largura: 0.08, estacoes: 2 })).toThrow(/pelo menos 3/);
  });

  it('vai exatamente de um extremo do comprimento ao outro', () => {
    const primeira = PEGADA[0];
    const ultima = PEGADA[PEGADA.length - 1];

    expect(primeira?.x).toBeCloseTo(-COMPRIMENTO / 2, 6);
    expect(ultima?.x).toBeCloseTo(COMPRIMENTO / 2, 6);
  });

  it('as duas pontas têm largura ZERO exata, dos dois lados', () => {
    // Exata, e não "quase zero": é o que faz a ponta ser um vértice só na malha. Um resto de
    // arredondamento ali viraria um segundo vértice a nanômetros do primeiro, ou seja, um
    // triângulo de área praticamente zero, sem normal que se possa calcular.
    const primeira = PEGADA[0];
    const ultima = PEGADA[PEGADA.length - 1];

    expect(primeira?.fora).toBe(0);
    expect(primeira?.dentro).toBe(0);
    expect(ultima?.fora).toBe(0);
    expect(ultima?.dentro).toBe(0);
  });

  it('ocupa exatamente a largura pedida, de borda a borda', () => {
    const maiorFora = Math.max(...PEGADA.map(({ fora }) => fora));
    const maiorDentro = Math.max(...PEGADA.map(({ dentro }) => dentro));

    expect(maiorFora + maiorDentro).toBeCloseTo(LARGURA, 6);
  });

  it('é pegada de pé: a planta é mais larga que o calcanhar', () => {
    expect(larguraEm(PLANTA)).toBeGreaterThan(larguraEm(CALCANHAR) * 1.15);
  });

  it('é pegada de pé: a cintura afina em relação à planta', () => {
    expect(larguraEm(CINTURA)).toBeLessThan(larguraEm(PLANTA) * 0.9);
  });

  it('o arco fica do lado de dentro: é ele que recua na cintura, não o lado de fora', () => {
    // A assimetria entre os dois lados é o que separa uma pegada de pé de uma elipse. Sem ela o
    // calçado fica com cara de tamanco, e os dois pés parecem o mesmo pé.
    expect(meiaLarguraEm(PEGADA, CINTURA).dentro).toBeLessThan(meiaLarguraEm(PEGADA, CALCANHAR).dentro);
    expect(meiaLarguraEm(PEGADA, CINTURA).fora).toBeGreaterThan(meiaLarguraEm(PEGADA, CALCANHAR).fora);
  });

  it('o ponto mais largo fica na metade da frente, onde ficam as cabeças dos metatarsos', () => {
    const maisLarga = PEGADA.reduce((maior, estacao) =>
      estacao.fora + estacao.dentro > maior.fora + maior.dentro ? estacao : maior,
    );

    expect(maisLarga.x).toBeGreaterThan(0);
  });

  it('as estações são mais densas nas pontas que no meio', () => {
    // Espaçamento em cosseno. É onde a curva muda depressa: com passo uniforme, ou o meio da sola
    // carrega cortes que ninguém precisa, ou o bico vira um chanfro.
    const vaos = PEGADA.slice(1).map((estacao, ordem) => estacao.x - (PEGADA[ordem]?.x ?? 0));
    const primeiro = vaos[0] ?? 0;
    const doMeio = vaos[Math.floor(vaos.length / 2)] ?? 0;
    const ultimo = vaos[vaos.length - 1] ?? 0;

    expect(primeiro).toBeLessThan(doMeio / 2);
    expect(ultimo).toBeLessThan(doMeio / 2);
  });

  it('as pontas são arredondadas: a largura cai depressa, mas sem virar bico', () => {
    // Numa ponta em bico a largura cairia em linha reta até zero. Na superelipse ela segura a
    // maior parte da largura quase até o fim, e é isso que este teste fixa: a meio caminho da
    // biqueira ainda há mais da metade da largura daquele trecho.
    const bordaDaBiqueira = COMPRIMENTO / 2;
    const noMeioDaBiqueira = larguraEm(bordaDaBiqueira - 0.022);
    const antesDaBiqueira = larguraEm(bordaDaBiqueira - 0.045);

    expect(noMeioDaBiqueira).toBeGreaterThan(antesDaBiqueira * 0.5);
    expect(noMeioDaBiqueira).toBeLessThan(antesDaBiqueira);
  });

  it('a pegada menor é a mesma pegada, e cabe inteira dentro da maior', () => {
    // É o que sustenta a decisão D1: cabedal e sola saem da mesma função, e o cabedal não tem
    // como passar da borda da sola sem alguém ter mexido nas medidas de propósito.
    const menor = contornoDoPe({ comprimento: COMPRIMENTO - 0.01, largura: LARGURA - 0.01, estacoes: 29 });

    for (const estacao of menor) {
      expect(dentroDoContorno(PEGADA, estacao.x, estacao.fora)).toBe(true);
      expect(dentroDoContorno(PEGADA, estacao.x, -estacao.dentro)).toBe(true);
    }
  });
});

describe('meiaLarguraEm', () => {
  it('lê o valor cravado quando o X é o de uma estação', () => {
    const estacao = PEGADA[10] as EstacaoDoContorno;

    expect(meiaLarguraEm(PEGADA, estacao.x).fora).toBeCloseTo(estacao.fora, 9);
  });

  it('interpola em linha reta entre duas estações, que é como a malha é feita de verdade', () => {
    const anterior = PEGADA[10] as EstacaoDoContorno;
    const seguinte = PEGADA[11] as EstacaoDoContorno;
    const meio = (anterior.x + seguinte.x) / 2;

    expect(meiaLarguraEm(PEGADA, meio).fora).toBeCloseTo((anterior.fora + seguinte.fora) / 2, 9);
  });

  it('fora do comprimento da pegada, a largura é zero', () => {
    expect(meiaLarguraEm(PEGADA, COMPRIMENTO)).toEqual({ fora: 0, dentro: 0 });
    expect(meiaLarguraEm(PEGADA, -COMPRIMENTO)).toEqual({ fora: 0, dentro: 0 });
  });
});

describe('dentroDoContorno', () => {
  it('o eixo do pé está dentro', () => {
    expect(dentroDoContorno(PEGADA, 0, 0)).toBe(true);
  });

  it('um ponto ao lado da pegada está fora', () => {
    expect(dentroDoContorno(PEGADA, 0, LARGURA)).toBe(false);
  });

  it('um ponto além da biqueira está fora', () => {
    expect(dentroDoContorno(PEGADA, COMPRIMENTO, 0)).toBe(false);
  });

  it('a assimetria vale também aqui: o mesmo Z pode estar dentro de um lado e fora do outro', () => {
    const { fora, dentro } = meiaLarguraEm(PEGADA, CINTURA);
    const entreOsDois = (fora + dentro) / 2;

    expect(entreOsDois).toBeGreaterThan(dentro);
    expect(dentroDoContorno(PEGADA, CINTURA, entreOsDois)).toBe(true);
    expect(dentroDoContorno(PEGADA, CINTURA, -entreOsDois)).toBe(false);
  });
});
