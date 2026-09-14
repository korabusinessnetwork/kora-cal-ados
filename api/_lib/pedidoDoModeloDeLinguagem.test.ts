// O 500 das rotas do modelo de linguagem: o detalhe vai ao log, e a resposta não o carrega.

import { describe, expect, it } from 'vitest';

import { falhaDaRotaDoModelo, MENSAGEM_DE_FALHA_INTERNA_DO_MODELO } from './pedidoDoModeloDeLinguagem';
import { criarFalhaDeTransporte } from './traduzirParaFalhaDaApi';

describe('falhaDaRotaDoModelo', () => {
  it('erro inesperado vai ao log com a rota, e a resposta sai com a frase fixa, sem "variante"', () => {
    const linhas: string[] = [];

    const falha = falhaDaRotaDoModelo('configuracao', new Error('null value in column "chave_cifrada"'), (linha) => linhas.push(linha));

    expect(falha.status).toBe(500);
    expect(falha.message).toBe(MENSAGEM_DE_FALHA_INTERNA_DO_MODELO);
    expect(falha.message).not.toMatch(/variante|chave_cifrada/);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatch(/rota=configuracao/);
    expect(linhas[0]).toMatch(/chave_cifrada/);
  });

  it('recusa nossa passa igual e não suja o log', () => {
    const linhas: string[] = [];
    const recusa = criarFalhaDeTransporte('SEM_PERMISSAO');

    expect(falhaDaRotaDoModelo('gerar', recusa, (linha) => linhas.push(linha))).toBe(recusa);
    expect(linhas).toHaveLength(0);
  });
});
