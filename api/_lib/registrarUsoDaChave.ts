// Marca `tenant_api_keys.last_used_at`. Escrita de conveniência, jamais de caminho crítico.
//
// POR QUE NÃO DEVOLVE `Promise`. A assinatura é `void` de propósito: uma função que devolve
// `Promise` convida o chamador a escrever `await`, e o `await` transformaria esta linha em
// mais um ida-e-volta ao Postgres somado ao tempo de TODA resposta da API, e, pior, faria
// uma variante já gerada com sucesso virar erro porque uma coluna de estatística não
// atualizou. O ADR-006 diz "fire-and-forget, nunca bloqueia a geração da variante"; devolver
// `void` é o que torna a regra impossível de quebrar por distração, em vez de escrita num
// comentário que ninguém lê às duas da manhã. `registrarUsoDaChave.test.ts` prende isso:
// verifica que a função não é `AsyncFunction` e que o retorno é `undefined`, então
// transformá-la em `async` reprova em vez de passar despercebido numa refatoração.
//
// A CONSEQUÊNCIA ACEITA, ESCRITA PARA NÃO SER REDESCOBERTA: em serverless o processo pode
// congelar assim que a resposta sai. Esta escrita foi disparada e não é aguardada, então ela
// **pode se perder**, a requisição terminou e o `then` interno pode nunca rodar. Isso é
// aceito (o ADR manda não bloquear), mas a consequência tem nome: `last_used_at` é um piso,
// não um número exato. "Chave sem uso" é um FALSO NEGATIVO possível, uma chave pode estar
// autenticando requisições todo dia e mostrar um `last_used_at` velho. Ninguém deve revogar
// uma chave só porque a coluna está atrasada; para responder "esta chave ainda serve para
// alguma coisa?" (ADR-006, Consequências) o valor serve, para auditoria e cobrança não.
//
// O cliente entra por parâmetro, como todo módulo daqui: é o que permite testar sem rede.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Nome literal da tabela e da coluna, num lugar só, o teste de forma compara com estes. */
const TABELA = 'tenant_api_keys';

/**
 * Para onde vai o aviso de falha. Entra por parâmetro com padrão, como o `EscritorDeLog` de
 * `logDaRequisicao.ts`: o teste captura a mensagem sem espionar o console global, e o
 * chamador de produção não precisa saber que este parâmetro existe.
 */
export type AvisoDeFalha = (mensagem: string) => void;

const avisarNoConsole: AvisoDeFalha = (mensagem) => {
  // `warn` e não `error`: isto não é uma falha da requisição, que respondeu certo. Marcar
  // como erro faria alerta de produção disparar por uma coluna de estatística.
  console.warn(mensagem);
};

/**
 * Dispara o `update` de `last_used_at` e volta imediatamente. Nunca lança, nunca aguarda.
 *
 * @param cliente cliente de `service_role` da requisição (ver `clienteDeServico.ts`).
 * @param idDaChave `tenant_api_keys.id`, a **chave primária**, não o `prefixo`.
 */
export function registrarUsoDaChave(
  cliente: SupabaseClient,
  idDaChave: string,
  avisar: AvisoDeFalha = avisarNoConsole,
): void {
  // Id vazio só chega aqui por defeito de quem chama. Mandar o `update` assim mesmo gastaria
  // uma escrita para receber "invalid input syntax for type uuid", um erro de banco no log,
  // que manda quem investiga procurar problema no Postgres em vez de no chamador.
  if (typeof idDaChave !== 'string' || idDaChave.trim() === '') {
    avisar('registrarUsoDaChave: id da chave ausente; nada foi gravado.');
    return;
  }

  try {
    const pedido = cliente
      .from(TABELA)
      // O valor é `new Date().toISOString()` e NÃO a expressão `now()`: um update via
      // PostgREST manda um VALOR, não SQL, a string `'now()'` seria gravada como texto e
      // falharia a conversão para `timestamptz`. Mesmo motivo já escrito em
      // `supabase/scripts/revogarChaveDeApi.ts`, e o relógio usado é o de quem escreve.
      .update({ last_used_at: new Date().toISOString() })
      // Filtro por `id`, a chave primária, nunca por `prefixo`. O `prefixo` veio pelo
      // header da requisição e é indexado mas não é a identidade da linha; o `id` saiu da
      // própria consulta de autenticação e não passou por entrada de rede.
      .eq('id', idDaChave);

    // `Promise.resolve` observa a promessa (ou o thenable do supabase-js) e o `then` de dois
    // ramos trata resolução E rejeição. É o cerne deste arquivo: uma promessa rejeitada que
    // ninguém observa vira `unhandled rejection`, e em Node isso derruba o processo, a
    // requisição seguinte, de outro tenant, morreria por causa desta escrita de conveniência.
    Promise.resolve(pedido).then(
      (resultado) => {
        const erro = (resultado as { error?: { message?: unknown } } | null | undefined)?.error;
        if (erro) avisar(mensagemDeFalha(idDaChave, erro));
      },
      (motivo: unknown) => avisar(mensagemDeFalha(idDaChave, motivo)),
    );
  } catch (motivo: unknown) {
    // Cliente que lança de forma SÍNCRONA (ambiente mal montado, mock errado, supabase-js
    // recusando o nome da tabela) não passaria pelo `then` acima. Sem este `catch` a exceção
    // subiria pelo handler e derrubaria uma variante que já estava pronta para responder.
    avisar(mensagemDeFalha(idDaChave, motivo));
  }
}

/**
 * A frase do aviso. Contém o `id` da linha, uuid, e não credencial, e a mensagem do erro.
 * NUNCA a chave, o segredo ou o hash: nada disso entra nesta função, e o CLAUDE.md proíbe
 * que entre. O `id` é o suficiente para achar a linha no banco quando alguém investigar.
 */
function mensagemDeFalha(idDaChave: string, motivo: unknown): string {
  const detalhe = descreverMotivo(motivo);
  return (
    `registrarUsoDaChave: falhou ao gravar last_used_at da chave ${idDaChave} ` +
    `(${detalhe}). A requisição não foi afetada.`
  );
}

/**
 * O erro do Supabase chega como objeto simples (`{ code, message, details }`), não como
 * `Error`. Sem este ramo o aviso diria `[object Object]`, uma linha de log que não ajuda
 * ninguém a decidir nada, que é o mesmo que não ter log.
 */
function descreverMotivo(motivo: unknown): string {
  if (motivo instanceof Error) return motivo.message;
  if (typeof motivo === 'object' && motivo !== null && 'message' in motivo) {
    return String((motivo as { message: unknown }).message);
  }
  return String(motivo);
}
