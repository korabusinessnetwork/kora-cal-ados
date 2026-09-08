// O que este arquivo protege são duas coisas que NÃO aparecem no retorno da função (ela não
// tem retorno): a FORMA do pedido enviado ao banco, e o fato de que nenhuma falha escapa.
//
// A forma importa porque um filtro errado aqui não dá erro na tela: `.eq('prefixo', …)` no
// lugar de `.eq('id', …)` continuaria "funcionando" — o prefixo é único hoje — e passaria a
// depender de um dado que veio pelo header da requisição. Por isso os testes afirmam tabela,
// operação, campos e filtros, no molde de `src/features/zonas/gravarZonaNoBanco.test.ts`.
//
// O engolir-tudo importa porque esta escrita roda DEPOIS de a variante já ter sido gerada.
// Qualquer exceção que escape daqui transforma um 200 pronto em 500 — e, no caso da promessa
// rejeitada, derruba o processo inteiro, levando junto a requisição seguinte, que é de outro
// tenant. Sem rede em nenhum teste: cliente falso montado à mão.

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registrarUsoDaChave } from './registrarUsoDaChave';

interface PedidoObservado {
  tabela: string;
  operacao: 'update' | 'nenhuma';
  valores: Record<string, unknown> | null;
  filtros: Array<[string, unknown]>;
}

/** O que o `.eq()` final devolve — é aí que o módulo decide se observou a promessa ou não. */
type RespostaDoPedido = unknown;

