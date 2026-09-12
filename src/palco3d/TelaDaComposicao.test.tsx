// @vitest-environment jsdom
//
// A tela do calçado montado, montada de verdade.
//
// Por que ela não tinha teste até aqui: é o arquivo mais tocado do projeto, 15 commits em 30 dias,
// e montá-la exigia WebGL, que jsdom não tem. Isso mudou no R5-A46, quando a falha de criação do
// contexto virou o estado `contexto-negado` em vez de uma exceção que derrubava a árvore. O teste
// da tela irmã (`TelaDoPalco3d.test.tsx`) provou o caminho, e é o mesmo aqui: a cena não desenha
// nada, e tudo o que estes testes olham é o que existe FORA da moldura.
//
// O que fica preso aqui é a ligação entre as regras puras, que já tinham teste cada uma, e a tela.
// As três afirmações são as que ninguém conferia sem abrir o navegador: colar troca o calçado,
// colar errado NÃO encosta no calçado que está em cena, e trocar de peça não carrega o parâmetro da
// peça anterior (BUG-019).

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TelaDaComposicao } from './TelaDaComposicao';
import { catalogoDeProva } from '../lib/acervo/acervoDeProva';

/** A forma que a tela monta, lida do acervo e não escrita à mão: id errado aqui vira teste que
    prova o caminho da recusa achando que prova o do sucesso, e foi o que aconteceu na primeira
    versão deste arquivo. */
const FORMA_ID = catalogoDeProva().formas[0]?.id ?? '';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let container: HTMLDivElement;
let raiz: Root;
let gritos: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  raiz = createRoot(container);
  // O three grita por não achar contexto gráfico, e o grito é esperado nesta máquina.
  gritos = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  act(() => {
    raiz.render(<TelaDaComposicao />);
  });
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  container.remove();
  gritos.mockRestore();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

/** As zonas do calçado que está em cena: a zona e a peça que responde por ela. */
function zonasNaTela(): { zona: string; peca: string }[] {
  return [...container.querySelectorAll('.palco3d__zona')].map((linha) => ({
    zona: linha.querySelector('code')?.textContent ?? '',
    peca: linha.querySelector('span')?.textContent ?? '',
  }));
}

function botaoDe(rotulo: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find(
    (botao) => botao.textContent?.trim() === rotulo,
  );
  if (achado === undefined) throw new Error(`Botão "${rotulo}" não está na tela.`);

  return achado;
}

function clicar(botao: HTMLButtonElement) {
  act(() => {
    botao.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/**
 * Escreve num campo controlado por React.
 *
 * O setter nativo é obrigatório: atribuir `.value` direto faz o React não perceber a mudança,
 * porque ele guarda o último valor no próprio nó. Mesmo procedimento de
 * `CampoDeCorDaCategoria.test.tsx`.
 */
function escrever(campo: HTMLInputElement | HTMLTextAreaElement, valor: string) {
  const prototipo =
    campo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototipo, 'value')?.set;

  act(() => {
    setter?.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const areaDeColar = () => container.querySelector<HTMLTextAreaElement>('#composicao-colada')!;
const faixaDoCabedal = () =>
  container.querySelector<HTMLInputElement>('input[aria-label="altura-do-cano da zona cabedal"]')!;

describe('a tela do calçado montado (A49)', () => {
  it('abre com o calçado de prova montado, três zonas e os controles de pé', () => {
    // Contraprova de todo o resto: sem ela, uma tela em branco passaria nos testes abaixo, já que
    // eles afirmam sobretudo o que NÃO mudou.
    expect(zonasNaTela()).toEqual([
      { zona: 'sola', peca: 'prova-sola-plana' },
      { zona: 'cabedal', peca: 'prova-cabedal-baixo' },
      { zona: 'cadarco', peca: 'prova-cadarco-reto' },
    ]);
    expect(areaDeColar().value).toBe('');
  });

  it('colar uma composição válida troca o calçado que está em cena', () => {
    escrever(
      areaDeColar(),
      JSON.stringify({
        forma_id: FORMA_ID,
        pecas: [
          { peca_id: 'prova-sola-tratorada', cor: '#101010' },
          { peca_id: 'prova-cabedal-cano-alto', cor: '#20A020' },
        ],
      }),
    );
    clicar(botaoDe('Montar o que está colado'));

    // As duas peças coladas entraram, e o cadarço, que a colagem não trouxe, saiu: a composição
    // colada é o calçado inteiro, não um remendo sobre o que estava ali.
    expect(zonasNaTela()).toEqual([
      { zona: 'sola', peca: 'prova-sola-tratorada' },
      { zona: 'cabedal', peca: 'prova-cabedal-cano-alto' },
    ]);
  });

  it('colar uma composição recusada não encosta no calçado, e diz por quê', () => {
    const antes = zonasNaTela();

    escrever(
      areaDeColar(),
      JSON.stringify({ forma_id: 'bota-de-cano-longo', pecas: [{ peca_id: 'prova-sola-plana' }] }),
    );
    clicar(botaoDe('Montar o que está colado'));

    // A afirmação central: quem colou errado não perde a montagem boa que estava na tela.
    expect(zonasNaTela()).toEqual(antes);
    const erro = container.querySelector('.palco3d__saida-erro')?.textContent ?? '';
    expect(erro).toContain('bota-de-cano-longo');
    expect(erro).toContain('continua sendo o de antes');
  });

  it('texto que não é composição nenhuma também não derruba o calçado', () => {
    const antes = zonasNaTela();

    escrever(areaDeColar(), 'isto não é json');
    clicar(botaoDe('Montar o que está colado'));

    expect(zonasNaTela()).toEqual(antes);
    expect(container.querySelector('.palco3d__saida-erro')?.textContent ?? '').not.toBe('');
  });

  it('trocar de peça descarta o parâmetro da anterior, que é o BUG-019', () => {
    // As duas peças de cabedal têm um parâmetro com o MESMO nome, `altura-do-cano`, e faixas que
    // mal se encostam: 0,05 a 0,12 contra 0,1 a 0,22. Carregar o valor da peça velha para a nova
    // produzia `PARAMETRO_INVALIDO` e a tela inteira virava uma linha vermelha, sem que ninguém
    // tivesse feito nada errado. A regra tem teste em `composicaoDaTela.test.ts`; o que falta
    // prender é que a TELA a usa, porque foi dentro do `.tsx` que o defeito nasceu.
    escrever(faixaDoCabedal(), '0.05');
    expect(faixaDoCabedal().value).toBe('0.05');

    clicar(botaoDe('Cabedal cano alto'));

    // 0,05 não cabe na faixa nova. O que aparece é o padrão da peça nova, 0,14, e não um valor
    // aparado nem um erro.
    expect(Number(faixaDoCabedal().value)).toBeCloseTo(0.14, 5);
    // O sintoma do BUG-019, pelo nome: a tela inteira virava uma linha vermelha com este código. E
    // a lista de zonas só existe quando a montagem deu certo, então ela é a outra metade da prova.
    expect(container.textContent ?? '').not.toContain('PARAMETRO_INVALIDO');
    expect(zonasNaTela()).toContainEqual({ zona: 'cabedal', peca: 'prova-cabedal-cano-alto' });
  });

  it('trocar de peça limpa a peça clicada, que era de um calçado que saiu de cena', () => {
    clicar(botaoDe('Sola tratorada'));

    expect(container.querySelector('.palco3d__vazio')?.textContent).toContain('Nada selecionado');
    expect(container.querySelector('.palco3d__endereco')).toBe(null);
  });
});
