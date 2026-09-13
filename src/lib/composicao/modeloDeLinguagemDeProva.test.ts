import { describe, expect, it } from 'vitest';

import { catalogoDeProva } from '../acervo/acervoDeProva';
import { FORMA_CHINELO, acervoDeTeste, peca } from './fixtures/acervoDeTeste';
import { gerarComposicaoPorPrompt } from './gerarComposicaoPorPrompt';
import { montarCatalogoParaModelo } from './montarCatalogoParaModelo';
import { modeloDeLinguagemDeProva, responderComoGeradorDeProva } from './modeloDeLinguagemDeProva';

const CATALOGO = catalogoDeProva();
const FORMA = CATALOGO.formas[0]!;

/** O prompt pelo caminho inteiro, com o gerador de prova no lugar do modelo: é o que a tela faz. */
async function gerar(prompt: string) {
  const composicao = await gerarComposicaoPorPrompt(prompt, FORMA, CATALOGO, modeloDeLinguagemDeProva);

  return new Map(composicao.pecas.map(({ categoria, peca, cor, parametros }) => [categoria, { id: peca.id, cor, parametros }]));
}

describe('gerador de prova, pelo caminho inteiro até o guarda', () => {
  it('"cano alto vermelho sem cadarço" vira cabedal cano alto vermelho, sem cadarço', async () => {
    const pecas = await gerar('cano alto vermelho sem cadarço');

    expect(pecas.get('cabedal')).toMatchObject({ id: 'prova-cabedal-cano-alto', cor: '#C0392B' });
    expect(pecas.has('cadarco')).toBe(false);
    expect(pecas.get('sola')?.cor).toBeUndefined();
  });

  it('cada cor vai para a categoria citada antes dela', async () => {
    const pecas = await gerar('Sola tratorada branca, cabedal azul e cadarço amarelo');

    expect(pecas.get('sola')).toMatchObject({ id: 'prova-sola-tratorada', cor: '#F2F2F2' });
    expect(pecas.get('cabedal')).toMatchObject({ id: 'prova-cabedal-baixo', cor: '#1F4FA8' });
    expect(pecas.get('cadarco')).toMatchObject({ id: 'prova-cadarco-reto', cor: '#E8B33C' });
  });

  it('cor sem categoria antes pinta o calçado inteiro', async () => {
    const pecas = await gerar('tudo preto');

    expect([...pecas.values()].map(({ cor }) => cor)).toEqual(['#1A1A1A', '#1A1A1A', '#1A1A1A']);
  });

  it('hex escrito no prompt vale como cor, e sai na forma longa pelo guarda', async () => {
    const pecas = await gerar('cabedal #0a0');

    expect(pecas.get('cabedal')?.cor).toBe('#00AA00');
  });

  it('"sola grossa" leva a espessura ao máximo da faixa, e "fina" ao mínimo', async () => {
    expect((await gerar('sola grossa')).get('sola')?.parametros).toEqual({ espessura: 0.04 });
    expect((await gerar('sola tratorada fina')).get('sola')?.parametros).toEqual({ espessura: 0.015 });
  });

  it('prompt sem palavra-chave nenhuma monta a primeira peça de cada categoria, e é válido', async () => {
    const pecas = await gerar('um tênis bonito');

    expect([...pecas.values()].map(({ id }) => id)).toEqual(['prova-sola-plana', 'prova-cabedal-baixo', 'prova-cadarco-reto']);
  });

  it('"sem sola" não tira categoria obrigatória', async () => {
    const pecas = await gerar('sem sola');

    expect(pecas.has('sola')).toBe(true);
  });
});

describe('gerador de prova, lê só o catálogo que recebeu', () => {
  it('com o catálogo do chinelo, responde só peça do chinelo', () => {
    const catalogo = acervoDeTeste();
    const chinelo = catalogo.formas.find(({ id }) => id === FORMA_CHINELO)!;

    const resposta = JSON.parse(responderComoGeradorDeProva(montarCatalogoParaModelo(chinelo, catalogo), 'cano alto'));

    expect(resposta).toEqual({ forma_id: FORMA_CHINELO, pecas: [{ peca_id: 'sola-chinelo' }] });
  });

  it('palavra curta do rótulo não escolhe peça: "de" em "cabedal de couro" não aponta para "Cabedal de lona"', () => {
    const catalogo = acervoDeTeste();
    const tenis = catalogo.formas[0]!;
    catalogo.pecas.push(
      { ...peca('cabedal-liso', 'cabedal', tenis.id), rotulo: 'Cabedal liso' },
      { ...peca('cabedal-lona', 'cabedal', tenis.id), rotulo: 'Cabedal de lona' },
    );
    catalogo.pecas = catalogo.pecas.filter(({ id }) => id !== 'cabedal-mesh');

    const resposta = JSON.parse(responderComoGeradorDeProva(montarCatalogoParaModelo(tenis, catalogo), 'cabedal de couro'));

    expect(resposta.pecas.map(({ peca_id }: { peca_id: string }) => peca_id)).toContain('cabedal-liso');
  });

  it('responde texto, e não objeto: quem transforma em composição é o guarda', async () => {
    const resposta = await modeloDeLinguagemDeProva({ instrucao: '', catalogo: montarCatalogoParaModelo(FORMA, CATALOGO), prompt: 'azul' });

    expect(typeof resposta).toBe('string');
  });
});
