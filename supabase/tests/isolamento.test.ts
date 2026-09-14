// Teste de isolamento entre tenants, o gate que `docs/11_SEGURANCA/multi-tenancy-rls.md`
// exige antes de qualquer release. Aqui a promessa central do produto vira asserção:
// marca concorrente nunca vê coleção não lançada da outra.
//
// Precisa de um ambiente Supabase real (SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY). Sem eles, PULA, nunca finge que passou.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { montarCenario, limpar, anonimo, temAmbiente, type Cenario } from './ambiente';
import { analisarSvg } from '../../src/lib/render/dom';
import { normalizarSvg } from '../../src/lib/render/normalizarSvg';

describe.skipIf(!temAmbiente)('isolamento entre tenants', () => {
  let cenario: Cenario;

  beforeAll(async () => {
    cenario = await montarCenario();
  }, 60_000);

  afterAll(async () => {
    if (cenario) await limpar(cenario);
  }, 60_000);

  it('BUG-006: ler membros do próprio tenant não entra em recursão de policy', async () => {
    const { data, error } = await cenario.clienteA
      .from('tenant_members')
      .select('tenant_id, papel');

    // 42P17 = infinite recursion detected in policy, é o defeito que esta migration corrige.
    expect(error?.code).not.toBe('42P17');
    expect(error).toBeNull();
    expect(data?.every((linha) => linha.tenant_id === cenario.tenantA)).toBe(true);
  });

  it('marca concorrente não lê o produto, nem sabendo o id', async () => {
    const { data, error } = await cenario.clienteB
      .from('products')
      .select('id, nome')
      .eq('id', cenario.produtoA);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('marca concorrente não escreve zona no tenant alheio', async () => {
    const { error } = await cenario.clienteB.from('product_zones').insert({
      product_id: cenario.produtoA,
      tenant_id: cenario.tenantA,
      zone_key: 'sola',
      svg_selector: '#zona-sola',
    });

    expect(error).not.toBeNull();
  });

  it('marca concorrente não alcança o asset-base no Storage', async () => {
    // O caminho é o do arquivo que EXISTE de verdade no bucket. Pedir um caminho
    // inventado provaria menos: a recusa poderia ser "não achei", não "não é seu".
    const { error } = await cenario.clienteB.storage
      .from('assets-base')
      .createSignedUrl(cenario.assetDoProdutoA, 300);

    expect(error).not.toBeNull();
  });

  it('o dono baixa o próprio asset-base e recebe o SVG canônico', async () => {
    // O outro lado da mesma moeda: sem isto, uma policy que negasse a TODO mundo passaria
    // no teste acima e ninguém perceberia até o editor abrir vazio.
    const { data, error } = await cenario.clienteA.storage
      .from('assets-base')
      .createSignedUrl(cenario.assetDoProdutoA, 300);

    expect(error).toBeNull();

    const svg = await (await fetch(data?.signedUrl ?? '')).text();

    expect(svg).toContain('<svg');
    // Canônico, não cru: é o que o editor e a API leem (ADR-004).
    expect(analisarSvg(svg).querySelector('style')).toBeNull();
    // E com os ids cunhados na normalização, que é o que o editor vai endereçar (ADR-005).
    expect(svg).toContain('elemento-1');
  });

  it('canário: o normalizador de hoje é compatível com o asset já gravado', async () => {
    // Se a ordem de cunhagem de id mudar numa versão futura, todo `svg_selector` gravado
    // repointa em silêncio. Este teste fica vermelho ANTES de qualquer variante sair
    // errada, é a rede de segurança que a decisão 2 do ADR-005 exige.
    const { data } = await cenario.clienteA.storage
      .from('assets-base')
      .createSignedUrl(cenario.assetDoProdutoA, 300);
    const baixado = await (await fetch(data?.signedUrl ?? '')).text();

    expect(normalizarSvg(baixado).svg).toBe(baixado);
  });

  it('BUG-009: membro não-owner não apaga produto do próprio tenant', async () => {
    await cenario.clienteMembroA.from('products').delete().eq('id', cenario.produtoA);

    const { data } = await cenario.clienteA.from('products').select('id').eq('id', cenario.produtoA);
    expect(data).toHaveLength(1);
  });

  it('BUG-007: owner edita o tema do próprio tenant (white-label)', async () => {
    const { error } = await cenario.clienteA
      .from('tenants')
      .update({ tema: { cor_primaria: '#C0392B' } })
      .eq('id', cenario.tenantA);

    expect(error).toBeNull();
  });

  it('owner não edita o tema do tenant alheio', async () => {
    await cenario.clienteB
      .from('tenants')
      .update({ tema: { cor_primaria: '#000000' } })
      .eq('id', cenario.tenantA);

    const { data } = await cenario.clienteA.from('tenants').select('tema').eq('id', cenario.tenantA);
    expect(data?.[0]?.tema).toEqual({ cor_primaria: '#C0392B' });
  });

  it('anônimo (só anon key, sem sessão) não lê nada', async () => {
    const { data } = await anonimo().from('products').select('id');
    expect(data).toEqual([]);
  });
});
