// @vitest-environment jsdom
//
// A terceira corrida do editor, e a única com DOIS caminhos que voltam da rede.
//
// O do efeito é o mesmo das outras duas: a lista de zonas do produto anterior chegando depois de
// a tela já ser do produto novo. O segundo é próprio deste hook: `gravar` continua rodando depois
// do `await`, e se alguém trocar de produto no meio, a lista relida do produto ANTIGO seria
// escrita por cima da tela do NOVO. O código já tratava os dois, com `vivo` num e
// `produtoAberto.current` no outro, e nenhum dos dois tinha teste.
//
// Aqui a zona errada não é só exibição: o editor grava `svg_selector` contra o desenho que está na
// tela. Marcar em cima da lista errada é gravar no banco uma zona que aponta para outro produto, e
// isso sobrevive à sessão parecendo correto.
//
// Escrever os testes achou o que faltava nas duas guardas: elas só falam da resposta ATRASADA, e
// nenhuma das duas olha a janela entre o render que troca de produto e o efeito que limpa o
// estado. Nessa janela a lista do produto anterior aparecia inteira sob o id do novo. Quem fecha
// isso é a etiqueta `de`, conferida durante o render, e é por isso que boa parte das afirmações
// aqui é sobre TODAS as passagens, e não sobre a última.
//
// Alcançável porque o cliente entra por parâmetro (A44). Sem `vi.mock`, que este projeto não usa.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { useZonasDoProduto, type ZonasCarregadas } from './useZonasDoProduto';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

type Resposta = { data?: unknown; error?: unknown };

const zonaDe = (produto: string) => ({
  id: `z-${produto}`,
  product_id: produto,
  tenant_id: 'marca',
  zone_key: `zona-do-${produto}`,
  svg_selector: `#${produto}`,
  label: `Zona do ${produto}`,
  cor_default: '#101010',
});

/**
 * Cliente com as listagens PENDURADAS por produto, e a gravação resolvendo na hora.
 *
 * A listagem é o que precisa atrasar, porque é ela que volta tarde nos dois defeitos. A gravação
 * resolve imediatamente: o que interessa é o que acontece DEPOIS dela, quando o hook relê a lista.
 */
