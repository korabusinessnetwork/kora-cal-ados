// Provisiona uma marca nova: tenant + owner + produto + asset-base canônico no Storage.
//
// Na Fase 1 a venda é manual e não existe tela de cadastro (decisão registrada em
// `docs/11_SEGURANCA/proposta-correcao-rls.md`): a policy de INSERT em `tenants` é
// service_role. Por isso este arquivo vive em `supabase/`, NUNCA em `src/`, nada aqui
// pode chegar ao bundle do navegador.
//
// O SVG é normalizado ANTES de subir, pelo mesmo `normalizarSvg` que o editor e a API
// usam. O que fica no Storage é o asset-base canônico, imutável: é dele que saem os ids
// de elemento que o editor vai endereçar (ADR-005).

import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import '../../src/lib/render/domNode';
import { normalizarSvg } from '../../src/lib/render/normalizarSvg';
import { BUCKET_DO_ASSET_BASE, caminhoDoAssetBase } from './caminhoDoAssetBase';

interface Argumentos {
  nome: string;
  slug: string;
  email: string;
  senha: string;
  produto: string;
  svg: string;
}

const AJUDA = `
Uso:
  node --env-file=.env.local supabase/scripts/executar.mjs \\
    supabase/scripts/provisionarTenant.ts \\
    --nome "Calçados Aurora" --slug aurora \\
    --email dono@aurora.com.br --senha "senha-combinada" \\
    --produto "Runner 2026" [--svg caminho/do/arquivo.svg]

A senha é obrigatória e escolhida por quem provisiona: o script não inventa nem imprime
credencial (CLAUDE.md, nunca logar dado sensível).
`;

await principal();

async function principal(): Promise<void> {
  const args = lerArgumentos();
  const admin = clienteAdmin();

  const svgCru = readFileSync(args.svg, 'utf8');
  // Normalizar ANTES de tocar no banco: arquivo recusado não deve deixar tenant pela metade.
  const { svg: canonico, relatorio } = normalizarSvg(svgCru);
  console.log(
    `Asset normalizado: ${relatorio.idsAtribuidos.length} ids atribuídos, ` +
      `${relatorio.idsRenomeados.length} renomeados, ` +
      `${relatorio.declaracoesAchatadas} declarações CSS achatadas.`,
  );

  const tenantId = await criarTenant(admin, args);
  console.log(`Tenant criado: ${args.nome} (${tenantId})`);

  const userId = await garantirOwner(admin, args, tenantId);
  console.log(`Owner vinculado: ${args.email} (${userId})`);

  const productId = crypto.randomUUID();
  const caminho = caminhoDoAssetBase(tenantId, productId);

  // Sobe o arquivo ANTES de inserir a linha: um produto cujo `base_asset_path` aponta
  // para objeto inexistente é exatamente o estado que quebrava `supabase/tests/`.
  const upload = await admin.storage
    .from(BUCKET_DO_ASSET_BASE)
    .upload(caminho, new Blob([canonico], { type: 'image/svg+xml' }), {
      contentType: 'image/svg+xml',
      upsert: false,
    });
  if (upload.error) throw upload.error;

  const produto = await admin
    .from('products')
    .insert({ id: productId, tenant_id: tenantId, nome: args.produto, base_asset_path: caminho })
    .select('id')
    .single();

  if (produto.error) {
    // Sem isto sobraria um objeto órfão no bucket, cobrando espaço e confundindo quem
    // for auditar o Storage depois.
    await admin.storage.from(BUCKET_DO_ASSET_BASE).remove([caminho]);
    throw produto.error;
  }

  console.log(`Produto criado: ${args.produto} (${productId})`);
  console.log(`Asset-base: ${caminho}`);
  console.log('\nPronto. O owner já pode entrar no editor com o e-mail e a senha combinados.');
}

function lerArgumentos(): Argumentos {
  const bruto = process.argv.slice(2);
  const valores = new Map<string, string>();

  for (let i = 0; i < bruto.length; i += 2) {
    const chave = bruto[i];
    const valor = bruto[i + 1];
    if (chave?.startsWith('--') && valor !== undefined) valores.set(chave.slice(2), valor);
  }

  const obrigatorios = ['nome', 'slug', 'email', 'senha', 'produto'];
  const faltando = obrigatorios.filter((chave) => !valores.get(chave));

  if (faltando.length > 0) {
    console.error(`Faltam argumentos: ${faltando.map((f) => `--${f}`).join(', ')}\n${AJUDA}`);
    process.exit(1);
  }

  const senha = valores.get('senha') as string;
  if (senha.length < 8) {
    console.error('A senha precisa de pelo menos 8 caracteres.');
    process.exit(1);
  }

  const slug = valores.get('slug') as string;
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    // O slug é identificador público do tenant; a mesma regra da zone_key vale aqui.
    console.error(`Slug inválido: "${slug}". Use minúsculas, números e hífen (ex: "aurora").`);
    process.exit(1);
  }

  return {
    nome: valores.get('nome') as string,
    slug,
    email: valores.get('email') as string,
    senha,
    produto: valores.get('produto') as string,
    svg: valores.get('svg') ?? 'src/esboco/tenis-demo-cru.svg',
  };
}

function clienteAdmin(): SupabaseClient {
  const url = process.env['SUPABASE_URL'] ?? '';
  const chave = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

  if (!url || !chave) {
    console.error(
      'Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. Rode com --env-file=.env.local.',
    );
    process.exit(1);
  }

  return createClient(url, chave, { auth: { persistSession: false } });
}

async function criarTenant(admin: SupabaseClient, args: Argumentos): Promise<string> {
  const { data, error } = await admin
    .from('tenants')
    .insert({ nome: args.nome, slug: args.slug })
    .select('id')
    .single();

  if (error) {
    // `23505` = slug já usado. Falhar aqui é o certo: dois tenants com o mesmo slug
    // seriam indistinguíveis para quem opera.
    if (error.code === '23505') {
      console.error(`Já existe um tenant com o slug "${args.slug}".`);
      process.exit(1);
    }
    throw error;
  }

  return data.id as string;
}

/** Cria o usuário, ou reaproveita o que já existe, a mesma pessoa pode ter duas marcas. */
async function garantirOwner(
  admin: SupabaseClient,
  args: Argumentos,
  tenantId: string,
): Promise<string> {
  const criado = await admin.auth.admin.createUser({
    email: args.email,
    password: args.senha,
    email_confirm: true,
  });

  const userId = criado.data.user?.id ?? (await procurarPorEmail(admin, args.email));

  if (!userId) throw criado.error ?? new Error(`Não foi possível criar nem achar ${args.email}.`);

  const vinculo = await admin
    .from('tenant_members')
    .insert({ tenant_id: tenantId, user_id: userId, papel: 'owner' });
  if (vinculo.error) throw vinculo.error;

  return userId;
}

async function procurarPorEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;

  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}
