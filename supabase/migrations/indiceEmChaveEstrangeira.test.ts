// Chave estrangeira sem índice que a lidere vira teste vermelho.
//
// O caso que fez esta guarda nascer (R7-A53): `tenant_members.user_id` ficou seis rodadas sem
// índice, e é a coluna mais consultada do sistema. `auth_tenant_ids()` filtra SÓ por ela, e essa
// função aparece quinze vezes nos predicados das políticas em vigor, cobrindo as seis tabelas
// mais as três políticas do Storage. Toda leitura autenticada de qualquer tabela passava por uma
// varredura inteira de `tenant_members`.
//
// POR QUE NINGUÉM VIU: a tabela TEM um índice em `user_id`, de um certo jeito de olhar. O
// `unique (tenant_id, user_id)` cria um btree com as duas colunas, e quem lê a linha rápido
// conclui que as duas estão cobertas. Não estão: índice composto só serve para busca que comece
// pela coluna da FRENTE. Essa é a leitura errada que este arquivo existe para tornar impossível,
// e é por isso que a regra aqui é "índice que a LIDERE", e não "índice que a contenha".
//
// A guarda vale mais que o índice que ela cobra. O índice conserta uma coluna; ela impede a
// sétima tabela de repetir o caso, na migration em que a pessoa escreve `references` e para por
// ali, que é onde o esquecimento acontece de verdade.
//
// O que ela NÃO promete, e está dito para ninguém confundir guarda verde com banco rápido:
// - não afirma que o índice está SENDO USADO. Isso é `explain` contra banco de verdade, e este
//   projeto não tem acesso direto a Postgres (o cliente fala por PostgREST e não executa SQL
//   arbitrário). O que se prova aqui é que o índice EXISTE no texto que vai ser aplicado.
// - não julga índice sobrando. Índice a mais custa escrita, e cobrar isso exigiria saber quais
//   consultas existem, que é conhecimento que este arquivo não tem.
//
// Varredura de FONTE, e não teste contra o banco, pelo mesmo motivo de `rlsEmTodaTabela.test.ts`:
// roda em `npm test` numa máquina sem `.env.local`, pega a migration que ainda não foi aplicada em
// banco nenhum, e é sobre o TEXTO que a pessoa escreveu.

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { semComentarios, semEsquema } from './lerSql';

/** Começos de item que são restrição de tabela, e não declaração de coluna. */
const RESTRICOES = ['unique', 'primary', 'foreign', 'constraint', 'check', 'exclude'];

/**
 * Os itens de dentro de um `create table (...)`, separados pelas vírgulas de PROFUNDIDADE ZERO.
 *
 * Um `split(',')` cru quebraria `unique (tenant_id, user_id)` no meio e faria a restrição virar
 * duas metades sem sentido, exatamente na única linha do schema que este arquivo precisa ler
 * direito. Por isso o corte conta parênteses, e ignora vírgula dentro de texto entre aspas.
 */
function itensDoCorpo(corpo: string): string[] {
  const itens: string[] = [];
  let atual = '';
  let profundidade = 0;
  let dentroDeTexto = false;

  for (const caractere of corpo) {
    if (caractere === "'") dentroDeTexto = !dentroDeTexto;

    if (!dentroDeTexto) {
      if (caractere === '(') profundidade += 1;
      else if (caractere === ')') profundidade -= 1;
      else if (caractere === ',' && profundidade === 0) {
        itens.push(atual.trim());
        atual = '';
        continue;
      }
    }

    atual += caractere;
  }

  if (atual.trim() !== '') itens.push(atual.trim());

  return itens;
}

/** O corpo de cada `create table`, por nome de tabela. Conta parênteses para achar o fecho certo. */
function corposDeTabela(limpo: string): Map<string, string> {
  const corpos = new Map<string, string>();
  const aberturas = [...limpo.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)\s*\(/gi)];

  for (const abertura of aberturas) {
    const nome = semEsquema(abertura[1] ?? '');
    const inicio = (abertura.index ?? 0) + abertura[0].length;
    let profundidade = 1;
    let fim = inicio;

    while (fim < limpo.length && profundidade > 0) {
      const caractere = limpo[fim];
      if (caractere === '(') profundidade += 1;
      else if (caractere === ')') profundidade -= 1;
      fim += 1;
    }

    corpos.set(nome, limpo.slice(inicio, fim - 1));
  }

  return corpos;
}

