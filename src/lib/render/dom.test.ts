// @vitest-environment jsdom
//
// O resto da suíte roda o motor com o jsdom registrado à mão (setupFiles → domNode.ts),
// que é o caminho do Node: função serverless e testes. Este arquivo cobre o OUTRO
// caminho, o do navegador — `DOMParser`/`XMLSerializer` globais, sem registro nenhum.
//
// Existe porque "mesmo motor nos dois lados" é o princípio nº1 do CLAUDE.md, e uma
// afirmação dessas sem teste é só uma intenção: se o caminho do navegador quebrasse, o
// editor mostraria uma cor e a API entregaria outra — exatamente o que não pode acontecer.
//
// `vi.resetModules()` é o que zera o adaptador já registrado pelo setup; sem isso o jsdom
// registrado venceria e o teste passaria testando o caminho errado.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const SUJO = `<svg xmlns="http://www.w3.org/2000/svg">
  <style>.st0{fill:#E9E4DA;stroke:#C9C2B4;}</style>
  <script>/* fixture */</script>
  <path id="zona-cabedal" class="st0" d="M0 0 L10 0 L10 10 Z"/>
  <rect id="zona-sola" style="fill:#2E2E33" x="0" y="10" width="10" height="3"/>
</svg>`;

const ZONAS = [
  { zone_key: 'cabedal', svg_selector: '#zona-cabedal' },
  { zone_key: 'sola', svg_selector: '#zona-sola' },
];

beforeEach(() => {
  vi.resetModules();
});

describe('motor no caminho do navegador', () => {
  it('usa o DOMParser global quando ninguém registrou adaptador', async () => {
    const { normalizarSvg } = await import('./normalizarSvg');
    const { relatorio } = normalizarSvg(SUJO);

    expect(relatorio.scriptsRemovidos).toBe(1);
    expect(relatorio.declaracoesAchatadas).toBeGreaterThan(0);
  });

  it('achata o CSS igual ao caminho do Node', async () => {
    const { normalizarSvg } = await import('./normalizarSvg');
    const { svg } = normalizarSvg(SUJO);

    expect(svg).toMatch(/fill="#E9E4DA"/i);
    expect(svg).toMatch(/stroke="#C9C2B4"/i);
    expect(svg).toMatch(/fill="#2E2E33"/i);
    expect(svg).not.toMatch(/<style/i);
  });

  it('gera a variante com a cor pedida', async () => {
    const { normalizarSvg } = await import('./normalizarSvg');
    const { gerarVarianteDeCor } = await import('./gerarVarianteDeCor');

    const canonico = normalizarSvg(SUJO).svg;
    const variante = gerarVarianteDeCor(canonico, ZONAS, { cabedal: '#FF0000' });

    expect(variante).toMatch(/id="zona-cabedal"[^>]*fill="#FF0000"/i);
    // Zona não pedida não pode mudar de cor de tabela.
    expect(variante).toMatch(/fill="#2E2E33"/i);
  });

  it('recusa cor inválida com o mesmo código de erro do Node', async () => {
    const { normalizarSvg } = await import('./normalizarSvg');
    const { gerarVarianteDeCor } = await import('./gerarVarianteDeCor');

    const canonico = normalizarSvg(SUJO).svg;

    expect(() => gerarVarianteDeCor(canonico, ZONAS, { cabedal: 'banana' })).toThrow(
      expect.objectContaining({ codigo: 'COR_INVALIDA' }),
    );
  });
});
