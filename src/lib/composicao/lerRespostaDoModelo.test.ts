import { describe, expect, it } from 'vitest';

import { TAMANHO_MAXIMO_DA_RESPOSTA, lerRespostaDoModelo } from './lerRespostaDoModelo';

describe('lerRespostaDoModelo', () => {
  it('tira o JSON do meio do texto', () => {
    expect(lerRespostaDoModelo('ok: {"a": 1} fim')).toEqual({ a: 1 });
  });

  it('JSON quebrado é COMPOSICAO_INVALIDA, não o erro do JSON.parse', () => {
    expect(() => lerRespostaDoModelo('{"a": }')).toThrowError(expect.objectContaining({ codigo: 'COMPOSICAO_INVALIDA' }));
  });

  it('resposta maior que o teto é descartada sem ser lida', () => {
    const enorme = '{"a": "' + 'x'.repeat(TAMANHO_MAXIMO_DA_RESPOSTA) + '"}';

    expect(() => lerRespostaDoModelo(enorme)).toThrowError(expect.objectContaining({ codigo: 'COMPOSICAO_INVALIDA' }));
  });
});
