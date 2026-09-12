// @vitest-environment jsdom
//
// O que este arquivo prende é a corrida: trocar de marca com uma requisição em voo.
//
// O `vivo` do efeito já existia e o comentário ao lado dele já prometia isso ("trocar de marca com
// uma requisição em voo não pode deixar o produto da marca anterior aparecer na tela da nova"),
// mas promessa em comentário não reprova nada. Apagar o `vivo` não deixava nenhum teste vermelho,
// e o defeito que ele evita é o pior que este projeto pode ter: a lista de produtos de uma marca
// aparecendo na tela de outra. O produto é multi-tenant com marcas CONCORRENTES, e isolamento é
// requisito comercial, não detalhe técnico.
//
// Não é defeito hipotético de laboratório. Basta a rede da primeira marca estar lenta e a pessoa
// trocar de marca no seletor: a resposta antiga chega depois e pinta a tela nova.
//
// Só ficou alcançável porque o cliente passou a entrar por parâmetro (A44). Antes, o hook lia
// `clienteSupabase()` de dentro, e sem `vi.mock`, que este projeto não usa em lugar nenhum, montar
// isto exigiria rede de verdade. Componente-sonda no mesmo molde de `usePreviewDeCor.test.tsx`,
// gravando TODAS as passagens, inclusive as que o React descarta: a corrida é justamente o tipo de
// defeito que aparece numa passagem intermediária e some na seguinte.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { useProdutos, type ListaDeProdutosCarregada } from './useProdutos';
import type { Produto } from '../listarProdutos';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

type Resposta = { data?: unknown; error?: unknown };

/**
 * Um cliente cujas respostas ficam PENDURADAS até o teste soltar cada uma, pelo tenant.
 *
 * É o que permite escrever a corrida na ordem em que ela acontece de verdade: a marca A é pedida,
 * a marca B é pedida, e só então a resposta de A chega, atrasada. Um `Promise.resolve` imediato
 * não reproduziria isso, porque a resposta de A já teria sido entregue antes de B existir.
 */
