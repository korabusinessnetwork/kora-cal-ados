// Revoga uma chave de API pelo prefixo: preenche `revoked_at`, nunca apaga a linha.
//
// Por que este arquivo vive em `supabase/` e NUNCA em `src/`: a Fase 1 não tem UI de
// gerenciamento de chaves, e quem revoga hoje é quem opera, com a service_role. Nada que
// leia a service_role pode chegar ao bundle do navegador.
//
// O argumento é o PREFIXO, não a chave. Duas razões: o prefixo é a única parte que alguém
// tem depois de a chave ter sido mostrada uma vez (ADR-006, D1), e pedir a chave inteira
// para revogá-la faria uma credencial viva passear por histórico de shell.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface LinhaDaChave {
  prefixo: string;
  label: string | null;
  revoked_at: string | null;
}

const AJUDA = `
Uso:
  npm run revogar-chave -- --prefixo 7f3ab902

O prefixo são os 8 caracteres hexadecimais do meio da chave
(kora_live_<prefixo>_<segredo>), o único pedaço que fica em claro no banco e em log.
`;

/** 4 bytes em hex, como `gerarChaveDeApi` cunha. Validar antes de consultar. */
const PREFIXO_VALIDO = /^[0-9a-f]{8}$/;

await principal();

async function principal(): Promise<void> {
  const prefixo = lerPrefixo();
  const admin = clienteAdmin();

  const atual = await lerLinha(admin, prefixo);

  if (!atual) {
    console.error(`Não existe chave com o prefixo "${prefixo}".`);
    process.exit(1);
  }

  if (atual.revoked_at) {
    // Idempotente de propósito: quem revoga de novo quer a chave inativa, e ela está.
    // Sair com erro faria um operador procurar problema onde não há.
    console.log(`A chave ${prefixo} já estava revogada em ${atual.revoked_at}. Nada a fazer.`);
    return;
  }

  const revogada = await admin
    .from('tenant_api_keys')
    // Revogar é preencher `revoked_at`, NUNCA apagar a linha (ADR-006, D4): chave apagada
    // leva embora a resposta para "quem estava usando isto quando aconteceu". A tabela
    // nem tem policy de delete, e este script não tenta uma.
    //
    // O horário vem do relógio de quem roda, e não de um `now()` do banco, porque um
    // update via PostgREST manda valor, não expressão. A diferença é de segundos e a
    // coluna responde "quando nós revogamos", não ordena eventos entre si.
    .update({ revoked_at: new Date().toISOString() })
    .eq('prefixo', prefixo);

  if (revogada.error) throw revogada.error;

  // Relê do banco em vez de confiar no que foi enviado: a confirmação impressa tem de ser
  // o estado gravado, senão ela diz "revogado" sobre uma escrita que pode não ter pegado.
  const confirmada = await lerLinha(admin, prefixo);
  if (!confirmada?.revoked_at) {
    throw new Error(`A chave ${prefixo} continua sem \`revoked_at\` depois do update.`);
  }

  console.log('Chave revogada.');
  console.log(`  prefixo:    ${confirmada.prefixo}`);
  console.log(`  label:      ${confirmada.label ?? '(sem rótulo)'}`);
  console.log(`  revoked_at: ${confirmada.revoked_at}`);
  console.log('\nA integração que usava esta chave para de autenticar. Se ela ainda for');
  console.log('necessária, crie outra com `npm run criar-chave` antes de avisar o cliente.');
}

function lerPrefixo(): string {
  const bruto = process.argv.slice(2);
  const valores = new Map<string, string>();

  for (let i = 0; i < bruto.length; i += 2) {
    const chave = bruto[i];
    const valor = bruto[i + 1];
    if (chave?.startsWith('--') && valor !== undefined) valores.set(chave.slice(2), valor);
  }

  const prefixo = valores.get('prefixo');

  if (!prefixo) {
    console.error(`Falta o argumento --prefixo.\n${AJUDA}`);
    process.exit(1);
  }

  if (!PREFIXO_VALIDO.test(prefixo)) {
    // Consultar com um prefixo malformado devolveria "não existe", que manda o operador
    // procurar a chave errada em vez de corrigir o que ele digitou.
    console.error(
      `Prefixo inválido: "${prefixo}". São 8 caracteres hexadecimais (0-9, a-f).\n${AJUDA}`,
    );
    process.exit(1);
  }

  return prefixo;
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

/** Campos explícitos, jamais `hash`: ele não tem por que sair do banco (CLAUDE.md). */
async function lerLinha(admin: SupabaseClient, prefixo: string): Promise<LinhaDaChave | null> {
  const { data, error } = await admin
    .from('tenant_api_keys')
    .select('prefixo, label, revoked_at')
    .eq('prefixo', prefixo)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    prefixo: data.prefixo as string,
    label: (data.label as string | null) ?? null,
    revoked_at: (data.revoked_at as string | null) ?? null,
  };
}
