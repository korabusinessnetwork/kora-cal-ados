// @vitest-environment jsdom
//
// A tela de uma peça desenha um controle por parâmetro, e manda todos para o glTF (R8-A63).
//
// Mesma razão de `ControlesDeParametro.test.tsx`: a peça é sintética e tem dois parâmetros, porque o
// acervo de prova só tem peças de um, e foi por isso que `TelaDoPalco3d.tsx` lia `parametros[0]`
// sem nenhum teste reprovar.

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ParametrosDaPeca, valoresEmVigor } from './ParametrosDaPeca';
import type { ParametroDePeca } from '../lib/composicao/tiposDaComposicao';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const DOIS_PARAMETROS: ParametroDePeca[] = [
  { nome: 'espessura', minimo: 0.01, maximo: 0.03, padrao: 0.018 },
  { nome: 'largura', minimo: 0.08, maximo: 0.12, padrao: 0.1 },
];

let container: HTMLDivElement;
let raiz: Root;
/** Os valores que a tela teria guardado, lidos depois de cada gesto. */
let guardados: Record<string, number>;

/** O mesmo arranjo da tela: estado com os valores, e a mudança somada aos outros. */
function ComoATela() {
  const [valores, setValores] = useState<Record<string, number>>({});
  guardados = valores;

  return (
    <ParametrosDaPeca
      parametros={DOIS_PARAMETROS}
      valores={valores}
      aoMudar={(nome, valor) => setValores((atual) => ({ ...atual, [nome]: valor }))}
    />
  );
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  raiz = createRoot(container);
  act(() => {
    raiz.render(<ComoATela />);
  });
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function faixa(nome: string): HTMLInputElement {
  const achada = container.querySelector<HTMLInputElement>(`input[aria-label="${nome}"]`);
  if (achada === null) throw new Error(`Não há controle para "${nome}".`);

  return achada;
}

function mover(campo: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('um controle por parâmetro na tela de uma peça (R8-A63)', () => {
  it('uma peça de dois parâmetros desenha dois controles, cada um com a sua faixa', () => {
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(2);
    expect(faixa('largura').min).toBe('0.08');
    expect(faixa('largura').max).toBe('0.12');
    expect([...container.querySelectorAll('h2')].map((titulo) => titulo.textContent)).toEqual([
      'espessura',
      'largura',
    ]);
  });

  it('a explicação do parâmetro aparece uma vez só', () => {
    expect(container.querySelectorAll('.painel__ajuda')).toHaveLength(1);
  });

  it('mexer no segundo guarda o segundo, e não apaga o primeiro', () => {
    mover(faixa('espessura'), '0.02');
    mover(faixa('largura'), '0.11');

    expect(guardados).toEqual({ espessura: 0.02, largura: 0.11 });
    expect(container.querySelectorAll('.palco3d__medida strong')[1]?.textContent).toBe('110,0 mm');
  });

  it('o glTF recebe todos os parâmetros, no padrão os que ninguém mexeu', () => {
    expect(valoresEmVigor(DOIS_PARAMETROS, { largura: 0.09 })).toEqual({ espessura: 0.018, largura: 0.09 });
  });
});
