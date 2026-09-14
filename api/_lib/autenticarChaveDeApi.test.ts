// O que este arquivo protege não é "a função autentica": é que as recusas sejam
// INDISTINGUÍVEIS entre si e que o `tenant_id` venha da linha da chave. As duas coisas são
// invisíveis num teste que só olhe o caminho feliz, e as duas são o isolamento entre marcas
// concorrentes (ADR-006 D3), aqui não há RLS para consertar depois.
//
// Por isso os testes afirmam a FORMA do pedido ao banco (tabela, campos, filtros) e comparam
// as falhas UMA COM A OUTRA, nunca cada uma com uma string literal: escrever a mesma
// mensagem esperada quatro vezes provaria que quatro literais foram digitados iguais, não que
// a resposta é a mesma. Molde do cliente falso: `src/features/zonas/gravarZonaNoBanco.test.ts`.
//
// Sem rede, sem `.env`: o cliente entra por parâmetro.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { autenticarChaveDeApi } from './autenticarChaveDeApi';
import { gerarChaveDeApi, hashDoSegredo, interpretarChaveDeApi } from './formatoDaChaveDeApi';
import { FalhaDaApi } from './tiposDaApi';

const ROTA = 'https://kora.example/api/v1/products/prod-1/variants';

/** Uma chave real, gerada pelo mesmo módulo que a API usa, nada de literal montado à mão. */
const CHAVE = gerarChaveDeApi('live');

/** Outra chave real, para o caso "prefixo existe, segredo é de outra chave". */
const OUTRA_CHAVE = gerarChaveDeApi('live');

interface PedidoObservado {
  chamadas: number;
  tabela: string;
  campos: string;
  filtros: Array<[string, unknown]>;
  operacoes: string[];
}

function clienteFalso(resposta: { data?: unknown; error?: unknown } = {}) {
  const pedido: PedidoObservado = {
    chamadas: 0,
    tabela: '',
    campos: '',
    filtros: [],
    operacoes: [],
  };
  const resultado = { data: resposta.data ?? null, error: resposta.error ?? null };

  const encadeador = {
    eq(coluna: string, valor: unknown) {
      pedido.filtros.push([coluna, valor]);
      return encadeador;
    },
    maybeSingle: () => Promise.resolve(resultado),
    single: () => Promise.resolve(resultado),
  };

  const cliente = {
    from(tabela: string) {
      pedido.chamadas += 1;
      pedido.tabela = tabela;
      return {
        select(campos: string) {
          pedido.operacoes.push('select');
          pedido.campos = campos;
          return encadeador;
        },
        update(valores: Record<string, unknown>) {
          pedido.operacoes.push(`update:${Object.keys(valores).join(',')}`);
          return encadeador;
        },
        insert(valores: Record<string, unknown>) {
          pedido.operacoes.push(`insert:${Object.keys(valores).join(',')}`);
          return encadeador;
        },
      };
    },
  } as unknown as SupabaseClient;

  return { cliente, pedido };
}

/**
 * Um `Request` que registra CADA leitura de header. É o que transforma "a query é conferida
 * antes do header" de intenção escrita em fato verificável: sem isto, um módulo que lesse o
 * `Authorization` primeiro e recusasse a query depois passaria em todos os outros testes.
 */
function pedidoEspiao(url: string, init: RequestInit = {}) {
  const leiturasDeHeader: string[] = [];
  const pedido = new Request(url, init);
  const leituraOriginal = pedido.headers.get.bind(pedido.headers);

  Object.defineProperty(pedido.headers, 'get', {
    configurable: true,
    value: (nome: string) => {
      leiturasDeHeader.push(nome.toLowerCase());
      return leituraOriginal(nome);
    },
  });

  return { pedido, leiturasDeHeader };
}

function comChave(chave: string, url: string = ROTA): Request {
  return new Request(url, { headers: { Authorization: `Bearer ${chave}` } });
}

function linhaDaChave(sobrescrever: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'chave-1',
    tenant_id: 'tenant-da-linha',
    hash: CHAVE.hash,
    revoked_at: null,
    ...sobrescrever,
  };
}

