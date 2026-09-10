// Soma um deslocamento à translação dos nós raiz de um modelo 3D canônico.
//
// É o gêmeo de `recolorirModelo3d` em forma, e o paralelo é de propósito: recebe o **modelo
// canônico** (já passado por `normalizarModelo3d`), devolve modelo canônico, valida tudo antes
// de escrever qualquer coisa, e recusa com `ErroDeVariante` em vez de devolver "quase certo".
// Um agente que conhece um dos dois arquivos lê o outro sem vocabulário novo (ADR-003).
//
// Existe porque o empilhamento da composição (T14 D2) precisa subir o cabedal quando a sola
// engrossa, e a peça não pode ser remodelada para isso: deslocar é **transformação de nó**,
// nunca malha nova. É o mesmo princípio do ADR-008 D7, que faz o parâmetro de peça virar escala
// do nó. A consequência verificável é que `accessors`, `bufferViews` e `buffers` saem daqui
// exatamente como entraram, byte a byte.
//
// Este módulo NÃO desenha nada e não conhece three.js: glTF é JSON, deslocar é somar num campo.
// Ele também NÃO normaliza, NÃO junta documentos e NÃO escreve cor: quem faz cada uma dessas
// coisas é `normalizarModelo3d`, `juntarModelos3d` e `recolorirModelo3d`, e a única maneira de
// "cor no editor = cor na API" continuar verdadeira é cada motor ter um dono só.

import { ErroDeVariante } from './erros';
import { analisarGltf, escreverGltf } from './lerGltf';
import type { DocumentoGltf, NoDoGltf } from './tiposDoGltf';

/** Um deslocamento em metros, nos eixos X, Y e Z, que é a unidade que o glTF 2.0 fixa. */
export type Deslocamento3d = readonly [number, number, number];

const EIXOS = 3;

/**
 * Devolve o modelo com os nós **raiz** transladados por `deslocamento`.
 *
 * Só os raiz. Nó filho já herda a translação do pai na hora de compor a matriz de mundo, então
 * deslocar os dois somaria o movimento duas vezes e a peça pararia no dobro da altura pedida:
 * um calçado com o cadarço flutuando acima do cabedal, sem nenhum erro no caminho. É o critério
 * 8 da spec de composição, e é o defeito mais provável deste arquivo.
 */
export function deslocarModelo3d(modeloCanonico: string, deslocamento: Deslocamento3d): string {
  const documento = analisarGltf(modeloCanonico);
  const passo = validarDeslocamento(deslocamento);
  const raizes = nosRaiz(documento);

  // Valida os nós todos antes de escrever no primeiro, pela mesma razão que o recolor resolve
  // as zonas todas antes de pintar: o modelo sai deslocado inteiro ou não sai. Sem isto, uma
  // recusa no terceiro de quatro nós devolveria um calçado com duas peças no lugar novo e duas
  // no antigo, que é pior que não deslocar nada porque parece ter funcionado.
  for (const no of raizes) recusarTransformacaoQueEngoleTranslacao(no);

  // Deslocamento nulo não escreve em nó nenhum, e não é preguiça: `[0, 0, 0]` é o valor padrão
  // de `translation` no glTF 2.0, então gravá-lo num nó que não a declarava mudaria os bytes do
  // documento sem mudar um milímetro da cena. O critério 6 exige o documento de volta byte a
  // byte, e é ele a contraprova de que esta função não reescreve o documento de lado nenhum.
  // Repare que a leitura e a reescrita acontecem mesmo assim, logo o teste continua exercendo o
  // caminho inteiro em vez de bater num atalho antes de `analisarGltf`.
  if (!ehNulo(passo)) {
    for (const no of raizes) no.translation = somar(translacaoDe(no), passo);
  }

  return escreverGltf(documento);
}

