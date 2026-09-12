// Citação de ADR que aponta para decisão inexistente vira teste vermelho.
//
// Nasceu de uma citação errada de verdade, achada na rodada 5: quatro lugares do palco 3D
// afirmavam que "a composição não é gravada em banco (ADR-008 D6)", e o D6 do ADR-008 é "Acervo
// base é da Kora; acervo do tenant é privado, sob RLS". Não fala de composição nem de persistência.
// A decisão citada não existia com aquele número, e nem com número nenhum.
//
// O perigo não é a feiura. O `CLAUDE.md` decide conflito assim, em letra: "se doc e código
// conflitarem, a documentação prevalece". Um agente que fosse mexer naquilo leria o D6, não acharia
// decisão nenhuma sobre persistir composição, e a conclusão razoável dele seria que o CÓDIGO está
// errado e a composição deveria ser gravada. A citação errada não confundia: ela apontava para a
// conclusão oposta à verdadeira, e o mecanismo de resolver conflito do projeto a obedecia.
//
// A varredura pega a metade MECÂNICA: número que não existe naquele ADR. A metade semântica,
// número que existe mas fala de outra coisa, continua sendo leitura humana e este teste não a
// promete. Meia guarda dita por inteiro vale mais que uma guarda inteira prometida e falsa.
//
// Mora aqui, junto dos ADRs, e não em `src/`, pelo mesmo motivo de
// `supabase/migrations/rlsEmTodaTabela.test.ts`: a guarda fica ao lado da autoridade que ela lê.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PASTA_DOS_ADRS = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

/** Onde o código mora. `docs/` fica de fora: lá a citação é prosa, e prosa se corrige lendo. */
const ARVORES = ['src', 'api', 'supabase'];

/** Arquivos que o projeto escreve à mão. `node_modules` e `dist` nunca entram. */
const EXTENSOES = ['.ts', '.tsx', '.css', '.sql', '.md', '.mjs'];

/**
 * Os números de decisão que um ADR realmente tem.
 *
 * Duas grafias, porque os ADRs usam duas, e exigir uma só transformaria o outro estilo em falso
 * alarme permanente, que é como uma guarda vira ruído e depois vira comentário desligado:
 *
 * - cabeçalho `### D1`, de ADR-005 a ADR-009. O ADR-009 escreve `### D1.` com ponto no lugar do
 *   travessão, e é por isso que o casamento para no número em vez de exigir o que vem depois.
 * - linha de tabela `| 1 |`, do ADR-004, que numera as decisões do dono numa tabela
 *   (`| # | Questão | Decisão | Onde está no código |`) em vez de dar um cabeçalho a cada uma.
 *   Hoje o ADR-004 é o único arquivo desta pasta com tabela numerada assim, então não há como
 *   confundir a tabela de decisões com outra.
 */
