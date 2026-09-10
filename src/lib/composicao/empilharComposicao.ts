// De quanto cada peça precisa subir para assentar sobre a de baixo (T14, decisão D2).
//
// Existe porque o `assento` que cada peça do acervo carrega é o lugar dela no calçado **padrão**.
// Quando a composição escolhe uma sola mais grossa, o cabedal precisa subir junto, senão ele
// afunda dentro da sola; quando escolhe uma mais fina, ele fica flutuando. Nenhum dos dois dá
// erro, os dois só ficam errados na tela, que é a família de defeito que o princípio nº1 persegue.
//
// **Trabalha só com números.** Não conhece glTF, não conhece three, não abre arquivo. Recebe a
// faixa vertical que cada peça ocupa e devolve quanto ela sobe. É o que torna a regra de
// empilhamento testável sem montar um modelo 3D, e é o que impede este arquivo de virar o lugar
// onde alguém resolve "também" reindexar acessor.
//
// Quem mede as faixas é `medidaDoModelo3d`, e quem aplica o deslocamento é `deslocarModelo3d`.

import type { Forma } from './tiposDaComposicao';

/** Onde a peça começa e termina no eixo vertical, no espaço do modelo, em metros. */
export interface FaixaVertical {
  /** O ponto mais baixo. Para uma peça modelada com a base na origem, é o assento dela. */
  base: number;
  /** O ponto mais alto. É sobre ele que a próxima peça assenta. */
  topo: number;
}

/**
 * De quanto cada categoria sobe, em metros. Zero é resposta legítima e é a mais comum.
 *
 * Devolve **deslocamento** e não posição absoluta, e a diferença é o que faz uma forma sem
 * empilhamento declarado continuar montando como as peças dela foram modeladas: categoria que não
 * assenta sobre ninguém recebe zero e fica onde está, em vez de ser empurrada para o chão.
 *
 * A chave do mapa devolvido é a categoria, e não o id da peça, porque quem assenta sobre quem é
 * propriedade da **forma** (ADR-008 D4): a sola tratorada e a sola plana ocupam o mesmo lugar na
 * anatomia, e trocar uma pela outra não pode mudar a regra de empilhamento.
 *
 * A ordem em que as peças aparecem na composição **não** influencia o resultado. A ordem de uma
 * composição é a que o modelo de linguagem escreveu, não a anatomia do calçado, e um empilhamento
 * que dependesse dela mudaria o calçado conforme a frase que gerou o pedido.
 *
 * Lança `Error` cru, e não `ErroDeVariante`, nos dois casos de catálogo quebrado (base que a forma
 * não declara, e ciclo). Não é pedido malformado de cliente: é a nossa forma descrevendo uma
 * anatomia impossível, e um código de erro público ensinaria o integrador a consertar algo que
 * não está nas mãos dele.
 */
export function empilharComposicao(
  forma: Forma,
  faixas: ReadonlyMap<string, FaixaVertical>,
): Map<string, number> {
  const baseDeclarada = new Map(
    forma.categorias.map(({ categoria, assenta_sobre }) => [categoria, assenta_sobre]),
  );
  recusarBaseQueAFormaNaoDeclara(forma, baseDeclarada);

  const deslocamentos = new Map<string, number>();

  /**
   * A categoria mais próxima, subindo a declaração, que está de fato na composição.
   *
   * Pular categoria ausente em vez de parar nela é o que faz categoria opcional funcionar: sem o
   * cabedal, o cadarço assenta sobre a sola em vez de ficar pendurado na altura de um cabedal que
   * não existe. `validarComposicao` já garantiu que o que falta é opcional.
   *
   * O conjunto de vistas não é zelo: sem ele, uma forma que declare ciclo entre categorias
   * **ausentes** da composição faz este laço rodar para sempre, e travar sem mensagem é a pior
   * forma de falhar que este projeto conhece.
   */
  function basePresente(categoria: string): string | undefined {
    const vistas = new Set<string>([categoria]);
    let atual = baseDeclarada.get(categoria);

    while (atual !== undefined) {
      if (vistas.has(atual)) throw ciclo(forma, atual);
      if (faixas.has(atual)) return atual;

      vistas.add(atual);
      atual = baseDeclarada.get(atual);
    }

    return undefined;
  }

  /**
   * O deslocamento de uma categoria **que está na composição**, com memória.
   *
   * Recebe a faixa por parâmetro, em vez de buscá-la, porque quem chama já a tem em mãos nos dois
   * caminhos. Buscar de novo exigiria tratar um `undefined` que não pode acontecer, e ramo
   * defensivo que nenhum dado alcança nasce sem teste: é o buraco que a verificação por mutação
   * encontrou em T13.
   */
  function deslocamentoDe(categoria: string, faixa: FaixaVertical, caminho: Set<string>): number {
    const memorizado = deslocamentos.get(categoria);
    if (memorizado !== undefined) return memorizado;
    if (caminho.has(categoria)) throw ciclo(forma, categoria);

    caminho.add(categoria);
    const base = basePresente(categoria);
    const faixaDaBase = base === undefined ? undefined : faixas.get(base);

    // `base` só volta de `basePresente` quando `faixas.has(base)`, então os dois são definidos
    // juntos ou nenhum dos dois. O `&&` diz isso ao compilador sem inventar um terceiro caso.
    const deslocamento =
      base !== undefined && faixaDaBase !== undefined
        ? faixaDaBase.topo + deslocamentoDe(base, faixaDaBase, caminho) - faixa.base
        : 0;

    caminho.delete(categoria);
    deslocamentos.set(categoria, deslocamento);

    return deslocamento;
  }

  for (const [categoria, faixa] of faixas) deslocamentoDe(categoria, faixa, new Set());

  return deslocamentos;
}

function ciclo(forma: Forma, categoria: string): Error {
  return new Error(
    `A forma "${forma.id}" declara um ciclo de empilhamento envolvendo a categoria "${categoria}". Uma peça não pode assentar, direta ou indiretamente, sobre si mesma.`,
  );
}

/**
 * `assenta_sobre` apontando para categoria que a forma não declara é catálogo quebrado.
 *
 * Recusar aqui, e não deixar passar como "assenta no chão", porque as duas situações dão o mesmo
 * resultado e têm causas opostas: uma é a sola, que realmente não assenta sobre nada, a outra é um
 * erro de digitação que faria o cabedal cair no chão em silêncio.
 */
function recusarBaseQueAFormaNaoDeclara(
  forma: Forma,
  baseDeclarada: ReadonlyMap<string, string | undefined>,
): void {
  for (const [categoria, base] of baseDeclarada) {
    if (base !== undefined && !baseDeclarada.has(base)) {
      throw new Error(
        `A categoria "${categoria}" da forma "${forma.id}" declara assentar sobre "${base}", que a forma não tem. Categorias declaradas: ${forma.categorias.map(({ categoria: nome }) => nome).join(', ')}.`,
      );
    }
  }
}
