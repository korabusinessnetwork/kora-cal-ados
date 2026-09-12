// @vitest-environment jsdom
//
// A rede de proteção com uma exceção de verdade passando por ela.
//
// O que este arquivo prende é uma única afirmação, e é a que foi medida como falsa antes dele: uma
// exceção durante o render deixava `document.body` VAZIO. Por isso quase todo teste aqui olha o
// texto do container inteiro, e não um seletor: a pergunta é "sobrou alguma coisa na página?", que
// é exatamente a pergunta que um seletor bem escolhido esconderia.
//
// O `console.error` é silenciado de propósito: o React grita a pilha inteira ao entregar o erro à
// rede, e o grito é esperado aqui. Silenciar também serve de asserção, porque o espião prova que a
// rede registrou a falha em vez de engoli-la em silêncio.

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RedeDeProtecao } from './RedeDeProtecao';
import { ROTULO_DA_SAIDA } from './saidasDaTela';
import type { Tela } from './telaInicial';

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
  gritos = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  container.remove();
  gritos.mockRestore();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

/** Um filho que lança durante o render, que é justamente o que nada segurava antes desta rede. */
function PecaQuebrada({ motivo }: { motivo: string }): never {
  throw new Error(motivo);
}

function montar(conteudo: ReactNode, atual: Tela = 'palco3d', chave?: string) {
  act(() => {
    raiz.render(
      <RedeDeProtecao key={chave} atual={atual}>
        {conteudo}
      </RedeDeProtecao>,
    );
  });
}

/** A rede como o `App` a usa: sem saídas próprias, porque lá o rodapé fica fora dela e sobrevive. */
function montarComoNoApp(conteudo: ReactNode, atual: Tela = 'palco3d') {
  act(() => {
    raiz.render(
      <RedeDeProtecao atual={atual} comSaidas={false}>
        {conteudo}
      </RedeDeProtecao>,
    );
  });
}

/** Os endereços das saídas oferecidas pela rede, na ordem em que aparecem. */
function saidasNaTela(): { texto: string; href: string }[] {
  return [...container.querySelectorAll('a')].map((link) => ({
    texto: link.textContent ?? '',
    href: link.getAttribute('href') ?? '',
  }));
}

describe('a rede de proteção da raiz (A51)', () => {
  it('sem falha nenhuma, a rede é invisível: o filho é o que está na tela', () => {
    // Contraprova de todo o resto. Sem isto, uma rede que mostrasse o aviso SEMPRE passaria nos
    // outros testes deste arquivo.
    montar(<p className="filho">conteúdo normal da tela</p>);

    expect(container.querySelector('.filho')?.textContent).toBe('conteúdo normal da tela');
    expect(container.querySelector('.rede-de-protecao')).toBe(null);
    expect(saidasNaTela()).toEqual([]);
  });

  it('com o filho lançando, a página continua COM conteúdo em vez de ficar em branco', () => {
    montar(<PecaQuebrada motivo="o glTF da peça não pôde ser lido" />);

    // A medida que originou o item era `document.body.innerText` vazio. É esta linha.
    expect(container.textContent).not.toBe('');
    expect(container.querySelector('.rede-de-protecao')).not.toBe(null);
    expect(container.querySelector('h1')?.textContent).toBe('Esta tela parou de funcionar');
  });

  it('a mensagem da falha aparece, para o relato de bug não virar adivinhação', () => {
    montar(<PecaQuebrada motivo="o glTF da peça não pôde ser lido" />);

    expect(container.querySelector('.rede-de-protecao__motivo')?.textContent).toBe(
      'o glTF da peça não pôde ser lido',
    );
    // E a falha foi registrada, não engolida.
    expect(gritos).toHaveBeenCalled();
  });

  it('as saídas continuam na tela, são endereços, e não incluem a tela que quebrou', () => {
    montar(<PecaQuebrada motivo="qualquer coisa" />, 'palco3d');

    const saidas = saidasNaTela();
    // Endereço, e não botão: quando quem quebra é o próprio `App`, não existe mais estado de
    // navegação para atender um clique, e um `href` funciona com a árvore morta.
    expect(saidas.map(({ texto }) => texto)).toEqual([
      ROTULO_DA_SAIDA.esboco,
      ROTULO_DA_SAIDA.composicao,
      ROTULO_DA_SAIDA.app,
    ]);
    expect(saidas.map(({ href }) => href)).toEqual(['?tela=esboco', '?tela=composicao', '/']);
    expect(saidas.map(({ texto }) => texto)).not.toContain(ROTULO_DA_SAIDA.palco3d);
  });

  it('com `comSaidas={false}`, a rede não repete as saídas que o rodapé já mostra', () => {
    // Achado no navegador, e não aqui: dentro do `App` o rodapé sobrevive à falha, então a rede
    // desenhando as próprias saídas deixava a mesma lista de três destinos duas vezes seguidas na
    // tela. A mensagem continua inteira, que é o que a rede existe para garantir.
    montarComoNoApp(<PecaQuebrada motivo="quebrou com o rodapé vivo" />);

    expect(saidasNaTela()).toEqual([]);
    expect(container.querySelector('.rede-de-protecao__motivo')?.textContent).toBe(
      'quebrou com o rodapé vivo',
    );
    expect(container.querySelector('h1')?.textContent).toBe('Esta tela parou de funcionar');
  });

  it('trocar de tela limpa a rede, que é o que o `key={tela}` do App garante', () => {
    // Sem o `key`, a mesma instância seria reaproveitada com a falha antiga dentro, e o botão do
    // rodapé pareceria não fazer nada: a pessoa clicaria em "ver o esboço" e continuaria olhando o
    // aviso de erro do palco.
    montar(<PecaQuebrada motivo="quebrou no palco" />, 'palco3d', 'palco3d');
    expect(container.querySelector('.rede-de-protecao')).not.toBe(null);

    montar(<p className="filho">o esboço, inteiro</p>, 'esboco', 'esboco');

    expect(container.querySelector('.rede-de-protecao')).toBe(null);
    expect(container.querySelector('.filho')?.textContent).toBe('o esboço, inteiro');
  });
});
