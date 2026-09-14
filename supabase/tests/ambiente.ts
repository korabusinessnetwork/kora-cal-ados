// Provisionamento do cenário do teste de isolamento: dois tenants concorrentes, três
// usuários. Fica separado das asserções para o teste em si ler como especificação.
//
// Usa service_role, por isso vive em supabase/tests/, nunca em src/ (que vai pro
// bundle do navegador).

import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import '../../src/lib/render/domNode';
import { normalizarSvg } from '../../src/lib/render/normalizarSvg';
import { montarSeletorDeZona } from '../../src/lib/render/montarSeletorDeZona';
import { gerarChaveDeApi } from '../../api/_lib/formatoDaChaveDeApi';
import { BUCKET_DO_ASSET_BASE, caminhoDoAssetBase } from '../scripts/caminhoDoAssetBase';

const URL = process.env.SUPABASE_URL ?? '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON = process.env.SUPABASE_ANON_KEY ?? '';

/** Sem ambiente configurado o teste é pulado, não falha, ver README de supabase/tests/. */
export const temAmbiente = Boolean(URL && SERVICE_ROLE && ANON);

export const admin = () => createClient(URL, SERVICE_ROLE, { auth: { persistSession: false } });
export const anonimo = () => createClient(URL, ANON, { auth: { persistSession: false } });

export interface Cenario {
  tenantA: string;
  tenantB: string;
  produtoA: string;
  /** Caminho do asset-base do produto A no Storage, existe de verdade no bucket. */
  assetDoProdutoA: string;
  /** owner do tenant A */
  clienteA: SupabaseClient;
  /** owner do tenant B, a marca concorrente */
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
  // um concorrente não consegue baixar o arquivo, não havia arquivo para baixar.
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


// ─────────────────────────────────────────────────────────────────────────────
// Semeadura opcional: chaves de API e zonas
//
// Nenhuma das duas entra em `montarCenario`. O cenário é compartilhado por quatro arquivos
// de teste, e um deles (`editorDeZonas.test.ts`) começa contando as zonas do produto,
// semear por padrão faria a contagem dele mentir. Quem precisa, pede.
// ─────────────────────────────────────────────────────────────────────────────

/** Uma chave semeada. `chave` é o texto em claro, só existe aqui e no header do teste. */
export interface ChaveSemeada {
  readonly id: string;
  readonly prefixo: string;
  /** A chave inteira, para mandar em `Authorization: Bearer`. Nunca chega ao banco. */
  readonly chave: string;
}

export interface ChavesDoCenario {
  readonly ativaDeA: ChaveSemeada;
  readonly revogadaDeA: ChaveSemeada;
  readonly ativaDeB: ChaveSemeada;
}

/**
 * Uma chave ativa e uma revogada no tenant A, uma ativa no B.
 *
 * As chaves saem de `gerarChaveDeApi`, e não de string à mão, porque assim o teste também
 * exerce o formato de verdade contra o banco: comprimento do prefixo, comprimento do hash e
 * a unicidade do prefixo. O segredo em claro fica só no objeto devolvido, o que chega à
 * tabela é `prefixo` e `hash`, que é exatamente o que a Etapa 2 promete.
 */
export async function semearChavesDaApi(cenario: Cenario): Promise<ChavesDoCenario> {
  const inserir = async (tenantId: string, label: string, revogada: boolean) => {
    const gerada = gerarChaveDeApi('test');
    const { data, error } = await admin()
      .from('tenant_api_keys')
      .insert({
        tenant_id: tenantId,
        prefixo: gerada.prefixo,
        hash: gerada.hash,
        label,
        revoked_at: revogada ? new Date().toISOString() : null,
      })
      .select('id, prefixo')
      .single();

    if (error) throw error;
    return { id: data['id'] as string, prefixo: data['prefixo'] as string, chave: gerada.chave };
  };

  return {
    ativaDeA: await inserir(cenario.tenantA, 'ativa de A', false),
    revogadaDeA: await inserir(cenario.tenantA, 'revogada de A', true),
    ativaDeB: await inserir(cenario.tenantB, 'ativa de B', false),
  };
}

/**
 * As `zone_key` que o teste da API usa, com o que cada uma existe para provar.
 *
 * Os seletores saem de `montarSeletorDeZona`, nunca de string escrita à mão, mesma regra do
 * editor e do produto de demonstração (ADR-005, decisão 2): `svg_selector` tem UMA fonte de
 * formato. Dado de teste montado por outro caminho vira o exemplo que alguém copia.
 */
export const ZONAS_DO_TESTE_DA_API = {
  /** Recolore de verdade: é o caminho de 200. */
  sola: 'zona-sola',
  cabedal: 'zona-cabedal',
  /** Pintada com gradiente no asset-base: o motor recusa com ZONA_NAO_RECOLORIVEL (409). */
  detalhe: 'zona-detalhe',
  /** Seletor que não resolve nada no canônico: ZONA_NAO_ENCONTRADA vinda do MOTOR, 409, e
   *  não o 422 da pré-checagem, porque a linha existe. É o par que desambigua o código. */
  quebrada: 'zona-que-nao-existe-no-arquivo',
  /** Mesmo elemento da `sola`: pedir as duas juntas dá ZONAS_SOBREPOSTAS (409). */
  'sola-espelho': 'zona-sola',
} as const;

/** Grava as zonas acima em `product_zones` do produto do tenant A. */
export async function semearZonasDoProdutoA(cenario: Cenario): Promise<void> {
  const linhas = Object.entries(ZONAS_DO_TESTE_DA_API).map(([zoneKey, id]) => ({
    product_id: cenario.produtoA,
    tenant_id: cenario.tenantA,
    zone_key: zoneKey,
    svg_selector: montarSeletorDeZona([id]),
  }));

  const { error } = await admin().from('product_zones').insert(linhas);
  if (error) throw error;
}
