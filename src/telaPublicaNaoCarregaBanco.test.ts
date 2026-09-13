// O cliente de banco não pode voltar para o chunk que todo mundo baixa.
//
// O que esta varredura protege é uma medida, não um gosto: antes do R6-A52 o
// `@supabase/supabase-js` inteiro, com o cliente de realtime junto, estava no chunk principal, e
// quem abria `?tela=esboco` num clone recém-baixado pagava por um cliente de banco que aquela tela
// nunca ia usar. Tirá-lo de lá cortou o chunk principal de 458,98 kB para 218,97 kB (133,45 kB para
// 70,15 kB em gzip), e a metade que saiu é exatamente a parte que só a área logada usa.
//
// Por que a guarda é sobre os IMPORTS de `App.tsx` e não sobre o tamanho do arquivo gerado: o
// número do build depende de versão de dependência, de minificador e de hash de arquivo, e um teste
// que reprova quando o rolldown muda de versão é um teste que alguém desliga. O que causa a
// regressão é sempre a mesma linha: um `import` comum de `features/` ou de `lib/supabase/` no topo
// do `App.tsx`. É essa linha que esta varredura proíbe, e é por isso que ela não precisa de
// `npm run build` para rodar.
//
// A checagem é textual de propósito, no mesmo molde de `api/_lib/apiNaoImportaOFront.test.ts`: ela
// pega o import mesmo que nenhum teste execute a linha, e comentários são descontados, porque este
// arquivo e o próprio `App.tsx` citam os caminhos proibidos em prosa.
//
// O que ela NÃO promete: que o chunk esteja pequeno. Uma dependência nova e pesada importada
// diretamente pelo `App.tsx` passaria por aqui sem reclamar. O número do chunk é conferido a cada
// rodada no `BASELINE.md`, e quem faz esse trabalho é o olho, não este arquivo.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP = fileURLToPath(new URL('./App.tsx', import.meta.url));

/** Remove comentários: a proibição é sobre import, não sobre citar o caminho proibido. */
export function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

/**
 * Os módulos importados de forma ESTÁTICA, que são os únicos que entram no chunk de quem importa.
 *
 * O `import()` dinâmico fica de fora de propósito, e é a diferença que dá sentido a esta varredura:
 * ele é justamente o jeito CERTO de a área protegida entrar. Uma guarda que proibisse os dois
 * reprovaria o conserto que ela existe para defender.
 */
export function importesEstaticos(codigo: string): string[] {
  const limpo = semComentarios(codigo);

  return [...limpo.matchAll(/\bimport\s+(?:[^'"()]*?\bfrom\s*)?['"]([^'"]+)['"]/g)].map(
    (achado) => achado[1] ?? '',
  );
}

/** O que arrasta o `@supabase/supabase-js` junto, direta ou indiretamente. */
export function importesQueTrazemOBanco(codigo: string): string[] {
  return importesEstaticos(codigo).filter(
    (modulo) =>
      modulo.includes('features/') ||
      modulo.includes('lib/supabase') ||
      modulo.includes('@supabase/'),
  );
}

describe('o cliente de banco fica fora do chunk principal (A52)', () => {
  const CODIGO = readFileSync(APP, 'utf8');

  it('o `App.tsx` não importa `features/` nem `lib/supabase/` de forma estática', () => {
    expect(importesQueTrazemOBanco(CODIGO)).toEqual([]);
  });

  it('e continua importando o que é dele, senão a varredura não estaria lendo nada', () => {
    // Contraprova: sem isto, um caminho errado, um arquivo vazio ou uma expressão regular que
    // parasse de casar deixariam a lista proibida vazia para sempre, e a guarda viraria enfeite.
    const estaticos = importesEstaticos(CODIGO);

    expect(estaticos).toContain('react');
    expect(estaticos).toContain('./esboco/EsbocoDoEditor');
    expect(estaticos).toContain('./RodapeDeTelas');
  });

  it('a área protegida entra por `import()` tardio, e o texto dela está lá', () => {
    // O outro lado do par: a área não pode ter sumido. Se alguém apagar o `lazy`, o primeiro teste
    // continuaria verde sobre um app sem área logada nenhuma.
    expect(CODIGO).toContain("import('./features/AreaProtegida')");
    expect(CODIGO).toContain("import('./palco3d/TelaDoPalco3d')");
    expect(CODIGO).toContain("import('./palco3d/TelaDaComposicao')");
  });

  it('um import estático de `features/` REPROVA, e o dinâmico não', () => {
    // As duas contraprovas sintéticas, no mesmo teste porque são a mesma afirmação vista dos dois
    // lados: o que reprova é o import que entra no chunk, não a menção ao caminho.
    expect(
      importesQueTrazemOBanco("import { TelaDeProdutos } from './features/produtos/TelaDeProdutos';"),
    ).toEqual(['./features/produtos/TelaDeProdutos']);
    expect(importesQueTrazemOBanco("import { createClient } from '@supabase/supabase-js';")).toEqual(
      ['@supabase/supabase-js'],
    );
    expect(importesQueTrazemOBanco("const A = lazy(() => import('./features/AreaProtegida'));")).toEqual(
      [],
    );
  });

  it('caminho proibido escrito em comentário não reprova', () => {
    // Senão a explicação da regra, que o projeto escreve em comentário por norma, derrubaria a
    // própria regra, e o conserto seria apagar a explicação.
    expect(importesQueTrazemOBanco("// não importe './features/sessao/useSessao' aqui")).toEqual([]);
    expect(importesQueTrazemOBanco("/* import x from '@supabase/supabase-js' */")).toEqual([]);
  });
});
