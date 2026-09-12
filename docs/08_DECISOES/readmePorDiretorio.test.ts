// Diretório com código e sem `README.md` vira teste vermelho.
//
// A regra é do ADR-003 e está no `CLAUDE.md` em letra: "todo diretório novo ganha um README.md de
// índice". Ela existe porque este projeto é mantido só por agentes, que reconstroem o contexto do
// zero a cada sessão: o índice é o que evita adivinhar onde algo mora, e um diretório sem índice
// cobra essa adivinhação de todo mundo que passar por ali depois.
//
// Por que virou varredura: quem furou a regra duas vezes seguidas fui eu, o autor dela. Na rodada
// 4 nasceu `src/lib/copia/` sem índice, e na rodada 5 a varredura de RLS foi parar em
// `supabase/migrations/` sem índice nenhum ao lado. Regra que o próprio autor fura duas vezes em
// duas rodadas não é regra frouxa, é regra sem guarda, e este projeto já tem duas guardas do mesmo
// feitio funcionando (A41, a RLS, e A45, as citações de ADR).
//
// O que ela pega: diretório que TEM arquivo de código e NÃO tem `README.md`. O que ela não
// promete: que o índice esteja bom, atualizado ou verdadeiro. Isso continua sendo leitura humana, e
// meia guarda dita por inteiro vale mais que uma guarda inteira prometida e falsa.
//
// Diretório vazio não entra, e é de propósito: uma cópia de trabalho antiga ainda tem as pastas de
// andaime (`src/components/`, `src/hooks/`, `src/pages/`...) que nunca foram versionadas porque
// nunca receberam arquivo. Cobrar índice de pasta vazia faria esta varredura reprovar numa máquina
// e passar noutra, a partir do mesmo commit, que é o jeito mais rápido de uma guarda perder a
// autoridade. No instante em que uma delas receber o primeiro arquivo, ela entra na conta.
//
// Mora aqui, junto dos ADRs, pelo mesmo motivo de `citacoesDeAdrExistem.test.ts` e de
// `supabase/migrations/rlsEmTodaTabela.test.ts`: a guarda fica ao lado da autoridade que ela lê.

import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

/**
 * O que conta como código para efeito de índice.
 *
 * `.md` fica de fora de propósito: uma pasta só de documento é o próprio índice, e incluir `.md`
 * faria cada pasta de `docs/` precisar de um `README.md` para explicar os `.md` ao lado. `.svg` e
 * `.json` também ficam de fora: são dado, e dado acompanha o código que o lê.
 */
const EXTENSOES_DE_CODIGO = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.sql', '.html'];

/** O que nunca é do projeto: dependência, saída de build e tudo o que começa com ponto. */
function eDeFora(nome: string): boolean {
  return nome === 'node_modules' || nome === 'dist' || nome.startsWith('.');
}

/** Este diretório tem arquivo de código escrito à mão? */
export function temCodigo(entradas: readonly string[]): boolean {
  return entradas.some((nome) => EXTENSOES_DE_CODIGO.some((fim) => nome.endsWith(fim)));
}

/**
 * Os diretórios com código de uma árvore, cada um com a resposta de se ele tem índice.
 *
 * Devolve os dois lados, e não só a lista de faltantes, porque "nenhum faltando" precisa ser
 * afirmado sobre um conjunto que se sabe grande. Uma varredura que devolve lista vazia porque não
 * achou diretório nenhum passaria em silêncio para sempre.
 */
export function diretoriosComCodigo(raiz: string): { caminho: string; temIndice: boolean }[] {
  const achados: { caminho: string; temIndice: boolean }[] = [];

  function descer(pasta: string, relativo: string) {
    const entradas = readdirSync(pasta);

    if (temCodigo(entradas)) {
      achados.push({ caminho: relativo === '' ? '.' : relativo, temIndice: entradas.includes('README.md') });
    }

    for (const nome of entradas) {
      if (eDeFora(nome)) continue;

      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) descer(caminho, relativo === '' ? nome : `${relativo}/${nome}`);
    }
  }

  descer(raiz, '');

  return achados;
}