async function capturarFalha(acao: () => Promise<unknown>): Promise<FalhaDaApi> {
  try {
    await acao();
  } catch (falha: unknown) {
    if (falha instanceof FalhaDaApi) return falha;
    throw new Error(`A falha deveria ser uma FalhaDaApi, e veio: ${String(falha)}`);
  }
  throw new Error('A chamada deveria ter falhado e não falhou.');
}

/** As quatro recusas por chave do contrato, cada uma montada pelo seu caminho real. */
async function recusaPorChaveMalformada(): Promise<FalhaDaApi> {
  const { cliente } = clienteFalso();
  return capturarFalha(() => autenticarChaveDeApi(cliente, comChave('nao_e_uma_chave')));
}

async function recusaPorPrefixoInexistente(): Promise<FalhaDaApi> {
  const { cliente } = clienteFalso({ data: null });
  return capturarFalha(() => autenticarChaveDeApi(cliente, comChave(CHAVE.chave)));
}

async function recusaPorSegredoErrado(): Promise<FalhaDaApi> {
  // Prefixo real, segredo de outra chave: é o caso que a comparação de hash existe para pegar.
  const { cliente } = clienteFalso({ data: linhaDaChave() });
  const segredoAlheio = interpretarChaveDeApi(OUTRA_CHAVE.chave)?.segredo ?? '';
  const chaveHibrida = `kora_live_${CHAVE.prefixo}_${segredoAlheio}`;
  return capturarFalha(() => autenticarChaveDeApi(cliente, comChave(chaveHibrida)));
}

async function recusaPorChaveRevogada(): Promise<FalhaDaApi> {
  const { cliente } = clienteFalso({
    data: linhaDaChave({ revoked_at: '2026-01-01T00:00:00.000Z' }),
  });
  return capturarFalha(() => autenticarChaveDeApi(cliente, comChave(CHAVE.chave)));
}

describe('chave na query string é recusada antes de o header ser lido', () => {
  it('recusa mesmo com um Authorization VÁLIDO no mesmo pedido, sem consultar o banco', async () => {
    // O ponto do teste: um pedido perfeitamente autenticável é recusado só por ter mandado a
    // chave também pela URL. Se o header vencesse, a regra viraria decorativa e o integrador
    // continuaria vazando a chave em log de CDN sem nunca receber um erro.
    const { cliente, pedido: consulta } = clienteFalso({ data: linhaDaChave() });
    const { pedido, leiturasDeHeader } = pedidoEspiao(`${ROTA}?api_key=${CHAVE.chave}`, {
      headers: { Authorization: `Bearer ${CHAVE.chave}` },
    });

    const falha = await capturarFalha(() => autenticarChaveDeApi(cliente, pedido));

    expect(falha.codigo).toBe('CHAVE_AUSENTE');
    expect(falha.status).toBe(401);
    expect(leiturasDeHeader).toEqual([]);
    expect(consulta.chamadas).toBe(0);
  });

  it.each(['api_key', 'apikey', 'api-key', 'key', 'token', 'access_token'])(
    '?%s= é recusado',
    async (nome) => {
      const { cliente } = clienteFalso({ data: linhaDaChave() });
      const falha = await capturarFalha(() =>
        autenticarChaveDeApi(cliente, comChave(CHAVE.chave, `${ROTA}?${nome}=${CHAVE.chave}`)),
      );

      expect(falha.codigo).toBe('CHAVE_AUSENTE');
    },
  );

  it('parâmetro de nome desconhecido carregando algo com cara de chave também é recusado', async () => {
    // Lista de nomes só recusa o que alguém já imaginou; o valor é o que não muda. `?cred=`
    // não está em lista nenhuma e é exatamente o que um integrador criativo escreveria.
    const { cliente } = clienteFalso({ data: linhaDaChave() });
    const falha = await capturarFalha(() =>
      autenticarChaveDeApi(cliente, comChave(CHAVE.chave, `${ROTA}?cred=${CHAVE.chave}`)),
    );

    expect(falha.codigo).toBe('CHAVE_AUSENTE');
  });

  it('query legítima não vira 401', async () => {
    // A recusa não pode virar um filtro que derruba pedido correto: `?format=svg` é o único
    // parâmetro do contrato, e ele precisa continuar passando.
    const { cliente } = clienteFalso({ data: linhaDaChave() });
    const autenticada = await autenticarChaveDeApi(
      cliente,
      comChave(CHAVE.chave, `${ROTA}?format=svg`),
    );

    expect(autenticada.tenantId).toBe('tenant-da-linha');
  });
});

