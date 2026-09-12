// @vitest-environment jsdom
//
// O botão de copiar o corpo do pedido. Arquivo separado de `PainelDaApi.test.tsx` de propósito:
// aquele prende o CONTRATO mostrado na tela e roda com `renderToStaticMarkup`, que só enxerga o
// primeiro render; este prende o COMPORTAMENTO do botão, que é estado mudando depois de um clique,
// e por isso precisa de jsdom. Duas perguntas diferentes, dois ambientes diferentes, e o arquivo
// de contrato continua barato de rodar.
//
// A afirmação que mais importa é a negativa, a mesma de `src/lib/copia/useCopiaDeTexto.test.tsx`:
// com a área de transferência NEGADA, o painel precisa dizer isso na tela. Aqui o que está sendo
// provado não é a regra (ela já tem teste próprio), é a LIGAÇÃO: que este botão está de fato nela,
// e que copia o corpo, e não o bloco inteiro com o cabeçalho de exemplo junto.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PainelDaApi } from './PainelDaApi';
import type { RelatorioDeNormalizacao } from '../lib/render/normalizarSvg';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const relatorioVazio: RelatorioDeNormalizacao = {
  idsRenomeados: [],
  idsAtribuidos: [],
  declaracoesAchatadas: 0,
  scriptsRemovidos: 0,
  handlersRemovidos: 0,
  referenciasExternasRemovidas: 0,
};

/** O que a área de transferência falsa recebeu, e se ela aceita ou recusa. */
const area = { escritos: [] as string[], recusa: false };

let raiz: Root | null = null;
let alvo: HTMLDivElement;

async function montar(cores: Record<string, string>) {
  alvo = document.createElement('div');
  document.body.appendChild(alvo);
  raiz = createRoot(alvo);

  await act(async () => {
    raiz?.render(<PainelDaApi cores={cores} relatorio={relatorioVazio} erro={null} />);
  });
}

const botao = () =>
  [...alvo.querySelectorAll('button')].find((b) => b.textContent === 'Copiar o corpo')!;

const aviso = () => alvo.querySelector('.copia-do-corpo__aviso')?.textContent ?? '';
const erroNaTela = () => alvo.querySelector('.copia-do-corpo__erro')?.textContent ?? null;

/** Clicar e deixar a promessa da área de transferência assentar antes de afirmar. */
async function clicar() {
  await act(async () => {
    botao().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  area.escritos = [];
  area.recusa = false;

  // Escrita à mão, e não `vi.mock`: este projeto não usa mock de módulo em lugar nenhum.
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (texto: string) => {
        if (area.recusa) throw new Error('permissão negada');
        area.escritos.push(texto);
      },
    },
  });
});

afterEach(async () => {
  const atual = raiz;
  raiz = null;
  if (atual) await act(async () => atual.unmount());
  document.body.innerHTML = '';
});

describe('PainelDaApi, botão de copiar o corpo', () => {
  it('copia o corpo do pedido, e não o bloco inteiro', async () => {
    // A chave de exemplo e as linhas de cabeçalho ficam de fora: elas mudam de cliente HTTP para
    // cliente HTTP, e `kora_live_..._SEGREDO_DE_EXEMPLO` colado junto pareceria chave pronta.
    await montar({ sola: '#2E2E33', cabedal: '#2B4C7E' });

    await clicar();

    expect(area.escritos).toEqual([JSON.stringify({ sola: '#2E2E33', cabedal: '#2B4C7E' }, null, 2)]);
    expect(area.escritos[0]).not.toContain('SEGREDO_DE_EXEMPLO');
    expect(area.escritos[0]).not.toContain('POST /api/v1/products');
  });

  it('depois de copiar, a tela diz que copiou', async () => {
    await montar({ sola: '#2E2E33' });

    await clicar();

    expect(aviso()).toContain('Corpo copiado');
    expect(erroNaTela()).toBeNull();
  });

  it('área de transferência negada aparece na tela, e não some em silêncio', async () => {
    // A AFIRMAÇÃO CENTRAL. Em desenvolvimento a cópia sempre funciona, então este caminho só
    // existe no navegador de alguém, e é o caminho em que o silêncio faz a pessoa colar o que já
    // estava na área de transferência achando que colou o corpo do pedido.
    area.recusa = true;
    await montar({ sola: '#2E2E33' });

    await clicar();

    expect(erroNaTela()).toContain('O navegador não deixou copiar');
    expect(erroNaTela()).toContain('copie à mão');
    expect(area.escritos).toEqual([]);
  });

  it('a recusa aponta para o bloco que continua na tela', async () => {
    // Não há bloco de reserva aqui, ao contrário da composição: o corpo já está visível dentro do
    // bloco da requisição. Se um dia alguém remover esse bloco, esta afirmação vira mentira.
    area.recusa = true;
    await montar({ sola: '#2E2E33' });

    await clicar();

    const bloco = alvo.querySelector('.codigo--requisicao')?.textContent ?? '';
    expect(bloco).toContain('"sola": "#2E2E33"');
  });

  it('mudar a cor apaga o aviso de copiada', async () => {
    // Senão o aviso passa a falar de um corpo que não é mais o que está no bloco. Quem garante
    // isso é o hook, chaveado pelo texto; o que este teste prende é que o painel entrega para ele
    // o corpo, e não um texto fixo que nunca muda.
    await montar({ sola: '#2E2E33' });
    await clicar();
    expect(aviso()).toContain('Corpo copiado');

    await act(async () => {
      raiz?.render(<PainelDaApi cores={{ sola: '#B23A2E' }} relatorio={relatorioVazio} erro={null} />);
    });

    expect(aviso()).not.toContain('Corpo copiado');
  });
});
