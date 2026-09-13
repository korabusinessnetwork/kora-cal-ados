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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TelaDoPalco3d } from './TelaDoPalco3d';
import { catalogoDeProva } from '../lib/acervo/acervoDeProva';
import { ROTULO_DA_SAIDA } from '../saidasDaTela';

// O palco de verdade continua montado, e sem WebGL cai em `contexto-negado` como sempre. O dublê só
// guarda o `aoSelecionar` que a tela entrega, porque em jsdom não há canvas para clicar numa peça, e
// sem isso "Nada selecionado" seria verdade com a limpeza da seleção ou sem ela: a mutação que tirava
// a limpeza sobreviveu aos testes de tela no R8-A59 (R9-A69).
const palco = vi.hoisted(() => ({ aoSelecionar: null as ((nome: string | null) => void) | null }));

vi.mock('./PalcoDeModelo3d', async (importOriginal) => {
  const real = await importOriginal<typeof import('./PalcoDeModelo3d')>();

  function PalcoQueGuardaASelecao(props: Parameters<typeof real.PalcoDeModelo3d>[0]) {
    palco.aoSelecionar = props.aoSelecionar;

    return <real.PalcoDeModelo3d {...props} />;
  }

  return { ...real, PalcoDeModelo3d: PalcoQueGuardaASelecao };
});

/** O que o clique numa malha do canvas faria: a tela recebe o nome do nó. */
function selecionarNoPalco(nome: string) {
  if (palco.aoSelecionar === null) throw new Error('A tela não entregou `aoSelecionar` ao palco.');
  const aoSelecionar = palco.aoSelecionar;
  act(() => {
    aoSelecionar(nome);
  });
}

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

/** O botão da lista com este rótulo. */
function botaoDaPeca(rotulo: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll<HTMLButtonElement>('.palco3d__peca')].find((botao) =>
    botao.textContent?.includes(rotulo),
  );
  if (achado === undefined) throw new Error(`Não há peça "${rotulo}" na lista.`);

  return achado;
}

function clicarNa(rotulo: string) {
  act(() => {
    botaoDaPeca(rotulo).click();
  });
}

/** Leva o controle de um parâmetro a um valor, como a mão faria. */
function moverControle(nome: string, valor: string) {
  const faixa = container.querySelector<HTMLInputElement>(`input[aria-label="${nome}"]`);
  if (faixa === null) throw new Error(`Não há controle para "${nome}".`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(faixa, valor);
    faixa.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const medida = () => container.querySelector('.palco3d__medida strong')?.textContent;

describe('trocar de peça não carrega o valor da peça anterior (R9-A67)', () => {
  it('a sola tratorada no máximo não passa os 50 mm para o cadarço, que tem outra faixa', () => {
    // As duas solas e o cadarço têm um parâmetro chamado `espessura`, com faixas diferentes. A tela
    // guardava valor por nome, e o cadarço abria dizendo 50,0 mm numa faixa de 3 a 12 mm.
    clicarNa('Sola tratorada');
    moverControle('espessura', '0.05');
    expect(medida()).toBe('50,0 mm');

    clicarNa('Cadarço reto');

    expect(medida()).toBe('6,0 mm');
    expect(container.querySelector<HTMLInputElement>('input[aria-label="espessura"]')?.value).toBe('0.006');
  });

  it('voltar para a sola também abre no padrão dela, como na tela da composição', () => {
    clicarNa('Sola tratorada');
    moverControle('espessura', '0.05');
    clicarNa('Sola plana');
    clicarNa('Sola tratorada');

    expect(medida()).toBe('30,0 mm');
  });

  it('clicar na peça que já está em cena não apaga o que foi mexido', () => {
    clicarNa('Sola tratorada');
    moverControle('espessura', '0.05');
    clicarNa('Sola tratorada');

    expect(medida()).toBe('50,0 mm');
  });
});

describe('trocar de peça larga a malha clicada (R9-A69)', () => {
  const nomeNaTela = () => container.querySelector('.palco3d__nome')?.textContent ?? null;

  it('o dublê não troca o palco: o de verdade está montado e respondeu sem WebGL', () => {
    // Contraprova do dublê. Se ele deixasse de desenhar o palco real, os testes de tela passariam a
    // provar uma tela sem cena, e ninguém veria. A frase do `contexto-negado` só aparece porque o
    // palco de verdade tentou criar o contexto e avisou a tela; sem ele, a tela ficaria em
    // "carregando". A moldura não serve de prova: ela some de propósito nesse estado (A48).
    expect(container.querySelector('.palco3d__estado')?.textContent).toContain('WebGL');
  });

  it('a malha clicada some quando outra peça entra em cena', () => {
    selecionarNoPalco('prova-sola-plana');
    // Contraprova: a tela mostra a seleção antes da troca, senão o teste não prova nada.
    expect(nomeNaTela()).toBe('prova-sola-plana');

    clicarNa('Cadarço reto');

    expect(nomeNaTela()).toBe(null);
    expect(container.querySelector('.palco3d__vazio')?.textContent).toContain('Nada selecionado');
  });
});
