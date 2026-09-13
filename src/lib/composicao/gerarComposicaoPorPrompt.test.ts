import { describe, expect, it, vi } from 'vitest';

import { ErroDeVariante } from '../render/erros';
import { FORMA_CHINELO, FORMA_TENIS, acervoDeTeste } from './fixtures/acervoDeTeste';
import {
  INSTRUCAO_AO_MODELO,
  ModeloNaoRespondeu,
  PromptRecusado,
  TAMANHO_MAXIMO_DO_PROMPT,
  gerarComposicaoPorPrompt,
  type ModeloDeLinguagem,
} from './gerarComposicaoPorPrompt';

const CATALOGO = acervoDeTeste();
const TENIS = CATALOGO.formas.find(({ id }) => id === FORMA_TENIS)!;

/** Um modelo que responde sempre o mesmo texto, e guarda o pedido que recebeu. */
function modeloQueResponde(texto: string) {
  return vi.fn<ModeloDeLinguagem>(async () => texto);
}

const RESPOSTA_BOA = JSON.stringify({
  forma_id: FORMA_TENIS,
  pecas: [{ peca_id: 'sola-tratorada', cor: '#c0392b' }, { peca_id: 'cabedal-mesh' }],
});

async function recusa(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa;
  } catch (erro) {
    return erro;
  }
  throw new Error('era para recusar, e aceitou');
}

describe('gerarComposicaoPorPrompt, o caminho feliz', () => {
  it('a resposta do modelo vira composição validada, com a peça do catálogo e a cor na forma longa', async () => {
    const composicao = await gerarComposicaoPorPrompt('sola tratorada vermelha', TENIS, CATALOGO, modeloQueResponde(RESPOSTA_BOA));

    expect(composicao.pecas.map(({ peca }) => peca.id)).toEqual(['sola-tratorada', 'cabedal-mesh']);
    expect(composicao.pecas[0]?.cor).toBe('#C0392B');
    expect(composicao.pecas[0]?.parametros).toEqual({ espessura: 30, 'altura-entressola': 12 });
  });

  it('o modelo recebe instrução, catálogo e prompt em campos separados, e o prompt sem espaço nas pontas', async () => {
    const modelo = modeloQueResponde(RESPOSTA_BOA);

    await gerarComposicaoPorPrompt('  sola tratorada  ', TENIS, CATALOGO, modelo);

    const pedido = modelo.mock.calls[0]![0];
    expect(pedido.instrucao).toBe(INSTRUCAO_AO_MODELO);
    expect(pedido.prompt).toBe('sola tratorada');
    expect(JSON.parse(pedido.catalogo).forma_id).toBe(FORMA_TENIS);
    expect(pedido.catalogo).not.toContain('sola-chinelo');
  });

  it('aceita a composição embrulhada num bloco de código com frase antes', async () => {
    const texto = 'Aqui está a composição:\n```json\n' + RESPOSTA_BOA + '\n```';

    const composicao = await gerarComposicaoPorPrompt('x', TENIS, CATALOGO, modeloQueResponde(texto));

    expect(composicao.pecas).toHaveLength(2);
  });
});

describe('gerarComposicaoPorPrompt, o prompt é conferido antes de chamar o modelo', () => {
  it('prompt vazio é recusado e o modelo não é chamado', async () => {
    const modelo = modeloQueResponde(RESPOSTA_BOA);

    const erro = await recusa(gerarComposicaoPorPrompt('   ', TENIS, CATALOGO, modelo));

    expect(erro).toBeInstanceOf(PromptRecusado);
    expect(modelo).not.toHaveBeenCalled();
  });

  it('prompt acima do limite é recusado e o modelo não é chamado; no limite, passa', async () => {
    const modelo = modeloQueResponde(RESPOSTA_BOA);

    const erro = await recusa(gerarComposicaoPorPrompt('a'.repeat(TAMANHO_MAXIMO_DO_PROMPT + 1), TENIS, CATALOGO, modelo));
    expect(erro).toBeInstanceOf(PromptRecusado);
    expect((erro as Error).message).toContain(String(TAMANHO_MAXIMO_DO_PROMPT));
    expect(modelo).not.toHaveBeenCalled();

    await gerarComposicaoPorPrompt('a'.repeat(TAMANHO_MAXIMO_DO_PROMPT), TENIS, CATALOGO, modelo);
    expect(modelo).toHaveBeenCalledTimes(1);
  });
});

describe('gerarComposicaoPorPrompt, a resposta passa pelo guarda', () => {
  it('peça inventada pelo modelo sai como PECA_NAO_ENCONTRADA', async () => {
    const texto = JSON.stringify({ forma_id: FORMA_TENIS, pecas: [{ peca_id: 'sola-corrida-04' }, { peca_id: 'cabedal-mesh' }] });

    const erro = await recusa(gerarComposicaoPorPrompt('x', TENIS, CATALOGO, modeloQueResponde(texto)));

    expect((erro as ErroDeVariante).codigo).toBe('PECA_NAO_ENCONTRADA');
  });

  it('parâmetro fora da faixa sai como PARAMETRO_INVALIDO', async () => {
    const texto = JSON.stringify({
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa', parametros: { espessura: 99 } }, { peca_id: 'cabedal-mesh' }],
    });

    const erro = await recusa(gerarComposicaoPorPrompt('x', TENIS, CATALOGO, modeloQueResponde(texto)));

    expect((erro as ErroDeVariante).codigo).toBe('PARAMETRO_INVALIDO');
  });

  it('resposta sem JSON sai como COMPOSICAO_INVALIDA', async () => {
    const erro = await recusa(gerarComposicaoPorPrompt('x', TENIS, CATALOGO, modeloQueResponde('Não sei montar isso.')));

    expect((erro as ErroDeVariante).codigo).toBe('COMPOSICAO_INVALIDA');
  });

  it('resposta de outra forma do catálogo é recusada, mesmo sendo uma composição válida dela', async () => {
    const texto = JSON.stringify({ forma_id: FORMA_CHINELO, pecas: [{ peca_id: 'sola-chinelo' }] });

    const erro = await recusa(gerarComposicaoPorPrompt('x', TENIS, CATALOGO, modeloQueResponde(texto)));

    expect((erro as ErroDeVariante).codigo).toBe('COMPOSICAO_INVALIDA');
    expect((erro as Error).message).toContain(FORMA_CHINELO);
  });

  it('modelo que falha vira ModeloNaoRespondeu, sem a mensagem de dentro na frase', async () => {
    const modelo = vi.fn<ModeloDeLinguagem>(async () => {
      throw new Error('401 Unauthorized: Bearer sk-segredo-de-teste');
    });

    const erro = await recusa(gerarComposicaoPorPrompt('x', TENIS, CATALOGO, modelo));

    expect(erro).toBeInstanceOf(ModeloNaoRespondeu);
    expect((erro as Error).message).not.toContain('sk-segredo');
  });
});
