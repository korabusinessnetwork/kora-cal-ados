// O guarda da saída do modelo de linguagem (ADR-008 D1).
//
// Este arquivo tem um papel que os outros do projeto não têm. `normalizarSvg` e
// `normalizarModelo3d` conferem um arquivo que um cliente subiu; aqui a entrada pode ter sido
// escrita por um **modelo de linguagem**, que é o único componente do sistema em que não se
// pode confiar por construção. O ADR-008 diz isso com todas as letras: "um prompt é entrada
// de usuário, e a resposta do modelo vira escolha de arquivo. A validação de D1 é o que separa
// isso de uma vulnerabilidade; ela não é opcional e não é tratamento de erro".
//
// Daí as duas regras que mandam no desenho inteiro:
//
// 1. **Pertencimento, nunca formato.** Um id é válido porque ESTÁ no catálogo, jamais porque
//    se parece com um id. `sola-corrida-04` é sintaticamente impecável e é recusado se não
//    existir. Validar por regex aqui seria uma allowlist que aceita qualquer coisa.
// 2. **A saída carrega a peça do catálogo, não o id da entrada.** Quem recebe uma
//    `ComposicaoValidada` não tem a string que o modelo escreveu, então não tem como
//    transformá-la em caminho de arquivo. O guarda não confere e devolve: ele troca.
//
// O módulo é puro: sem rede, sem disco, sem Storage. Ele não sabe o que é um glTF.

import { ErroDeVariante } from '../render/erros';
import { validarCor } from '../render/validarCor';
import { validarZoneKey } from '../render/validarZoneKey';
import type {
  CatalogoDoAcervo,
  ComposicaoValidada,
  Forma,
  PecaDoAcervo,
  PecaValidada,
} from './tiposDaComposicao';

/**
 * Devolve a composição resolvida contra o acervo, ou recusa dizendo o que corrigir.
 *
 * A entrada é `unknown` de propósito: tipá-la como `Composicao` seria afirmar na assinatura
 * exatamente o que esta função existe para verificar.
 *
 * Recusa em vez de devolver "quase certo", como todo o resto do motor: peça inexistente,
 * forma trocada, categoria faltando ou repetida e parâmetro fora da faixa viram erro com
 * código, nunca um calçado com um buraco no lugar da sola.
 */
export function validarComposicao(entrada: unknown, catalogo: CatalogoDoAcervo): ComposicaoValidada {
  const bruta = lerEstrutura(entrada);
  const forma = acharForma(catalogo, bruta.forma_id);
  const pecasDoAcervo = indexarPecasPorId(catalogo);

  const pecas = bruta.pecas.map((escolha, posicao) =>
    resolverEscolha(escolha, posicao, forma, pecasDoAcervo),
  );

  // As duas conferências que só existem olhando o conjunto, e por isso vêm depois de resolver
  // cada escolha. A ordem entre elas não é indiferente: repetida primeiro, porque uma sola
  // escolhida duas vezes também satisfaz "sola presente", e reclamar da falta esconderia a
  // duplicata.
  recusarCategoriaRepetida(pecas);
  recusarCategoriaObrigatoriaAusente(forma, pecas);

  return { forma, pecas };
}

/** A entrada ainda crua, depois de provado que ela tem a forma de uma composição. */
interface ComposicaoBruta {
  forma_id: string;
  pecas: unknown[];
}

function lerEstrutura(entrada: unknown): ComposicaoBruta {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      'A composição precisa ser um objeto JSON com "forma_id" e a lista "pecas".',
    );
  }

  const { forma_id: formaId, pecas } = entrada as { forma_id?: unknown; pecas?: unknown };

  if (typeof formaId !== 'string' || formaId.trim() === '') {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      'A composição precisa dizer de qual forma ela é, no campo "forma_id".',
    );
  }

  if (!Array.isArray(pecas)) {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      'O campo "pecas" da composição precisa ser uma lista. Objeto com uma chave por categoria não serve: chave repetida some no JSON.parse e a última venceria em silêncio.',
    );
  }

  return { forma_id: formaId.trim(), pecas };
}

