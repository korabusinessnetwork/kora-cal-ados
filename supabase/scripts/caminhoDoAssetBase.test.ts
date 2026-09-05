// O path não é decoração: as policies do bucket leem `storage.foldername(name)` e exigem
// `tenants/<tenant_id>/…` para decidir quem enxerga o arquivo. Path fora do formato não
// dá erro — dá um objeto que a RLS considera de ninguém.

import { describe, expect, it } from 'vitest';
import { BUCKET_DO_ASSET_BASE, caminhoDoAssetBase } from './caminhoDoAssetBase';

describe('caminho do asset-base', () => {
  it('tem o formato que as policies do bucket esperam', () => {
    expect(caminhoDoAssetBase('t-1', 'p-1')).toBe('tenants/t-1/products/p-1/base.svg');
  });

  it('o tenant_id é o SEGUNDO segmento — é o que a policy compara', () => {
    expect(caminhoDoAssetBase('t-1', 'p-1').split('/')[1]).toBe('t-1');
  });

  it('recusa id vazio em vez de gerar segmento vazio', () => {
    // `tenants//products/...` desloca os índices e o arquivo cai fora do alcance do
    // próprio tenant — invisível para o dono e para todo mundo.
    expect(() => caminhoDoAssetBase('', 'p-1')).toThrow(/tenant_id/);
    expect(() => caminhoDoAssetBase('t-1', '  ')).toThrow(/product_id/);
  });

  it('recusa id com barra, que criaria uma pasta a mais', () => {
    expect(() => caminhoDoAssetBase('t-1/x', 'p-1')).toThrow(/"\/"/);
  });

  it('o bucket é o privado', () => {
    expect(BUCKET_DO_ASSET_BASE).toBe('assets-base');
  });
});
