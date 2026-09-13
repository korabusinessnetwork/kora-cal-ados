// @vitest-environment jsdom
//
// Todos os parâmetros da peça aparecem, e mexer num não apaga o outro (R7-A58).
//
// A peça daqui tem dois parâmetros e é sintética de propósito: o acervo de prova só tem peças de
// um, e foi por isso que a tela lia só `parametros[0]` sem nenhum teste reprovar. O segundo teste
// liga este componente à transição pura, `mudarEscolhaDaTela`, do mesmo jeito que a tela liga, e é
// ele que reprova a substituição do objeto inteiro.

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ControlesDeParametro } from './ControlesDeParametro';
import { mudarEscolhaDaTela, type EscolhaDaTela } from './composicaoDaTela';
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
/** A escolha que a tela teria guardado, lida depois de cada gesto. */
let ultima: EscolhaDaTela;

/** O mesmo arranjo da tela: estado com a escolha, e a mudança passando por `mudarEscolhaDaTela`. */
function ComoATela() {
  const [escolhas, setEscolhas] = useState(
    () => new Map<string, EscolhaDaTela>([['sola', { pecaId: 'sola-de-dois' }]]),
  );
  ultima = escolhas.get('sola') ?? { pecaId: null };

  return (
    <ControlesDeParametro
      categoria="sola"
      parametros={DOIS_PARAMETROS}
      valores={ultima.parametros}
      aoMudar={(nome, valor) =>
        setEscolhas((atual) => mudarEscolhaDaTela(atual, 'sola', { parametros: { [nome]: valor } }))
      }
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

const faixa = (nome: string) =>
  container.querySelector<HTMLInputElement>(`input[aria-label="${nome} da zona sola"]`)!;

/** Arrasta uma faixa controlada: setter nativo e evento `input`, que é o que o React escuta. */
function arrastar(campo: HTMLInputElement, valor: number) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(campo, String(valor));
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('os controles de parâmetro da peça (R7-A58)', () => {
  it('uma peça de dois parâmetros desenha dois controles, cada um com a sua faixa', () => {
    // Reprova a leitura de `parametros[0]`: com ela só a espessura existiria.
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(2);
    expect(faixa('espessura')).not.toBe(null);
    expect(faixa('largura')).not.toBe(null);
    // O passo vem de `medidaDoParametro.ts`, o mesmo da tela de uma peça: 40 passos na faixa (R9-A68).
    expect(Number(faixa('largura').step)).toBeCloseTo(0.001, 12);
    expect(container.textContent).toContain('faixa 80,0 mm a 120,0 mm');
  });

  it('arrastar um parâmetro preserva o valor já escolhido no outro', () => {
    arrastar(faixa('largura'), 0.09);
    arrastar(faixa('espessura'), 0.02);

    // Reprova a substituição do objeto: com ela a largura voltaria ao padrão de 0,1.
    expect(ultima.parametros).toEqual({ largura: 0.09, espessura: 0.02 });
    expect(Number(faixa('largura').value)).toBeCloseTo(0.09);
    expect(container.textContent).toContain('largura: 90,0 mm');
  });

  it('parâmetro que ninguém mexeu mostra o padrão da peça', () => {
    expect(container.textContent).toContain('espessura: 18,0 mm');
    expect(container.textContent).toContain('largura: 100,0 mm');
  });
});