/**
 * Forma desconhecida é `COMPOSICAO_INVALIDA` e não `PECA_NAO_ENCONTRADA`: nenhuma peça foi
 * consultada ainda, e mandar procurar um id de peça mandaria procurar a coisa errada.
 */
function acharForma(catalogo: CatalogoDoAcervo, formaId: string): Forma {
  const forma = catalogo.formas.find((candidata) => candidata.id === formaId);

  if (forma === undefined) {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      `A forma "${formaId}" não existe no acervo visível.`,
    );
  }

  return forma;
}

/**
 * Id repetido no catálogo é acervo malformado, não composição malformada, e o primeiro vence.
 * Não é recusa porque o defeito não é de quem pediu: quebrar o pedido do designer por causa
 * de uma linha duplicada no nosso banco o deixaria sem saída nenhuma.
 */
function indexarPecasPorId(catalogo: CatalogoDoAcervo): Map<string, PecaDoAcervo> {
  const porId = new Map<string, PecaDoAcervo>();

  for (const peca of catalogo.pecas) {
    if (!porId.has(peca.id)) porId.set(peca.id, peca);
  }

  return porId;
}

function resolverEscolha(
  escolha: unknown,
  posicao: number,
  forma: Forma,
  pecasDoAcervo: Map<string, PecaDoAcervo>,
): PecaValidada {
  if (typeof escolha !== 'object' || escolha === null || Array.isArray(escolha)) {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      `A escolha na posição ${posicao} da composição precisa ser um objeto com "peca_id".`,
    );
  }

  const { peca_id: pecaId, cor, parametros } = escolha as {
    peca_id?: unknown;
    cor?: unknown;
    parametros?: unknown;
  };

  if (typeof pecaId !== 'string' || pecaId.trim() === '') {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      `A escolha na posição ${posicao} da composição precisa de um "peca_id".`,
    );
  }

  // O coração do módulo: pertencimento ao catálogo. O que sai daqui é a peça do acervo, e a
  // string `pecaId` não viaja adiante.
  const peca = pecasDoAcervo.get(pecaId.trim());

  if (peca === undefined) {
    throw new ErroDeVariante(
      'PECA_NAO_ENCONTRADA',
      `A peça "${pecaId}" não existe no acervo visível. Escolha uma peça do catálogo — o catálogo é a lista completa do que pode ser usado.`,
    );
  }

  if (peca.forma_id !== forma.id) {
    throw new ErroDeVariante(
      'FORMAS_MISTURADAS',
      `A peça "${peca.id}" é da forma "${peca.forma_id}", e esta composição é da forma "${forma.id}". Peça só encaixa em peça da mesma forma.`,
    );
  }

  // A categoria vem do catálogo, e ainda assim é validada: no produto gerado ela É a zone_key
  // pública da zona (ADR-008 D3). Uma categoria com acento passaria despercebida aqui e só
  // explodiria na API, longe da causa.
  const categoria = validarZoneKey(peca.categoria);

  if (!forma.categorias.some((prevista) => prevista.categoria === categoria)) {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      `A forma "${forma.id}" não tem a categoria "${categoria}", então a peça "${peca.id}" não cabe nesta composição.`,
    );
  }

  return {
    categoria,
    peca,
    // `validarCor` recebe a categoria no lugar da zone_key e a mensagem sai correta por
    // construção, não por coincidência: no produto gerado as duas são o mesmo texto.
    ...(cor === undefined ? {} : { cor: validarCor(cor, categoria) }),
    parametros: resolverParametros(peca, parametros),
  };
}

/**
 * Todo parâmetro declarado pela peça sai preenchido, e nenhum parâmetro não declarado entra.
 *
 * Ignorar um parâmetro desconhecido em silêncio seria o pior resultado possível: "sola mais
 * robusta" não teria efeito nenhum e ninguém saberia por quê.
 */