export function decisoesDoAdr(texto: string): Set<string> {
  const porCabecalho = [...texto.matchAll(/^#{2,4}\s*D(\d+)\b/gim)].map((achado) => achado[1] ?? '');
  const porTabela = [...texto.matchAll(/^\|\s*(\d+)\s*\|/gm)].map((achado) => achado[1] ?? '');

  return new Set([...porCabecalho, ...porTabela]);
}

/**
 * As citações `ADR-XXX DN` de um texto, na ordem em que aparecem.
 *
 * Aceita as separações que o projeto já escreve: `ADR-006 D1`, `ADR-006, D1` e `ADR-006 (D1`. O que
 * varia é pontuação de frase, não a citação, e obrigar uma forma só faria este teste reprovar
 * português correto.
 */
export function citacoesDoTexto(texto: string): { adr: string; decisao: string }[] {
  return [...texto.matchAll(/ADR-(\d{3})[\s,(]+D(\d+)\b/g)].map((achado) => ({
    adr: achado[1] ?? '',
    decisao: achado[2] ?? '',
  }));
}

/** Toda citação que não resolve para uma decisão existente naquele ADR. */
export function citacoesQuebradas(
  texto: string,
  decisoesPorAdr: Map<string, Set<string>>,
): string[] {
  return citacoesDoTexto(texto)
    .filter(({ adr, decisao }) => !(decisoesPorAdr.get(adr)?.has(decisao) ?? false))
    .map(({ adr, decisao }) => `ADR-${adr} D${decisao}`);
}

function lerAdrs(): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();

  for (const nome of readdirSync(PASTA_DOS_ADRS)) {
    const numero = /^adr-(\d{3})-/.exec(nome)?.[1];
    if (numero === undefined) continue;

    mapa.set(numero, decisoesDoAdr(readFileSync(join(PASTA_DOS_ADRS, nome), 'utf8')));
  }

  return mapa;
}

function arquivosDoCodigo(): string[] {
  const achados: string[] = [];

  function descer(pasta: string) {
    for (const entrada of readdirSync(pasta)) {
      if (entrada === 'node_modules' || entrada === 'dist') continue;

      const caminho = join(pasta, entrada);
      if (statSync(caminho).isDirectory()) descer(caminho);
      else if (EXTENSOES.some((fim) => entrada.endsWith(fim))) achados.push(caminho);
    }
  }

  for (const arvore of ARVORES) descer(join(RAIZ, arvore));

  return achados;
}

describe('toda citação de ADR aponta para decisão que existe (A45)', () => {
  const DECISOES = lerAdrs();
  const ARQUIVOS = arquivosDoCodigo();

  it('os ADRs foram lidos, e as decisões deles foram encontradas', () => {
    // Contraprova: sem isto, uma leitura que devolvesse zero decisão por qualquer motivo (pasta
    // renomeada, cabeçalho mudado) deixaria TODAS as citações quebradas ou, dependendo do sinal,
    // todas válidas. Um mapa vazio é o jeito mais fácil de esta varredura virar decoração.
    expect(DECISOES.get('008')).toEqual(new Set(['1', '2', '3', '4', '5', '6', '7']));
    // O ADR-004 é o da tabela, e é ele que prova que a segunda grafia está sendo lida.
    expect(DECISOES.get('004')?.has('1')).toBe(true);
    // O ADR-009 é o que escreve `### D1.` com ponto.
    expect(DECISOES.get('009')?.has('5')).toBe(true);
  });

  it('o código de verdade tem citações, e nenhuma delas está quebrada', () => {
    const quebradas = ARQUIVOS.flatMap((caminho) => {
      const texto = readFileSync(caminho, 'utf8');

      return citacoesQuebradas(texto, DECISOES).map(
        (citacao) => `${caminho.slice(RAIZ.length)}: ${citacao}`,
      );
    });

    expect(quebradas).toEqual([]);
    // E a contraprova de que o varredor achou arquivo e citação, senão "nenhuma quebrada" seria
    // verdade sobre um conjunto vazio.
    expect(ARQUIVOS.length).toBeGreaterThan(50);
    expect(
      ARQUIVOS.some((caminho) => citacoesDoTexto(readFileSync(caminho, 'utf8')).length > 0),
    ).toBe(true);
  });

  it('uma citação inventada reprova', () => {
    // O ADR-008 vai até D7. O D9 é o tipo exato do defeito que existia: número plausível, ADR que
    // existe, decisão que não.
    expect(citacoesQuebradas('a composição é gravada (ADR-008 D9)', DECISOES)).toEqual([
      'ADR-008 D9',
    ]);
  });

  it('as três pontuações que o projeto escreve são aceitas', () => {
    // `ADR-006 D1`, `ADR-006, D1` e `ADR-006 (D1` aparecem todas no código de hoje. Reprovar
    // qualquer uma seria reprovar português correto, e uma guarda que reclama do certo é desligada.
    expect(citacoesQuebradas('ADR-006 D1 e ADR-006, D1 e ADR-006 (D1)', DECISOES)).toEqual([]);
  });

  it('não confunde o ADR citado: o D6 existe no 008 e não no 006', () => {
    // Sem esta, a varredura poderia estar juntando as decisões de todos os ADRs num monte só, e
    // aí qualquer número que existisse em qualquer ADR passaria em todos.
    expect(citacoesQuebradas('ADR-008 D6', DECISOES)).toEqual([]);
    expect(citacoesQuebradas('ADR-006 D6', DECISOES)).toEqual(['ADR-006 D6']);
  });

  it('ADR que não existe reprova junto', () => {
    expect(citacoesQuebradas('ADR-042 D1', DECISOES)).toEqual(['ADR-042 D1']);
  });
});
