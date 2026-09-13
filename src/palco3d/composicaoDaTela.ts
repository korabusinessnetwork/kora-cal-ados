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
  Composicao,
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
 * Uma mudança numa categoria, com a única regra de transição que a tela tem.
 *
 * **Trocar de peça descarta os parâmetros da peça anterior.** Existe por causa do BUG-019: o
 * cabedal baixo e o cabedal cano alto têm um parâmetro com o MESMO nome, `altura-do-cano`, e
 * faixas que mal se encostam (0,05 a 0,12 contra 0,1 a 0,22). Carregar 0,075 da peça velha para a
 * nova produzia `PARAMETRO_INVALIDO` e a tela inteira virava uma linha vermelha, sem que ninguém
 * tivesse feito nada errado: a pessoa só trocou de peça.
 *
 * Descartar, e não aparar para dentro da faixa nova. Aparar mudaria o número que a pessoa escolheu
 * sem avisar, e "valor aproximado que ninguém pediu" é a mesma família de defeito que o princípio
 * nº1 persegue na cor. Sem parâmetro, `validarComposicao` preenche o padrão declarado pela peça
 * nova, que é a resposta que ela mesma dá para "que tamanho eu tenho quando ninguém escolheu".
 *
 * A **cor** sobrevive à troca de propósito: cor é escolha da marca sobre a zona, não propriedade
 * da peça. Quem pintou o cabedal de azul e trocou o modelo continua querendo azul.
 *
 * Esta função mora aqui, e não dentro do componente, porque foi exatamente ali que o BUG-019
 * nasceu: transição de estado dentro do `.tsx` é regra no único arquivo desta pasta que nenhum
 * teste alcança.
 */
export function mudarEscolhaDaTela(
  escolhas: ReadonlyMap<string, EscolhaDaTela>,
  categoria: string,
  mudanca: Partial<EscolhaDaTela>,
): Map<string, EscolhaDaTela> {
  const antes = escolhas.get(categoria) ?? { pecaId: null };
  const trocouDePeca = mudanca.pecaId !== undefined && mudanca.pecaId !== antes.pecaId;
  const depois = { ...antes, ...mudanca };

  if (trocouDePeca) {
    delete depois.parametros;
  } else if (mudanca.parametros !== undefined) {
    // Mexer num parâmetro SOMA ao que já estava, e não substitui. O espalhamento de cima trocaria
    // o objeto inteiro pelo da mudança, que traz uma chave só, a do controle arrastado: numa peça
    // de dois parâmetros, arrastar a espessura apagaria a largura já escolhida, e a peça voltaria
    // ao padrão dela sem ninguém ter tocado ali (R7-A58).
    depois.parametros = { ...antes.parametros, ...mudanca.parametros };
  }

  return new Map(escolhas).set(categoria, depois);
}

/**
 * As escolhas da tela viram a composição do ADR-008: JSON de algumas linhas, e nada além.
 *
 * Sai separado de `montarDaTela` porque é o mesmo objeto que a API recebe e que o modelo de
 * linguagem vai escrever, e a tela precisa poder ENTREGAR isso a quem está montando: não existe
 * tabela para a composição, e o que fica guardado no navegador (`composicaoGuardada.ts`) não sai
 * dele. É também este texto que é guardado.
 *
 * Segue a ordem das categorias da FORMA, e não a ordem em que a pessoa mexeu nos controles. Duas
 * montagens iguais têm que produzir o mesmo texto, senão comparar dois JSON dessa tela vira
 * adivinhação.
 *
 * Categoria sem peça simplesmente não entra: a lista é das peças escolhidas, e `null` ali seria
 * uma peça chamada "nenhuma" que o validador teria de saber ignorar.
 */
export function composicaoDasEscolhas(
  forma: Forma,
  escolhas: ReadonlyMap<string, EscolhaDaTela>,
): Composicao {
  // `flatMap` e não `filter().map()`: o filtro com predicado de tipo estreita a ESCOLHA, e não o
  // `pecaId` dentro dela, então o `null` da categoria dispensada sobrevivia até a saída.
  const pecas = forma.categorias.flatMap(({ categoria }) => {
    const escolha = escolhas.get(categoria);

    if (escolha?.pecaId == null) return [];

    return [{ peca_id: escolha.pecaId, cor: escolha.cor, parametros: escolha.parametros }];
  });

  return { forma_id: forma.id, pecas };
}

/** O caminho de volta: ou as escolhas prontas, ou a frase que diz o que corrigir. Nunca os dois. */
export type ColagemDaComposicao =
  | { escolhas: Map<string, EscolhaDaTela>; erro: null }
  | { escolhas: null; erro: string };