function resolverParametros(peca: PecaDoAcervo, pedidos: unknown): Record<string, number> {
  if (pedidos !== undefined && (typeof pedidos !== 'object' || pedidos === null || Array.isArray(pedidos))) {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      `O campo "parametros" da peça "${peca.id}" precisa ser um objeto de nome para número.`,
    );
  }

  const pedidosPorNome = (pedidos ?? {}) as Record<string, unknown>;
  const declarados = new Set(peca.parametros.map((parametro) => parametro.nome));

  for (const nome of Object.keys(pedidosPorNome)) {
    if (!declarados.has(nome)) {
      throw new ErroDeVariante(
        'PARAMETRO_INVALIDO',
        `A peça "${peca.id}" não tem o parâmetro "${nome}". Os que ela aceita: ${listar(peca.parametros.map((parametro) => parametro.nome))}.`,
      );
    }
  }

  const resolvidos: Record<string, number> = {};

  for (const parametro of peca.parametros) {
    // Faixa invertida é acervo malformado: nenhum valor passaria, e a mensagem apontaria a
    // composição quando o defeito é nosso. Melhor dizer de quem é.
    if (parametro.minimo > parametro.maximo) {
      throw new ErroDeVariante(
        'PARAMETRO_INVALIDO',
        `O parâmetro "${parametro.nome}" da peça "${peca.id}" está cadastrado com faixa impossível (mínimo ${parametro.minimo}, máximo ${parametro.maximo}). O acervo precisa de correção; a composição está correta.`,
      );
    }

    const pedido = pedidosPorNome[parametro.nome];

    if (pedido === undefined) {
      resolvidos[parametro.nome] = parametro.padrao;
      continue;
    }

    // `NaN` atravessa qualquer comparação de faixa sem disparar (`NaN < 0` é falso e
    // `NaN > 10` também), então a checagem de número precisa vir antes e ser própria. É o
    // mesmo buraco que `limitar` tapa em `corSrgbLinear.ts`.
    if (typeof pedido !== 'number' || !Number.isFinite(pedido)) {
      throw new ErroDeVariante(
        'PARAMETRO_INVALIDO',
        `O parâmetro "${parametro.nome}" da peça "${peca.id}" precisa ser um número entre ${parametro.minimo} e ${parametro.maximo}.`,
      );
    }

    if (pedido < parametro.minimo || pedido > parametro.maximo) {
      throw new ErroDeVariante(
        'PARAMETRO_INVALIDO',
        `O parâmetro "${parametro.nome}" da peça "${peca.id}" está em ${pedido}, fora da faixa aceita (${parametro.minimo} a ${parametro.maximo}).`,
      );
    }

    resolvidos[parametro.nome] = pedido;
  }

  return resolvidos;
}

function recusarCategoriaRepetida(pecas: PecaValidada[]): void {
  const vistas = new Set<string>();

  for (const { categoria, peca } of pecas) {
    if (vistas.has(categoria)) {
      throw new ErroDeVariante(
        'COMPOSICAO_INVALIDA',
        `A categoria "${categoria}" aparece mais de uma vez nesta composição (a segunda é a peça "${peca.id}"). Cada categoria recebe exatamente uma peça.`,
      );
    }

    vistas.add(categoria);
  }
}

function recusarCategoriaObrigatoriaAusente(forma: Forma, pecas: PecaValidada[]): void {
  const escolhidas = new Set(pecas.map(({ categoria }) => categoria));
  const faltando = forma.categorias
    .filter(({ obrigatoria, categoria }) => obrigatoria && !escolhidas.has(categoria))
    .map(({ categoria }) => categoria);

  if (faltando.length > 0) {
    throw new ErroDeVariante(
      'COMPOSICAO_INVALIDA',
      `A composição da forma "${forma.id}" está sem ${faltando.length === 1 ? 'a categoria obrigatória' : 'as categorias obrigatórias'} ${listar(faltando)}.`,
    );
  }
}

/** `a`, `b` e `c` — lista legível numa mensagem de erro, sem virgular o último item. */
function listar(itens: string[]): string {
  const citados = itens.map((item) => `"${item}"`);
  const ultimo = citados.pop();

  if (ultimo === undefined) return 'nenhum';

  return citados.length === 0 ? ultimo : `${citados.join(', ')} e ${ultimo}`;
}
