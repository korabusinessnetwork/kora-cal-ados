import { describe, expect, it } from 'vitest';

import { secoesDoPapel } from './SecoesDaArea';

describe('secoesDoPapel', () => {
  it('owner vê a entrada do fornecedor de modelo de linguagem', () => {
    expect(secoesDoPapel('owner').map((secao) => secao.id)).toContain('fornecedor');
  });

  it('membro não recebe a entrada do fornecedor de modelo de linguagem', () => {
    expect(secoesDoPapel('membro').map((secao) => secao.id)).not.toContain('fornecedor');
  });

  it('"Compor calçado" é de todo papel: quem compõe é o time', () => {
    expect(secoesDoPapel('membro').map((secao) => secao.id)).toContain('compor');
    expect(secoesDoPapel('owner').map((secao) => secao.id)).toContain('compor');
  });
});
