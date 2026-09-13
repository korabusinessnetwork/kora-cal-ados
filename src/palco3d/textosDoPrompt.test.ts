import { describe, expect, it } from 'vitest';

import { avisoDaComposicaoGerada, quemRespondeOPrompt } from './textosDoPrompt';

const GERADOR_DE_PROVA = { ehIa: false, nome: 'o gerador de prova' };
const FORNECEDOR = { ehIa: true, nome: 'o Fornecedor X' };

describe('o aviso de composição gerada (transparência de IA)', () => {
  it('diz que foi automático, a partir do prompt, e que peças existentes foram escolhidas, não desenhadas', () => {
    const aviso = avisoDaComposicaoGerada(FORNECEDOR);

    expect(aviso).toContain('Composto automaticamente a partir do seu prompt');
    expect(aviso).toContain('já existiam no acervo');
    expect(aviso).toContain('nenhuma peça foi desenhada');
  });

  it('com modelo de IA, diz que é IA e o nome dele', () => {
    expect(avisoDaComposicaoGerada(FORNECEDOR)).toContain('o Fornecedor X, um modelo de linguagem (IA)');
  });

  it('com o gerador de prova, diz que NÃO é IA, e não atribui a uma IA o que ela não fez', () => {
    const aviso = avisoDaComposicaoGerada(GERADOR_DE_PROVA);

    expect(aviso).toContain('o gerador de prova, que não é IA');
    expect(aviso).not.toContain('(IA)');
  });

  it('nenhum dos textos usa travessão', () => {
    const textos = [GERADOR_DE_PROVA, FORNECEDOR].flatMap((d) => [avisoDaComposicaoGerada(d), quemRespondeOPrompt(d)]);

    expect(textos.filter((texto) => texto.includes('\u2014'))).toEqual([]);
  });
});

describe('a ajuda de quem responde o prompt', () => {
  it('o gerador de prova lista as palavras-chave que entende, e diz que não é IA', () => {
    const ajuda = quemRespondeOPrompt(GERADOR_DE_PROVA);

    expect(ajuda).toContain('que não é IA');
    expect(ajuda).toContain('"sem"');
    expect(ajuda).toContain('mesmo guarda');
  });

  it('um modelo de IA é apresentado como IA, sem a lista de palavras-chave', () => {
    const ajuda = quemRespondeOPrompt(FORNECEDOR);

    expect(ajuda).toContain('um modelo de linguagem (IA)');
    expect(ajuda).not.toContain('"sem"');
    expect(ajuda).toContain('mesmo guarda');
  });
});