/**
 * O JSON de uma composição volta a ser o estado da tela.
 *
 * O inverso exato de `composicaoDasEscolhas`, e é isso que fecha o ciclo: dava para copiar a
 * montagem e não dava para colá-la de volta, então o botão de copiar resolvia metade do problema.
 * O JSON ia para a API, para o bloco de notas de alguém, para um chamado, e nunca mais voltava
 * para a tela que o produziu.
 *
 * Passa pelo MESMO `validarComposicao` que a API usa, e não por uma conferência própria. Um
 * segundo guarda seria uma segunda implementação da regra, e a tela passaria a aceitar ou recusar
 * coisas diferentes do que a API aceita ou recusa. Colar aqui é ensaiar a chamada de verdade.
 *
 * Recusa a forma trocada antes de qualquer outra coisa, e essa conferência é daqui, não do
 * validador: para o validador uma composição de outra forma é perfeitamente válida, e é a TELA que
 * está presa a uma forma só. Sem esta recusa, as categorias da outra forma virariam chaves que
 * nenhum controle desta tela lê, e a montagem sairia sem elas, em silêncio. É o princípio nº1 na
 * sua forma mais literal: zona errada falha alto e visível, nunca aplica no lugar errado.
 */
export function escolhasDoTextoColado(
  texto: string,
  forma: Forma,
  catalogo: CatalogoDoAcervo,
): ColagemDaComposicao {
  if (texto.trim() === '') {
    return { escolhas: null, erro: 'Cole o JSON de uma composição para montá-la aqui.' };
  }

  let entrada: unknown;
  try {
    entrada = JSON.parse(texto);
  } catch {
    // A mensagem do `JSON.parse` fala de posição de caractere, que não ajuda quem colou torto.
    return {
      escolhas: null,
      erro: 'O texto colado não é JSON. Copie o bloco inteiro, das chaves de abrir às de fechar.',
    };
  }

  const formaPedida = (entrada as { forma_id?: unknown } | null)?.forma_id;
  if (formaPedida !== forma.id) {
    return {
      escolhas: null,
      erro:
        `Esta composição é da forma "${String(formaPedida)}", e esta tela monta a forma ` +
        `"${forma.id}". Montá-la aqui daria um calçado sem as peças que não existem nesta forma.`,
    };
  }

  try {
    return { escolhas: escolhasDaComposicao(validarComposicao(entrada, catalogo)), erro: null };
  } catch (erro) {
    return { escolhas: null, erro: mensagemDe(erro) };
  }
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
  try {
    const composicao = validarComposicao(composicaoDasEscolhas(forma, escolhas), catalogo);
    const { modelo, zonas } = montarComposicao(composicao, provedorDeGltf);

    return { modelo, zonas, erro: null };
  } catch (erro) {
    return { modelo: null, zonas: [], erro: mensagemDe(erro) };
  }
}

/**
 * A mensagem que a pessoa lê. O código do erro entra junto quando existe.
 *
 * Exportada para o painel de prompt (T09c): a recusa da resposta do modelo de linguagem é a mesma
 * recusa da colagem, e duas funções de mensagem escreveriam o mesmo erro de dois jeitos.
 *
 * O código aparece porque ele é contrato público de API (`erros.ts`): quem está montando um
 * calçado aqui é a mesma pessoa que vai receber esse código na integração, e ver os dois lados
 * com o mesmo nome é o que impede "o editor disse uma coisa e a API disse outra".
 */
export function mensagemDe(erro: unknown): string {
  if (erro instanceof ErroDeVariante) return `${erro.codigo}: ${erro.message}`;
  if (erro instanceof Error) return erro.message;

  return 'A composição foi recusada, e o motivo não veio em forma de erro.';
}

/**
 * A zona a que uma malha clicada pertence, segundo a montagem que está EM CENA.
 *
 * O painel "Peça clicada" dizia, no próprio texto de ajuda, que o nome do nó e a categoria "são os
 * dois lados do mesmo endereço", e mostrava um lado só. O outro lado, que é justamente o que a API
 * recolore e o que tem controle de cor na tela, a pessoa tinha de achar casando com o olho o id que
 * apareceu aqui com a lista de zonas mais abaixo.
 *
 * A resposta sai das `zonas` da montagem, e não do catálogo, de propósito: o catálogo sabe a que
 * categoria uma peça PODE servir, e a pergunta da tela é outra, "a peça que eu acabei de clicar,
 * nesta cena, é de que zona". Malha que não está em zona nenhuma devolve `null`, e a tela diz isso
 * em vez de inventar uma categoria: zona errada em silêncio é o que o princípio nº1 proíbe.
 */
export function zonaDaMalha(zonas: readonly Zona3d[], malha: string | null): string | null {
  if (malha === null) return null;

  return zonas.find(({ malhas }) => malhas.includes(malha))?.zone_key ?? null;
}
