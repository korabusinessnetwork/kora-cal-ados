// @vitest-environment jsdom
//
// O que acontece com a PÁGINA quando o contexto WebGL não pode ser criado.
//
// Este arquivo existe por um defeito medido no navegador, não por precaução: com o
// `HTMLCanvasElement.prototype.getContext` devolvendo `null` para `webgl*`, o `new WebGLRenderer`
// lançava de dentro do efeito, o erro subia até o React, e como naquele momento não existia
// `ErrorBoundary` em lugar nenhum deste projeto a árvore INTEIRA era desmontada. O `body` ficava vazio: sem o palco,
// sem o painel de cores, sem o rodapé, sem caminho para o esboço, que é justamente a tela que
// funcionaria perfeitamente numa máquina sem GPU, porque desenha o mesmo tênis em SVG.
//
// A ironia é a parte que importa: o pior estrago não é o 3D faltar, é o 3D faltando levar junto a
// alternativa que existia. Uma tela em branco também não diz o que houve, e o princípio nº1 pede
// estado sempre visível.
//
// jsdom é o ambiente CERTO para esta prova, e não uma limitação: ele não tem WebGL, então a falha
// de criação é a real, produzida pelo mesmo caminho de código do navegador sem GPU, sem ninguém
// precisar simular nada. É o único pedaço do palco que dá para exercitar sem placa de vídeo.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ehFalha, PalcoDeModelo3d, type EstadoDoPalco } from './PalcoDeModelo3d';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/** Qualquer texto serve: o palco nem chega a carregar modelo, ele morre antes disso. */
const GLTF_QUALQUER = '{"asset":{"version":"2.0"}}';

let container: HTMLDivElement;
let raiz: Root;
let estados: EstadoDoPalco[] = [];

function montar(filho: React.ReactNode) {
  act(() => {
    raiz.render(filho);
  });
}

function palco() {
  return (
    <PalcoDeModelo3d
      textoGltf={GLTF_QUALQUER}
      rotulo="Peça em 3D."
      aoSelecionar={() => undefined}
      aoMudarEstado={(estado) => estados.push(estado)}
    />
  );
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  estados = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  raiz = createRoot(container);
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

describe('sem contexto WebGL disponível (A46)', () => {
  it('monta sem deixar o erro escapar do efeito', () => {
    // Antes do conserto esta linha reprovava: o `new WebGLRenderer` lançava de dentro do efeito e
    // o `act` devolvia o erro. Falhar aqui é o sintoma inteiro, o resto do arquivo é consequência.
    expect(() => montar(palco())).not.toThrow();
  });

  it('avisa `contexto-negado`, que é falha, e não `contexto-perdido`', () => {
    montar(palco());

    // `perdido` seria mentira em duas frentes: nada caiu, e nada vai voltar sozinho. A frase dele
    // manda esperar e depois recarregar, e recarregar aqui só custa a composição da pessoa.
    expect(estados).toContain('contexto-negado');
    expect(estados).not.toContain('contexto-perdido');
    expect(ehFalha('contexto-negado')).toBe(true);
  });

  it('não apaga o resto da página: o que está ao lado do palco continua de pé', () => {
    // A afirmação que vale o arquivo. O rodapé aqui representa qualquer irmão do palco na árvore,
    // e no app real são o painel de cores e as saídas para as outras telas, o esboço inclusive.
    montar(
      <div>
        {palco()}
        <p id="rodape">ir para o esboço</p>
      </div>,
    );

    expect(container.querySelector('#rodape')?.textContent).toBe('ir para o esboço');
  });

  it('a moldura não fica na tela guardando lugar para o que não vem (A48)', () => {
    // Ela media 532x320 px na janela de trabalho e 375x340 px em 375x812, medido no navegador, e
    // ficava preta e vazia para sempre, empurrando para baixo a frase que explica o que houve.
    // Caixa vazia permanente parece estado de espera, e esperar é exatamente o que não adianta:
    // este navegador não vai entregar contexto gráfico nenhum.
    montar(
      <div>
        {palco()}
        <p id="rodape">ir para o esboço</p>
      </div>,
    );

    expect(container.querySelector('.palco3d__moldura')).toBeNull();
    // E o que estava ao lado continua onde estava: sumiu a caixa, não a página.
    expect(container.querySelector('#rodape')?.textContent).toBe('ir para o esboço');
  });

  it('desmontar depois da falha não estoura', () => {
    // O palco que não nasceu não tem nada para destruir, e o `destruir()` do caminho normal mexe
    // em renderizador, laço de animação e escutas que aqui nunca existiram. Chamá-lo assim mesmo
    // trocaria a tela em branco da montagem por uma tela em branco na saída.
    montar(palco());

    expect(() =>
      act(() => {
        raiz.render(null);
      }),
    ).not.toThrow();
  });
});