function clientePendurado() {
  const pendentes = new Map<string, (resposta: Resposta) => void>();

  const cliente = {
    from() {
      return {
        select() {
          return {
            eq(_coluna: string, productId: string) {
              return {
                order() {
                  return new Promise<Resposta>((resolver) => {
                    pendentes.set(productId, resolver);
                  });
                },
              };
            },
          };
        },
        insert() {
          return {
            select() {
              return { single: () => Promise.resolve({ data: zonaDe('gravada') }) };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return {
    cliente,
    pedidos: () => [...pendentes.keys()],
    responder(productId: string, zonas: unknown[]) {
      const resolver = pendentes.get(productId);
      if (resolver === undefined) throw new Error(`ninguém pediu as zonas de ${productId}`);

      pendentes.delete(productId);
      resolver({ data: zonas });
    },
  };
}

let passagens: { productId: string; estado: string; chaves: string[] }[] = [];
const visto: { zonas: ZonasCarregadas | null } = { zonas: null };

function Sonda({ productId, cliente }: { productId: string; cliente: SupabaseClient }) {
  const carregadas = useZonasDoProduto(productId, 'marca', cliente);

  passagens.push({
    productId,
    estado: carregadas.estado,
    chaves: carregadas.zonas.map((zona) => zona.zone_key),
  });
  visto.zonas = carregadas;

  return null;
}

let container: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  passagens = [];
  visto.zonas = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  raiz = createRoot(container);
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

async function assentar() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('trocar de produto com as zonas em voo (A44)', () => {
  it('a lista atrasada do produto anterior NÃO aparece na tela do produto novo', async () => {
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda productId="produto-a" cliente={banco.cliente} />);
    });
    act(() => {
      raiz.render(<Sonda productId="produto-b" cliente={banco.cliente} />);
    });

    banco.responder('produto-a', [zonaDe('produto-a')]);
    await assentar();
    banco.responder('produto-b', [zonaDe('produto-b')]);
    await assentar();

    const vazamento = passagens.filter(
      ({ productId, chaves }) =>
        productId === 'produto-b' && chaves.some((chave) => chave.includes('produto-a')),
    );

    expect(vazamento).toEqual([]);
    expect(passagens.at(-1)).toMatchObject({
      productId: 'produto-b',
      estado: 'pronta',
      chaves: ['zona-do-produto-b'],
    });
  });

  it('os dois produtos foram pedidos, cada um uma vez', () => {
    // Contraprova: sem rede nenhuma, o teste acima passaria sem provar coisa alguma.
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda productId="produto-a" cliente={banco.cliente} />);
    });
    act(() => {
      raiz.render(<Sonda productId="produto-b" cliente={banco.cliente} />);
    });

    expect(banco.pedidos()).toEqual(['produto-a', 'produto-b']);
  });

  it('a releitura de DEPOIS de gravar não escreve na tela do produto novo', async () => {
    // A proteção própria deste hook, e a que mais custaria: `gravar` segue rodando depois do
    // `await`, relê a lista do produto em que a gravação começou, e escreveria essa lista na tela
    // de quem já trocou de produto. Quem segura é `produtoAberto.current`, não o `vivo`.
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda productId="produto-a" cliente={banco.cliente} />);
    });
    banco.responder('produto-a', [zonaDe('produto-a')]);
    await assentar();

    // A gravação começa com o produto A aberto, e não é esperada aqui de propósito.
    let gravou: Promise<boolean> | null = null;
    act(() => {
      gravou =
        visto.zonas?.gravar({
          zone_key: 'nova',
          svg_selector: '#nova',
          label: 'Nova',
          cor_default: '#FFFFFF',
          idExistente: null,
        }) ?? null;
    });

    // A gravação passa, e o hook pede a releitura da lista DO PRODUTO A. Ela fica pendurada.
    await assentar();
    expect(banco.pedidos()).toEqual(['produto-a']);

    // No meio do caminho, a pessoa troca de produto.
    act(() => {
      raiz.render(<Sonda productId="produto-b" cliente={banco.cliente} />);
    });
    banco.responder('produto-b', [zonaDe('produto-b')]);
    await assentar();

    // Só então a releitura do produto A chega.
    banco.responder('produto-a', [zonaDe('produto-a'), zonaDe('produto-a-2')]);
    await assentar();
    await gravou;
    await assentar();

    const vazamento = passagens.filter(
      ({ productId, chaves }) =>
        productId === 'produto-b' && chaves.some((chave) => chave.includes('produto-a')),
    );

    expect(vazamento).toEqual([]);
    expect(passagens.at(-1)).toMatchObject({
      productId: 'produto-b',
      chaves: ['zona-do-produto-b'],
    });
  });

  it('a lista do produto anterior some no MESMO render em que o produto muda', async () => {
    // A metade da corrida que o `vivo` não cobre: entre o render que troca de produto e o efeito
    // que limpa o estado existe uma passagem inteira com a lista antiga sob o id novo. Aqui essa
    // passagem aceita clique, e clique vira `svg_selector` gravado contra o desenho errado.
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda productId="produto-a" cliente={banco.cliente} />);
    });
    banco.responder('produto-a', [zonaDe('produto-a')]);
    await assentar();
    expect(passagens.at(-1)).toMatchObject({ estado: 'pronta', chaves: ['zona-do-produto-a'] });

    act(() => {
      raiz.render(<Sonda productId="produto-b" cliente={banco.cliente} />);
    });

    const naTelaDoB = passagens.filter(({ productId }) => productId === 'produto-b');

    expect(naTelaDoB).not.toEqual([]);
    expect(naTelaDoB.filter(({ chaves }) => chaves.length > 0)).toEqual([]);
  });

  it('a lista morta do produto anterior não apaga a que o produto novo já mostrou', async () => {
    // O que o `vivo` faz, e a etiqueta não faria: a leitura é um lugar só. A resposta atrasada do
    // produto A escrita ali por cima não apareceria na tela (a etiqueta descarta), mas apagaria a
    // lista do produto B, e ninguém a recarregaria. O editor voltaria para "carregando" e ficaria.
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda productId="produto-a" cliente={banco.cliente} />);
    });
    act(() => {
      raiz.render(<Sonda productId="produto-b" cliente={banco.cliente} />);
    });

    banco.responder('produto-b', [zonaDe('produto-b')]);
    await assentar();
    const quantasAteAqui = passagens.length;

    banco.responder('produto-a', [zonaDe('produto-a')]);
    await assentar();

    expect(passagens.length).toBe(quantasAteAqui);
    expect(passagens.at(-1)).toMatchObject({
      productId: 'produto-b',
      estado: 'pronta',
      chaves: ['zona-do-produto-b'],
    });
  });

  it('trocar de produto no meio de uma gravação não deixa ninguém salvando para sempre', async () => {
    // Defeito encontrado ao escrever este arquivo. Quem desliga `salvando` é o fim da gravação, e
    // o fim da gravação era justamente o trecho que se recusava a escrever na tela de outro
    // produto. Resultado: trocar de produto no meio de um `gravar` deixava o produto NOVO com
    // `salvando` ligado, sem gravação nenhuma em andamento e sem nada que o desligasse.
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda productId="produto-a" cliente={banco.cliente} />);
    });
    banco.responder('produto-a', [zonaDe('produto-a')]);
    await assentar();

    act(() => {
      void visto.zonas?.gravar({
        zone_key: 'nova',
        svg_selector: '#nova',
        label: 'Nova',
        cor_default: '#FFFFFF',
        idExistente: null,
      });
    });
    expect(visto.zonas?.salvando).toBe(true);

    act(() => {
      raiz.render(<Sonda productId="produto-b" cliente={banco.cliente} />);
    });

    expect(visto.zonas?.salvando).toBe(false);

    // A gravação termina com a pessoa longe, no produto B.
    await assentar();
    banco.responder('produto-a', [zonaDe('produto-a')]);
    await assentar();
    expect(visto.zonas?.salvando).toBe(false);

    // E voltar para o produto A mostra uma gravação TERMINADA, não uma eterna. Este é o pedaço
    // que a etiqueta sozinha não resolve: se o fim da gravação só puder escrever quando a pessoa
    // ainda estiver no produto, o `salvando` do produto A nunca é desligado por ninguém.
    act(() => {
      raiz.render(<Sonda productId="produto-a" cliente={banco.cliente} />);
    });

    expect(visto.zonas?.salvando).toBe(false);
  });

  it('gravar sem marca é recusado antes da rede', async () => {
    // A guarda que impede linha órfã em `product_zones.tenant_id`, que a RLS esconderia de todo
    // mundo. Recusa antes da rede, como as outras guardas do projeto.
    const banco = clientePendurado();

    function SemMarca({ productId }: { productId: string }) {
      const carregadas = useZonasDoProduto(productId, '', banco.cliente);
      visto.zonas = carregadas;

      return null;
    }

    act(() => {
      raiz.render(<SemMarca productId="produto-a" />);
    });

    let resultado: boolean | undefined;
    await act(async () => {
      resultado = await visto.zonas?.gravar({
        zone_key: 'nova',
        svg_selector: '#nova',
        label: 'Nova',
        cor_default: '#FFFFFF',
        idExistente: null,
      });
    });

    expect(resultado).toBe(false);
    expect(visto.zonas?.erroAoGravar).toContain('marca');
  });
});
