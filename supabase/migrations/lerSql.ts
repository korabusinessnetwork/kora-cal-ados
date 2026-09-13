// Leitura de TEXTO de migration, para as guardas que moram nesta pasta.
//
// Por que existe um módulo e não uma cópia em cada teste: `rlsEmTodaTabela.test.ts` e
// `indiceEmChaveEstrangeira.test.ts` precisam das mesmas duas respostas, "o SQL sem comentário" e
// "o nome sem esquema", e duas implementações de cortar comentário de SQL é exatamente o tipo de
// par que diverge em silêncio. Quando divergir, uma guarda passa a enxergar um `create table` que
// a outra não enxerga, e a diferença aparece como guarda verde, que é o pior jeito de aparecer.
//
// Não é arquivo de teste, e isso é de propósito: importar um `.test.ts` de outro faz o vitest
// registrar os `describe` do importado dentro do arquivo que importou, e os mesmos testes passam a
// rodar duas vezes com dois nomes de arquivo.

/**
 * O texto sem comentário nenhum.
 *
 * Corta nos dois sentidos, e os dois importam. Um `-- create table pedidos` de exemplo dentro de
 * um comentário viraria tabela inexistente sem RLS, e a guarda reclamaria de nada. Pior: um
 * comentário explicando "alter table pedidos enable row level security" faria uma tabela DE
 * VERDADE passar por protegida sem uma linha de SQL ter sido escrita.
 */
export function semComentarios(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

/** `public.tenants` e `tenants` são a mesma tabela. O que interessa é o nome depois do ponto. */
export function semEsquema(nome: string): string {
  return nome.includes('.') ? (nome.split('.').pop() ?? nome) : nome;
}