describe('header ausente ou sem o esquema Bearer é CHAVE_AUSENTE', () => {
  it('sem Authorization nenhum', async () => {
    const { cliente, pedido: consulta } = clienteFalso();
    const falha = await capturarFalha(() =>
      autenticarChaveDeApi(cliente, new Request(ROTA)),
    );

    expect(falha.codigo).toBe('CHAVE_AUSENTE');
    expect(falha.status).toBe(401);
    expect(consulta.chamadas).toBe(0);
  });

  it('com a chave crua, sem o esquema', async () => {
    const { cliente } = clienteFalso();
    const falha = await capturarFalha(() =>
      autenticarChaveDeApi(cliente, new Request(ROTA, { headers: { Authorization: CHAVE.chave } })),
    );

    expect(falha.codigo).toBe('CHAVE_AUSENTE');
  });

  it('com outro esquema (Basic)', async () => {
    const { cliente } = clienteFalso();
    const falha = await capturarFalha(() =>
      autenticarChaveDeApi(cliente, new Request(ROTA, { headers: { Authorization: 'Basic abc' } })),
    );

    expect(falha.codigo).toBe('CHAVE_AUSENTE');
  });

  it('com Bearer e nada depois', async () => {
    const { cliente } = clienteFalso();
    const falha = await capturarFalha(() =>
      autenticarChaveDeApi(cliente, new Request(ROTA, { headers: { Authorization: 'Bearer   ' } })),
    );

    expect(falha.codigo).toBe('CHAVE_AUSENTE');
  });

  it('`bearer` minúsculo autentica, o esquema é case-insensitive por RFC', async () => {
    // Recusar aqui seria bug nosso disfarçado de segurança: cliente HTTP que normaliza o
    // esquema é comum, e o integrador ficaria com um 401 que nenhuma doc explica.
    const { cliente } = clienteFalso({ data: linhaDaChave() });
    const autenticada = await autenticarChaveDeApi(
      cliente,
      new Request(ROTA, { headers: { Authorization: `bearer ${CHAVE.chave}` } }),
    );

    expect(autenticada.tenantId).toBe('tenant-da-linha');
  });
});

describe('as quatro recusas por chave são indistinguíveis entre si', () => {
  it('malformada, prefixo inexistente, segredo errado e revogada respondem igual', async () => {
    // Comparadas UMA COM A OUTRA, nunca com uma literal: o requisito é "iguais", e só essa
    // forma o torna verificável. Distinguir qualquer uma delas conta a quem sonda prefixos
    // qual deles já existiu (ADR-006).
    const [malformada, inexistente, segredoErrado, revogada] = await Promise.all([
      recusaPorChaveMalformada(),
      recusaPorPrefixoInexistente(),
      recusaPorSegredoErrado(),
      recusaPorChaveRevogada(),
    ]);

    const forma = (falha: FalhaDaApi) => ({
      codigo: falha.codigo,
      status: falha.status,
      message: falha.message,
    });

    expect(forma(inexistente)).toEqual(forma(malformada));
    expect(forma(segredoErrado)).toEqual(forma(malformada));
    expect(forma(revogada)).toEqual(forma(malformada));
    expect(malformada.codigo).toBe('CHAVE_INVALIDA');
    expect(malformada.status).toBe(401);
  });

  it('nenhuma delas ecoa a chave, o segredo ou o hash, nem na mensagem nem no stack', async () => {
    const falhas = await Promise.all([
      recusaPorChaveMalformada(),
      recusaPorPrefixoInexistente(),
      recusaPorSegredoErrado(),
      recusaPorChaveRevogada(),
    ]);
    const segredo = interpretarChaveDeApi(CHAVE.chave)?.segredo ?? '';

    for (const falha of falhas) {
      const texto = `${falha.message}\n${falha.stack ?? ''}`;
      expect(texto).not.toContain(CHAVE.chave);
      expect(texto).not.toContain(segredo);
      expect(texto).not.toContain(CHAVE.hash);
      expect(texto).not.toContain(hashDoSegredo(segredo));
    }
  });
});

