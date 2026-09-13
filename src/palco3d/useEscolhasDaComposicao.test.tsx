// @vitest-environment jsdom
//
// O hook das escolhas da tela, montado sem a tela.
//
// Existe por uma mutação que sobreviveu no R8-A59: tirar o aviso de "a montagem trocou" deixava os
// testes da tela verdes. Não por descuido deles, mas porque a peça clicada só nasce de um clique no
// canvas, e o canvas não desenha em jsdom. Na tela, "Nada selecionado" é verdade antes e depois, com
// o aviso ou sem ele. Aqui o aviso é contado direto, em cada porta que troca a montagem.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogoDeProva, composicaoDeProva } from '../lib/acervo/acervoDeProva';
import { validarComposicao } from '../lib/composicao/validarComposicao';
import { escolhasDaComposicao } from './composicaoDaTela';
import { useEscolhasDaComposicao } from './useEscolhasDaComposicao';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const CATALOGO = catalogoDeProva();
const FORMA = CATALOGO.formas[0];
const DEMO = validarComposicao(composicaoDeProva(), CATALOGO);

let container: HTMLDivElement;
let raiz: Root;
let hook: ReturnType<typeof useEscolhasDaComposicao>;
let aoTrocarMontagem: ReturnType<typeof vi.fn<() => void>>;

function Harness() {
  hook = useEscolhasDaComposicao(FORMA, CATALOGO, DEMO, aoTrocarMontagem);
  return null;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  aoTrocarMontagem = vi.fn<() => void>();
  container = document.createElement('div');
  raiz = createRoot(container);
  act(() => {
    raiz.render(<Harness />);
  });
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

describe('useEscolhasDaComposicao (R8-A59)', () => {
  it('abrir não conta como troca de montagem', () => {
    expect(aoTrocarMontagem).not.toHaveBeenCalled();
    expect(hook.ehPadrao).toBe(true);
    expect(hook.podeDesfazer).toBe(false);
  });

  it('cada porta que troca a montagem avisa a tela uma vez', () => {
    const categoria = [...hook.escolhas.keys()][0] ?? '';

    act(() => hook.mudar(categoria, { cor: '#123456' }));
    expect(aoTrocarMontagem).toHaveBeenCalledTimes(1);

    act(() => hook.voltarAoPadrao());
    expect(aoTrocarMontagem).toHaveBeenCalledTimes(2);

    act(() => hook.desfazerORecomeco());
    expect(aoTrocarMontagem).toHaveBeenCalledTimes(3);

    act(() => hook.aceitarOColado(escolhasDaComposicao(DEMO)));
    expect(aoTrocarMontagem).toHaveBeenCalledTimes(4);
  });

  it('Desfazer sem nada guardado não troca nada nem avisa', () => {
    act(() => hook.desfazerORecomeco());

    expect(aoTrocarMontagem).not.toHaveBeenCalled();
    expect(hook.ehPadrao).toBe(true);
  });
});
