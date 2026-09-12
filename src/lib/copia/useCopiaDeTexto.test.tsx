// @vitest-environment jsdom
//
// O que este arquivo prende é o caminho que ninguém exercita à mão: a área de transferência
// NEGADA. Em desenvolvimento ela sempre funciona, então o estado `falhou` só aparece no navegador
// de alguém, fora de HTTPS ou sem permissão, e é justamente o caso em que sumir em silêncio faz a
// pessoa colar outra coisa achando que colou a certa.
//
// Mesmo molde de `usePreviewDeCor.test.tsx`: componente-sonda que grava o que o hook devolveu em
// TODAS as passagens, inclusive nas que o React descarta. Sem testing-library e sem `vi.mock`, que
// este projeto não usa em lugar nenhum.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useCopiaDeTexto, type CopiaDeTexto } from './useCopiaDeTexto';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/** O que a área de transferência falsa recebeu, e se ela aceita ou recusa. */
const area = { escritos: [] as string[], recusa: false };

let passagens: { texto: string; estado: string }[] = [];
const visto: { copia: CopiaDeTexto | null } = { copia: null };

function Sonda({ texto }: { texto: string }) {
  const copia = useCopiaDeTexto(texto);

  passagens.push({ texto, estado: copia.estado });
  visto.copia = copia;

  return null;
}

function copia(): CopiaDeTexto {
  if (!visto.copia) throw new Error('a sonda não renderizou');

  return visto.copia;
}

let raiz: Root | null = null;

async function montar(texto: string) {
  const alvo = document.createElement('div');
  document.body.appendChild(alvo);
  raiz = createRoot(alvo);

  await act(async () => {
    raiz?.render(<Sonda texto={texto} />);
  });
}

async function trocarPara(texto: string) {
  await act(async () => {
    raiz?.render(<Sonda texto={texto} />);
  });
}

/** Clicar e deixar a promessa da área de transferência assentar antes de afirmar. */
async function clicar() {
  await act(async () => {
    copia().copiar();
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  passagens = [];
  visto.copia = null;
  area.escritos = [];
  area.recusa = false;

  // jsdom não traz `navigator.clipboard`. A falsa é escrita aqui, e não por `vi.mock`, porque
  // este projeto não usa mock de módulo em lugar nenhum.
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

describe('cópia de texto', () => {
  it('nasce pronta, sem ter copiado nada', async () => {
    await montar('{"sola":"#C0392B"}');

    expect(copia().estado).toBe('pronta');
    expect(area.escritos).toEqual([]);
  });

  it('copia o texto inteiro, e não uma aproximação dele', async () => {
    await montar('{"sola":"#C0392B"}');

    await clicar();

    expect(area.escritos).toEqual(['{"sola":"#C0392B"}']);
    expect(copia().estado).toBe('copiada');
  });

  it('área de transferência negada vira estado `falhou`, e não silêncio', async () => {
    // A AFIRMAÇÃO CENTRAL. É o caminho que ninguém exercita à mão, e é aquele em que sumir em
    // silêncio faz a pessoa colar o que já estava na área de transferência achando que colou isto.
    area.recusa = true;
    await montar('{"sola":"#C0392B"}');

    await clicar();

    expect(copia().estado).toBe('falhou');
    expect(area.escritos).toEqual([]);
  });

  it('depois de falhar, tentar de novo com a permissão dada volta a copiar', async () => {
    area.recusa = true;
    await montar('{"sola":"#C0392B"}');
    await clicar();

    area.recusa = false;
    await clicar();

    expect(copia().estado).toBe('copiada');
    expect(area.escritos).toEqual(['{"sola":"#C0392B"}']);
  });

  it('mudar o texto apaga o aviso de copiada', async () => {
    // Senão o aviso passa a falar de um texto que não está mais na tela.
    await montar('{"sola":"#C0392B"}');
    await clicar();
    expect(copia().estado).toBe('copiada');

    await trocarPara('{"sola":"#111111"}');

    expect(copia().estado).toBe('pronta');
  });

  it('mudar o texto também apaga o aviso de falha', async () => {
    area.recusa = true;
    await montar('{"sola":"#C0392B"}');
    await clicar();

    await trocarPara('{"sola":"#111111"}');

    expect(copia().estado).toBe('pronta');
  });

  it('NENHUMA passagem mostra "copiada" junto do texto novo', async () => {
    // Com o descarte em `useEffect` existiria uma passagem com o texto novo e o aviso velho ao
    // mesmo tempo, e é essa passagem que a pessoa vê.
    await montar('{"sola":"#C0392B"}');
    await clicar();

    passagens = [];
    await trocarPara('{"sola":"#111111"}');

    expect(passagens.length).toBeGreaterThan(0);
    const mentiras = passagens.filter(
      (p) => p.texto === '{"sola":"#111111"}' && p.estado !== 'pronta',
    );
    expect(mentiras).toEqual([]);
  });

  it('renderizar de novo com o MESMO texto não apaga o aviso', async () => {
    // O descarte é disparado pela troca do texto, não por render: fosse por render, qualquer
    // mudança de estado do pai apagaria o "copiada" no mesmo instante em que ele aparecesse.
    await montar('{"sola":"#C0392B"}');
    await clicar();

    await trocarPara('{"sola":"#C0392B"}');

    expect(copia().estado).toBe('copiada');
  });

  it('copiar de novo o mesmo texto escreve de novo', async () => {
    // Botão que "já foi usado" e não faz mais nada é armadilha: a pessoa copiou outra coisa no
    // meio e volta aqui justamente para recuperar este texto.
    await montar('{"sola":"#C0392B"}');

    await clicar();
    await clicar();

    expect(area.escritos).toEqual(['{"sola":"#C0392B"}', '{"sola":"#C0392B"}']);
  });
});