describe('a comparação de hash acontece mesmo quando o prefixo não existe', () => {
  it('prefixo inexistente ainda consulta o banco e ainda compara', async () => {
    // Se a função saísse por `return` ao ver `data: null`, o prefixo inexistente responderia
    // mais rápido que o prefixo real com segredo errado, e essa diferença de tempo é o
    // oráculo que a mensagem idêntica existe para fechar.
    const { cliente, pedido } = clienteFalso({ data: null });
    await capturarFalha(() => autenticarChaveDeApi(cliente, comChave(CHAVE.chave)));

    expect(pedido.chamadas).toBe(1);
    expect(pedido.filtros).toEqual([['prefixo', CHAVE.prefixo]]);
  });

  it('hash gravado com tamanho errado não vira exceção: `timingSafeEqual` lançaria', async () => {
    // Buffers de tamanhos diferentes fazem `timingSafeEqual` LANÇAR. Sem a guarda, uma linha
    // corrompida no banco viraria 500 onde o contrato promete 401.
    const { cliente } = clienteFalso({ data: linhaDaChave({ hash: 'abc' }) });
    const falha = await capturarFalha(() => autenticarChaveDeApi(cliente, comChave(CHAVE.chave)));

    expect(falha.codigo).toBe('CHAVE_INVALIDA');
    expect(falha.status).toBe(401);
  });
});

describe('a consulta ao banco tem a forma certa', () => {
  it('busca em tenant_api_keys por prefixo, com campos explícitos', async () => {
    const { cliente, pedido } = clienteFalso({ data: linhaDaChave() });
    await autenticarChaveDeApi(cliente, comChave(CHAVE.chave));

    expect(pedido.tabela).toBe('tenant_api_keys');
    expect(pedido.campos).toBe('id, tenant_id, hash, revoked_at');
    expect(pedido.campos).not.toContain('*');
    expect(pedido.filtros).toEqual([['prefixo', CHAVE.prefixo]]);
  });

  it('não escreve nada, `last_used_at` é fire-and-forget de outro módulo', async () => {
    // Uma escrita aqui bloquearia a geração da variante por causa de uma métrica.
    const { cliente, pedido } = clienteFalso({ data: linhaDaChave() });
    await autenticarChaveDeApi(cliente, comChave(CHAVE.chave));

    expect(pedido.operacoes).toEqual(['select']);
  });

  it('erro do banco é 500, nunca 401', async () => {
    // 401 por Postgres fora do ar mandaria o integrador rotacionar uma chave que está certa.
    const { cliente } = clienteFalso({
      error: { code: '57P01', message: 'terminating connection due to administrator command' },
    });
    const falha = await capturarFalha(() => autenticarChaveDeApi(cliente, comChave(CHAVE.chave)));

    expect(falha.codigo).toBe('FALHA_INTERNA');
    expect(falha.status).toBe(500);
    expect(falha.message).not.toContain('terminating connection');
  });

  it('linha sem tenant_id utilizável é 500, não um escopo vazio', async () => {
    // `tenantId: ''` abriria uma consulta sem escopo lá na frente, o vazamento inteiro.
    const { cliente } = clienteFalso({ data: linhaDaChave({ tenant_id: '  ' }) });
    const falha = await capturarFalha(() => autenticarChaveDeApi(cliente, comChave(CHAVE.chave)));

    expect(falha.codigo).toBe('FALHA_INTERNA');
  });
});

