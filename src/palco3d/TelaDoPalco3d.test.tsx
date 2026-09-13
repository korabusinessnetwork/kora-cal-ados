// @vitest-environment jsdom
//
// A tela do palco montada de verdade, para conferir uma coisa que função pura nenhuma alcança: o
// que ela DIZ.
//
// O painel "Peça" afirmava que montar as cinco peças numa cena só, e colori-las, era "a próxima
// tarefa". Era verdade quando foi escrito e deixou de ser no dia em que a tela do calçado montado
// nasceu, sem que ninguém voltasse aqui. Texto que promete o que já existe custa mais caro que
// texto nenhum: quem lê conclui que o produto não faz aquilo e não vai procurar, e o rodapé com o
// botão para a tela certa fica ali do lado, sem ser clicado.
//
// Esta tela é montável em jsdom desde o R5-A46: sem WebGL, o palco cai em `contexto-negado` em vez
// de deixar o erro subir e apagar a página. A frase é lida do DOM, e não do arquivo-fonte, porque
// o que interessa é o que chega na tela.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TelaDoPalco3d } from './TelaDoPalco3d';
import { catalogoDeProva } from '../lib/acervo/acervoDeProva';
import { ROTULO_DA_SAIDA } from '../saidasDaTela';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let container: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  raiz = createRoot(container);
  act(() => {
    raiz.render(<TelaDoPalco3d />);
  });
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

/** O primeiro painel da tela, o da escolha de peça, com a frase de ajuda dele. */
function painelDaPeca() {
  const painel = container.querySelector('.palco3d__colunas .painel');

  return {
    titulo: painel?.querySelector('.painel__titulo')?.textContent ?? '',
    ajuda: painel?.querySelector('.painel__ajuda')?.textContent ?? '',
  };
}

describe('o que a tela do palco diz sobre a montagem (A43)', () => {
  it('monta em jsdom, sem WebGL, com o painel da peça de pé', () => {
    // Contraprova das duas afirmações abaixo: elas seriam verdadeiras numa tela em branco.
    expect(painelDaPeca().titulo).toBe('Peça');
    expect(painelDaPeca().ajuda).not.toBe('');
    expect(container.querySelectorAll('.palco3d__peca').length).toBeGreaterThan(0);
  });

  it('o painel "Peça" não promete mais a montagem como tarefa futura', () => {
    // A frase exata que estava lá, e a família dela. Se alguém reescrever o painel prometendo
    // "próxima tarefa" de novo, isto reprova antes de a promessa chegar em quem lê.
    expect(container.textContent ?? '').not.toContain('próxima tarefa');
    expect(painelDaPeca().ajuda).not.toContain('Montar as cinco');
  });

  it('a frase aponta para o calçado montado, com o nome que o rodapé usa', () => {
    // Não basta parar de mentir: quem está no palco precisa saber para onde ir. E o nome tem de
    // ser o MESMO do botão do rodapé, senão a pessoa lê um nome aqui e procura outro ali
    // (ADR-003, "um termo, um nome, sempre").
    expect(ROTULO_DA_SAIDA.composicao).toContain('calçado montado');
    expect(painelDaPeca().ajuda).toContain('calçado montado');
    expect(painelDaPeca().ajuda).toContain('rodapé');
  });
});

describe('a tela de uma peça desenha um controle por parâmetro (R8-A63)', () => {
  it('uma peça de dois parâmetros ganha dois controles na TELA, e não só no componente', () => {
    // `ParametrosDaPeca.test.tsx` prova o componente. Este prova a ligação: uma tela que passasse
    // só `parametros[0]` ao componente continuava verde lá, e reprova aqui. A sola plana do acervo
    // de prova ganha um segundo parâmetro sintético, porque o glTF sai do acervo pelo id.
    const sola = catalogoDeProva().pecas.find(({ id }) => id === 'prova-sola-plana');
    if (sola === undefined) throw new Error('A sola plana saiu do acervo de prova.');
    const deDois = { ...sola, parametros: [...sola.parametros, { nome: 'largura', minimo: 0.08, maximo: 0.12, padrao: 0.1 }] };

    act(() => {
      raiz.render(<TelaDoPalco3d pecas={[deDois]} />);
    });

    expect(
      [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')].map((faixa) => faixa.getAttribute('aria-label')),
    ).toEqual(['espessura', 'largura']);
  });
});
