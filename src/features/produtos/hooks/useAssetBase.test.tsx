// @vitest-environment jsdom
//
// A mesma corrida de `useProdutos.test.tsx`, num lugar onde ela machuca mais.
//
// Aqui o que chega atrasado não é um nome numa lista: é o DESENHO sobre o qual a pessoa vai
// marcar zona. Se o asset-base do produto anterior aparecer na tela do produto novo, cada clique
// grava um seletor contra o desenho errado, e a zona errada é gravada em silêncio, no banco. É o
// princípio nº1 pelo avesso, e o dano sobrevive à sessão: o registro fica no banco parecendo
// certo. A URL assinada expira em 5 minutos, então "abrir outro produto antes disso" é o caso
// comum, não o raro.
//
// O `vivo` do efeito já prometia isso num comentário, e apagá-lo não deixava nada vermelho.
// Alcançável agora porque o cliente entra por parâmetro (A44). O `fetch` é substituído à mão, do
// mesmo jeito que `useCopiaDeTexto.test.tsx` substitui a área de transferência: este projeto não
// usa `vi.mock` em lugar nenhum.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { useAssetBase, type AssetBaseCarregado } from './useAssetBase';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const svgDe = (nome: string) => `<svg data-de="${nome}"></svg>`;

/** O que cada URL assinada devolve quando o `fetch` chega nela. */
const conteudoPorUrl = new Map<string, string>();

type Assinatura = { data?: { signedUrl: string }; error?: unknown };

/**
 * Cliente com a assinatura PENDURADA por caminho, para a resposta do produto anterior poder
 * chegar depois de a tela já ser do produto novo. É essa ordem, e não outra, que cria o defeito.
 */
function clientePendurado() {
  const pendentes = new Map<string, (assinatura: Assinatura) => void>();

  const cliente = {
    storage: {
      from: () => ({
        createSignedUrl: (caminho: string) =>
          new Promise<Assinatura>((resolver) => {
            pendentes.set(caminho, resolver);
          }),
      }),
    },
  } as unknown as SupabaseClient;

  return {
    cliente,
    pedidos: () => [...pendentes.keys()],
    responder(caminho: string, svg: string) {
      const resolver = pendentes.get(caminho);
      if (resolver === undefined) throw new Error(`ninguém pediu ${caminho}`);

      const url = `https://exemplo.invalido/${caminho}`;
      conteudoPorUrl.set(url, svg);
      resolver({ data: { signedUrl: url } });
    },
  };
}

let passagens: { caminho: string; estado: string; svg: string | null }[] = [];

function Sonda({ caminho, cliente }: { caminho: string; cliente: SupabaseClient }) {
  const asset: AssetBaseCarregado = useAssetBase(caminho, cliente);

  passagens.push({ caminho, estado: asset.estado, svg: asset.svg });

  return null;
}

let container: HTMLDivElement;
let raiz: Root;
let fetchOriginal: typeof globalThis.fetch;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  passagens = [];
  conteudoPorUrl.clear();
  fetchOriginal = globalThis.fetch;
  globalThis.fetch = ((entrada: RequestInfo | URL) => {
    const texto = conteudoPorUrl.get(String(entrada)) ?? '';

    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(texto) });
  }) as unknown as typeof globalThis.fetch;

  container = document.createElement('div');
  document.body.appendChild(container);
  raiz = createRoot(container);
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  container.remove();
  globalThis.fetch = fetchOriginal;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

/** Duas voltas: a assinatura e o `fetch` são dois `await` em sequência dentro do mesmo caminho. */
async function assentar() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('trocar de produto com o asset-base em voo (A44)', () => {
  it('o desenho atrasado do produto anterior NÃO aparece na tela do produto novo', async () => {
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda caminho="produto-a.svg" cliente={banco.cliente} />);
    });
    act(() => {
      raiz.render(<Sonda caminho="produto-b.svg" cliente={banco.cliente} />);
    });

    banco.responder('produto-a.svg', svgDe('a'));
    await assentar();
    banco.responder('produto-b.svg', svgDe('b'));
    await assentar();

    // Um único render com o desenho de A sob o caminho de B já é a tela errada para marcar zona.
    const vazamento = passagens.filter(
      ({ caminho, svg }) => caminho === 'produto-b.svg' && svg !== null && svg.includes('"a"'),
    );

    expect(vazamento).toEqual([]);
    expect(passagens.at(-1)).toEqual({
      caminho: 'produto-b.svg',
      estado: 'pronto',
      svg: svgDe('b'),
    });
  });

  it('os dois produtos foram pedidos, cada um uma vez', () => {
    // Contraprova: um hook que nunca pedisse nada passaria no teste acima sem fazer nada.
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda caminho="produto-a.svg" cliente={banco.cliente} />);
    });
    act(() => {
      raiz.render(<Sonda caminho="produto-b.svg" cliente={banco.cliente} />);
    });

    expect(banco.pedidos()).toEqual(['produto-a.svg', 'produto-b.svg']);
  });

  it('trocar de produto limpa o desenho antigo no MESMO render, não um depois', async () => {
    // Sem isto, o desenho de A ficaria na tela durante toda a espera de B, e a pessoa poderia
    // clicar nele achando que é o produto que ela acabou de abrir. Esperar com a tela em branco
    // é honesto; esperar com o desenho errado não é.
    //
    // "No mesmo render" é a parte que custa: limpar dentro do efeito deixa passar uma passagem
    // inteira com o desenho de A sob o caminho de B, e é sobre o desenho que a pessoa clica. Por
    // isso a conferência é sobre TODAS as passagens do caminho novo, e não só sobre a última.
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda caminho="produto-a.svg" cliente={banco.cliente} />);
    });
    banco.responder('produto-a.svg', svgDe('a'));
    await assentar();
    expect(passagens.at(-1)).toMatchObject({ estado: 'pronto', svg: svgDe('a') });

    act(() => {
      raiz.render(<Sonda caminho="produto-b.svg" cliente={banco.cliente} />);
    });

    const naTelaDoB = passagens.filter(({ caminho }) => caminho === 'produto-b.svg');

    expect(naTelaDoB).not.toEqual([]);
    expect(naTelaDoB.filter(({ svg }) => svg !== null)).toEqual([]);
    expect(passagens.at(-1)).toEqual({
      caminho: 'produto-b.svg',
      estado: 'carregando',
      svg: null,
    });
  });

  it('o desenho morto do produto anterior não apaga o que o produto novo já mostrou', async () => {
    // O que o `vivo` faz, e a etiqueta do caminho não faria: o desenho é um lugar só. A resposta
    // atrasada de A escrita ali por cima não apareceria (a etiqueta descarta), mas apagaria o
    // desenho de B, que ninguém baixaria de novo. O editor ficaria sem desenho nenhum.
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda caminho="produto-a.svg" cliente={banco.cliente} />);
    });
    act(() => {
      raiz.render(<Sonda caminho="produto-b.svg" cliente={banco.cliente} />);
    });

    banco.responder('produto-b.svg', svgDe('b'));
    await assentar();
    const quantasAteAqui = passagens.length;

    banco.responder('produto-a.svg', svgDe('a'));
    await assentar();

    expect(passagens.length).toBe(quantasAteAqui);
    expect(passagens.at(-1)).toEqual({
      caminho: 'produto-b.svg',
      estado: 'pronto',
      svg: svgDe('b'),
    });
  });
});