describe('sucesso', () => {
  it('o tenantId vem DA LINHA, mesmo com outro tenant_id no corpo do pedido', async () => {
    // É a falha inteira do ADR-006 D3 numa linha: se o chamador puder dizer de quem é o
    // produto, a marca A pede a variante da marca B e a API entrega.
    const { cliente } = clienteFalso({ data: linhaDaChave() });
    const pedido = new Request(ROTA, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CHAVE.chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: 'tenant-da-concorrente', sola: '#C0392B' }),
    });

    const autenticada = await autenticarChaveDeApi(cliente, pedido);

    expect(autenticada.tenantId).toBe('tenant-da-linha');
    expect(autenticada.tenantId).not.toBe('tenant-da-concorrente');
  });

  it('devolve o prefixo e o id da chave para o log e para o registro de uso', async () => {
    const { cliente } = clienteFalso({ data: linhaDaChave() });
    const autenticada = await autenticarChaveDeApi(cliente, comChave(CHAVE.chave));

    expect(autenticada.prefixo).toBe(CHAVE.prefixo);
    expect(autenticada.idDaChave).toBe('chave-1');
  });

  it('uma chave `test` autentica igual, o ambiente é do formato, não da autorização', async () => {
    const chaveDeTeste = gerarChaveDeApi('test');
    const { cliente } = clienteFalso({ data: linhaDaChave({ hash: chaveDeTeste.hash }) });
    const autenticada = await autenticarChaveDeApi(cliente, comChave(chaveDeTeste.chave));

    expect(autenticada.tenantId).toBe('tenant-da-linha');
  });
});

describe('guarda de fonte', () => {
  const fonte = readFileSync(new URL('./autenticarChaveDeApi.ts', import.meta.url), 'utf8');

  /**
   * O fonte SEM comentário, e é a diferença entre a guarda proteger e a guarda mentir.
   *
   * Uma guarda escrita como `expect(fonte).toContain('timingSafeEqual')` fica verde quando
   * alguém apaga a chamada e deixa a palavra num comentário explicando o que a função fazia,
   * que é justamente o que se escreve ao remover código. Verde dos dois lados é o mesmo que
   * não ter guarda: nenhuma execução mostra a diferença.
   */
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  /** Quantas vezes o identificador aparece no CÓDIGO. Uma só é o `import`, e importar não é usar. */
  const usosNoCodigo = (identificador: string) => codigo.split(identificador).length - 1;

  it('existe UMA única saída de recusa por chave', () => {
    // A indistinguibilidade das quatro recusas é estrutural enquanto houver um `throw` só.
    // Uma segunda saída passaria nos testes de igualdade no dia em que fosse escrita e
    // divergiria na primeira vez que alguém "melhorasse" uma das mensagens.
    const ocorrencias = codigo.split("criarFalhaDeTransporte('CHAVE_INVALIDA')").length - 1;

    expect(ocorrencias).toBe(1);
  });

  it('a comparação é em tempo constante e tem contra o que comparar quando não há linha', () => {
    // Pelo menos DUAS ocorrências no código, não uma: a primeira é o `import`, e um import
    // sobrevive intacto à remoção da chamada que ele servia. Exigir só "aparece no arquivo"
    // deixaria passar tanto a troca de `timingSafeEqual` por `===` (o oráculo de tempo que
    // este módulo existe para fechar) quanto a comparação contra `null` no lugar do digest
    // de mentira (o oráculo que denuncia prefixo inexistente pela resposta mais rápida).
    expect(usosNoCodigo('timingSafeEqual')).toBeGreaterThanOrEqual(2);
    expect(usosNoCodigo('HASH_QUE_NUNCA_CONFERE')).toBeGreaterThanOrEqual(2);
    expect(codigo).not.toContain('===  hashArmazenado');
  });

  it('não monta status à mão e não escreve no banco', () => {
    // `new FalhaDaApi(...)` aqui seria uma segunda cópia da tabela de status de
    // `docs/07_APIS/endpoints.md`, e cópia diverge. E nenhuma escrita: `last_used_at` é
    // fire-and-forget de `registrarUsoDaChave`, e uma escrita aqui bloquearia a autenticação
    // por causa de uma métrica. A proibição é sobre a OPERAÇÃO, não sobre a menção: por isso
    // ela lê `codigo`, e um comentário que cite `.update(` para explicar por que ele não está
    // aqui não reprova o arquivo.
    expect(codigo).not.toContain('new FalhaDaApi(');
    expect(codigo).not.toContain('.update(');
    expect(codigo).not.toContain('.insert(');
    expect(codigo).not.toContain('.upsert(');
  });
});
