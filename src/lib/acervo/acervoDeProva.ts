// O acervo de prova: 5 peças de uma forma só, em geometria grosseira, geradas por código.
//
// Existe por decisão do dono (2026-09-10): provar a esteira de ponta a ponta com combustível
// grosseiro antes de investir nas ~15 peças reais que o ADR-008 trata como gargalo. Não é o
// acervo do produto, é o acervo que permite construir T13, T14 e T15 sem esperar por modelagem.
//
// **Nenhum arquivo em disco.** O gerador é a fonte de verdade e o texto glTF sai sob demanda.
// Versionar os 5 arquivos criaria uma segunda fonte de verdade capaz de divergir do gerador, e
// o consumidor no navegador não perde nada: `GLTFLoader.parse(texto)` recebe o texto direto,
// que é a mesma chamada que o produto trazido usa depois de baixar o arquivo do Storage.
//
// Todas as medidas em metros, que é a unidade que o glTF 2.0 fixa. Um tênis 42 tem uns 0,28 m.

import { geometriaDeCabedal } from './geometriaDeCabedal';
import { geometriaDeSola } from './geometriaDeSola';
import { CANO_ALTO, CANO_BAIXO } from './perfilDoCabedal';
import { montarGltfDePeca, type DescricaoDaPecaDeProva } from './montarGltfDePeca';
import type { CatalogoDoAcervo, PecaDoAcervo } from '../composicao/tiposDaComposicao';

/** Uma forma só. Misturar formas é estado inválido (ADR-008 D4), e aqui não há com o que misturar. */
export const FORMA_DE_PROVA = 'prova-tenis-01';

/** A altura da sola padrão, e o degrau em que o cabedal assenta. Ver `assento` abaixo. */
const ALTURA_DA_SOLA = 0.018;

/**
 * A altura dos cravos da sola tratorada, em metros.
 *
 * Fica **dentro** da espessura da sola, não somada a ela: a tratorada de 30 mm tem 7 mm de cravo
 * e 23 mm de laje. Somar mudaria a altura do calçado ao trocar de sola sem ninguém ter pedido, e
 * faria a altura modelada deixar de bater com o padrão do parâmetro.
 */
const ALTURA_DO_CRAVO = 0.007;

/**
 * As medidas dos dois cabedais, escritas uma vez para os dois.
 *
 * Comprimento, largura e peito do pé **precisam** ser iguais nos dois cabedais: é o que faz o
 * trecho onde o cadarço deita ser idêntico (decisão D6 da spec `acervo-com-cara-de-tenis`). Uma
 * constante só impede que alguém ajuste um cabedal e esqueça o outro.
 *
 * A largura é menor que a da sola plana (0,1 m) com folga: o topo da sola recua um pouco por causa
 * do bisel, e o contorno do cabedal precisa caber inteiro dentro dele, estação por estação.
 */
const COMPRIMENTO_DO_CABEDAL = 0.26;
const LARGURA_DO_CABEDAL = 0.09;

/** A altura do peito do pé no começo dele, onde a boca termina. Ver `perfilDoCabedal.ts`. */
const ALTURA_DO_PEITO = 0.064;

/**
 * As 5 peças, e a razão de cada número.
 *
 * O `assento` é onde a peça repousa **na forma**, no tamanho em que ela foi modelada. Não é a
 * montagem: quando a composição escolher uma sola mais alta, o cabedal precisa subir junto, e
 * essa conta é de T14. Aqui cada peça sabe só o lugar dela no calçado padrão, que é exatamente
 * o que uma peça de acervo de verdade sabe (ela é modelada sobre a forma, e é isso que faz
 * "peça só combina com peça da mesma forma" ser verdade).
 */
