// @vitest-environment jsdom
//
// A tela "Fornecedor de modelo de linguagem" montada de verdade, com um chamador de mentira no lugar da rede.
//
// O que só se prova montando: que a chave não reaparece na tela depois de salva, que o botão de
// teste não testa uma configuração diferente da que a pessoa está vendo, e que membro não recebe o
// formulário. Cada uma dessas é uma frase de comentário até existir um teste que reprove.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  ConfiguracaoDoFornecedorVisivel,
  ResumoDoUsoDoMes,
} from '../../lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import type { TenantDoUsuario } from '../sessao/carregarTenantsDoUsuario';
import { FalhaDaApiDoModelo, type ChamadorDaApi, type OpcoesDaChamada } from './chamarApiDoModeloDeLinguagem';
import { TelaDoFornecedor } from './TelaDoFornecedor';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const CHAVE = 'gsk_chave-colada-pela-pessoa-1234';

const OWNER: TenantDoUsuario = { id: '11111111-1111-4111-8111-111111111111', nome: 'Marca Teste', slug: 'marca', tema: {}, papel: 'owner' };
const MEMBRO: TenantDoUsuario = { ...OWNER, papel: 'membro' };

const GRAVADA: ConfiguracaoDoFornecedorVisivel = {
  fornecedor: 'groq',
  modelo: 'llama-3.3-70b-versatile',
  endereco: null,
  preco_entrada_por_milhao: 0,
  preco_saida_por_milhao: 0,
  teto_mensal_usd: 10,
  final_da_chave: '1234',
  updated_at: '2026-09-14T10:00:00.000Z',
};

const USO_VAZIO: ResumoDoUsoDoMes & { completo: boolean } = {
  mes: '2026-09',
  totais: { chamadas: 0, falhas: 0, tokens_de_entrada: 0, tokens_de_saida: 0, custo_estimado_usd: 0 },
  teto_mensal_usd: null,
  por_modelo: [],
  por_dia: [],
  recentes: [],
  completo: true,
};

interface Chamada {
  rota: string;
  opcoes: OpcoesDaChamada | undefined;
}

/** Chamador falso: responde por rota e método, e grava tudo o que recebeu. */
function chamadorFalso(respostas: Record<string, (opcoes?: OpcoesDaChamada) => unknown>) {
  const chamadas: Chamada[] = [];
  const chamar = (async (rota: string, _tenant: string, opcoes?: OpcoesDaChamada) => {
    chamadas.push({ rota, opcoes });
    const responder = respostas[`${opcoes?.metodo ?? 'GET'} ${rota}`];
    if (!responder) throw new Error(`rota não prevista no teste: ${opcoes?.metodo ?? 'GET'} ${rota}`);
    return responder(opcoes);
  }) as ChamadorDaApi;
  return { chamar, chamadas };
}

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

async function montar(tenant: TenantDoUsuario, chamar: ChamadorDaApi) {
  await act(async () => {
    raiz.render(<TelaDoFornecedor tenant={tenant} chamar={chamar} />);
  });
}

function campo(rotulo: string): HTMLInputElement | HTMLSelectElement {
  const label = [...container.querySelectorAll('label')].find((item) => item.textContent?.startsWith(rotulo));
  const alvo = label?.querySelector('input, select');
  if (!alvo) throw new Error(`campo "${rotulo}" não encontrado`);
  return alvo as HTMLInputElement;
}

function botao(texto: string): HTMLButtonElement {
  const alvo = [...container.querySelectorAll('button')].find((item) => item.textContent === texto);
  if (!alvo) throw new Error(`botão "${texto}" não encontrado`);
  return alvo;
}

