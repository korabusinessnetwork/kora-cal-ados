// @vitest-environment jsdom
//
// O botão Voltar do navegador anda entre as telas (A56).
//
// O que este arquivo prende é um PAR, e é por isso que ele existe como teste de componente e não
// como teste de função pura: `pushState` sem ouvinte de `popstate` deixa Voltar mudando o endereço
// com a tela anterior ainda desenhada, e ouvinte sem `pushState` deixa Voltar saindo do app. As
// duas metades sozinhas são piores que o `replaceState` que havia antes, e nenhuma função pura
// consegue afirmar que o ouvinte foi registrado.
//
// Medido antes da mudança, no navegador: `history.length` ficava em 28 nas três telas seguidas,
// composição, esboço e palco 3D, enquanto o endereço mudava a cada uma. Três navegações, zero
// entradas novas.
//
// Por que o esboço é a tela de partida: é a única das quatro que entra por `import` comum, então a
// árvore monta sem esperar `import()` nenhum. As outras três aparecem aqui pelo texto do
// `Suspense`, que é síncrono, e isso basta: o que se pergunta é qual tela o `App` ESCOLHEU, não o
// que o chunk dela desenha depois de chegar.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { ROTULO_DA_SAIDA } from './saidasDaTela';
import type { Tela } from './telaInicial';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let container: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // A aba começa no esboço, e começa por `replaceState` para não empilhar uma entrada que os
  // testes depois contariam como navegação.
  window.history.replaceState(null, '', '?tela=esboco');
  container = document.createElement('div');
  document.body.appendChild(container);
  raiz = createRoot(container);

  act(() => {
    raiz.render(<App />);
  });
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

/**
 * O botão do rodapé que leva a uma tela.
 *
 * Procura pelo rótulo de `ROTULO_DA_SAIDA`, e não por um texto escrito à mão aqui: o rótulo é
 * dado do produto e já mudou de palavras uma vez (R3-A26). Um teste que o copiasse reprovaria na
 * próxima vez que alguém melhorasse a frase, que é o tipo de teste que acaba desligado.
 */
function botaoDoRodape(destino: Tela): HTMLButtonElement {
  const rotulo = ROTULO_DA_SAIDA[destino];
  const achado = [...container.querySelectorAll('.rodape-telas button')].find(
    (botao) => botao.textContent?.trim() === rotulo,
  );
  if (achado === undefined) throw new Error(`O rodapé não tem a saída para "${destino}".`);

  return achado as HTMLButtonElement;
}

