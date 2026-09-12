// @vitest-environment jsdom
//
// O que este arquivo prende não é a marcação, que vive em `marcacaoEmCurso.ts` e já tem teste. É o
// DESCARTE: trocar de produto tem que zerar a marcação, e zerar no render, não num efeito.
//
// Por que isso importa o bastante para merecer teste próprio: os ids marcados são ids de elementos
// do SVG do produto aberto. Sobrevivendo à troca, eles seriam gravados como zona do produto NOVO,
// apontando para elementos que não existem nele. A zona nasceria sem pintar nada, e ninguém
// perceberia na hora de marcar, que é o modo de falha silencioso que o princípio nº1 proíbe.
//
// Por que no render e não em `useEffect`: com efeito existiria um render em que o `productId` já é o
// novo e a lista ainda é a velha. Um clique nesse intervalo grava id de outro modelo. O teste abaixo
// olha justamente para isso, gravando o que o hook DEVOLVE a cada passagem, inclusive na passagem
// que o React descarta.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useMarcacaoDeZona, type MarcacaoDeZona } from './useMarcacaoDeZona';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/** Tudo o que o hook devolveu, na ordem, uma entrada por passagem pelo corpo do componente. */
let passagens: { produto: string; marcados: string[] }[] = [];

/** A última marcação vista, para chamar as ações dela de fora do componente. */
const visto: { marcacao: MarcacaoDeZona | null } = { marcacao: null };

function Sonda({ produto }: { produto: string }) {
  const marcacao = useMarcacaoDeZona(produto);

  passagens.push({ produto, marcados: marcacao.idsMarcados });
  visto.marcacao = marcacao;

  return null;
}

function marcacao(): MarcacaoDeZona {
  if (!visto.marcacao) throw new Error('a sonda não renderizou');

  return visto.marcacao;
}

let raiz: Root | null = null;

async function montar(produto: string) {
  const area = document.createElement('div');
  document.body.appendChild(area);
  raiz = createRoot(area);

  await act(async () => {
    raiz?.render(<Sonda produto={produto} />);
  });
}

async function trocarPara(produto: string) {
  await act(async () => {
    raiz?.render(<Sonda produto={produto} />);
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  passagens = [];
  visto.marcacao = null;
});

afterEach(async () => {
  const atual = raiz;
  raiz = null;
  if (atual) await act(async () => atual.unmount());
  document.body.innerHTML = '';
});

describe('marcação de zona', () => {
  it('nasce vazia', async () => {
    await montar('produto-1');

    expect(marcacao().idsMarcados).toEqual([]);
  });

  it('alternar marca e desmarca o mesmo id', async () => {
    await montar('produto-1');

    await act(async () => marcacao().alternar('zona-sola'));
    expect(marcacao().idsMarcados).toEqual(['zona-sola']);

    await act(async () => marcacao().alternar('zona-sola'));
    expect(marcacao().idsMarcados).toEqual([]);
  });

  it('guarda a ordem do clique, que é a que vai para o seletor', async () => {
    await montar('produto-1');

    await act(async () => marcacao().alternar('b'));
    await act(async () => marcacao().alternar('a'));
    await act(async () => marcacao().alternar('c'));

    expect(marcacao().idsMarcados).toEqual(['b', 'a', 'c']);
  });

  it('desfazer tira o último, e limpar tira todos', async () => {
    await montar('produto-1');

    await act(async () => marcacao().alternar('a'));
    await act(async () => marcacao().alternar('b'));
    await act(async () => marcacao().desfazer());
    expect(marcacao().idsMarcados).toEqual(['a']);

    await act(async () => marcacao().limpar());
    expect(marcacao().idsMarcados).toEqual([]);
  });

  it('trocar de produto descarta a marcação', async () => {
    await montar('produto-1');
    await act(async () => marcacao().alternar('zona-sola'));

    await trocarPara('produto-2');

    expect(marcacao().idsMarcados).toEqual([]);
  });

  it('NENHUMA passagem devolve a marcação velha junto do produto novo', async () => {
    // A afirmação central. Com o descarte em `useEffect` existiria uma passagem com
    // `produto-2` e `['zona-sola']` ao mesmo tempo, e um clique nela gravaria id de outro
    // modelo. Aqui se olha o que o hook devolveu em TODAS as passagens, inclusive na que o
    // React descarta depois, e não só o estado final.
    await montar('produto-1');
    await act(async () => marcacao().alternar('zona-sola'));

    passagens = [];
    await trocarPara('produto-2');

    expect(passagens.length).toBeGreaterThan(0);
    const vazamentos = passagens.filter((p) => p.produto === 'produto-2' && p.marcados.length > 0);
    expect(vazamentos).toEqual([]);
  });

  it('voltar ao produto anterior não ressuscita o que estava marcado nele', async () => {
    // O descarte é descarte, não um esconderijo por produto: quem volta encontra a tela limpa e
    // remarca, em vez de receber de volta uma marcação que não vê há três telas.
    await montar('produto-1');
    await act(async () => marcacao().alternar('zona-sola'));

    await trocarPara('produto-2');
    await trocarPara('produto-1');

    expect(marcacao().idsMarcados).toEqual([]);
  });

  it('renderizar de novo com o MESMO produto não apaga nada', async () => {
    // O descarte é disparado pela troca, não por render: fosse por render, qualquer mudança de
    // estado do pai apagaria a marcação em curso.
    await montar('produto-1');
    await act(async () => marcacao().alternar('zona-sola'));

    await trocarPara('produto-1');

    expect(marcacao().idsMarcados).toEqual(['zona-sola']);
  });
});
