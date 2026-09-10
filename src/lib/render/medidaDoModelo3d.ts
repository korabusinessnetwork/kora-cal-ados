// A caixa envolvente do modelo 3D, lida do JSON do glTF (T14, critérios 1 a 4).
//
// Responde uma pergunta só: onde esta peça começa e onde ela termina, em metros. É dela que sai
// o empilhamento da composição (o cabedal sobe junto quando a sola engrossa), e a razão de a
// altura ser lida da geometria em vez de um campo declarado está na spec de T14: campo
// redundante que pode divergir é a família de defeito que este projeto persegue desde o BUG-013.
// Uma peça cuja malha não bate com a altura declarada existiria; uma peça cuja malha não bate
// com a própria malha, não.
//
// Este módulo NÃO conhece three.js, e isso é o ponto: a montagem precisa da medida onde não há
// GPU nem navegador. O que impede as duas leituras de divergirem não é disciplina, é o teste que
// compara esta medida com a que o three faz depois de carregar as 5 peças de prova.
//
// Ele também NÃO escreve nada no documento. Medir é leitura, e um módulo de leitura que
// devolvesse o glTF convidaria alguém a gravar a medida dentro dele, que é exatamente o campo
// redundante que a decisão acima existe para não ter.

import { ErroDeVariante } from './erros';
import { analisarGltf } from './lerGltf';
import type { DocumentoGltf, NoDoGltf } from './tiposDoGltf';

/** Os dois cantos opostos da caixa, em metros, no espaço do modelo. */
export interface CaixaDoModelo3d {
  minimo: [number, number, number];
  maximo: [number, number, number];
}

type Vetor3 = [number, number, number];

/** A transformação acumulada do nó, já composta com a das ancestrais. */
interface Transformacao {
  escala: Vetor3;
  translacao: Vetor3;
}

const RAIZ: Transformacao = { escala: [1, 1, 1], translacao: [0, 0, 0] };

/**
 * A caixa envolvente do modelo, em metros, lida do JSON do glTF.
 *
 * Lança em vez de devolver "quase certo": nó com rotação, modelo sem malha ou acessor de
 * POSITION sem `min`/`max` viram recusa com código. Medida errada em silêncio vira peça
 * flutuando no ar na tela, e ninguém tem como saber que o culpado foi a medida.
 */
export function medidaDoModelo3d(modeloCanonico: string): CaixaDoModelo3d {
  const documento = analisarGltf(modeloCanonico);
  const nos = documento.nodes ?? [];

  if (nos.length === 0) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      'O glTF não tem nós ("nodes"): não há geometria para medir.',
    );
  }

  recusarTransformacaoQueMente(nos);

  let caixa: CaixaDoModelo3d | undefined;
  const visitados = new Set<number>();

  for (const indice of raizes(documento, nos)) {
    caixa = unir(caixa, medirSubarvore(documento, nos, indice, RAIZ, visitados));
  }

  if (caixa === undefined) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      'Nenhum nó da cena tem malha: um modelo sem geometria não tem medida, e devolver uma caixa de tamanho zero faria a peça sumir da montagem sem erro.',
    );
  }

  return caixa;
}

/**
 * Recusa `rotation` e `matrix`, em qualquer nó do documento.
 *
 * Uma caixa alinhada aos eixos calculada sobre geometria girada MENTE: os cantos do volume
 * girado saem para fora dela, e a conta de empilhamento passa a assentar a peça de cima no
 * lugar errado. Mentira de medida vira peça flutuando na tela sem explicação, e o modo de falha
 * é silencioso, que é o que este projeto recusa desde o ADR-004.
 *
 * A varredura é sobre `nodes` inteiro, e não só sobre os nós alcançados pela cena: um nó fora da
 * cena hoje entra nela amanhã, e a recusa que só olha o alcançável mudaria de resposta sem o
 * arquivo mudar. Mesmo motivo para recusar o campo pela **presença** e não pelo valor: aceitar a
 * rotação identidade obrigaria o próximo leitor a decidir o que é "perto o bastante da
 * identidade", e essa é a conversa que a regra dura evita.
 */
function recusarTransformacaoQueMente(nos: NoDoGltf[]): void {
  for (const no of nos) {
    for (const campo of ['rotation', 'matrix'] as const) {
      if (no?.[campo] === undefined) continue;

      throw new ErroDeVariante(
        'MODELO_3D_NAO_NORMALIZAVEL',
        `O nó "${no.name ?? '(sem nome)'}" tem "${campo}", e a medida deste modelo é uma caixa alinhada aos eixos, que sobre geometria girada dá um número errado. Exporte a peça já orientada, com a rotação aplicada na geometria, deixando nos nós apenas "translation" e "scale".`,
      );
    }
  }
}

