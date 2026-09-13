// O catálogo para o modelo: o que o modelo de linguagem lê para saber quais peças existem.
//
// Existe separado de quem chama o modelo porque a pergunta que ele responde é de segurança e não
// de formatação: O QUE sai do acervo e vai parar dentro de um pedido a um terceiro. Duas regras
// mandam no arquivo inteiro:
//
// 1. **Só as peças da forma em uso.** Uma peça de outra forma no catálogo seria um convite ao
//    `FORMAS_MISTURADAS`, e o modelo não tem como saber que não pode misturar se o catálogo
//    oferece. Recortar aqui é prevenção; a recusa em `validarComposicao` continua existindo.
// 2. **Nada além do que a composição usa.** Id, categoria, rótulo e faixa de parâmetro. O
//    `assenta_sobre` da forma é detalhe de montagem, e todo campo a mais é campo que um dia
//    carrega algo que não devia sair.
//
// O recorte por tenant NÃO é daqui: o catálogo recebido já é o acervo visível àquele tenant,
// cortado por RLS antes de chegar (ADR-008 D6). Este módulo não tem como saber de quem é uma
// peça, e fingir que confere seria uma segunda guarda que não guarda nada.
//
// Sai em JSON e não em frases de propósito: um rótulo com quebra de linha ou com "ignore as
// instruções" dentro vira uma string entre aspas, e não uma linha nova do texto que o modelo lê.

import type { CatalogoDoAcervo, Forma } from './tiposDaComposicao';

/** O formato do catálogo para o modelo. Exportado para o gerador de prova ler o mesmo contrato. */
export interface CatalogoParaModelo {
  forma_id: string;
  rotulo: string;
  categorias: { categoria: string; obrigatoria: boolean }[];
  pecas: {
    peca_id: string;
    categoria: string;
    rotulo: string;
    parametros: { nome: string; minimo: number; maximo: number; padrao: number }[];
  }[];
}

/**
 * O texto que o modelo de linguagem recebe como catálogo.
 *
 * A chave da peça é `peca_id`, a mesma da composição, e não `id`: o modelo copia o nome que vê,
 * e um nome diferente na entrada e na saída é um erro de digitação esperando para acontecer.
 */
export function montarCatalogoParaModelo(forma: Forma, catalogo: CatalogoDoAcervo): string {
  return JSON.stringify(catalogoParaModelo(forma, catalogo), null, 2);
}

/** O mesmo recorte, em objeto. Separado para o teste conferir o conteúdo sem reler o texto. */
export function catalogoParaModelo(forma: Forma, catalogo: CatalogoDoAcervo): CatalogoParaModelo {
  const categoriasDaForma = new Set(forma.categorias.map(({ categoria }) => categoria));

  return {
    forma_id: forma.id,
    rotulo: forma.rotulo,
    categorias: forma.categorias.map(({ categoria, obrigatoria }) => ({ categoria, obrigatoria })),
    pecas: catalogo.pecas
      // A categoria também filtra: peça da forma certa numa categoria que a forma não prevê seria
      // recusada pelo guarda, então oferecê-la ao modelo só produziria recusa.
      .filter((peca) => peca.forma_id === forma.id && categoriasDaForma.has(peca.categoria))
      .map((peca) => ({
        peca_id: peca.id,
        categoria: peca.categoria,
        rotulo: peca.rotulo,
        parametros: peca.parametros.map(({ nome, minimo, maximo, padrao }) => ({
          nome,
          minimo,
          maximo,
          padrao,
        })),
      })),
  };
}
