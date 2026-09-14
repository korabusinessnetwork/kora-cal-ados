// @vitest-environment jsdom
//
// "Compor calçado" montada, com a tela da composição trocada por um dublê: o que se prova aqui é
// QUEM a tela recebe para responder o prompt, e não o 3D (que tem os testes dele em `palco3d/`).

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModeloDaTela } from '../../palco3d/TelaDaComposicao';
import type { TenantDoUsuario } from '../sessao/carregarTenantsDoUsuario';
import { FalhaDaApiDoModelo, type ChamadorDaApi } from './chamarApiDoModeloDeLinguagem';
import { TelaDeComporCalcado } from './TelaDeComporCalcado';

vi.mock('../../palco3d/TelaDaComposicao', async () => {
  const { DESCRICAO_DO_GERADOR_DE_PROVA } = await import('../../lib/composicao/modeloDeLinguagemDeProva');
  return {
    MODELO_DE_PROVA_DA_TELA: { criar: () => async () => '', descricao: DESCRICAO_DO_GERADOR_DE_PROVA },
    TelaDaComposicao: ({ modeloDaTela }: { modeloDaTela: ModeloDaTela }) => (
      <output data-testid="dubla">{`${modeloDaTela.descricao.nome}|ia=${String(modeloDaTela.descricao.ehIa)}`}</output>
    ),
  };
});

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const MEMBRO: TenantDoUsuario = { id: '11111111-1111-4111-8111-111111111111', nome: 'Marca Teste', slug: 'marca', tema: {}, papel: 'membro' };

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

/** O `lazy` e a leitura de `em-uso` resolvem em tarefas separadas; espera as duas. */
async function esperarTelaAssentar() {
  for (let volta = 0; volta < 3; volta += 1) {
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0));
    });
  }
}

async function montar(chamar: ChamadorDaApi) {
  await act(async () => {
    raiz.render(<TelaDeComporCalcado tenant={MEMBRO} chamar={chamar} />);
  });
  await esperarTelaAssentar();
}

const dubla = () => container.querySelector('[data-testid="dubla"]')?.textContent;

describe('TelaDeComporCalcado', () => {
  it('com fornecedor configurado, membro compõe com ele e a tela diz quem responde', async () => {
    const rotas: string[] = [];
    const chamar = (async (rota: string) => {
      rotas.push(rota);
      return { fornecedor_em_uso: { fornecedor: 'groq', nome_do_fornecedor: 'Groq', modelo: 'llama-3.3-70b-versatile' } };
    }) as ChamadorDaApi;

    await montar(chamar);

    expect(rotas).toEqual(['em-uso']);
    expect(dubla()).toBe('Groq (modelo llama-3.3-70b-versatile)|ia=true');
    expect(container.textContent).toMatch(/respondido por Groq \(modelo llama-3.3-70b-versatile\)/);
  });

  it('sem fornecedor, a tela recebe o gerador de prova e diz que não é IA', async () => {
    const chamar = (async () => ({ fornecedor_em_uso: null })) as ChamadorDaApi;

    await montar(chamar);

    expect(dubla()).toBe('o gerador de prova|ia=false');
    expect(container.textContent).toMatch(/gerador de prova, que não é IA/);
    expect(container.textContent).toMatch(/Quem configura é o owner/);
  });

  it('falha ao ler não vira "sem fornecedor": avisa, usa o gerador de prova e tenta de novo', async () => {
    let tentativas = 0;
    const chamar = (async () => {
      tentativas += 1;
      if (tentativas === 1) throw new FalhaDaApiDoModelo('SEM_CONEXAO', 'Sem conexão com a API.', 0);
      return { fornecedor_em_uso: { fornecedor: 'groq', nome_do_fornecedor: 'Groq', modelo: 'm' } };
    }) as ChamadorDaApi;

    await montar(chamar);
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/Não foi possível saber.*Sem conexão com a API/);
    expect(dubla()).toBe('o gerador de prova|ia=false');

    await act(async () => {
      [...container.querySelectorAll('button')].find((botao) => botao.textContent === 'Tentar de novo')?.click();
    });
    await esperarTelaAssentar();

    expect(tentativas).toBe(2);
    expect(dubla()).toBe('Groq (modelo m)|ia=true');
  });
});
