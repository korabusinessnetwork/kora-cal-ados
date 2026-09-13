// @vitest-environment jsdom
//
// O campo de hex do configurador. A afirmação que mais importa aqui é negativa: texto pela metade
// NÃO pode chegar ao motor. Sem isso o calçado piscaria a cada tecla, e `#C` viraria uma cor.
//
// Monta com `react-dom/client` em jsdom, no padrão que a rodada 1 deixou em
// `features/sessao/ContextoDeSessao.test.tsx`: o componente guarda o texto em estado próprio, então
// `renderToStaticMarkup` só enxergaria o primeiro render, e é a digitação que precisa ser provada.
// Isto só é possível porque o campo mora em arquivo separado da tela: montar `TelaDaComposicao`
// traria o palco 3D junto, e WebGL não existe em jsdom.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CampoDeCorDaCategoria, idDoCampoDeCor } from './CampoDeCorDaCategoria';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let raiz: Root | null = null;
let area: HTMLDivElement;

/** As cores que o pai recebeu, na ordem. Lista vazia significa que o preview não foi tocado. */
let recebidas: string[] = [];

async function montar(cor = '#C0392B') {
  area = document.createElement('div');
  document.body.appendChild(area);
  raiz = createRoot(area);

  await act(async () => {
    raiz?.render(
      <CampoDeCorDaCategoria
        categoria="sola"
        cor={cor}
        aoTrocar={(nova) => {
          recebidas.push(nova);
        }}
      />,
    );
  });
}

const campoDeTexto = () => area.querySelector<HTMLInputElement>('input[type="text"]')!;
const campoDeCor = () => area.querySelector<HTMLInputElement>('input[type="color"]')!;
const erro = () => area.querySelector('p');

/**
 * Digita num input controlado por React. O setter nativo é obrigatório: atribuir `.value` direto faz
 * o React não perceber a mudança, porque ele guarda o último valor no próprio nó.
 */
async function digitar(campo: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

  await act(async () => {
    setter?.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  recebidas = [];
});

afterEach(async () => {
  const atual = raiz;
  raiz = null;
  if (atual) await act(async () => atual.unmount());
  document.body.innerHTML = '';
});

describe('campo de cor da categoria', () => {
  it('abre com a cor em vigor escrita no campo, editável', async () => {
    await montar('#C0392B');

    expect(campoDeTexto().value).toBe('#C0392B');
    expect(campoDeCor().value).toBe('#c0392b'); // o input de cor normaliza para minúsculo
    expect(erro()).toBeNull();
  });

  it('os dois campos dizem de qual zona são', async () => {
    // Nove categorias na tela e dois campos cada: sem rótulo, a árvore de acessibilidade mostraria
    // dezoito campos cujo nome é o próprio valor.
    await montar();

    expect(campoDeTexto().getAttribute('aria-label')).toBe('hex da zona sola');
    expect(campoDeCor().getAttribute('aria-label')).toBe('cor da zona sola');
  });

  it('hex pela metade NÃO chega ao motor', async () => {
    // A afirmação central do arquivo. Cada tecla de "#1A2B3C" passa por aqui, e só a última é cor.
    await montar();

    for (const parcial of ['#', '#1', '#1A', '#1A2', '#1A2B', '#1A2B3']) {
      await digitar(campoDeTexto(), parcial);
    }

    // `#1A2` é a forma curta, que É uma cor: o motor recebe ela, já na forma longa (R10-A73), e mais
    // nenhuma das outras cinco.
    expect(recebidas).toEqual(['#11AA22']);
  });

  it('a forma curta sobe na forma longa, e o seletor ao lado mostra a mesma cor (R10-A73)', async () => {
    // O `<input type="color">` só aceita `#rrggbb`. Com `#f00` no `value` ele cai em preto, e a
    // peça fica vermelha com o seletor preto do lado. O texto do campo continua como foi digitado.
    await montar();
    await digitar(campoDeTexto(), '#f00');

    expect(recebidas).toEqual(['#FF0000']);
    expect(campoDeTexto().value).toBe('#f00');
  });

  it('hex completo chega ao motor em maiúsculo', async () => {
    await montar();
    await digitar(campoDeTexto(), '#1a2b3c');

    expect(recebidas).toEqual(['#1A2B3C']);
    expect(erro()).toBeNull();
    expect(campoDeTexto().getAttribute('aria-invalid')).toBe('false');
  });

  it('hex incompleto é dito em palavras, e ligado ao campo', async () => {
    await montar();
    await digitar(campoDeTexto(), '#1A2B');

    expect(campoDeTexto().getAttribute('aria-invalid')).toBe('true');
    expect(erro()?.textContent).toContain('Cor incompleta');
    expect(erro()?.textContent).toContain('a peça só muda');
    // É o `aria-describedby` que faz o texto ser lido quando o foco chega no campo.
    expect(campoDeTexto().getAttribute('aria-describedby')).toBe('composicao-hex-erro-sola');
    expect(erro()?.id).toBe('composicao-hex-erro-sola');
  });

  it('o que nunca vai virar cor recebe outra frase, não a de incompleto', async () => {
    // "Continue digitando" e "isso não vai virar cor" são notícias diferentes: dar a mesma para as
    // duas faz quem digitou `#C0` achar que errou.
    await montar();
    await digitar(campoDeTexto(), 'vermelho');

    expect(erro()?.textContent).toContain('não é um hex');
    expect(erro()?.textContent).not.toContain('Cor incompleta');
    expect(recebidas).toEqual([]);
  });

  it('hex sem # diz que falta o #, e continua sem chegar ao motor (R9-A70)', async () => {
    // O formato que ferramenta de design copia. A API recusa sem `#`, então o campo também recusa;
    // o que muda é a frase, que antes dizia "não é um hex" para uma cor completa.
    await montar();
    await digitar(campoDeTexto(), '22aa44');

    expect(erro()?.textContent).toBe('Falta o # no começo. Escreva #22aa44.');
    expect(campoDeTexto().getAttribute('aria-invalid')).toBe('true');
    expect(recebidas).toEqual([]);
  });

  it('o erro não interrompe quem está digitando', async () => {
    // Mesma decisão do editor do esboço: alerta a cada tecla ensina o time a ignorar alerta.
    await montar();
    await digitar(campoDeTexto(), '#1A2B');

    expect(erro()?.getAttribute('role')).toBeNull();
  });

  it('mexer no seletor de cor atualiza o texto junto', async () => {
    // Se só a peça mudasse, os dois campos passariam a mostrar cores diferentes e a tela deixaria
    // de dizer qual delas vai sair, que é exatamente o que o princípio nº1 proíbe.
    await montar('#C0392B');
    await digitar(campoDeCor(), '#00ff00');

    expect(recebidas).toEqual(['#00FF00']);
    expect(campoDeTexto().value).toBe('#00FF00');
  });
});