function clienteFalso(resposta: RespostaDoPedido) {
  const pedido: PedidoObservado = {
    tabela: '',
    operacao: 'nenhuma',
    valores: null,
    filtros: [],
  };

  const cliente = {
    from(tabela: string) {
      pedido.tabela = tabela;
      return {
        update(valores: Record<string, unknown>) {
          pedido.operacao = 'update';
          pedido.valores = valores;
          return {
            eq(coluna: string, valor: unknown) {
              pedido.filtros.push([coluna, valor]);
              return resposta;
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { cliente, pedido };
}

/** Resposta feliz do PostgREST: objeto com `error: null`. */
const RESPOSTA_OK = Promise.resolve({ data: null, error: null });

function coletorDeAvisos() {
  const avisos: string[] = [];
  return { avisos, avisar: (mensagem: string) => void avisos.push(mensagem) };
}

/**
 * Deixa a fila de microtarefas drenar E cruza uma macrotarefa. O `setTimeout` não é enfeite:
 * o Node só decide que uma promessa ficou sem tratamento DEPOIS de esvaziar as microtarefas
 * do tick, então um `await Promise.resolve()` sozinho testaria antes de a decisão existir.
 */
function esperarUmCicloCompleto(): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, 10));
}

describe('a forma do pedido enviado ao banco', () => {
  it('é UPDATE em tenant_api_keys, filtrado por `id` e nunca por `prefixo`', async () => {
    // O `id` é a chave primária e saiu da própria consulta de autenticação. O `prefixo` veio
    // pelo header do cliente: usá-lo como filtro faria uma entrada de rede escolher qual
    // linha é escrita, e a escolha pareceria correta porque o prefixo também é único.
    const { cliente, pedido } = clienteFalso(RESPOSTA_OK);

    registrarUsoDaChave(cliente, 'chave-1');
    await esperarUmCicloCompleto();

    expect(pedido.tabela).toBe('tenant_api_keys');
    expect(pedido.operacao).toBe('update');
    expect(pedido.filtros).toEqual([['id', 'chave-1']]);
    expect(pedido.filtros.map(([coluna]) => coluna)).not.toContain('prefixo');
  });

  it('escreve só `last_used_at`, e nenhuma outra coluna junto', async () => {
    // Um campo a mais neste update é uma coluna sobrescrita por engano numa escrita que
    // ninguém observa — `revoked_at` aqui reviveria uma chave revogada, em silêncio.
    const { cliente, pedido } = clienteFalso(RESPOSTA_OK);

    registrarUsoDaChave(cliente, 'chave-1');
    await esperarUmCicloCompleto();

    expect(Object.keys(pedido.valores ?? {})).toEqual(['last_used_at']);
    expect(Object.keys(pedido.valores ?? {})).not.toContain('revoked_at');
    expect(Object.keys(pedido.valores ?? {})).not.toContain('hash');
  });

  it('o valor é ISO-8601, não a string `now()` nem um objeto Date', async () => {
    // O PostgREST manda um VALOR, não SQL: `now()` chegaria como texto e falharia a conversão
    // para `timestamptz`. Um `Date` seria serializado pelo JSON do caminho, não por decisão
    // deste módulo. Mesmo motivo já escrito em `supabase/scripts/revogarChaveDeApi.ts`.
    const { cliente, pedido } = clienteFalso(RESPOSTA_OK);

    registrarUsoDaChave(cliente, 'chave-1');
    await esperarUmCicloCompleto();

    const valor = pedido.valores?.['last_used_at'];
    expect(typeof valor).toBe('string');
    expect(valor).not.toBe('now()');
    expect(valor).not.toBeInstanceOf(Date);
    expect(valor).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // Ida e volta: o que foi enviado é exatamente o que `toISOString()` produz.
    expect(new Date(String(valor)).toISOString()).toBe(valor);
  });
});

describe('nenhuma falha escapa para o handler', () => {
  it('erro do banco na resposta não lança e não altera a requisição', async () => {
    const { avisos, avisar } = coletorDeAvisos();
    const { cliente } = clienteFalso(
      Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } }),
    );

    expect(() => registrarUsoDaChave(cliente, 'chave-1', avisar)).not.toThrow();
    await esperarUmCicloCompleto();

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('permission denied');
  });

  it('cliente que lança de forma SÍNCRONA dentro de from() não derruba nada', () => {
    // Não passa pelo `then`: sem o `try/catch` esta exceção subiria pelo handler e viraria
    // 500 sobre uma variante que já estava pronta para responder.
    const { avisos, avisar } = coletorDeAvisos();
    const cliente = {
      from() {
        throw new Error('cliente de serviço mal construído');
      },
    } as unknown as SupabaseClient;

    expect(() => registrarUsoDaChave(cliente, 'chave-1', avisar)).not.toThrow();
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('cliente de serviço mal construído');
  });

  it('id da chave vazio não gasta uma escrita nem manda uuid inválido ao Postgres', () => {
    // Prevenção de erro > mensagem de erro (CLAUDE.md): o update passaria e voltaria com
    // "invalid input syntax for type uuid", mandando quem investiga procurar defeito no
    // banco em vez de no chamador que esqueceu o id.
    const { avisos, avisar } = coletorDeAvisos();
    const { cliente, pedido } = clienteFalso(RESPOSTA_OK);

    expect(() => registrarUsoDaChave(cliente, '   ', avisar)).not.toThrow();

    expect(pedido.operacao).toBe('nenhuma');
    expect(avisos).toHaveLength(1);
  });
});