/** Só os que estão sem índice, que é a lista que o teste mostra quando reprova. */
export function diretoriosSemIndice(raiz: string): string[] {
  return diretoriosComCodigo(raiz)
    .filter(({ temIndice }) => !temIndice)
    .map(({ caminho }) => caminho);
}

/** As árvores de mentira criadas pelos testes, apagadas no fim. */
const descartaveis: string[] = [];

/** Uma árvore de mentira, para a contraprova ser feita pela MESMA função que varre a de verdade. */
function arvoreDeMentira(comIndice: boolean): string {
  const raiz = mkdtempSync(join(tmpdir(), 'kora-readme-'));
  const pasta = join(raiz, 'recem-nascido');

  mkdirSync(pasta);
  writeFileSync(join(pasta, 'algumaCoisa.ts'), 'export const x = 1;\n');
  if (comIndice) writeFileSync(join(pasta, 'README.md'), '# recem-nascido\n');

  descartaveis.push(raiz);

  return raiz;
}

afterAll(() => {
  for (const raiz of descartaveis) rmSync(raiz, { recursive: true, force: true });
});

describe('todo diretório com código tem README.md (A42)', () => {
  const VARRIDOS = diretoriosComCodigo(RAIZ);

  it('a varredura achou a árvore de verdade, e não um punhado de nada', () => {
    // Contraprova do teste seguinte: sem isto, uma varredura que não descesse em pasta nenhuma
    // (caminho errado, `readdirSync` mudando de forma) devolveria "nenhum faltando" e o projeto
    // inteiro poderia ficar sem índice sem ninguém ver vermelho.
    const caminhos = VARRIDOS.map(({ caminho }) => caminho);

    expect(VARRIDOS.length).toBeGreaterThan(15);
    // A raiz conta: ela tem `vite.config.ts` e `index.html`. Foi por ela existir na lista que este
    // item escreveu o `README.md` da raiz, e é por isso que esta varredura não precisa de lista de
    // exceção nenhuma. Lista de exceção é onde uma regra vai morrer devagar.
    expect(caminhos).toContain('.');
    expect(caminhos).toContain('src');
    expect(caminhos).toContain('api/_lib');
    expect(caminhos).toContain('supabase/migrations');
    // E as duas árvores que só apareceram na conta desta rodada.
    expect(caminhos).toContain('src/features/zonas/hooks');
    expect(caminhos).toContain('src/lib/render/fixtures');
  });

  it('e nenhum deles está sem índice', () => {
    expect(diretoriosSemIndice(RAIZ)).toEqual([]);
  });

  it('um diretório novo com código e sem índice REPROVA', () => {
    // A contraprova sintética, feita pela mesma função que varre o projeto. Sem ela, as duas
    // afirmações acima continuariam verdadeiras se `temCodigo` passasse a devolver `false` sempre.
    expect(diretoriosSemIndice(arvoreDeMentira(false))).toEqual(['recem-nascido']);
  });

  it('o mesmo diretório, com índice, passa', () => {
    // O outro lado do par: prova que o que reprova é a ausência do `README.md`, e não o fato de a
    // pasta ser nova, ter aquele nome ou estar fora do projeto.
    expect(diretoriosSemIndice(arvoreDeMentira(true))).toEqual([]);
  });

  it('diretório vazio não é cobrado, e `.md` sozinho não é código', () => {
    // As duas decisões que separam esta guarda de um alarme falso permanente: as pastas de andaime
    // não versionadas de uma cópia antiga, e as pastas de `docs/` que são só documento.
    expect(temCodigo([])).toBe(false);
    expect(temCodigo(['visao-do-produto.md', 'glossario.md'])).toBe(false);
    expect(temCodigo(['acervoDeTeste.ts'])).toBe(true);
    expect(temCodigo(['palco3d.css'])).toBe(true);
    expect(temCodigo(['20260812_schema_inicial.sql'])).toBe(true);
  });
});