/** Digita como o React espera: pelo setter nativo, senão o `onChange` não dispara. */
function digitar(elemento: HTMLInputElement | HTMLSelectElement, valor: string) {
  const prototipo = elemento instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototipo, 'value')?.set?.call(elemento, valor);
  elemento.dispatchEvent(new Event(elemento instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

describe('TelaDoFornecedor', () => {
  it('membro não recebe formulário nem painel, e nenhuma chamada sai', async () => {
    const { chamar, chamadas } = chamadorFalso({});

    await montar(MEMBRO, chamar);

    expect(container.textContent).toMatch(/Só o owner da marca/);
    expect(container.querySelector('form')).toBeNull();
    expect(chamadas).toHaveLength(0);
  });

  it('owner sem configuração vê o aviso do gerador de prova e o mês vazio', async () => {
    const { chamar } = chamadorFalso({
      'GET configuracao': () => ({ configuracao: null }),
      'GET uso': () => USO_VAZIO,
    });

    await montar(OWNER, chamar);

    expect(container.textContent).toMatch(/Nenhum fornecedor configurado/);
    expect(container.textContent).toMatch(/Nenhuma chamada ao fornecedor neste mês/);
    expect(botao('Testar conexão').disabled).toBe(true);
  });

  it('salvar sem chave mostra o que falta e não chama o servidor', async () => {
    const { chamar, chamadas } = chamadorFalso({
      'GET configuracao': () => ({ configuracao: null }),
      'GET uso': () => USO_VAZIO,
    });
    await montar(OWNER, chamar);

    await act(async () => {
      botao('Salvar').click();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/Cole a chave/);
    expect(chamadas.some((chamada) => chamada.opcoes?.metodo === 'PUT')).toBe(false);
  });

  it('salvar manda a chave uma vez, e depois a tela só mostra o final dela', async () => {
    const { chamar, chamadas } = chamadorFalso({
      'GET configuracao': () => ({ configuracao: null }),
      'GET uso': () => USO_VAZIO,
      'PUT configuracao': () => ({ configuracao: GRAVADA }),
    });
    await montar(OWNER, chamar);

    await act(async () => digitar(campo('Chave'), CHAVE));
    await act(async () => {
      botao('Salvar').click();
    });

    const put = chamadas.find((chamada) => chamada.opcoes?.metodo === 'PUT');
    expect(put?.opcoes?.corpo).toMatchObject({ fornecedor: 'groq', chave: CHAVE });
    // A propriedade: depois de salva, a chave não está em lugar nenhum da tela, nem no valor do campo.
    expect(container.innerHTML).not.toContain(CHAVE);
    expect((campo('Chave') as HTMLInputElement).value).toBe('');
    expect(container.textContent).toMatch(/chave terminando em 1234/);
    expect(container.textContent).toMatch(/Configuração salva/);
  });

  it('com o formulário alterado, "Testar conexão" fica desligado e diz por quê', async () => {
    const { chamar } = chamadorFalso({
      'GET configuracao': () => ({ configuracao: GRAVADA }),
      'GET uso': () => USO_VAZIO,
    });
    await montar(OWNER, chamar);
    expect(botao('Testar conexão').disabled).toBe(false);

    await act(async () => digitar(campo('Modelo'), 'outro-modelo'));

    expect(botao('Testar conexão').disabled).toBe(true);
    expect(container.textContent).toMatch(/alterações não salvas/);
  });

  it('a falha do teste aparece com a mensagem do servidor e a configuração continua na tela', async () => {
    const { chamar } = chamadorFalso({
      'GET configuracao': () => ({ configuracao: GRAVADA }),
      'GET uso': () => USO_VAZIO,
      'POST testar': () => {
        throw new FalhaDaApiDoModelo('FORNECEDOR_RECUSOU_A_CHAVE', 'O fornecedor recusou a chave.', 502);
      },
    });
    await montar(OWNER, chamar);

    await act(async () => {
      botao('Testar conexão').click();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('O fornecedor recusou a chave.');
    expect(container.textContent).toMatch(/Em uso: llama-3.3-70b-versatile/);
  });

  it('remover pede confirmação antes de chamar o servidor', async () => {
    const { chamar, chamadas } = chamadorFalso({
      'GET configuracao': () => ({ configuracao: GRAVADA }),
      'GET uso': () => USO_VAZIO,
      'DELETE configuracao': () => ({ configuracao: null }),
    });
    await montar(OWNER, chamar);

    await act(async () => {
      botao('Remover fornecedor').click();
    });
    expect(chamadas.some((chamada) => chamada.opcoes?.metodo === 'DELETE')).toBe(false);

    await act(async () => {
      botao('Confirmar remoção').click();
    });
    expect(chamadas.some((chamada) => chamada.opcoes?.metodo === 'DELETE')).toBe(true);
    expect(container.textContent).toMatch(/Nenhum fornecedor configurado/);
  });

  it('o painel mostra totais, teto e chamadas recentes do mês', async () => {
    const { chamar } = chamadorFalso({
      'GET configuracao': () => ({ configuracao: GRAVADA }),
      'GET uso': () => ({
        ...USO_VAZIO,
        teto_mensal_usd: 10,
        totais: { chamadas: 3, falhas: 1, tokens_de_entrada: 2400, tokens_de_saida: 300, custo_estimado_usd: 2.5 },
        por_dia: [{ dia: '2026-09-14', chamadas: 3, falhas: 1, tokens_de_entrada: 2400, tokens_de_saida: 300, custo_estimado_usd: 2.5 }],
        por_modelo: [
          { fornecedor: 'groq', modelo: 'llama-3.3-70b-versatile', chamadas: 3, falhas: 1, tokens_de_entrada: 2400, tokens_de_saida: 300, custo_estimado_usd: 2.5 },
        ],
        recentes: [
          { created_at: '2026-09-14T10:00:00.000Z', fornecedor: 'groq', modelo: 'llama-3.3-70b-versatile', origem: 'teste', sucesso: false, tokens_de_entrada: 0, tokens_de_saida: 0, custo_estimado_usd: 0 },
        ],
      }),
    });

    await montar(OWNER, chamar);

    expect(container.textContent).toMatch(/US\$ 2,50/);
    expect(container.textContent).toMatch(/1 com falha/);
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25');
    expect(container.textContent).toMatch(/Teste de conexão/);
    expect(container.textContent).toMatch(/falhou/);
  });

  it('erro ao ler o gasto dá um "Tentar de novo" que lê de novo', async () => {
    let tentativas = 0;
    const { chamar } = chamadorFalso({
      'GET configuracao': () => ({ configuracao: GRAVADA }),
      'GET uso': () => {
        tentativas += 1;
        if (tentativas === 1) throw new FalhaDaApiDoModelo('ERRO_INTERNO', 'Falhou ao ler o gasto.', 500);
        return USO_VAZIO;
      },
    });
    await montar(OWNER, chamar);
    expect(container.textContent).toMatch(/Falhou ao ler o gasto/);

    await act(async () => {
      botao('Tentar de novo').click();
    });

    expect(tentativas).toBe(2);
    expect(container.textContent).toMatch(/Nenhuma chamada ao fornecedor neste mês/);
  });
});