const PECAS: readonly DescricaoDaPecaDeProva[] = [
  {
    id: 'prova-sola-plana',
    categoria: 'sola',
    rotulo: 'Sola plana',
    comprimento: 0.28,
    largura: 0.1,
    altura: { nome: 'espessura', minimo: 0.01, maximo: 0.04, padrao: ALTURA_DA_SOLA },
    assento: [0, 0, 0],
    modelar: geometriaDeSola,
  },
  {
    id: 'prova-sola-tratorada',
    categoria: 'sola',
    rotulo: 'Sola tratorada',
    comprimento: 0.28,
    // Mais larga que a plana de propósito: em T13 a diferença entre as duas solas precisa ser
    // visível a olho, senão trocar de peça no configurador não parece ter feito nada.
    largura: 0.108,
    altura: { nome: 'espessura', minimo: 0.015, maximo: 0.05, padrao: 0.03 },
    assento: [0, 0, 0],
    modelar: (medidas) => geometriaDeSola({ ...medidas, alturaDoCravo: ALTURA_DO_CRAVO }),
  },
  {
    id: 'prova-cabedal-baixo',
    categoria: 'cabedal',
    rotulo: 'Cabedal baixo',
    comprimento: COMPRIMENTO_DO_CABEDAL,
    largura: LARGURA_DO_CABEDAL,
    altura: { nome: 'altura-do-cano', minimo: 0.05, maximo: 0.12, padrao: 0.075 },
    assento: [0, ALTURA_DA_SOLA, 0],
    modelar: (medidas) => geometriaDeCabedal({ ...medidas, alturaDoPeito: ALTURA_DO_PEITO, cano: CANO_BAIXO }),
    materialDeDuplaFace: true,
  },
  {
    id: 'prova-cabedal-cano-alto',
    categoria: 'cabedal',
    rotulo: 'Cabedal cano alto',
    comprimento: COMPRIMENTO_DO_CABEDAL,
    largura: LARGURA_DO_CABEDAL,
    altura: { nome: 'altura-do-cano', minimo: 0.1, maximo: 0.22, padrao: 0.14 },
    assento: [0, ALTURA_DA_SOLA, 0],
    modelar: (medidas) => geometriaDeCabedal({ ...medidas, alturaDoPeito: ALTURA_DO_PEITO, cano: CANO_ALTO }),
    materialDeDuplaFace: true,
  },
  {
    id: 'prova-cadarco-reto',
    categoria: 'cadarco',
    rotulo: 'Cadarço reto',
    comprimento: 0.13,
    largura: 0.05,
    altura: { nome: 'espessura', minimo: 0.003, maximo: 0.012, padrao: 0.006 },
    // Deslocado para a biqueira e apoiado no cabedal baixo. Cadarço é categoria opcional na
    // forma, então esta é a peça que prova que composição sem ela continua válida.
    assento: [0.03, ALTURA_DA_SOLA + 0.075, 0],
  },
];

const POR_ID = new Map(PECAS.map((peca) => [peca.id, peca]));

/**
 * O catálogo no formato que `validarComposicao` espera.
 *
 * Derivado de `PECAS`, nunca digitado ao lado dele. É o que impede o defeito mais provável
 * deste módulo: uma peça existir no catálogo e não ter geometria, ou o contrário. As duas
 * listas são a mesma lista.
 */
export function catalogoDeProva(): CatalogoDoAcervo {
  return {
    formas: [
      {
        id: FORMA_DE_PROVA,
        rotulo: 'Tênis de prova',
        // A anatomia do tênis, de baixo para cima. É o que `empilharComposicao` lê para fazer
        // o cabedal subir quando a composição escolhe uma sola mais grossa. A sola não declara
        // `assenta_sobre` porque ela assenta no chão, que é a ausência do campo.
        categorias: [
          { categoria: 'sola', obrigatoria: true },
          { categoria: 'cabedal', obrigatoria: true, assenta_sobre: 'sola' },
          { categoria: 'cadarco', obrigatoria: false, assenta_sobre: 'cabedal' },
        ],
      },
    ],
    pecas: PECAS.map(
      (peca): PecaDoAcervo => ({
        id: peca.id,
        categoria: peca.categoria,
        forma_id: FORMA_DE_PROVA,
        rotulo: peca.rotulo,
        parametros: [peca.altura],
      }),
    ),
  };
}

/**
 * O texto glTF de uma peça do acervo de prova, com os parâmetros já validados aplicados.
 *
 * Recusa id desconhecido com `Error` cru e não com `PECA_NAO_ENCONTRADA`: aquele código é a
 * recusa que `validarComposicao` dá para uma peça que o modelo de linguagem inventou, e é
 * contrato de API. Chegar aqui com id que não existe significa que alguém pulou o guarda, que é
 * defeito nosso e não pedido malformado de cliente.
 */
export function gltfDaPecaDeProva(
  pecaId: string,
  parametros: Readonly<Record<string, number>> = {},
): string {
  const peca = POR_ID.get(pecaId);

  if (peca === undefined) {
    throw new Error(
      `A peça "${pecaId}" não está no acervo de prova. Ids disponíveis: ${PECAS.map(({ id }) => id).join(', ')}.`,
    );
  }

  return montarGltfDePeca(peca, parametros);
}

/**
 * A composição demo: um tênis inteiro, com as três categorias e uma cor por peça.
 *
 * Existe em `unknown` e não já validada de propósito: ela entra por `validarComposicao` como
 * entraria a saída de um modelo de linguagem, pelo mesmo portão e com a mesma recusa. Uma
 * composição demo que pulasse o guarda seria uma demonstração de um caminho que o produto não
 * usa.
 *
 * As cores são as três do calçado de demonstração, e não têm significado de marca: identidade
 * vem do tenant (CLAUDE.md), e este acervo não pertence a tenant nenhum.
 */
export function composicaoDeProva(): unknown {
  return {
    forma_id: FORMA_DE_PROVA,
    pecas: [
      { peca_id: 'prova-sola-plana', cor: '#F2F2F2' },
      { peca_id: 'prova-cabedal-baixo', cor: '#1F4FA8' },
      { peca_id: 'prova-cadarco-reto', cor: '#E8B33C' },
    ],
  };
}

/** Os ids das peças, na ordem em que foram descritas. Para testes percorrerem o acervo inteiro. */
export function idsDoAcervoDeProva(): string[] {
  return PECAS.map(({ id }) => id);
}
