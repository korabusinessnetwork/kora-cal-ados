// A sola: a pegada do pé extrudada, com a lateral levemente barrigada e, quando pedido, cravos.
//
// Substitui a caixa que o acervo de prova usava para provar a esteira. A caixa cumpriu o papel
// dela (decisão do dono em 2026-09-10: geometria grosseira primeiro); o que ela não cumpre é o
// próximo: o dono não consegue julgar composição, cor ou parâmetro olhando uma pilha de tijolos.
//
// Continua tudo gerado por código, sem Blender e sem arquivo em disco, e continua valendo a
// regra do parâmetro: a altura aqui é a altura **modelada**, e o parâmetro de espessura escala o
// eixo Y do nó (ADR-008 D7). Por isso a base da sola fica em Y = 0: escalar em volta da origem
// faz a peça crescer para cima a partir de onde ela assenta.

import { contornoDoPe, dentroDoContorno, type EstacaoDoContorno } from './contornoDoPe';
import { extrusaoDoContorno, type NivelDoContorno } from './extrusaoDoContorno';
import { geometriaDeCaixa } from './geometriaDeCaixa';
import { arredondarParaFloat32, juntarMalhas, malhaDePeca, transladarMalha, type MalhaCrua, type MalhaDePeca } from './malhaDePeca';

export interface MedidasDaSola {
  /** Metros, eixo X. É a medida da caixa que a sola ocupa. */
  comprimento: number;
  /** Metros, eixo Z, no ponto mais largo. */
  largura: number;
  /** Metros, eixo Y, do chão ao topo. É o `padrao` do parâmetro de espessura. */
  altura: number;
  /**
   * Metros, a altura dos cravos sob a laje. Zero (o padrão) é sola lisa.
   *
   * A altura total continua sendo `altura`: os cravos ficam **entre o chão e a laje**, e a laje
   * é que fica mais fina. Sola tratorada não é sola comum com pedaços colados embaixo, senão
   * trocar de sola mudaria a altura do calçado sem ninguém ter pedido.
   */
  alturaDoCravo?: number;
}

/**
 * Quantos cortes transversais a sola tem. 29 deixa a biqueira redonda a olho nu no palco e a
 * malha com menos de mil vértices por peça, com folga enorme para os índices de 16 bits.
 */
const ESTACOES_DA_SOLA = 29;

/**
 * O quanto a pegada encolhe na base e no topo da lateral, em metros.
 *
 * É o que dá à sola o perfil de sola, com a barriga na altura média, em vez de o perfil de
 * caixa. Encolher a pegada inteira (comprimento e largura juntos) é uma aproximação do recuo
 * perpendicular de verdade: como o contorno é redondo em toda a volta, a diferença entre os dois
 * fica abaixo de meio milímetro, e a conta exata pediria deslocamento de polígono, que é uma
 * biblioteca inteira para ganhar nada que o olho veja.
 */
const BISEL = 0.004;

/** A altura da lateral em que cada nível fica, em fração da laje, e o quanto ele encolhe. */
const NIVEIS_DA_LATERAL: ReadonlyArray<{ fracao: number; recuo: number }> = [
  { fracao: 0, recuo: BISEL },
  { fracao: 0.3, recuo: 0 },
  { fracao: 0.75, recuo: BISEL * 0.25 },
  // O topo recua pouco de propósito: é nele que o cabedal assenta, e cada milímetro recuado aqui
  // é um milímetro a menos de sola em que a pegada do cabedal precisa caber.
  { fracao: 1, recuo: BISEL * 0.45 },
];

/** Medidas do cravo, em metros. Quadrado e simples: é relevo de sola, não desenho de marca. */
const CRAVO = {
  lado: 0.016,
  passoNoComprimento: 0.024,
  passoNaLargura: 0.022,
  /** O quanto o cravo precisa estar para dentro da borda da pegada para ser aceito. */
  margemDaBorda: 0.006,
  /** O quanto o cravo entra na laje, para as duas superfícies não brigarem pelo mesmo plano. */
  folgaNaLaje: 0.0015,
} as const;

