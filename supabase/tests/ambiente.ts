// Provisionamento do cenário do teste de isolamento: dois tenants concorrentes, três
// usuários. Fica separado das asserções para o teste em si ler como especificação.
//
// Usa service_role — por isso vive em supabase/tests/, nunca em src/ (que vai pro
// bundle do navegador).

import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import '../../src/lib/render/domNode';
import { normalizarSvg } from '../../src/lib/render/normalizarSvg';
import { BUCKET_DO_ASSET_BASE, caminhoDoAssetBase } from '../scripts/caminhoDoAssetBase';

const URL = process.env.SUPABASE_URL ?? '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON = process.env.SUPABASE_ANON_KEY ?? '';

/** Sem ambiente configurado o teste é pulado, não falha — ver README de supabase/tests/. */
export const temAmbiente = Boolean(URL && SERVICE_ROLE && ANON);

export const admin = () => createClient(URL, SERVICE_ROLE, { auth: { persistSession: false } });
export const anonimo = () => createClient(URL, ANON, { auth: { persistSession: false } });

export interface Cenario {
  tenantA: string;
  tenantB: string;
  produtoA: string;
  /** Caminho do asset-base do produto A no Storage — existe de verdade no bucket. */
  assetDoProdutoA: string;
  /** owner do tenant A */
  clienteA: SupabaseClient;
  /** owner do tenant B — a marca concorrente */
  clienteB: SupabaseClient;
  /** membro (não-owner) do tenant A */
  clienteMembroA: SupabaseClient;
  userIds: string[];
}

async function criarUsuario(email: string, papel: 'owner' | 'membro', tenantId: string) {
  const senha = `teste-${crypto.randomUUID()}`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('usuário não criado');

  const vinculo = await admin()
    .from('tenant_members')
    .insert({ tenant_id: tenantId, user_id: data.user.id, papel });
  if (vinculo.error) throw vinculo.error;

  const cliente = anonimo();
  const login = await cliente.auth.signInWithPassword({ email, password: senha });
  if (login.error) throw login.error;

  return { cliente, userId: data.user.id };
}

/** Cria dois tenants concorrentes com um produto no A. Sempre chamar `limpar` depois. */
export async function montarCenario(): Promise<Cenario> {
  const marca = crypto.randomUUID().slice(0, 8);

  const tenants = await admin()
    .from('tenants')
    .insert([
      { nome: `Marca A ${marca}`, slug: `marca-a-${marca}` },
      { nome: `Marca B ${marca}`, slug: `marca-b-${marca}` },
    ])
    .select('id');
  if (tenants.error || !tenants.data) throw tenants.error;

  const [tenantA, tenantB] = tenants.data.map((linha) => linha.id as string);
  if (!tenantA || !tenantB) throw new Error('tenants não criados');

  // O produto nasce com um asset-base REAL no Storage. Antes isto era um caminho
  // inventado: o teste de isolamento provava a policy do banco, mas nunca provava que
  // um concorrente não consegue baixar o arquivo — não havia arquivo para baixar.
  const productId = crypto.randomUUID();
  const caminhoDoAsset = caminhoDoAssetBase(tenantA, productId);
  const canonico = normalizarSvg(
    readFileSync('src/esboco/tenis-demo-cru.svg', 'utf8'),
  ).svg;

  const upload = await admin()
    .storage.from(BUCKET_DO_ASSET_BASE)
    .upload(caminhoDoAsset, new Blob([canonico], { type: 'image/svg+xml' }), {
      contentType: 'image/svg+xml',
      upsert: true,
    });
  if (upload.error) throw upload.error;

  const produto = await admin()
    .from('products')
    .insert({
      id: productId,
      tenant_id: tenantA,
      nome: 'Tênis coleção não lançada',
      base_asset_path: caminhoDoAsset,
    })
    .select('id')
    .single();
  if (produto.error) throw produto.error;

  const a = await criarUsuario(`a-${marca}@teste.kora`, 'owner', tenantA);
  const b = await criarUsuario(`b-${marca}@teste.kora`, 'owner', tenantB);
  const membro = await criarUsuario(`m-${marca}@teste.kora`, 'membro', tenantA);

  return {
    tenantA,
    tenantB,
    produtoA: produto.data.id as string,
    assetDoProdutoA: caminhoDoAsset,
    clienteA: a.cliente,
    clienteB: b.cliente,
    clienteMembroA: membro.cliente,
    userIds: [a.userId, b.userId, membro.userId],
  };
}

export async function limpar(cenario: Cenario): Promise<void> {
  // O objeto do Storage NÃO some junto com o tenant: apagar a linha de `products` não
  // apaga o arquivo. Sem esta remoção, cada rodada do teste deixaria lixo no bucket.
  await admin().storage.from(BUCKET_DO_ASSET_BASE).remove([cenario.assetDoProdutoA]);
  for (const userId of cenario.userIds) await admin().auth.admin.deleteUser(userId);
  await admin().from('tenants').delete().in('id', [cenario.tenantA, cenario.tenantB]);
}