function clientePendurado() {
  const pendentes = new Map<string, (resposta: Resposta) => void>();

  const cliente = {
    from() {
      return {
        select() {
          return {
            eq(_coluna: string, tenantId: string) {
              return {
                order() {
                  return new Promise<Resposta>((resolver) => {
                    pendentes.set(tenantId, resolver);
                  });
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return {
    cliente,
    pedidos: () => [...pendentes.keys()],
    responder(tenantId: string, produtos: { id: string; nome: string }[]) {
      const resolver = pendentes.get(tenantId);
      if (resolver === undefined) throw new Error(`ninguém pediu os produtos de ${tenantId}`);

      resolver({ data: produtos.map((p) => ({ ...p, base_asset_path: `${p.id}.svg` })) });
    },
  };
}

let passagens: { tenantId: string; estado: string; nomes: string[] }[] = [];

function Sonda({ tenantId, cliente }: { tenantId: string; cliente: SupabaseClient }) {
  const lista: ListaDeProdutosCarregada = useProdutos(tenantId, cliente);

  passagens.push({
    tenantId,
    estado: lista.estado,
    nomes: lista.produtos.map((produto: Produto) => produto.nome),
  });

  return null;
}

let container: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  passagens = [];
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

/** Deixa as promessas já resolvidas entregarem antes de o teste conferir a tela. */
async function assentar() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('trocar de marca com requisição em voo (A44)', () => {
  it('a resposta atrasada da marca anterior NÃO pinta a tela da marca nova', async () => {
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda tenantId="marca-a" cliente={banco.cliente} />);
    });
    act(() => {
      raiz.render(<Sonda tenantId="marca-b" cliente={banco.cliente} />);
    });

    // A ordem que cria o defeito: a marca A responde DEPOIS de a tela já ser da marca B.
    banco.responder('marca-a', [{ id: 'p-a', nome: 'Tênis da marca A' }]);
    await assentar();
    banco.responder('marca-b', [{ id: 'p-b', nome: 'Bota da marca B' }]);
    await assentar();

    // A afirmação que vale o arquivo, e ela é sobre TODAS as passagens, não só a última: um
    // produto da marca A visível por um render é um produto da marca A visível na tela.
    const vazamento = passagens.filter(
      ({ tenantId, nomes }) => tenantId === 'marca-b' && nomes.some((nome) => nome.includes('A')),
    );

    expect(vazamento).toEqual([]);
    expect(passagens.at(-1)).toMatchObject({
      tenantId: 'marca-b',
      estado: 'pronta',
      nomes: ['Bota da marca B'],
    });
  });

  it('as duas marcas foram pedidas de verdade, cada uma uma vez', () => {
    // Contraprova: sem isto, um hook que nunca chamasse a rede passaria no teste acima com
    // louvor, porque nada da marca A apareceria em lugar nenhum.
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda tenantId="marca-a" cliente={banco.cliente} />);
    });
    act(() => {
      raiz.render(<Sonda tenantId="marca-b" cliente={banco.cliente} />);
    });

    expect(banco.pedidos()).toEqual(['marca-a', 'marca-b']);
  });

  it('a lista da marca anterior some no MESMO render em que a marca muda', async () => {
    // A outra metade da corrida, e a que o `vivo` sozinho não cobre: entre o render que troca de
    // marca e o efeito que limpa o estado existe uma passagem inteira com a lista antiga sob o id
    // novo. Uma passagem é a tela. Quem segura isto é a etiqueta `de` conferida durante o render.
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda tenantId="marca-a" cliente={banco.cliente} />);
    });
    banco.responder('marca-a', [{ id: 'p-a', nome: 'Tênis da marca A' }]);
    await assentar();
    expect(passagens.at(-1)).toMatchObject({ estado: 'pronta', nomes: ['Tênis da marca A'] });

    act(() => {
      raiz.render(<Sonda tenantId="marca-b" cliente={banco.cliente} />);
    });

    const naTelaDaMarcaB = passagens.filter(({ tenantId }) => tenantId === 'marca-b');

    expect(naTelaDaMarcaB).not.toEqual([]);
    expect(naTelaDaMarcaB.filter(({ nomes }) => nomes.length > 0)).toEqual([]);
  });

  it('a resposta morta da marca anterior não apaga a lista que a marca nova já mostrou', async () => {
    // O que o `vivo` faz, e a etiqueta não faria: a leitura é um lugar só. A resposta atrasada da
    // marca A escrita ali por cima não apareceria na tela (a etiqueta descarta), mas apagaria a
    // lista da marca B, que ninguém recarregaria depois. Tela em branco para sempre.
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda tenantId="marca-a" cliente={banco.cliente} />);
    });
    act(() => {
      raiz.render(<Sonda tenantId="marca-b" cliente={banco.cliente} />);
    });

    banco.responder('marca-b', [{ id: 'p-b', nome: 'Bota da marca B' }]);
    await assentar();
    const quantasAteAqui = passagens.length;

    banco.responder('marca-a', [{ id: 'p-a', nome: 'Tênis da marca A' }]);
    await assentar();

    // Nem re-renderiza: a resposta morta não chega a mexer no estado.
    expect(passagens.length).toBe(quantasAteAqui);
    expect(passagens.at(-1)).toMatchObject({
      tenantId: 'marca-b',
      estado: 'pronta',
      nomes: ['Bota da marca B'],
    });
  });

  it('lista vazia é `vazia`, e não `pronta` com zero produtos', async () => {
    // Os quatro estados obrigatórios do CLAUDE.md: "essa marca não tem produto" e "a lista
    // carregou" são notícias diferentes, e a tela escreve frases diferentes para cada uma.
    const banco = clientePendurado();

    act(() => {
      raiz.render(<Sonda tenantId="marca-a" cliente={banco.cliente} />);
    });
    banco.responder('marca-a', []);
    await assentar();

    expect(passagens.at(-1)).toMatchObject({ estado: 'vazia', nomes: [] });
  });
});
