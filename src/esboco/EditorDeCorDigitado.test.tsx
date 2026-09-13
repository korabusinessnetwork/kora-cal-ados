// @vitest-environment jsdom
//
// O campo de hex do esboço, digitado de verdade (R10-A73).
//
// `PainelDeZonas.test.tsx` lê o HTML de um render só, e o que precisa de prova aqui é a digitação:
// a forma curta (`#f00`) é cor, e subia como veio. A cor que sobe vira o `value` do seletor ao lado e
// o texto da lista de zonas, e o `<input type="color">` só aceita `#rrggbb`.

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PainelDeZonas } from './PainelDeZonas';
import type { ZonaDoProduto } from './produtoDemo';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const ZONAS: ZonaDoProduto[] = [{ zone_key: 'sola', rotulo: 'Sola', svg_selector: '#sola' } as ZonaDoProduto];

let container: HTMLDivElement;
let raiz: Root;
let recebidas: string[];

/** O mesmo arranjo do esboço: as cores em estado, e a zona já escolhida. */
function ComoOEsboco() {
  const [cores, setCores] = useState<Record<string, string>>({ sola: '#C0392B' });

  return (
    <PainelDeZonas
      zonas={ZONAS}
      elementosPorZona={{ sola: 1 }}
      cores={cores}
      zonaSelecionada="sola"
      aoSelecionar={() => {}}
      aoTrocarCor={(zona, cor) => {
        recebidas.push(cor);
        setCores((atual) => ({ ...atual, [zona]: cor }));
      }}
    />
  );
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  recebidas = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  raiz = createRoot(container);
  act(() => {
    raiz.render(<ComoOEsboco />);
  });
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function digitar(valor: string) {
  const campo = container.querySelector<HTMLInputElement>('input[aria-label="hex da zona sola"]')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('o hex digitado no esboço sobe na forma longa (R10-A73)', () => {
  it('a forma curta sobe como #RRGGBB, e o texto do campo fica como foi digitado', () => {
    digitar('#f00');

    expect(recebidas).toEqual(['#FF0000']);
    expect(container.querySelector<HTMLInputElement>('input[aria-label="hex da zona sola"]')?.value).toBe('#f00');
  });

  it('o seletor e a lista de zonas mostram a forma longa', () => {
    digitar('#f00');

    expect(container.querySelector<HTMLInputElement>('input[aria-label="cor da zona sola"]')?.value).toBe('#ff0000');
    expect(container.querySelector('.zona__hex')?.textContent).toBe('#FF0000');
  });
});