function clicar(botao: HTMLButtonElement) {
  act(() => {
    botao.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/**
 * Volta uma entrada no histórico e espera o `popstate` chegar.
 *
 * `history.back()` não é síncrono: ele agenda a navegação, e o evento sai depois. Sem a espera, a
 * asserção rodaria antes de o React ter visto qualquer coisa, e o teste passaria ou falharia
 * conforme a máquina.
 */
async function voltar() {
  await act(async () => {
    // Espera o EVENTO, e não um número de milissegundos. Com um `setTimeout` fixo o teste
    // responderia conforme a máquina: uma volta depois de duas navegações seguidas leva mais de um
    // tique no jsdom, e a primeira versão deste arquivo passava em três testes e reprovava no
    // quarto por causa disso. Se o `popstate` nunca chegar, o vitest estoura o tempo, que é o
    // relato certo para "o par não está ligado".
    const chegou = new Promise<void>((resolva) => {
      window.addEventListener('popstate', () => resolva(), { once: true });
    });

    window.history.back();
    await chegou;
  });
}

describe('o histórico do navegador acompanha as telas (A56)', () => {
  it('cada navegação pelo rodapé EMPILHA uma entrada, em vez de substituir a atual', () => {
    // A afirmação que vale o item. Com `replaceState` este número não mudava, e era isso que
    // fazia Voltar sair do app.
    const antes = window.history.length;

    clicar(botaoDoRodape('palco3d'));
    expect(window.location.search).toBe('?tela=palco3d');
    expect(window.history.length).toBe(antes + 1);

    clicar(botaoDoRodape('composicao'));
    expect(window.location.search).toBe('?tela=composicao');
    expect(window.history.length).toBe(antes + 2);
  });

  it('Voltar desfaz a última navegação, e a TELA volta junto com o endereço', async () => {
    clicar(botaoDoRodape('palco3d'));
    expect(document.title).toContain('Palco 3D');

    await voltar();

    // As duas metades do par, uma em cada linha. Só o endereço voltar seria o defeito que o
    // `pushState` sozinho criaria, e é um defeito pior que o original.
    expect(window.location.search).toBe('?tela=esboco');
    expect(document.title).toContain('Esboço do motor');
  });

  it('Voltar duas vezes atravessa as duas navegações, uma de cada vez', async () => {
    clicar(botaoDoRodape('palco3d'));
    clicar(botaoDoRodape('composicao'));

    await voltar();
    expect(window.location.search).toBe('?tela=palco3d');

    await voltar();
    expect(window.location.search).toBe('?tela=esboco');
    expect(document.title).toContain('Esboço do motor');
  });

  it('o rodapé continua desenhado uma vez só depois de andar no histórico', async () => {
    // O defeito que o R6-A51 achou no navegador, e que só o navegador tinha visto: duas listas de
    // destinos, uma embaixo da outra. Voltar remonta a tela, e remontagem é justamente quando esse
    // tipo de duplicata aparece.
    clicar(botaoDoRodape('palco3d'));
    await voltar();

    expect(container.querySelectorAll('.rodape-telas')).toHaveLength(1);
  });

  it('o ouvinte sai do ar quando o app desmonta', () => {
    // Pergunta pela IDENTIDADE da função removida, e não pelo efeito na tela. A primeira versão
    // deste teste disparava um `popstate` depois de desmontar e conferia que o título não mudava,
    // e a mutação que apaga a limpeza SOBREVIVEU: numa árvore desmontada o `setTela` não faz nada
    // visível e o efeito do título nem roda, então o título não mudava com limpeza ou sem ela. O
    // teste perguntava a coisa errada. O que a limpeza garante é que a MESMA função registrada
    // sai, e é isso que se afirma agora.
    //
    // Sem a limpeza, cada montagem deixaria um ouvinte para trás chamando `setTela` numa árvore que
    // não existe mais, e a próxima montagem, que acontece a cada teste deste arquivo e a cada
    // recarga do Vite em desenvolvimento, somaria mais um.
    const adicionados: EventListenerOrEventListenerObject[] = [];
    const removidos: EventListenerOrEventListenerObject[] = [];
    // Os originais presos ANTES do espião: o `window` do jsdom não aceita ser chamado por
    // `EventTarget.prototype`, então repassar pelo protótipo lança em vez de registrar.
    const adicionarDeVerdade = window.addEventListener.bind(window);
    const removerDeVerdade = window.removeEventListener.bind(window);
    const adicionar = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation((tipo: string, ouvinte, opcoes?) => {
        if (tipo === 'popstate' && ouvinte !== null) adicionados.push(ouvinte);
        adicionarDeVerdade(tipo, ouvinte, opcoes);
      });
    const remover = vi
      .spyOn(window, 'removeEventListener')
      .mockImplementation((tipo: string, ouvinte, opcoes?) => {
        if (tipo === 'popstate' && ouvinte !== null) removidos.push(ouvinte);
        removerDeVerdade(tipo, ouvinte, opcoes);
      });

    try {
      // Uma montagem limpa, com os espiões já no lugar, para contar só o que ELA registra.
      act(() => {
        raiz.unmount();
        raiz = createRoot(container);
        raiz.render(<App />);
      });
      expect(adicionados).toHaveLength(1);
      // A desmontagem de cima removeu o ouvinte da montagem do `beforeEach`, registrado antes de
      // o espião existir. Ele não é desta pergunta, e contá-lo faria o teste comparar duas
      // montagens diferentes.
      removidos.length = 0;

      act(() => {
        raiz.unmount();
      });

      expect(removidos).toEqual(adicionados);
    } finally {
      adicionar.mockRestore();
      remover.mockRestore();
      // Remonta para o `afterEach` ter o que desmontar.
      act(() => {
        raiz = createRoot(container);
        raiz.render(<App />);
      });
    }
  });
});
