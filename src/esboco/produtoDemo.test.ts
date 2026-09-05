// O esboço só vale alguma coisa se o que ele mostra for verdade. Estes testes prendem a
// premissa dele: o asset-base de demonstração passa pela normalização, as zonas resolvem
// o número de elementos que a tela promete, e o comparativo "antes/depois" mostra um
// fato, não uma encenação.

import { describe, it, expect } from 'vitest';
import { normalizarSvg } from '../lib/render/normalizarSvg';
import { gerarVarianteDeCor, relatorioDeZonas } from '../lib/render/gerarVarianteDeCor';
import { assetBaseCru, zonasDoProduto } from './produtoDemo';

const canonico = normalizarSvg(assetBaseCru);
const VERMELHO = '#FF0000';

/**
 * O cabeçalho do fixture é um comentário que descreve a sujeira do arquivo, então cita
 * "<style>", "<script>" e "onclick" como texto. A normalização preserva comentários — o
 * que ela remove é markup vivo. Sem tirar os comentários, o teste acusaria a própria
 * documentação do fixture como se fosse código sobrevivente.
 */
function semComentarios(svg: string): string {
  return svg.replace(/<!--[\s\S]*?-->/g, '');
}

describe('normalização do asset-base de demonstração', () => {
  it('é aceito (nenhuma propriedade CSS fora do allowlist)', () => {
    expect(canonico.svg).toMatch(/<svg/);
    expect(semComentarios(canonico.svg)).not.toMatch(/<style/i);
  });

  it('remove script, handler on* e referência externa', () => {
    expect(canonico.relatorio.scriptsRemovidos).toBe(1);
    expect(canonico.relatorio.handlersRemovidos).toBe(1);
    expect(canonico.relatorio.referenciasExternasRemovidas).toBe(1);
    expect(semComentarios(canonico.svg)).not.toMatch(/onclick/i);
    expect(semComentarios(canonico.svg)).not.toMatch(/exemplo-externo/);
  });

  it('desambigua os 4 cadarços que nascem com o mesmo id', () => {
    expect(canonico.relatorio.idsRenomeados).toEqual([
      { de: 'zona-cadarco', para: 'zona-cadarco-2' },
      { de: 'zona-cadarco', para: 'zona-cadarco-3' },
      { de: 'zona-cadarco', para: 'zona-cadarco-4' },
    ]);
  });
});

describe('mapeamento de zonas', () => {
  const contagem = Object.fromEntries(
    relatorioDeZonas(canonico.svg, zonasDoProduto).map((linha) => [linha.zone_key, linha.elementos]),
  );

  it('nenhuma zona fica órfã (seletor que não acha nada é zona quebrada)', () => {
    for (const zona of zonasDoProduto) {
      expect(contagem[zona.zone_key], `zona ${zona.zone_key}`).toBeGreaterThan(0);
    }
  });

  it('cadarço captura os 4 elementos, não só o primeiro (BUG-002)', () => {
    expect(contagem['cadarco']).toBe(4);
  });
});

describe('o comparativo do esboço mostra um fato', () => {
  it('no canônico, a cor pedida é a cor que fica', () => {
    const variante = gerarVarianteDeCor(canonico.svg, zonasDoProduto, { cabedal: VERMELHO });

    expect(variante).toMatch(new RegExp(`id="zona-cabedal"[^>]*fill="${VERMELHO}"`, 'i'));
    expect(semComentarios(variante)).not.toMatch(/<style/i);
  });

  it('no arquivo cru, o <style> sobrevive e continua vencendo o atributo (BUG-001)', () => {
    const variante = gerarVarianteDeCor(assetBaseCru, zonasDoProduto, { cabedal: VERMELHO });

    // O motor escreveu o atributo pedido...
    expect(variante).toMatch(new RegExp(`fill="${VERMELHO}"`, 'i'));
    // ...e mesmo assim o cabedal continua bege na tela, porque a regra de classe tem
    // prioridade sobre atributo de apresentação. É por isso que a normalização existe.
    expect(variante).toMatch(/\.st-cabedal\s*\{[^}]*fill:\s*#E9E4DA/i);
    expect(variante).toMatch(/id="zona-cabedal"[^>]*class="st-cabedal"/i);
  });

  it('a zona de gradiente recusa cor chapa em vez de achatar sem avisar', () => {
    expect(() => gerarVarianteDeCor(canonico.svg, zonasDoProduto, { detalhe: VERMELHO })).toThrow(
      expect.objectContaining({ codigo: 'ZONA_NAO_RECOLORIVEL' }),
    );
  });
});