/** A primeira coluna de uma lista `(a, b, c)`, que é a única que a lista indexa para busca direta. */
function primeiraDaLista(lista: string): string {
  return (lista.split(',')[0] ?? '').trim().replace(/"/g, '');
}

interface LeituraDaTabela {
  /** Colunas que apontam para outra tabela, por `references` de coluna ou `foreign key` de tabela. */
  estrangeiras: string[];
  /** Colunas que LIDERAM alguma estrutura indexada declarada dentro do `create table`. */
  lideradas: Set<string>;
}

function lerTabela(corpo: string): LeituraDaTabela {
  const estrangeiras: string[] = [];
  const lideradas = new Set<string>();

  for (const item of itensDoCorpo(corpo)) {
    const primeiraPalavra = (item.split(/\s+/)[0] ?? '').toLowerCase();

    if (RESTRICOES.includes(primeiraPalavra)) {
      // `unique (a, b)` e `primary key (a, b)` criam um índice que só a PRIMEIRA coluna lidera.
      const lista = /(?:unique|primary\s+key)\s*\(([^)]*)\)/i.exec(item);
      if (lista !== null) lideradas.add(primeiraDaLista(lista[1] ?? ''));

      // `foreign key (x) references ...` é a forma de tabela do que quase sempre vem na coluna.
      const estrangeira = /foreign\s+key\s*\(([^)]*)\)\s*references/i.exec(item);
      if (estrangeira !== null) estrangeiras.push(primeiraDaLista(estrangeira[1] ?? ''));

      continue;
    }

    const coluna = primeiraPalavra.replace(/"/g, '');
    if (coluna === '') continue;

    // `primary key` e `unique` de coluna criam índice de uma coluna só, e ela o lidera por
    // definição. É por isso que `id uuid primary key` nunca aparece na lista de faltantes.
    if (/\bprimary\s+key\b/i.test(item) || /\bunique\b/i.test(item)) lideradas.add(coluna);
    if (/\breferences\b/i.test(item)) estrangeiras.push(coluna);
  }

  return { estrangeiras, lideradas };
}