describe('a promessa rejeitada é observada — o teste mais importante deste arquivo', () => {
  // O QUE ESTES DOIS TESTES PROVAM, E O QUE NÃO PROVAM.
  //
  // Provam (1) que o módulo encadeia um tratador na promessa devolvida pelo cliente, e (2)
  // que o Node, ao fim do ciclo, não classificou aquela rejeição como `unhandledRejection`.
  // Em processo sem tratador global instalado, essa classificação é exatamente o que derruba
  // o processo em Node — é o modo de falha que se quer impedir.
  //
  // NÃO provam que o processo morreria sem o tratamento: o próprio vitest instala um ouvinte
  // de `unhandledRejection`, então aqui a queda nunca aconteceria de verdade. O que se
  // observa é a CLASSIFICAÇÃO do Node, que é o gatilho da queda, não a queda em si. Para
  // provar a queda seria preciso subir um processo Node separado — custo alto para observar
  // um comportamento que é do runtime, não deste módulo.

  it('encadeia um tratador na promessa devolvida pelo cliente', async () => {
    const promessaRejeitada = Promise.reject(new Error('conexão recusada'));
    let foiEncadeada = false;

    // Thenable instrumentado: é assim que o supabase-js devolve o builder do PostgREST (um
    // objeto com `then`, não uma `Promise`), e é o único jeito de ver de fora que alguém
    // pediu para ser avisado do resultado.
    const thenable = {
      then(aoResolver: (v: unknown) => unknown, aoRejeitar?: (m: unknown) => unknown) {
        foiEncadeada = true;
        return promessaRejeitada.then(aoResolver, aoRejeitar);
      },
    };

    const { avisos, avisar } = coletorDeAvisos();
    const { cliente } = clienteFalso(thenable);

    registrarUsoDaChave(cliente, 'chave-1', avisar);
    await esperarUmCicloCompleto();

    expect(foiEncadeada).toBe(true);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('conexão recusada');
  });

  it('o Node não classifica a rejeição como unhandledRejection', async () => {
    const capturadas: unknown[] = [];
    const ouvinte = (motivo: unknown): void => void capturadas.push(motivo);
    process.on('unhandledRejection', ouvinte);

    const { avisos, avisar } = coletorDeAvisos();

    try {
      const { cliente } = clienteFalso(Promise.reject(new Error('socket hang up')));
      expect(() => registrarUsoDaChave(cliente, 'chave-1', avisar)).not.toThrow();
      await esperarUmCicloCompleto();
    } finally {
      // Remover sempre: um ouvinte deixado para trás mudaria o comportamento dos testes
      // seguintes deste mesmo processo.
      process.off('unhandledRejection', ouvinte);
    }

    expect(capturadas).toEqual([]);
    expect(avisos).toHaveLength(1);
  });
});

describe('a assinatura que impede o `await` acidental', () => {
  it('não é async e não devolve nada para o chamador aguardar', () => {
    // `await` aqui somaria uma ida ao Postgres ao tempo de TODA resposta da API, e faria uma
    // variante já gerada virar 500 por causa de uma coluna de estatística. A defesa não é o
    // comentário no topo do módulo: é não haver o que aguardar. Trocar `function` por `async
    // function` numa refatoração reprova aqui, em vez de passar despercebido.
    const { cliente } = clienteFalso(RESPOSTA_OK);

    expect(registrarUsoDaChave.constructor.name).toBe('Function');
    expect(registrarUsoDaChave(cliente, 'chave-1')).toBeUndefined();
  });
});

describe('o aviso de falha nunca carrega credencial', () => {
  it('registra o id da linha e a causa, jamais chave, segredo ou hash', async () => {
    // O `id` é uuid da linha e pode aparecer (CLAUDE.md proíbe logar dado sensível, e uuid de
    // linha não é). Nada mais da chave entra nesta função — por construção, não por cuidado.
    const { avisos, avisar } = coletorDeAvisos();
    const { cliente } = clienteFalso(
      Promise.resolve({ data: null, error: { code: '08006', message: 'connection failure' } }),
    );

    registrarUsoDaChave(cliente, '3f1c9c2e-0000-4000-8000-000000000001', avisar);
    await esperarUmCicloCompleto();

    const aviso = avisos[0] ?? '';
    expect(aviso).toContain('3f1c9c2e-0000-4000-8000-000000000001');
    expect(aviso).not.toContain('kora_');
    expect(aviso).not.toMatch(/segredo|hash/i);
    // `[object Object]` seria um log que não ajuda ninguém a decidir nada.
    expect(aviso).not.toContain('[object Object]');
  });
});
