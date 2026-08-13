// Prova a premissa do princípio nº1: trocar o parser NÃO muda a cor que sai do motor.
//
// O ambiente de teste é Node, então o caminho "navegador" é simulado instalando o
// DOMParser/XMLSerializer de uma janela jsdom como global — que é exatamente a API nativa
// que o navegador expõe. Se os dois caminhos divergirem, editor e API divergem.

import { describe, it, expect, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { gerarVarianteDeCor } from './gerarVarianteDeCor';
import { normalizarSvg } from './normalizarSvg';
import { parsearSvg, serializarSvg } from './parsearSvg';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg"><style>.st0{fill:#333333;}</style><g id="zona-sola"><path class="st0" d="M0 0h10v10H0z"/><path fill="#111111" d="M0 0h5v5H0z"/></g></svg>`;
const ZONAS = [{ zone_key: 'sola', svg_selector: '#zona-sola' }];

/** Instala a API nativa do navegador como global, usando a janela do jsdom. */
function comDomNativo<T>(executar: () => T): T {
  const janela = new JSDOM('').window;

  Object.assign(globalThis, {
    DOMParser: janela.DOMParser,
    XMLSerializer: janela.XMLSerializer,
  });

  return executar();
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'DOMParser');
  Reflect.deleteProperty(globalThis, 'XMLSerializer');
});

describe('parsearSvg — mesmo motor nos dois ambientes', () => {
  it('normaliza igual com DOM nativo e com o analisador de Node', () => {
    const emNode = normalizarSvg(SVG);
    const noNavegador = comDomNativo(() => normalizarSvg(SVG));

    expect(noNavegador.svg).toBe(emNode.svg);
    expect(noNavegador.relatorio).toEqual(emNode.relatorio);
  });

  it('gera a MESMA variante de cor nos dois ambientes', () => {
    const canonico = normalizarSvg(SVG).svg;

    const emNode = gerarVarianteDeCor(canonico, ZONAS, { sola: '#C0392B' });
    const noNavegador = comDomNativo(() => gerarVarianteDeCor(canonico, ZONAS, { sola: '#C0392B' }));

    expect(noNavegador).toBe(emNode);
    expect(noNavegador).toMatch(/fill="#C0392B"/i);
  });

  it('usa o DOM nativo quando ele existe, sem depender de registro', () => {
    const documento = comDomNativo(() => parsearSvg(SVG));

    expect(documento.querySelector('#zona-sola')).not.toBeNull();
    expect(comDomNativo(() => serializarSvg(documento))).toContain('zona-sola');
  });
});