/**
 * Os nós raiz por onde a medida começa.
 *
 * A cena declarada vem primeiro porque é o que o renderizador desenha: medir um nó que o three
 * ignora faria as duas leituras discordarem, e é justamente isso que o critério 1 existe para
 * impedir. Sem cena declarada, raiz é quem ninguém tem como filho.
 */
function raizes(documento: DocumentoGltf, nos: NoDoGltf[]): number[] {
  const daCena = documento.scenes?.[documento.scene ?? 0]?.nodes;
  if (Array.isArray(daCena)) return daCena;

  const filhos = new Set(nos.flatMap((no) => no?.children ?? []));

  return nos.map((_, indice) => indice).filter((indice) => !filhos.has(indice));
}

/** A caixa do nó e de toda a descendência dele, já no espaço do modelo. */
function medirSubarvore(
  documento: DocumentoGltf,
  nos: NoDoGltf[],
  indice: number,
  herdada: Transformacao,
  visitados: Set<number>,
): CaixaDoModelo3d | undefined {
  const no = nos[indice];

  if (no === undefined) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      `O modelo referencia o nó ${indice}, que não existe em "nodes".`,
    );
  }

  // Em glTF 2.0 os nós formam árvore: um nó tem no máximo um pai. Reencontrar um já visitado é
  // arquivo inválido, e seguir em frente seria recursão infinita pendurando quem chamou, sem
  // mensagem nenhuma. Recusar é a resposta barata.
  if (visitados.has(indice)) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      `O nó ${indice} aparece duas vezes na hierarquia. Em glTF 2.0 cada nó tem no máximo um pai.`,
    );
  }
  visitados.add(indice);

  const transformacao = compor(herdada, no);
  let caixa = caixaDaMalha(documento, no, transformacao);

  for (const filho of no.children ?? []) {
    caixa = unir(caixa, medirSubarvore(documento, nos, filho, transformacao, visitados));
  }

  return caixa;
}

/**
 * Compõe a transformação do nó com a que ele herdou.
 *
 * A translação local acontece no espaço do pai, então ela entra **escalada** pela escala do pai.
 * Somar a translação crua daria a peça no lugar certo enquanto ninguém escalasse a hierarquia, e
 * no lugar errado no dia em que alguém escalasse, que é o pior tipo de defeito para achar.
 */
function compor(pai: Transformacao, no: NoDoGltf): Transformacao {
  const escala = vetor(no.scale, 1, 'scale');
  const translacao = vetor(no.translation, 0, 'translation');

  return {
    escala: [pai.escala[0] * escala[0], pai.escala[1] * escala[1], pai.escala[2] * escala[2]],
    translacao: [
      pai.translacao[0] + pai.escala[0] * translacao[0],
      pai.translacao[1] + pai.escala[1] * translacao[1],
      pai.translacao[2] + pai.escala[2] * translacao[2],
    ],
  };
}

/** A caixa das primitivas do nó, ou nada quando o nó não carrega malha. */
function caixaDaMalha(
  documento: DocumentoGltf,
  no: NoDoGltf,
  transformacao: Transformacao,
): CaixaDoModelo3d | undefined {
  // Índice zero é falsy: `mesh: 0` é a primeira malha do documento, e um `if (no.mesh)` aqui
  // pularia justamente a peça 0 de todo modelo. O defeito apareceria como peça no lugar errado
  // na montagem, longe daqui. Comparar com `undefined`, sempre.
  if (no.mesh === undefined) return undefined;

  const malha = documento.meshes?.[no.mesh];

  if (malha === undefined) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      `O nó "${no.name ?? '(sem nome)'}" aponta para a malha ${no.mesh}, que não existe em "meshes".`,
    );
  }

  let caixa: CaixaDoModelo3d | undefined;

  for (const primitiva of malha.primitives ?? []) {
    const nome = no.name ?? '(sem nome)';
    // `POSITION: 0` é o caso comum, e não a ausência do atributo. Mesma armadilha do `mesh`.
    const indiceDoAcessor = primitiva?.attributes?.['POSITION'];

    if (indiceDoAcessor === undefined) {
      throw new ErroDeVariante(
        'MODELO_3D_INVALIDO',
        `Uma primitiva da malha "${nome}" não tem o atributo POSITION, que o glTF 2.0 exige. Sem posição não há geometria para medir.`,
      );
    }

    const acessor = documento.accessors?.[indiceDoAcessor];

    // O glTF 2.0 EXIGE `min` e `max` no acessor de POSITION, e o validador de referência confere
    // os dois contra os vértices decodificados. A ausência é arquivo inválido, não caso comum, e
    // por isso a resposta é recusa em vez de abrir o buffer para calcular: percorrer vértice a
    // vértice aqui daria uma medida que o resto do mundo não usa.
    if (acessor?.min === undefined || acessor.max === undefined) {
      throw new ErroDeVariante(
        'MODELO_3D_INVALIDO',
        `O acessor de POSITION da malha "${nome}" está sem "min"/"max". O glTF 2.0 os exige, e sem eles a caixa envolvente do modelo não existe no arquivo.`,
      );
    }

    const minimo = vetor(acessor.min, 0, 'accessor.min');
    const maximo = vetor(acessor.max, 0, 'accessor.max');

    caixa = unir(caixa, transformar(minimo, maximo, transformacao));
  }

  if (caixa === undefined) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      `A malha "${no.name ?? '(sem nome)'}" não tem nenhuma primitiva, e o glTF 2.0 exige ao menos uma.`,
    );
  }

  return caixa;
}

