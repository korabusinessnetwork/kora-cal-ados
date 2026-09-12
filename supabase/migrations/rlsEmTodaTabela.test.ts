// Tabela criada sem RLS vira teste vermelho.
//
// O `CLAUDE.md` manda, em letra: "ao criar tabela/função nova, lembrar que RLS precisa ser
// configurada". Até aqui isso era só uma frase, e frase não reprova nada. O produto é SaaS B2B
// multi-tenant com marcas CONCORRENTES no mesmo banco (`docs/11_SEGURANCA/multi-tenancy-rls.md`),
// então uma tabela sem RLS não é descuido de estilo: é o acervo de um tenant legível pelo outro.
//
// O defeito que isto pega é o mais silencioso que existe nesta pasta. A migration roda limpa, os
// testes de banco continuam verdes, o app funciona, e nada fica vermelho. A falta só aparece
// quando alguém de fora lê o que não devia, e aí já leu.
//
// Varredura de FONTE, e não teste contra o banco, por três motivos. Roda em `npm test` sem
// `.env.local` e sem projeto Supabase nenhum, ou seja, na máquina de quem escreveu a migration e
// antes de ela ser aplicada. Pega a migration de 2026-09-08, que está escrita e ainda NÃO foi
// executada em banco nenhum. E é sobre o TEXTO que a pessoa escreveu, que é onde o esquecimento
// acontece. Mesmo molde de `src/lib/supabase/semServiceRoleNoFront.test.ts`.

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * O texto sem comentário nenhum.
 *
 * Corta nos dois sentidos, e os dois importam. Um `-- create table pedidos` de exemplo dentro de
 * um comentário viraria tabela inexistente sem RLS, e o teste reclamaria de nada. Pior: um
 * comentário explicando "alter table pedidos enable row level security" faria uma tabela DE
 * VERDADE passar por protegida sem uma linha de SQL ter sido escrita.
 */
function semComentarios(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

/** `public.tenants` e `tenants` são a mesma tabela. O que interessa é o nome depois do ponto. */
function semEsquema(nome: string): string {
  return nome.includes('.') ? (nome.split('.').pop() ?? nome) : nome;
}

/**
 * As tabelas criadas neste SQL que não recebem `enable row level security` nele.
 *
 * Recebe o texto e não os arquivos porque o teste precisa fazer as duas perguntas com a MESMA
 * função: a de verdade, sobre as migrations do projeto, e a de mentira, sobre um texto inventado
 * que precisa reprovar. Uma função que lesse disco sozinha só responderia a primeira, e um teste
 * que só sabe dizer "está tudo certo" não prova que saberia dizer o contrário.
 */
export function tabelasSemRls(sql: string): string[] {
  const limpo = semComentarios(sql);

  const criadas = [...limpo.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi)].map(
    (achado) => semEsquema(achado[1] ?? ''),
  );
  const protegidas = new Set(
    [
      ...limpo.matchAll(
        /alter\s+table\s+(?:if\s+exists\s+)?([\w.]+)\s+enable\s+row\s+level\s+security/gi,
      ),
    ].map((achado) => semEsquema(achado[1] ?? '')),
  );

  return criadas.filter((tabela) => !protegidas.has(tabela));
}

const PASTA = new URL('.', import.meta.url);

/** Todas as migrations, numa string só: a RLS pode ser ligada numa migration posterior à criação. */
function todasAsMigrations(): string {
  const arquivos = readdirSync(PASTA).filter((nome) => nome.endsWith('.sql'));

  return arquivos.map((nome) => readFileSync(new URL(nome, PASTA), 'utf8')).join('\n');
}

describe('toda tabela criada tem RLS ligada (A41)', () => {
  const SQL = todasAsMigrations();

  it('nenhuma tabela das migrations ficou sem `enable row level security`', () => {
    // A afirmação que vale o arquivo. Falhar aqui lista o nome exato da tabela desprotegida.
    expect(tabelasSemRls(SQL)).toEqual([]);
  });

  it('a varredura enxerga as tabelas de verdade, e não passa por acerto de regex vazio', () => {
    // Contraprova obrigatória: o teste acima passaria igual se o `create table` nunca casasse com
    // coisa nenhuma, e aí a guarda inteira seria decoração. Estas são as seis tabelas de hoje.
    const criadas = [...semComentarios(SQL).matchAll(/create\s+table\s+([\w.]+)/gi)].map(
      (achado) => achado[1],
    );

    expect(criadas.sort()).toEqual([
      'product_zones',
      'products',
      'tenant_api_keys',
      'tenant_members',
      'tenants',
      'variants',
    ]);
  });

  it('uma tabela nova sem RLS reprova', () => {
    // O caso que este arquivo existe para pegar, escrito como a pessoa esqueceria de verdade:
    // a tabela entra, a RLS não.
    const comEsquecimento = `${SQL}\ncreate table pedidos_de_amostra (id uuid primary key);\n`;

    expect(tabelasSemRls(comEsquecimento)).toEqual(['pedidos_de_amostra']);
  });

  it('a mesma tabela nova COM RLS passa', () => {
    // Sem este par, a guarda poderia estar reprovando qualquer tabela nova, RLS ou não, e ninguém
    // saberia até ela barrar uma migration correta.
    const completa = `${SQL}
create table pedidos_de_amostra (id uuid primary key);
alter table pedidos_de_amostra enable row level security;
`;

    expect(tabelasSemRls(completa)).toEqual([]);
  });

  it('comentário não conta como RLS ligada', () => {
    // A forma mais fácil de a guarda ser enganada sem ninguém querer enganar: a pessoa escreve o
    // `alter table` dentro de um comentário de "falta fazer" e o teste fica verde.
    const soPromessa = `${SQL}
create table pedidos_de_amostra (id uuid primary key);
-- alter table pedidos_de_amostra enable row level security;
`;

    expect(tabelasSemRls(soPromessa)).toEqual(['pedidos_de_amostra']);
  });

  it('tabela citada só em comentário não conta como criada', () => {
    // O outro lado do mesmo corte: reclamar de uma tabela que não existe manda alguém procurar
    // RLS para uma tabela que ninguém criou, e um teste que reclama à toa acaba sendo ignorado.
    const soExemplo = `${SQL}\n-- create table pedidos_de_amostra (id uuid primary key);\n`;

    expect(tabelasSemRls(soExemplo)).toEqual([]);
  });

  it('o esquema escrito no nome não engana', () => {
    // `create table public.x` com `alter table x` é o mesmo par, e reprovar isso seria falso
    // alarme. As migrations de hoje não usam prefixo, mas nada impede a próxima de usar.
    expect(
      tabelasSemRls(`
create table public.pedidos_de_amostra (id uuid primary key);
alter table pedidos_de_amostra enable row level security;
`),
    ).toEqual([]);
  });
});
