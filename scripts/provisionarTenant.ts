// Provisiona um tenant novo e seu primeiro owner.
//
// Existe porque `tenants` não tem policy de INSERT para usuário autenticado: criar marca é
// operação de service_role, decidida assim em 2026-08-12 (memory/decisions.md) porque a
// venda da Fase 1 é manual/contrato — não há self-serve para proteger.
//
// Roda em Node, nunca no navegador. A service_role ignora RLS por completo: se esta chave
// vazar para o bundle, o isolamento entre marcas concorrentes deixa de existir.
//
// Uso: npm run provisionar-tenant -- "Nome da Marca" "slug-da-marca" "owner@marca.com"

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const chaveDeServico = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !chaveDeServico) {
  console.error(
    'Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente. Ver .env.example.',
  );
  process.exit(1);
}

const [nome, slug, email] = process.argv.slice(2);

if (!nome || !slug || !email) {
  console.error('Uso: npm run provisionar-tenant -- "Nome da Marca" "slug-da-marca" "owner@marca.com"');
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error('O slug aceita apenas letras minúsculas, números e hífen.');
  process.exit(1);
}

const admin = createClient(url, chaveDeServico, { auth: { persistSession: false } });

// Senha aleatória: o owner troca pelo fluxo de recuperação. Gerar aqui evita senha
// combinada por e-mail, que é o jeito mais comum de vazar acesso na implantação.
const senhaInicial = crypto.randomUUID();

const tenant = await admin.from('tenants').insert({ nome, slug }).select('id').single();

if (tenant.error) {
  console.error(`Não foi possível criar o tenant: ${tenant.error.message}`);
  process.exit(1);
}

const tenantId = tenant.data.id as string;

const usuario = await admin.auth.admin.createUser({
  email,
  password: senhaInicial,
  email_confirm: true,
});

if (usuario.error || !usuario.data.user) {
  await admin.from('tenants').delete().eq('id', tenantId);
  console.error(`Não foi possível criar o usuário: ${usuario.error?.message ?? 'desconhecido'}`);
  process.exit(1);
}

const vinculo = await admin
  .from('tenant_members')
  .insert({ tenant_id: tenantId, user_id: usuario.data.user.id, papel: 'owner' });

if (vinculo.error) {
  await admin.auth.admin.deleteUser(usuario.data.user.id);
  await admin.from('tenants').delete().eq('id', tenantId);
  console.error(`Não foi possível vincular o owner: ${vinculo.error.message}`);
  process.exit(1);
}

console.log(`Tenant "${nome}" criado (${tenantId}).`);
console.log(`Owner: ${email}`);
console.log('Senha inicial gerada — entregue por canal seguro e peça a troca no primeiro acesso:');
console.log(senhaInicial);
