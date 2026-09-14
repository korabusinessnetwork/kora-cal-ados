// Catálogo de acervo escrito à mão, para o teste de `validarComposicao`.
//
// É o gêmeo de `src/lib/render/fixtures/gltfDeTeste.ts`, e existe pela mesma razão que aquele:
// a validação compara identificadores e nunca carrega geometria, então ela é inteiramente
// testável sem as ~15 peças reais que o ADR-008 diz serem o gargalo do produto. Nenhuma peça
// aqui aponta para arquivo nenhum, não há campo de caminho, de propósito.
//
// O acervo tem DUAS formas porque uma só não conseguiria provar o `FORMAS_MISTURADAS`, que é
// a recusa do ADR-008 D4.

import type { CatalogoDoAcervo, ParametroDePeca, PecaDoAcervo } from '../tiposDaComposicao';

export const FORMA_TENIS = 'tenis-corrida-01';
export const FORMA_CHINELO = 'chinelo-praia-01';

export function parametro(
  nome: string,
  minimo: number,
  maximo: number,
  padrao: number,
): ParametroDePeca {
  return { nome, minimo, maximo, padrao };
}

export function peca(
  id: string,
  categoria: string,
  formaId: string,
  parametros: ParametroDePeca[] = [],
): PecaDoAcervo {
  return { id, categoria, forma_id: formaId, rotulo: id, parametros };
}

/**
 * O acervo padrão dos testes: uma forma de tênis com sola e cabedal **obrigatórios** e
 * cadarço **opcional**, mais um chinelo de uma peça só.
 *
 * O cadarço opcional não é enfeite: é o que prova que a lista de categorias vem da forma e
 * não é fixa no código. Um chinelo sem cadarço tem que ser composição válida.
 */
export function acervoDeTeste(): CatalogoDoAcervo {
  return {
    formas: [
      {
        id: FORMA_TENIS,
        rotulo: 'Tênis de corrida',
        categorias: [
          { categoria: 'sola', obrigatoria: true },
          { categoria: 'cabedal', obrigatoria: true },
          { categoria: 'cadarco', obrigatoria: false },
        ],
      },
      {
        id: FORMA_CHINELO,
        rotulo: 'Chinelo de praia',
        categorias: [{ categoria: 'sola', obrigatoria: true }],
      },
    ],
    pecas: [
      peca('sola-lisa', 'sola', FORMA_TENIS, [parametro('espessura', 10, 40, 22)]),
      peca('sola-tratorada', 'sola', FORMA_TENIS, [
        parametro('espessura', 10, 40, 30),
        parametro('altura-entressola', 0, 25, 12),
      ]),
      peca('cabedal-mesh', 'cabedal', FORMA_TENIS),
      peca('cadarco-chato', 'cadarco', FORMA_TENIS),
      peca('sola-chinelo', 'sola', FORMA_CHINELO, [parametro('espessura', 5, 20, 9)]),
    ],
  };
}
