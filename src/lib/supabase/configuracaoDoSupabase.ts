// De onde o front tira URL e chave do Supabase. Existe separado do cliente porque a
// pergunta "o ambiente está configurado?" precisa ter resposta ANTES de qualquer tela
// tentar renderizar — e porque só assim dá para testar a validação sem abrir conexão.
//
// Nada de valor padrão nem de fallback silencioso: app apontando para o projeto errado
// é pior que app que não sobe. Sem as duas variáveis, a mensagem diz exatamente o que
// escrever e onde.

/** O que o navegador precisa saber para falar com o Supabase. Nunca inclui service_role. */
export interface ConfiguracaoDoSupabase {
  url: string;
  anonKey: string;
}

export class ConfiguracaoAusente extends Error {
  readonly variaveis: string[];

  constructor(variaveis: string[]) {
    super(
      `Faltam variáveis de ambiente: ${variaveis.join(', ')}. ` +
        'Crie um arquivo `.env.local` na raiz do projeto com VITE_SUPABASE_URL e ' +
        'VITE_SUPABASE_ANON_KEY (Supabase → Project Settings → API) e reinicie o `npm run dev`. ' +
        'A chave que vai aqui é a anon/publishable, NUNCA a service_role.',
    );
    this.name = 'ConfiguracaoAusente';
    this.variaveis = variaveis;
  }
}

/**
 * Lê a configuração ou lança listando o que falta.
 * Recebe o ambiente por parâmetro para o teste não depender de `import.meta.env`.
 */
export function lerConfiguracaoDoSupabase(
  ambiente: Record<string, string | undefined> = import.meta.env as unknown as Record<
    string,
    string | undefined
  >,
): ConfiguracaoDoSupabase {
  const url = (ambiente['VITE_SUPABASE_URL'] ?? '').trim();
  const anonKey = (ambiente['VITE_SUPABASE_ANON_KEY'] ?? '').trim();

  const faltando = [
    ...(url ? [] : ['VITE_SUPABASE_URL']),
    ...(anonKey ? [] : ['VITE_SUPABASE_ANON_KEY']),
  ];

  if (faltando.length > 0) throw new ConfiguracaoAusente(faltando);

  // A service_role dá acesso total ignorando RLS. Ela no bundle do navegador entregaria
  // o banco inteiro — inclusive os dados dos tenants concorrentes — para qualquer um que
  // abrisse o DevTools. Barrar aqui é barato e o erro é claro; descobrir depois, não.
  if (papelDaChave(anonKey) === 'service_role') {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY contém uma chave service_role. Ela ignora RLS e NÃO pode ' +
        'ir para o navegador, porque qualquer visitante leria os dados de todos os tenants. ' +
        'Use a chave anon/publishable.',
    );
  }

  return { url, anonKey };
}

/** Lê o campo `role` do JWT sem validar assinatura — serve só para recusar a chave errada. */
function papelDaChave(chave: string): string | null {
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
