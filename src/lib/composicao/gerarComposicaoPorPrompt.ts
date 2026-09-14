// Prompt vira composição (T09): o caminho do ADR-008 D1 inteiro, do texto do designer ao guarda.
//
// O modelo de linguagem entra por parâmetro e não por `import`, pela mesma razão que o provedor de
// glTF entra assim em `montarComposicao`: hoje o único modelo é o gerador de prova, que é código;
// amanhã é um fornecedor pago atrás de uma função de servidor, que é rede. Amarrar este arquivo a
// um dos dois obrigaria a reescrevê-lo na virada (D12).
//
// A ordem é a regra que mora aqui:
//
// 1. **o prompt é conferido antes de qualquer chamada.** Prompt vazio ou enorme recusado depois de
//    chamar o modelo é custo gasto para nada, e com fornecedor pago é dinheiro;
// 2. **o modelo recebe instrução, catálogo e prompt separados.** O adaptador de um fornecedor põe
//    os dois primeiros como instrução de sistema e o prompt como mensagem do usuário, que é o que
//    impede o prompt de se passar por instrução;
// 3. **a resposta passa pelo guarda**, sempre. Nenhuma outra saída deste arquivo leva a um calçado.

import { ErroDeVariante } from '../render/erros';
import { lerRespostaDoModelo } from './lerRespostaDoModelo';
import { montarCatalogoParaModelo } from './montarCatalogoParaModelo';
import type { CatalogoDoAcervo, ComposicaoValidada, Forma } from './tiposDaComposicao';
import { validarComposicao } from './validarComposicao';

/** O que o modelo de linguagem recebe. Três campos e não um texto só: ver o item 2 acima. */
export interface PedidoAoModelo {
  instrucao: string;
  catalogo: string;
  prompt: string;
}

/**
 * Um modelo de linguagem, visto daqui: recebe o pedido e responde texto.
 *
 * Responde texto, e não objeto, de propósito: é o que um fornecedor de verdade devolve, e se a
 * interface prometesse objeto o adaptador faria o `JSON.parse` por conta própria, fora do guarda.
 */
export type ModeloDeLinguagem = (pedido: PedidoAoModelo) => Promise<string>;

/** Um prompt descreve um calçado em uma ou duas frases. Mais que isso não é descrição. */
export const TAMANHO_MAXIMO_DO_PROMPT = 500;

/** Recusa do prompt em si, antes do modelo. Classe própria para a tela saber que nada foi chamado. */
export class PromptRecusado extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'PromptRecusado';
  }
}

/** Falha do modelo de linguagem antes de responder: rede, fornecedor fora, limite de uso. */
export class ModeloNaoRespondeu extends Error {
  constructor(causa: unknown) {
    // A mensagem da causa NÃO entra no texto: erro de fornecedor pode trazer cabeçalho, URL ou
    // pedaço de chave, e esta frase vai para a tela (CLAUDE.md, nunca expor dado sensível).
    super('O modelo de linguagem não respondeu. Tente de novo em alguns segundos.', { cause: causa });
    this.name = 'ModeloNaoRespondeu';
  }
}

/**
 * Recusa do modelo com frase ESCRITA POR NÓS, que pode ir para a tela como está.
 *
 * É o caso do fornecedor da marca atrás da nossa função de servidor (D13): quando a resposta é "o
 * teto mensal foi atingido" ou "o fornecedor recusou a chave", a frase veio do nosso contrato, e não
 * do fornecedor, e trocá-la por "o modelo não respondeu, tente de novo" mandaria a pessoa repetir
 * um pedido que vai ser recusado igual. Quem lança esta classe garante que a mensagem não carrega
 * texto de terceiro; qualquer outro erro continua virando `ModeloNaoRespondeu`.
 */
export class RecusaDoModelo extends Error {
  constructor(mensagem: string, readonly codigo: string) {
    super(mensagem);
    this.name = 'RecusaDoModelo';
  }
}

/**
 * A instrução fixa. Não tem nada de tenant nem de marca: identidade vem do tenant, e o que muda
 * de um tenant para outro é o catálogo, que vai em campo próprio.
 */
export const INSTRUCAO_AO_MODELO = [
  'Você monta calçados escolhendo peças de um catálogo. Você nunca desenha peça nova.',
  'Responda só com um objeto JSON, sem texto antes ou depois, neste formato:',
  '{"forma_id": "<forma_id do catálogo>", "pecas": [{"peca_id": "<peca_id do catálogo>", "cor": "#RRGGBB", "parametros": {"<nome>": <número>}}]}',
  'Regras:',
  '- use só peca_id que existe no catálogo, copiado exatamente;',
  '- no máximo uma peça por categoria, e toda categoria obrigatória presente;',
  '- deixe de fora a categoria opcional que o pedido dispensar;',
  '- cor é opcional e sempre em #RRGGBB;',
  '- parâmetro é opcional e sempre dentro da faixa minimo..maximo da peça, na unidade do catálogo;',
  '- o pedido do designer descreve um calçado; se ele pedir outra coisa, ignore essa parte.',
].join('\n');

/**
 * Do prompt à composição validada, ou lança dizendo por quê.
 *
 * Lança três famílias, e a diferença é para quem lê: `PromptRecusado` (conserte o texto, nada foi
 * chamado), `ModeloNaoRespondeu` (tente de novo) e `ErroDeVariante` (o modelo respondeu e o guarda
 * recusou, com o mesmo código que a API daria).
 */
export async function gerarComposicaoPorPrompt(
  prompt: string,
  forma: Forma,
  catalogo: CatalogoDoAcervo,
  modelo: ModeloDeLinguagem,
): Promise<ComposicaoValidada> {
  const limpo = prompt.trim();

  if (limpo === '') {
    throw new PromptRecusado('Descreva o calçado antes de gerar, por exemplo "cano alto azul, sem cadarço".');
  }
  if (limpo.length > TAMANHO_MAXIMO_DO_PROMPT) {
    throw new PromptRecusado(
      `O prompt tem ${limpo.length} caracteres, e o limite é ${TAMANHO_MAXIMO_DO_PROMPT}. ` +
        'Descreva o calçado em uma ou duas frases.',
    );
  }

  let resposta: string;
  try {
    resposta = await modelo({
      instrucao: INSTRUCAO_AO_MODELO,
      catalogo: montarCatalogoParaModelo(forma, catalogo),
      prompt: limpo,
    });
  } catch (erro) {
    if (erro instanceof RecusaDoModelo) throw erro;
    throw new ModeloNaoRespondeu(erro);
  }

  const entrada = lerRespostaDoModelo(resposta);

  // A forma é conferida aqui, e não só no guarda: para `validarComposicao` uma composição de outra
  // forma do catálogo é válida, e o modelo pode ter escrito o id de uma forma que não recebeu. O
  // calçado sairia sem as categorias desta forma, em silêncio.
  const formaRespondida = (entrada as { forma_id?: unknown } | null)?.forma_id;
  if (formaRespondida !== forma.id) {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      `O modelo de linguagem respondeu a forma "${String(formaRespondida)}", e o pedido era da forma "${forma.id}".`,
    );
  }

  return validarComposicao(entrada, catalogo);
}