/** Por tabela, as colunas que lideram algum `create index` deste SQL. */
function indicesPorTabela(limpo: string): Map<string, Set<string>> {
  const porTabela = new Map<string, Set<string>>();
  const criados = [
    ...limpo.matchAll(
      /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?[\w."]+\s+on\s+([\w.]+)\s*(?:using\s+\w+\s*)?\(([^)]*)\)/gi,
    ),
  ];

  for (const criado of criados) {
    const tabela = semEsquema(criado[1] ?? '');
    const coluna = primeiraDaLista(criado[2] ?? '');
    const atuais = porTabela.get(tabela) ?? new Set<string>();
    atuais.add(coluna);
    porTabela.set(tabela, atuais);
  }

  return porTabela;
}

/**
 * As chaves estrangeiras deste SQL sem índice que as lidere, como `tabela.coluna`.
 *
 * Recebe o texto e não os arquivos porque o teste precisa fazer as duas perguntas com a MESMA
 * função: a de verdade, sobre as migrations do projeto, e a de mentira, sobre um SQL inventado que
 * TEM de reprovar. Uma função que lesse disco sozinha só responderia a primeira, e uma guarda que
 * só sabe dizer "está tudo certo" não prova que saberia dizer o contrário.
 */
export function chavesEstrangeirasSemIndice(sql: string): string[] {
  const limpo = semComentarios(sql);
  const indices = indicesPorTabela(limpo);
  const faltando: string[] = [];

  for (const [tabela, corpo] of corposDeTabela(limpo)) {
    const { estrangeiras, lideradas } = lerTabela(corpo);
    const daTabela = indices.get(tabela) ?? new Set<string>();

    for (const coluna of estrangeiras) {
      if (!lideradas.has(coluna) && !daTabela.has(coluna)) faltando.push(`${tabela}.${coluna}`);
    }
  }

  return faltando.sort();
}

const PASTA = new URL('.', import.meta.url);

/** Todas as migrations, numa string só: o índice pode nascer numa migration posterior à tabela. */
function todasAsMigrations(): string {
  const arquivos = readdirSync(PASTA).filter((nome) => nome.endsWith('.sql'));

  return arquivos.map((nome) => readFileSync(new URL(nome, PASTA), 'utf8')).join('\n');
}

describe('toda chave estrangeira tem índice que a lidere (A53)', () => {
  const SQL = todasAsMigrations();

  it('nenhuma coluna `references` das migrations ficou sem índice', () => {
    // A afirmação que vale o arquivo. Falhar aqui nomeia a coluna exata, `tabela.coluna`.
    expect(chavesEstrangeirasSemIndice(SQL)).toEqual([]);
  });

  it('a varredura enxerga as chaves estrangeiras de verdade, e não passa por regex vazio', () => {
    // Contraprova obrigatória: o teste acima passaria igual se `references` nunca casasse com
    // coisa nenhuma. Estas são as nove de hoje, e a lista é a prova de que a leitura acontece.
    //
    // `tenant_api_keys.created_by` está aqui porque a varredura o encontrou na primeira vez que
    // rodou, e eu não. Fica listado para a próxima pessoa ver que chave estrangeira não é só a
    // que aponta para `tenants`.
    const encontradas: string[] = [];

    for (const [tabela, corpo] of corposDeTabela(semComentarios(SQL))) {
      for (const coluna of lerTabela(corpo).estrangeiras) encontradas.push(`${tabela}.${coluna}`);
    }

    expect(encontradas.sort()).toEqual([
      'product_zones.product_id',
      'product_zones.tenant_id',
      'products.tenant_id',
      'tenant_api_keys.created_by',
      'tenant_api_keys.tenant_id',
      'tenant_members.tenant_id',
      'tenant_members.user_id',
      'variants.product_id',
      'variants.tenant_id',
    ]);
  });

  it('o composto cobre a coluna da FRENTE, e só ela', () => {
    // O coração do achado, escrito como caso isolado: é esta leitura, a de que
    // `unique (tenant_id, user_id)` cobre as duas, que deixou `user_id` seis rodadas sem índice.
    const semOIndice = `
create table tenant_members (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references auth.users(id),
  unique (tenant_id, user_id)
);
`;

    expect(chavesEstrangeirasSemIndice(semOIndice)).toEqual(['tenant_members.user_id']);
  });

  it('a mesma tabela COM o índice passa', () => {
    // Sem este par, a guarda poderia estar reprovando qualquer `references`, com índice ou sem, e
    // ninguém saberia até ela barrar uma migration correta. É o caso real depois desta rodada.
    const comOIndice = `
create table tenant_members (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references auth.users(id),
  unique (tenant_id, user_id)
);
create index tenant_members_user_id_idx on tenant_members(user_id);
`;

    expect(chavesEstrangeirasSemIndice(comOIndice)).toEqual([]);
  });

  it('índice citado só em comentário não conta', () => {
    // O jeito mais fácil de a guarda ser enganada sem ninguém querer enganar: o `create index`
    // fica dentro de um comentário de "falta fazer" e o teste fica verde.
    const soPromessa = `
create table pedidos_de_amostra (
  id uuid primary key,
  tenant_id uuid not null references tenants(id)
);
-- create index pedidos_de_amostra_tenant_id_idx on pedidos_de_amostra(tenant_id);
`;

    expect(chavesEstrangeirasSemIndice(soPromessa)).toEqual(['pedidos_de_amostra.tenant_id']);
  });

  it('a coluna que é chave primária já está indexada, e não vira falso alarme', () => {
    // Guarda que reclama à toa é guarda que alguém desliga. `id uuid primary key references x`
    // é raro mas legítimo (tabela filha que estende outra 1 para 1), e tem índice por definição.
    const filha = `
create table detalhe_do_produto (
  product_id uuid primary key references products(id)
);
`;

    expect(chavesEstrangeirasSemIndice(filha)).toEqual([]);
  });

  it('`foreign key` na forma de tabela também é cobrada', () => {
    // As migrations de hoje só usam `references` na coluna, mas nada impede a próxima de usar a
    // forma de restrição, e uma guarda que só enxerga uma das duas formas é meia guarda.
    const formaDeTabela = `
create table pedidos_de_amostra (
  id uuid primary key,
  tenant_id uuid not null,
  foreign key (tenant_id) references tenants(id)
);
`;

    expect(chavesEstrangeirasSemIndice(formaDeTabela)).toEqual(['pedidos_de_amostra.tenant_id']);
  });

  it('o esquema escrito no nome não engana', () => {
    // `create table public.x` com `create index ... on x` é o mesmo par, e reprovar isso seria
    // falso alarme. As migrations de hoje não usam prefixo, nada impede a próxima de usar.
    const comEsquema = `
create table public.pedidos_de_amostra (
  id uuid primary key,
  tenant_id uuid not null references tenants(id)
);
create index pedidos_de_amostra_tenant_id_idx on pedidos_de_amostra(tenant_id);
`;

    expect(chavesEstrangeirasSemIndice(comEsquema)).toEqual([]);
  });
});
