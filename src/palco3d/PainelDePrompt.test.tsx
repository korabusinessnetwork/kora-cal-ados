// @vitest-environment jsdom
//
// O painel de prompt sozinho, com um modelo de linguagem que o teste controla.
//
// A tela inteira já prova o caminho feliz com o gerador de prova (`TelaDaComposicao.test.tsx`). O que
// só dá para provar aqui é o que o gerador de prova nunca faz: demorar, falhar, responder lixo, e
// responder depois de a pessoa ter saído da tela.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogoDeProva } from '../lib/acervo/acervoDeProva';
import type { ModeloDeLinguagem } from '../lib/composicao/gerarComposicaoPorPrompt';
import { PainelDePrompt } from './PainelDePrompt';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const CATALOGO = catalogoDeProva();
const FORMA = CATALOGO.formas[0]!;
const DESCRICAO = { ehIa: false, nome: 'o gerador de prova' };

let container: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  raiz = createRoot(container);
});

afterEach(() => {
  act(() => raiz.unmount());
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function montar(modelo: ModeloDeLinguagem, aoGerar = vi.fn(), geradoEmCena = false) {
  act(() => {
    raiz.render(
      <PainelDePrompt
        forma={FORMA}
        catalogo={CATALOGO}
        modelo={modelo}
        descricao={DESCRICAO}
        geradoEmCena={geradoEmCena}
        aoGerar={aoGerar}
      />,
    );
  });

  return aoGerar;
}

const campo = () => container.querySelector<HTMLTextAreaElement>('#composicao-prompt')!;
const botao = () => container.querySelector<HTMLButtonElement>('button')!;
const alerta = () => container.querySelector('[role="alert"]')?.textContent ?? '';
const status = () => container.querySelector('[role="status"]')?.textContent ?? '';

function escrever(valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(campo(), valor);
    campo().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clicarEEsperar() {
  await act(async () => {
    botao().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const RESPOSTA_VALIDA = JSON.stringify({
  forma_id: FORMA.id,
  pecas: [{ peca_id: 'prova-sola-plana' }, { peca_id: 'prova-cabedal-cano-alto', cor: '#C0392B' }],
});

describe('o painel de prompt', () => {
  it('abre com o botão desabilitado e sem anunciar nada, e só habilita com texto que não seja espaço', () => {
    const modelo = vi.fn<ModeloDeLinguagem>();
    montar(modelo);

    expect(botao().disabled).toBe(true);
    expect(container.querySelectorAll('[role]')).toHaveLength(0);

    escrever('   ');
    expect(botao().disabled).toBe(true);

    escrever('cano alto');
    expect(botao().disabled).toBe(false);
    expect(container.querySelector('.palco3d__saida-ajuda')?.textContent).toContain('não é IA');
  });

  it('resposta válida sobe as escolhas para a tela e anuncia sem interromper', async () => {
    const modelo = vi.fn<ModeloDeLinguagem>(async () => RESPOSTA_VALIDA);
    const aoGerar = montar(modelo, vi.fn(), true);

    escrever('  cano alto vermelho  ');
    await clicarEEsperar();

    // O modelo recebe o prompt aparado e o catálogo em texto, e não o acervo em objeto.
    expect(modelo).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'cano alto vermelho' }));
    expect(typeof modelo.mock.calls[0]![0].catalogo).toBe('string');
    expect(aoGerar).toHaveBeenCalledTimes(1);
    const escolhas = aoGerar.mock.calls[0]![0] as Map<string, { pecaId: string | null; cor?: string }>;
    expect(escolhas.get('cabedal')).toMatchObject({ pecaId: 'prova-cabedal-cano-alto', cor: '#C0392B' });
    expect(status()).toContain('Composição gerada');
    expect(alerta()).toBe('');
  });

  it('resposta que o guarda recusa não sobe nada, e interrompe dizendo que o calçado não mudou', async () => {
    const modelo = vi.fn<ModeloDeLinguagem>(async () =>
      JSON.stringify({ forma_id: FORMA.id, pecas: [{ peca_id: 'peca-inventada' }] }),
    );
    const aoGerar = montar(modelo);

    escrever('qualquer coisa');
    await clicarEEsperar();

    expect(aoGerar).not.toHaveBeenCalled();
    expect(alerta()).toContain('PECA_NAO_ENCONTRADA');
    expect(alerta()).toContain('continua sendo o de antes');
    expect(status()).toBe('');
  });

  it('modelo que falha vira mensagem fixa, sem vazar o erro de dentro dele', async () => {
    const modelo = vi.fn<ModeloDeLinguagem>(async () => {
      throw new Error('401 chave sk-segredo inválida');
    });
    const aoGerar = montar(modelo);

    escrever('azul');
    await clicarEEsperar();

    expect(aoGerar).not.toHaveBeenCalled();
    expect(alerta()).toContain('não respondeu');
    expect(container.textContent).not.toContain('sk-segredo');
  });

  it('enquanto o modelo pensa, o botão trava e diz que está gerando', async () => {
    let responder: (texto: string) => void = () => undefined;
    const modelo = vi.fn<ModeloDeLinguagem>(() => new Promise((resolve) => (responder = resolve)));
    const aoGerar = montar(modelo, vi.fn(), true);

    escrever('azul');
    await clicarEEsperar();

    expect(botao().disabled).toBe(true);
    expect(botao().textContent).toBe('Gerando…');
    expect(status()).toContain('Gerando a composição');

    await act(async () => responder(RESPOSTA_VALIDA));

    expect(aoGerar).toHaveBeenCalledTimes(1);
    expect(botao().disabled).toBe(false);
  });

  it('a frase de "composição gerada" some quando o calçado em cena deixa de ser o gerado', async () => {
    const modelo = vi.fn<ModeloDeLinguagem>(async () => RESPOSTA_VALIDA);
    const aoGerar = montar(modelo, vi.fn(), true);
    escrever('azul');
    await clicarEEsperar();
    expect(status()).toContain('Composição gerada');

    montar(modelo, aoGerar, false);

    expect(status()).toBe('');
  });

  it('resposta que chega depois de a pessoa sair da tela não sobe para tela nenhuma', async () => {
    let responder: (texto: string) => void = () => undefined;
    const modelo = vi.fn<ModeloDeLinguagem>(() => new Promise((resolve) => (responder = resolve)));
    const aoGerar = montar(modelo);

    escrever('azul');
    await clicarEEsperar();
    act(() => raiz.render(<></>));
    await act(async () => responder(RESPOSTA_VALIDA));

    expect(aoGerar).not.toHaveBeenCalled();
  });
});
