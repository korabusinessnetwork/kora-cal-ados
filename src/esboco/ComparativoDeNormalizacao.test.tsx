// Prende o que o comparativo AFIRMA. Ele existe para provar o BUG-001 lado a lado; se os
// dois lados não receberem o mesmo pedido de cor, as imagens saem iguais e o painel vira
// decoração, foi exatamente o defeito encontrado ao abrir a página no navegador.
//
// `renderToStaticMarkup` em vez de testing-library: o que precisa ser verificado é o
// `src` que sai no HTML, e isso não justifica uma dependência nova.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComparativoDeNormalizacao } from './ComparativoDeNormalizacao';
import { normalizarSvg } from '../lib/render/normalizarSvg';
import { analisarSvg } from '../lib/render/dom';
import { assetBaseCru, coresIniciais } from './produtoDemo';

const AZUL = '#2B4C7E';
const canonico = normalizarSvg(assetBaseCru).svg;

/** Devolve o SVG de cada `<img>` do comparativo, já decodificado da data URL. */
function svgsRenderizados(markup: string): string[] {
  return [...markup.matchAll(/src="data:image\/svg\+xml;charset=utf-8,([^"]*)"/g)].map((achado) =>
    decodeURIComponent(achado[1] as string),
  );
}

function temBlocoDeEstilo(svg: string): boolean {
  return analisarSvg(svg).querySelector('style') !== null;
}

describe('comparativo de normalização', () => {
  it('manda o MESMO pedido de cor para os dois lados', () => {
    const cores = { ...coresIniciais(), cabedal: AZUL };
    const svgs = svgsRenderizados(
      renderToStaticMarkup(<ComparativoDeNormalizacao cores={cores} svgCanonico={canonico} />),
    );

    expect(svgs).toHaveLength(2);
    // O lado canônico é uma VARIANTE, não o asset-base repetido: sem isto o comparativo
    // mostra a mesma imagem dos dois lados e não prova nada.
    expect(svgs[1]).not.toBe(canonico);
    for (const svg of svgs) expect(svg).toContain(AZUL);
  });

  it('só o lado canônico realmente muda de cor, o cru continua preso ao CSS (BUG-001)', () => {
    const cores = { ...coresIniciais(), cabedal: AZUL };
    const [cru, canonicoPintado] = svgsRenderizados(
      renderToStaticMarkup(<ComparativoDeNormalizacao cores={cores} svgCanonico={canonico} />),
    );

    // No cru a regra `.st-*` sobrevive e é ela que pinta; no canônico não existe bloco
    // de estilo. Consulta pelo DOM, não por substring: o SVG de demo cita "<style>"
    // dentro de um comentário, e busca em texto acusaria o que não é elemento.
    expect(temBlocoDeEstilo(cru as string)).toBe(true);
    expect(temBlocoDeEstilo(canonicoPintado as string)).toBe(false);
  });

  it('pedido recusado não vira <img src="">', () => {
    // Cor chapa na zona de gradiente: o motor recusa os dois lados (ADR-004, q1).
    const cores = { ...coresIniciais(), detalhe: AZUL };
    const markup = renderToStaticMarkup(
      <ComparativoDeNormalizacao cores={cores} svgCanonico={canonico} />,
    );

    // `src=""` faz o navegador pedir a própria página de novo (404 + download inteiro).
    expect(markup).not.toContain('src=""');
    expect(svgsRenderizados(markup)).toHaveLength(0);
    expect(markup).toContain('pedido recusado');
  });
});
