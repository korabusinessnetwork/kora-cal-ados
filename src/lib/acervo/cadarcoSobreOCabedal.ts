// O cadarço assentado no cabedal: onde ele fica na forma, e a malha dele com a base em Y = 0.
//
// Separado de `geometriaDeCadarco.ts` porque são duas perguntas diferentes. A geometria sabe fazer
// uma fita que segue uma superfície qualquer; este arquivo sabe **qual** superfície (o cabedal
// baixo, no tamanho padrão, no lugar em que ele assenta) e converte o resultado para a regra do
// acervo: base em Y = 0 e a diferença guardada no assento.

import { alturaDaSuperficie } from './alturaDaSuperficie';
import { geometriaDeCadarco } from './geometriaDeCadarco';
import { malhaDePeca, transladarMalha, type MalhaCrua } from './malhaDePeca';
import type { ModeladorDePeca } from './montarGltfDePeca';

export interface EntradaDoCadarcoSobreOCabedal {
  /** A malha do cabedal em que o cadarço deita, no espaço dele (base em Y = 0). */
  cabedal: MalhaCrua;
  /** Onde o cabedal assenta na forma. */
  assentoDoCabedal: readonly [number, number, number];
  /** X na forma em que a borda de trás da primeira fileira fica. */
  inicio: number;
  /** As medidas do cadarço, as mesmas que a descrição da peça declara. */
  comprimento: number;
  largura: number;
  altura: number;
}

export interface CadarcoAssentado {
  assento: [number, number, number];
  modelar: ModeladorDePeca;
}

/**
 * O assento e o modelador do cadarço, calculados a partir do cabedal de verdade.
 *
 * O assento sai da geometria e não é digitado: a altura em que o cadarço começa é a altura do peito
 * do pé na fileira mais baixa, e um número escrito à mão ao lado dela divergiria no primeiro ajuste
 * do perfil do cabedal, com o cadarço flutuando ou enterrado sem teste nenhum dizer por quê.
 */
export function cadarcoSobreOCabedal(entrada: EntradaDoCadarcoSobreOCabedal): CadarcoAssentado {
  const centro = entrada.inicio + entrada.comprimento / 2;
  const [dx, dy, dz] = entrada.assentoDoCabedal;

  const noEspacoDaSuperficie = (medidas: { comprimento: number; largura: number; altura: number }): MalhaCrua =>
    geometriaDeCadarco({
      ...medidas,
      superficie: (x, z) => {
        const altura = alturaDaSuperficie(entrada.cabedal, x + centro - dx, z - dz);

        // Fileira passando da borda do cabedal é peça descrita errado. Deitar no chão em silêncio
        // deixaria a ponta do cadarço pendurada no ar, que é o que o critério 13 proíbe.
        if (altura === undefined) {
          throw new Error(`O cadarço passa da borda do cabedal em x = ${x + centro}, z = ${z}.`);
        }

        return altura + dy;
      },
    });

  const baseNaForma = menorAltura(noEspacoDaSuperficie(entrada));

  return {
    assento: [centro, baseNaForma, 0],
    modelar: (medidas) => {
      const crua = noEspacoDaSuperficie(medidas);

      return malhaDePeca(transladarMalha(crua, [0, -menorAltura(crua), 0]));
    },
  };
}

function menorAltura({ posicoes }: MalhaCrua): number {
  let menor = Number.POSITIVE_INFINITY;

  for (let indice = 1; indice < posicoes.length; indice += 3) menor = Math.min(menor, posicoes[indice] ?? menor);

  return menor;
}
