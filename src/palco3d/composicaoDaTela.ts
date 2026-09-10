// O estado da tela da composição virando calçado montado, ou virando mensagem de erro legível.
//
// Existe fora do componente pela mesma razão que `orbita.ts` existe: o componente da cena não é
// alcançável por teste nenhum, porque jsdom não tem WebGL. Toda decisão que morar lá dentro é
// decisão sem rede de proteção, e esta aqui é a que decide **o que aparece na tela**, que é onde
// o princípio nº1 é julgado.
//
// Devolve erro em vez de lançar, de propósito: a tela precisa ter sempre algo para mostrar, e um
// estado de erro visível vale mais que uma exceção que apaga a tela inteira (CLAUDE.md, "estados
// sempre visíveis").

import { montarComposicao, type ProvedorDeGltfDaPeca } from '../lib/composicao/montarComposicao';
import { validarComposicao } from '../lib/composicao/validarComposicao';
import type {
  CatalogoDoAcervo,
  ComposicaoValidada,
  Forma,
} from '../lib/composicao/tiposDaComposicao';
import { ErroDeVariante } from '../lib/render/erros';
import type { Zona3d } from '../lib/render/recolorirModelo3d';

/** O que a tela guarda por categoria da forma. */
export interface EscolhaDaTela {
  /** `null` é a categoria opcional deixada de fora, e é escolha legítima, não estado vazio. */
  pecaId: string | null;
  /** Ausente mantém a cor com que a peça foi modelada. */
  cor?: string;
  parametros?: Record<string, number>;
}

export interface MontagemDaTela {
  /** `null` quando a montagem foi recusada. Nunca um calçado pela metade. */
  modelo: string | null;
  zonas: Zona3d[];
  /** `null` quando deu certo. Texto pronto para ler, nunca um código solto. */
  erro: string | null;
}

/** O estado inicial da tela, tirado de uma composição já validada. */
export function escolhasDaComposicao(composicao: ComposicaoValidada): Map<string, EscolhaDaTela> {
  return new Map(
    composicao.pecas.map(({ categoria, peca, cor, parametros }) => [
      categoria,
      { pecaId: peca.id, cor, parametros },
    ]),
  );
}

/**
 * As escolhas da tela viram calçado montado, passando pelo guarda.
 *
 * Passa por `validarComposicao` mesmo sabendo que a tela só oferece opções válidas. Não é zelo
 * inútil: é o mesmo portão pelo qual a saída do modelo de linguagem vai entrar, e se a tela
 * pulasse o guarda ela estaria demonstrando um caminho que o produto não usa. Também é o que
 * garante que os parâmetros cheguem completos, com o padrão de cada peça preenchido.
 */
export function montarDaTela(
  forma: Forma,
  catalogo: CatalogoDoAcervo,
  escolhas: ReadonlyMap<string, EscolhaDaTela>,
  provedorDeGltf: ProvedorDeGltfDaPeca,
): MontagemDaTela {
  const pecas = forma.categorias
    .map(({ categoria }) => escolhas.get(categoria))
    .filter((escolha): escolha is EscolhaDaTela => escolha?.pecaId != null)
    .map(({ pecaId, cor, parametros }) => ({ peca_id: pecaId, cor, parametros }));

  try {
    const composicao = validarComposicao({ forma_id: forma.id, pecas }, catalogo);
    const { modelo, zonas } = montarComposicao(composicao, provedorDeGltf);

    return { modelo, zonas, erro: null };
  } catch (erro) {
    return { modelo: null, zonas: [], erro: mensagemDe(erro) };
  }
}

/**
 * A mensagem que a pessoa lê. O código do erro entra junto quando existe.
 *
 * O código aparece porque ele é contrato público de API (`erros.ts`): quem está montando um
 * calçado aqui é a mesma pessoa que vai receber esse código na integração, e ver os dois lados
 * com o mesmo nome é o que impede "o editor disse uma coisa e a API disse outra".
 */
function mensagemDe(erro: unknown): string {
  if (erro instanceof ErroDeVariante) return `${erro.codigo}: ${erro.message}`;
  if (erro instanceof Error) return erro.message;

  return 'A composição foi recusada, e o motivo não veio em forma de erro.';
}