/**
 * A sola pronta, com normais e extremos.
 *
 * A montagem é sempre a mesma: a laje é a extrusão da pegada entre o topo dos cravos e o topo da
 * sola, e os cravos são caixinhas encaixadas por baixo dela. Sola lisa é o mesmo código com zero
 * cravos, e não um segundo caminho.
 */
export function geometriaDeSola(medidas: MedidasDaSola): MalhaDePeca {
  const alturaDoCravo = medidas.alturaDoCravo ?? 0;
  const baseDaLaje = arredondarParaFloat32(alturaDoCravo);
  const alturaDaLaje = medidas.altura - alturaDoCravo;

  if (alturaDaLaje <= 0) {
    throw new Error(
      `A sola de ${medidas.altura} m não comporta cravos de ${alturaDoCravo} m: não sobraria laje.`,
    );
  }

  const niveis: NivelDoContorno[] = NIVEIS_DA_LATERAL.map(({ fracao, recuo }) => ({
    y: arredondarParaFloat32(baseDaLaje + fracao * alturaDaLaje),
    estacoes: contornoDoPe({
      comprimento: medidas.comprimento - 2 * recuo,
      largura: medidas.largura - 2 * recuo,
      estacoes: ESTACOES_DA_SOLA,
    }),
  }));

  const laje = extrusaoDoContorno(niveis);

  if (alturaDoCravo <= 0) return malhaDePeca(laje);

  return malhaDePeca(juntarMalhas([laje, ...cravosDaSola(medidas, alturaDoCravo)]));
}

/**
 * As caixinhas de relevo sob a laje, numa grade, e só onde a grade cabe dentro da pegada.
 *
 * O teste de "cabe" é feito nos quatro cantos do cravo contra a pegada encolhida pela margem, e
 * não no centro dele: cravo aceito pelo centro apareceria pela metade para fora da sola na
 * cintura do pé, que é justamente onde a pegada é mais estreita.
 *
 * As fileiras não passam pelo meio da sola (o primeiro Z é meio passo fora do zero). É como
 * solado de verdade se desenha, e evita a fileira única no eixo que faria a sola parecer ter uma
 * espinha.
 */
function cravosDaSola(medidas: MedidasDaSola, alturaDoCravo: number): MalhaCrua[] {
  const pegada = contornoDoPe({
    comprimento: medidas.comprimento - 2 * CRAVO.margemDaBorda,
    largura: medidas.largura - 2 * CRAVO.margemDaBorda,
    estacoes: ESTACOES_DA_SOLA,
  });

  const caixa = geometriaDeCaixa({
    comprimento: CRAVO.lado,
    altura: alturaDoCravo + CRAVO.folgaNaLaje,
    largura: CRAVO.lado,
  });

  const cravos: MalhaCrua[] = [];

  for (const x of grade(medidas.comprimento / 2, CRAVO.passoNoComprimento, 0)) {
    for (const z of grade(medidas.largura / 2, CRAVO.passoNaLargura, CRAVO.passoNaLargura / 2)) {
      if (!cabeNaPegada(pegada, x, z)) continue;

      cravos.push(transladarMalha(caixa, [x, 0, z]));
    }
  }

  return cravos;
}

/** Os centros de uma fileira, simétricos em volta do zero, sem passar do limite. */
function grade(limite: number, passo: number, deslocamentoInicial: number): number[] {
  const centros: number[] = [];

  for (let centro = deslocamentoInicial; centro <= limite; centro += passo) {
    centros.push(centro);
    if (centro > 0) centros.push(-centro);
  }

  return centros;
}

function cabeNaPegada(pegada: readonly EstacaoDoContorno[], x: number, z: number): boolean {
  const meioLado = CRAVO.lado / 2;

  return (
    dentroDoContorno(pegada, x - meioLado, z - meioLado) &&
    dentroDoContorno(pegada, x - meioLado, z + meioLado) &&
    dentroDoContorno(pegada, x + meioLado, z - meioLado) &&
    dentroDoContorno(pegada, x + meioLado, z + meioLado)
  );
}
