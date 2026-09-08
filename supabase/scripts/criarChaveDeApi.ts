// Cria uma chave de API para um tenant: gera a chave, grava prefixo + hash e mostra a
// chave UMA vez.
//
// Por que este arquivo vive em `supabase/` e NUNCA em `src/`: o insert em
// `tenant_api_keys` é `service_role` de propósito (ADR-006, D4 — a tabela não aceita
// insert de ninguém autenticado), e nada que leia a service_role pode chegar ao bundle do
// navegador. Na Fase 1 a venda é manual e a UI de chaves ainda não existe; quem provisiona
// roda isto e combina a chave com o cliente por fora.
//
// O formato da chave não é decidido aqui: vem inteiro de `api/_lib/formatoDaChaveDeApi`,
// que é a única leitura do formato no projeto. Uma segunda implementação que divirja em um
// caractere derruba toda chave já emitida sem nada ter sido "mudado".

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  gerarChaveDeApi,
  type AmbienteDaChave,
  type ChaveGerada,
} from '../../api/_lib/formatoDaChaveDeApi';

interface Argumentos {
  tenant: string;
  ambiente: AmbienteDaChave;
  label: string | null;
  email: string | null;
}

const AJUDA = `
Uso:
  npm run criar-chave -- --tenant aurora --ambiente test \\
    [--label "ERP da Aurora"] [--email dono@aurora.com.br]

--ambiente é obrigatório e NÃO tem padrão: emitir uma chave "live" por engano é um
acidente caro (ela atende cliente de verdade), e a ausência de padrão é o que o previne.
--label é o nome humano da chave, para quem for revogar saber qual é qual.
--email é o e-mail do owner que está pedindo a chave; vira \`created_by\`.
`;

const AMBIENTES: readonly string[] = ['live', 'test'];

await principal();

async function principal(): Promise<void> {
  const args = lerArgumentos();
  const admin = clienteAdmin();

  const tenant = await acharTenant(admin, args.tenant);
  const createdBy = args.email ? await acharUsuarioPorEmail(admin, args.email) : null;

  // A chave inteira só existe nesta variável e no que for impresso adiante. Ela não é
  // gravada em arquivo nem devolvida ao banco: o insert leva `prefixo` e `hash`, e mais
  // nada. É o que faz um vazamento do banco não virar acesso à API (ADR-006, D1).
  const gerada: ChaveGerada = gerarChaveDeApi(args.ambiente);

  const inserida = await admin
    .from('tenant_api_keys')
    .insert({
      tenant_id: tenant.id,
      prefixo: gerada.prefixo,
      hash: gerada.hash,
      label: args.label,
      created_by: createdBy,
    })
    .select('id, prefixo, created_at')
    .single();

  if (inserida.error) {
    // Nada fica pela metade: a chave gerada existe só na memória deste processo e morre
    // com ele. Sem linha no banco não há credencial válida — é seguro simplesmente falhar
    // e mandar rodar de novo.
    throw inserida.error;
  }

  imprimirChaveUmaVez(gerada, tenant.nome, args);
}

/**
 * A única exibição da chave em toda a vida dela. O banco guarda o hash SHA-256 do segredo,
 * então "ver de novo" é impossível por construção, não por falta de tela (ADR-006, D1) —
 * e o aviso precisa ser explícito no momento em que dá para copiar, não num doc.
 */
function imprimirChaveUmaVez(gerada: ChaveGerada, nomeDoTenant: string, args: Argumentos): void {
  console.log(`\nChave criada para ${nomeDoTenant} (ambiente ${gerada.ambiente}).`);
  if (args.label) console.log(`Rótulo: ${args.label}`);
  console.log('\n  ' + gerada.chave + '\n');
  console.log('Esta é a ÚNICA vez que a chave aparece: o banco guarda só o prefixo e o');
  console.log('hash do segredo, então não existe "ver a chave de novo". Se ela se perder,');
  console.log('revogue o prefixo e gere outra.');
  console.log(`\nPrefixo (identifica a chave sem permitir usá-la — este pode ir para log,`);
  console.log(`chamado e planilha): ${gerada.prefixo}`);
  console.log('Entregue a chave ao cliente por canal combinado. Ela vai em');
  console.log('`Authorization: Bearer <chave>`, nunca em query string.');
}

function lerArgumentos(): Argumentos {
  const bruto = process.argv.slice(2);
  const valores = new Map<string, string>();

  for (let i = 0; i < bruto.length; i += 2) {
    const chave = bruto[i];
    const valor = bruto[i + 1];
    if (chave?.startsWith('--') && valor !== undefined) valores.set(chave.slice(2), valor);
  }

  const obrigatorios = ['tenant', 'ambiente'];
  const faltando = obrigatorios.filter((chave) => !valores.get(chave));

  if (faltando.length > 0) {
    console.error(`Faltam argumentos: ${faltando.map((f) => `--${f}`).join(', ')}\n${AJUDA}`);
    process.exit(1);
  }

  const ambiente = valores.get('ambiente') as string;
  if (!AMBIENTES.includes(ambiente)) {
    console.error(`Ambiente inválido: "${ambiente}". Use "live" ou "test".\n${AJUDA}`);
    process.exit(1);
  }

  const tenant = valores.get('tenant') as string;
  if (!/^[a-z][a-z0-9-]*$/.test(tenant)) {
    // Mesma regra do slug em `provisionarTenant.ts`: o argumento é o slug do tenant, não
    // o nome comercial. Recusar aqui evita a consulta que devolveria "não existe" e
    // mandaria o operador procurar o erro no lugar errado.
    console.error(`Slug inválido: "${tenant}". Use o slug do tenant (ex: "aurora").`);
    process.exit(1);
  }

  return {
    tenant,
    ambiente: ambiente as AmbienteDaChave,
    label: valores.get('label') ?? null,
    email: valores.get('email') ?? null,
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

async function acharTenant(
  admin: SupabaseClient,
  slug: string,
): Promise<{ id: string; nome: string }> {
  const { data, error } = await admin
    .from('tenants')
    .select('id, nome')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    console.error(`Não existe tenant com o slug "${slug}". Confira em \`tenants\`.`);
    process.exit(1);
  }

  return { id: data.id as string, nome: data.nome as string };
}

/**
 * Resolve o `created_by` a partir do e-mail, do mesmo jeito que `provisionarTenant.ts`.
 * E-mail que não existe falha alto: gravar `created_by` nulo em silêncio apaga a resposta
 * para "quem pediu esta chave" logo na linha em que ela nasce.
 */
async function acharUsuarioPorEmail(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;

  const userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;

  if (!userId) {
    console.error(`Nenhum usuário com o e-mail "${email}". Omita --email ou confira o e-mail.`);
    process.exit(1);
  }

  return userId;
}