/**
 * A caixa transformada.
 *
 * Uma caixa alinhada aos eixos sob escala e translação continua alinhada aos eixos, e é por isso
 * que a conta é dois cantos e não oito. É também por isso que `rotation` é recusado lá em cima:
 * a propriedade que torna esta conta legítima é exatamente a que a rotação quebra.
 */
function transformar(minimo: Vetor3, maximo: Vetor3, { escala, translacao }: Transformacao): CaixaDoModelo3d {
  const x = extremosNoEixo(minimo[0], maximo[0], escala[0], translacao[0]);
  const y = extremosNoEixo(minimo[1], maximo[1], escala[1], translacao[1]);
  const z = extremosNoEixo(minimo[2], maximo[2], escala[2], translacao[2]);

  return { minimo: [x[0], y[0], z[0]], maximo: [x[1], y[1], z[1]] };
}

/**
 * Um eixo da caixa, com o cuidado que a escala negativa exige.
 *
 * Escala negativa é espelhamento, e é legítima (o pé esquerdo é o direito espelhado). Ela troca
 * o mínimo com o máximo, e sem esta ordenação a caixa sairia invertida: a peça teria altura
 * negativa e o empilhamento a enterraria na de baixo.
 */
function extremosNoEixo(
  minimo: number,
  maximo: number,
  escala: number,
  translacao: number,
): [number, number] {
  const a = minimo * escala + translacao;
  const b = maximo * escala + translacao;

  return a <= b ? [a, b] : [b, a];
}

/** A menor caixa que contém as duas. `undefined` é "ainda não mediu nada", nunca caixa vazia. */
function unir(
  atual: CaixaDoModelo3d | undefined,
  nova: CaixaDoModelo3d | undefined,
): CaixaDoModelo3d | undefined {
  if (nova === undefined) return atual;
  if (atual === undefined) return nova;

  return {
    minimo: [
      Math.min(atual.minimo[0], nova.minimo[0]),
      Math.min(atual.minimo[1], nova.minimo[1]),
      Math.min(atual.minimo[2], nova.minimo[2]),
    ],
    maximo: [
      Math.max(atual.maximo[0], nova.maximo[0]),
      Math.max(atual.maximo[1], nova.maximo[1]),
      Math.max(atual.maximo[2], nova.maximo[2]),
    ],
  };
}

/**
 * Lista de três números, ou recusa.
 *
 * `NaN` e `Infinity` são checados junto porque eles não lançam: uma escala `NaN` produziria uma
 * caixa inteira de `NaN`, toda comparação com ela seria falsa, e a peça sumiria da tela sem uma
 * linha de erro.
 */
function vetor(valores: number[] | undefined, padrao: number, campo: string): Vetor3 {
  if (valores === undefined) return [padrao, padrao, padrao];

  const [x, y, z] = valores;

  if (
    valores.length !== 3 ||
    x === undefined ||
    y === undefined ||
    z === undefined ||
    !valores.every((valor) => Number.isFinite(valor))
  ) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      `O campo "${campo}" tem ${JSON.stringify(valores)}, e o glTF 2.0 exige três números finitos.`,
    );
  }

  return [x, y, z];
}
