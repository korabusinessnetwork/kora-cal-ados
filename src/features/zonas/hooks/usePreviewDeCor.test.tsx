// @vitest-environment jsdom
//
// Irmão de `useMarcacaoDeZona.test.tsx`, e pelo mesmo motivo: a regra de cor vive em
// `coresDoPreview.ts` e já tem teste; o que ninguém prendia é o DESCARTE ao trocar de produto.
//
// Aqui o vazamento é pior que o da marcação, porque ele PINTA. A `zone_key` `sola` existe em todo
// modelo de calçado, então uma cor sobrando de um produto não fica órfã: ela encontra a zona de
// mesmo nome no produto seguinte e pinta, em silêncio, uma cor que ninguém escolheu ali. É o avesso
// exato do princípio nº1, cor no editor que não é cor nenhuma na API.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { usePreviewDeCor, type PreviewDeCor } from './usePreviewDeCor';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/** Tudo o que o hook devolveu, uma entrada por passagem pelo corpo do componente. */
let passagens: { produto: string; cores: Record<string, string> }[] = [];

const visto: { preview: PreviewDeCor | null } = { preview: null };

function Sonda({ produto }: { produto: string }) {
  const preview = usePreviewDeCor(produto);

  passagens.push({ produto, cores: preview.cores });
  visto.preview = preview;

  return null;
}

function preview(): PreviewDeCor {
  if (!visto.preview) throw new Error('a sonda não renderizou');

  return visto.preview;
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
  visto.preview = null;
});

afterEach(async () => {
  const atual = raiz;
  raiz = null;
  if (atual) await act(async () => atual.unmount());
  document.body.innerHTML = '';
});

describe('preview de cor', () => {
  it('nasce sem preview nenhum', async () => {
    await montar('produto-1');

    expect(preview().cores).toEqual({});
    expect(preview().erros).toEqual({});
    expect(preview().temPreview).toBe(false);
  });

  it('texto pela metade não vira cor nem vira erro', async () => {
    // O calçado não pode piscar e o painel não pode acusar quem só não terminou de digitar.
    await montar('produto-1');

    await act(async () => preview().definir('sola', '#C0'));

    expect(preview().cores).toEqual({});
    expect(preview().erros).toEqual({});
    // O texto cru fica à vista, senão o campo apagaria a tecla recém-digitada.
    expect(preview().emEdicao).toEqual({ sola: '#C0' });
    expect(preview().temPreview).toBe(true);
  });

  it('hex completo vira cor normalizada para o motor', async () => {
    await montar('produto-1');

    await act(async () => preview().definir('sola', '#c0392b'));

    expect(preview().cores).toEqual({ sola: '#C0392B' });
    expect(preview().erros).toEqual({});
  });

  it('o que nunca vira cor vira erro, sem derrubar as outras zonas', async () => {
    // Uma zona sendo digitada errado não pode apagar o preview das que já estão certas.
    await montar('produto-1');

    await act(async () => preview().definir('sola', '#C0392B'));
    await act(async () => preview().definir('cabedal', 'vermelho'));

    expect(preview().cores).toEqual({ sola: '#C0392B' });
    expect(Object.keys(preview().erros)).toEqual(['cabedal']);
  });

  it('trocar de produto descarta o preview', async () => {
    await montar('produto-1');
    await act(async () => preview().definir('sola', '#C0392B'));

    await trocarPara('produto-2');

    expect(preview().cores).toEqual({});
    expect(preview().emEdicao).toEqual({});
    expect(preview().temPreview).toBe(false);
  });

  it('NENHUMA passagem devolve a cor velha junto do produto novo', async () => {
    // A afirmação central. Com o descarte em `useEffect` existiria uma passagem com `produto-2` e
    // `{sola: '#C0392B'}` ao mesmo tempo, e essa passagem manda o SVG do produto novo para o motor
    // com a cor do antigo. Como `sola` existe nos dois, ela pinta.
    await montar('produto-1');
    await act(async () => preview().definir('sola', '#C0392B'));

    passagens = [];
    await trocarPara('produto-2');

    expect(passagens.length).toBeGreaterThan(0);
    const vazamentos = passagens.filter(
      (p) => p.produto === 'produto-2' && Object.keys(p.cores).length > 0,
    );
    expect(vazamentos).toEqual([]);
  });

  it('renderizar de novo com o MESMO produto não apaga o preview', async () => {
    await montar('produto-1');
    await act(async () => preview().definir('sola', '#C0392B'));

    await trocarPara('produto-1');

    expect(preview().cores).toEqual({ sola: '#C0392B' });
  });

  it('o mesmo texto de novo devolve o MESMO objeto, sem refazer o render do palco', async () => {
    // Identidade, não igualdade: `cores` vai por prop para o palco, e objeto novo a cada tecla faz
    // o SVG inteiro voltar ao motor sem nada ter mudado.
    await montar('produto-1');

    await act(async () => preview().definir('sola', '#C0392B'));
    const antes = preview().cores;

    await act(async () => preview().definir('sola', '#C0392B'));

    expect(preview().cores).toBe(antes);
  });
});
