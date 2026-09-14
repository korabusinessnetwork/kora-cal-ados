// O único lugar do projeto que constrói o cliente com `service_role`.
//
// Um só lugar porque essa chave BYPASSA a RLS: com ela o Postgres deixa de ser o guarda
// do isolamento entre marcas concorrentes, e o guarda passa a ser este código (ver
// `api/README.md`). Espalhar a construção do cliente espalharia também a chance de alguém
// criá-lo sem validar o ambiente, e um cliente mal construído só se revela na primeira
// consulta, com erro de rede incompreensível em vez de "faltou tal variável".
//
// POR REQUISIÇÃO, NÃO POR PROCESSO. Em serverless o processo é reaproveitado entre
// invocações, então um cliente em variável de módulo sobreviveria de uma requisição para a
// próxima, e essas duas requisições são, por hipótese, de tenants concorrentes. O
// `SupabaseClient` é um objeto mutável (headers, sessão): qualquer coisa que o mutasse numa
// requisição vazaria para a seguinte, e o vazamento seria de dado de outra marca. O que se
// ganharia em troca é só a construção do objeto, supabase-js fala HTTP por `fetch`, não
// mantém pool de conexão para "esquentar". Estado compartilhado entre tenants não vale isso.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const VARIAVEL_DA_URL = 'SUPABASE_URL';
const VARIAVEL_DA_CHAVE = 'SUPABASE_SERVICE_ROLE_KEY';

/** Ambiente incompleto. Falha na construção, e não na primeira consulta, é o ponto. */
export class ConfiguracaoDeServicoAusente extends Error {
  readonly variaveis: string[];

  constructor(variaveis: string[]) {
    super(
      `Faltam variáveis de ambiente na função serverless: ${variaveis.join(', ')}. ` +
        `Configure-as na Vercel (Project Settings → Environment Variables) e, para rodar ` +
        `local, em \`.env.local\`. Estas são as variáveis SEM prefixo \`VITE_\`: elas ficam ` +
        `no servidor e nunca vão para o bundle do navegador.`,
    );
    this.name = 'ConfiguracaoDeServicoAusente';
    this.variaveis = variaveis;
  }
}

/**
 * A chave está lá, mas é a errada, tipicamente a `anon` colada no lugar da `service_role`.
 *
 * Vale um erro próprio porque o modo de falha sem ele é cruel: a `anon` autentica, o
 * cliente é criado, e aí toda consulta volta VAZIA, a RLS recusa tudo, já que não há
 * usuário autenticado nenhum. A API responderia 404 para produtos que existem, e o rastro
 * seria "produto não encontrado", que aponta para o lugar errado.
 */
export class ChaveDeServicoIncorreta extends Error {
  readonly papel: string;

  constructor(papel: string) {
    // A mensagem vai para log: nomeia o PAPEL lido, nunca a chave.
    super(
      `${VARIAVEL_DA_CHAVE} contém uma chave de papel \`${papel}\`, não \`service_role\`. ` +
        `Sob a chave errada a RLS recusa tudo e a API responderia 404 para produtos que ` +
        `existem. Pegue a service_role em Supabase → Project Settings → API.`,
    );
    this.name = 'ChaveDeServicoIncorreta';
    this.papel = papel;
  }
}

/**
 * Constrói o cliente de `service_role` ou recusa o ambiente.
 *
 * Recebe o ambiente por parâmetro (mesmo desenho de `lerConfiguracaoDoSupabase` no front)
 * para o teste não precisar mexer em variável global do processo.
 */
export function criarClienteDeServico(
  ambiente: Record<string, string | undefined> = process.env,
): SupabaseClient {
  const url = (ambiente[VARIAVEL_DA_URL] ?? '').trim();
  const chave = (ambiente[VARIAVEL_DA_CHAVE] ?? '').trim();

  const faltando = [...(url ? [] : [VARIAVEL_DA_URL]), ...(chave ? [] : [VARIAVEL_DA_CHAVE])];
  if (faltando.length > 0) throw new ConfiguracaoDeServicoAusente(faltando);

  const papel = papelDaChave(chave);
  // `null` = chave ilegível para nós; aí não dá para afirmar que está errada, e recusar
  // seria pior (barraria uma chave válida de formato futuro). Só recusa o que se leu.
  if (papel !== null && papel !== 'service_role') throw new ChaveDeServicoIncorreta(papel);

  // `persistSession: false` pelo mesmo motivo de `supabase/scripts/provisionarTenant.ts`:
  // este cliente não representa pessoa nenhuma, ele já nasce com poder total pela chave,
  // e não há login para guardar. Ligado, o supabase-js tentaria gravar sessão em storage
  // (que não existe no servidor) e essa sessão seria estado sobrevivendo entre invocações
  // no processo reaproveitado, exatamente o que este módulo evita.
  return createClient(url, chave, { auth: { persistSession: false } });
}

/**
 * Lê o campo `role` do JWT sem validar assinatura, serve só para recusar a chave errada.
 *
 * Duplicado de propósito: `src/lib/supabase/configuracaoDoSupabase.ts` tem a versão
 * espelhada (lá recusa a `service_role`, aqui recusa tudo que NÃO é). Importar de lá é
 * proibido por `apiNaoImportaOFront.test.ts`, e a proibição vale mais que estas 12 linhas:
 * um import de `src/lib/supabase/` abriria a porta para `api/` reusar código do front que
 * confia na RLS, e aqui não há RLS. As duas cópias podem divergir sem consequência: cada
 * uma protege um lado, e nenhum dado depende de as duas concordarem.
 */
function papelDaChave(chave: string): string | null {
  // Chave nova do Supabase é opaca, não é JWT: o prefixo é tudo que dá para ler dela, e
  // já basta para pegar a publishable colada no lugar da secreta.
  if (chave.startsWith('sb_publishable_')) return 'publishable';
  if (chave.startsWith('sb_secret_')) return 'service_role';

  const corpo = chave.split('.')[1];
  if (!corpo) return null;

  try {
    const json = atob(corpo.replace(/-/g, '+').replace(/_/g, '/'));
    const papel = (JSON.parse(json) as { role?: unknown }).role;
    return typeof papel === 'string' ? papel : null;
  } catch {
    return null;
  }
}