/**
 * Os nós raiz do documento, sem repetição.
 *
 * Duas definições porque o glTF 2.0 permite as duas formas: com `scenes`, raiz é o que a cena
 * ativa lista; sem `scenes`, raiz é todo nó que ninguém declara como filho. A segunda existe
 * para documentos montados à mão em teste, e dá a mesma resposta que a primeira daria.
 *
 * O `Set` no fim não é zelo vazio: uma cena que liste o mesmo nó duas vezes é glTF válido, e um
 * laço ingênuo somaria o deslocamento duas vezes nele. É o defeito do critério 8 entrando por
 * outra porta, e a peça pararia no lugar errado do mesmo jeito.
 */
function nosRaiz(documento: DocumentoGltf): NoDoGltf[] {
  const nos = documento.nodes ?? [];
  const indices = new Set(
    documento.scenes === undefined ? indicesSemPai(nos) : indicesDaCenaAtiva(documento),
  );

  return [...indices].map((indice) => {
    const no = nos[indice];

    // Índice de nó que não existe é documento quebrado, e pular em silêncio deixaria a peça
    // parada onde estava sem ninguém saber. Falha alto, com o índice na mensagem, que é o que
    // se precisa para achar o defeito no arquivo.
    if (no === undefined) {
      throw new ErroDeVariante(
        'MODELO_3D_INVALIDO',
        `A cena aponta para o nó ${indice}, que não existe neste modelo 3D (há ${nos.length}).`,
      );
    }

    return no;
  });
}

/** A cena que o documento declara ativa, e `0` quando ele não declara nenhuma (padrão do glTF). */
function indicesDaCenaAtiva(documento: DocumentoGltf): number[] {
  // `?? 0` e nunca `documento.scene || 0`: a cena de índice 0 é a esmagadora maioria dos
  // arquivos, é falsy, e o `||` a trocaria por 0 sem mudar nada hoje e por acidente amanhã,
  // quando alguém escrever a mesma linha num campo em que o zero significa outra coisa.
  const indiceDaCena = documento.scene ?? 0;
  const cena = documento.scenes?.[indiceDaCena];

  if (cena === undefined) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      `Este modelo 3D declara a cena ${indiceDaCena}, que não existe na lista de cenas.`,
    );
  }

  return [...(cena.nodes ?? [])];
}

/**
 * Todo nó que não aparece como `children` de outro.
 *
 * A filiação mora num `Set` de índices, e não numa checagem de veracidade: índice de nó vale `0`
 * legitimamente, e `0` é falsy. Um `if (filho)` aqui não marcaria o nó 0 como filho, ele sairia
 * na lista de raízes e seria deslocado junto com o pai, exatamente o dobro do critério 8. O nó 0
 * é justamente o primeiro de todo arquivo, então o defeito seria o caso comum, não o raro.
 */
function indicesSemPai(nos: NoDoGltf[]): number[] {
  const filhos = new Set<number>();

  for (const no of nos) {
    for (const filho of no?.children ?? []) filhos.add(filho);
  }

  return nos.map((_, indice) => indice).filter((indice) => !filhos.has(indice));
}

/**
 * Recusa nó raiz com `matrix`.
 *
 * O glTF 2.0 proíbe `matrix` junto de `translation` no mesmo nó. Escrever a translação por cima
 * produziria um documento inválido em que o carregador honra a matriz e ignora o que acabamos de
 * pedir: o deslocamento simplesmente sumiria, a peça ficaria no lugar antigo e nada no caminho
 * reclamaria. É a mesma recusa, pelo mesmo motivo e com o mesmo código, que a spec de composição
 * manda `medidaDoModelo3d` dar para geometria girada.
 *
 * `rotation` e `scale` passam de propósito: numa transformação T * R * S a translação é aplicada
 * no espaço do pai, depois de girar e escalar, então somar nela não é afetado por nenhuma das
 * duas. Recusar aqui recusaria as peças de prova, que todas trazem `scale`.
 */
function recusarTransformacaoQueEngoleTranslacao(no: NoDoGltf): void {
  if (no?.matrix === undefined) return;

  throw new ErroDeVariante(
    'MODELO_3D_NAO_NORMALIZAVEL',
    `O nó "${no.name ?? '(sem nome)'}" traz a transformação em "matrix", e o glTF 2.0 não permite "translation" no mesmo nó. Exporte o modelo com translação, rotação e escala separadas.`,
  );
}

/**
 * A translação atual do nó, conferida.
 *
 * Nó sem `translation` vale `[0, 0, 0]`, que é o padrão da especificação, e é assim que um nó na
 * origem ganha translação ao ser deslocado pela primeira vez. Já `translation` presente e
 * malformada é recusa: completar com zero o que falta transformaria um documento quebrado num
 * deslocamento silenciosamente errado, e posição errada em 3D aparece como peça flutuando sem
 * explicação, que é a família de defeito que a spec de composição chama de mentira de medida.
 */
function translacaoDe(no: NoDoGltf): Deslocamento3d {
  const atual = no?.translation;
  if (atual === undefined) return [0, 0, 0];

  return conferirTrio(
    atual,
    `A translação do nó "${no.name ?? '(sem nome)'}"`,
    'MODELO_3D_INVALIDO',
  );
}

/**
 * O deslocamento pedido, conferido.
 *
 * `PARAMETRO_INVALIDO` e não um código de modelo 3D: o que está errado aqui é o argumento de
 * quem chamou, não o arquivo que entrou. Ele é 422 na tradução da API, que é a família certa
 * para "o pedido não faz sentido".
 *
 * `NaN` é o valor que esta guarda existe para pegar. Ele atravessa qualquer soma sem lançar,
 * `JSON.stringify` o escreve como `null`, e o carregador lê `null` como zero: o resultado seria
 * a peça parada na origem, com cara de defeito de geometria, a três módulos de distância da
 * divisão por zero que o produziu.
 */
function validarDeslocamento(deslocamento: Deslocamento3d): Deslocamento3d {
  return conferirTrio(deslocamento, 'O deslocamento', 'PARAMETRO_INVALIDO');
}

/**
 * Três números finitos, ou recusa com o código de quem errou.
 *
 * Uma função para os dois usos porque a pergunta é a mesma e duas cópias divergiriam: o dia em
 * que uma delas aprendesse a recusar `null` e a outra não, o defeito apareceria só num dos dois
 * caminhos e ninguém ligaria os pontos.
 */
function conferirTrio(
  valores: readonly unknown[],
  sujeito: string,
  codigo: 'PARAMETRO_INVALIDO' | 'MODELO_3D_INVALIDO',
): Deslocamento3d {
  const [x, y, z] = valores;

  // Os três conferidos um a um, e não por `some` sobre a lista, porque é isto que devolve à
  // função um trio de `number` de verdade em vez de um `unknown[]` com uma asserção por cima.
  // Asserção de tipo aqui seria a promessa que este arquivo inteiro existe para não fazer: ela
  // calaria o compilador sem conferir nada, e o `NaN` passaria.
  if (valores.length !== EIXOS || !ehNumeroFinito(x) || !ehNumeroFinito(y) || !ehNumeroFinito(z)) {
    throw new ErroDeVariante(
      codigo,
      `${sujeito} precisa ser três números finitos (X, Y, Z), em metros. Recebido: ${JSON.stringify(valores)}.`,
    );
  }

  return [x, y, z];
}

function ehNumeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

/**
 * Soma eixo a eixo, os três.
 *
 * O laço é sobre a contagem de eixos e não sobre `atual`, porque escrever os três à mão é como
 * se esquece o Z: `[atual[0] + passo[0], atual[1] + passo[1], atual[2]]` compila, passa em todo
 * teste que só olha altura, e deixa a peça no lugar errado em profundidade.
 */
function somar(atual: Deslocamento3d, passo: Deslocamento3d): number[] {
  return Array.from({ length: EIXOS }, (_, eixo) => (atual[eixo] ?? 0) + (passo[eixo] ?? 0));
}

/** Somar zero em três eixos não move nada, e é o que dispensa a escrita (ver o critério 6). */
function ehNulo(deslocamento: Deslocamento3d): boolean {
  return deslocamento.every((valor) => valor === 0);
}
