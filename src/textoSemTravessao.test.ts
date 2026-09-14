// Nenhum texto que chega a alguém usa travessão (R8-A62).
//
// A regra de escrita do dono proíbe travessão em texto em português, e pede vírgula no lugar. Na
// reauditoria da rodada 8 havia 21 literais com travessão em código de produção, entre eles a frase
// da tela de login, a ajuda do formulário de zona e mensagens de erro da API e do motor, que chegam
// a quem integra. Nada impedia um novo.
//
// O QUE conta: literal de texto, pedaço de template e texto de JSX, que é o que aparece para quem
// usa ou chega a quem integra. O que NÃO conta, e por quê:
//
// - Comentário. Não é lido por quem usa, e os comentários deste projeto são escritos para agentes.
//   É também a razão de a checagem não ser um `grep`: um `grep` fora de linhas de comentário erra
//   comentário no fim de linha e texto de JSX que quebra linha, e os dois existem aqui.
// - Arquivo de teste. Título de `describe` e `it` só aparece para quem roda o teste, e um dos
//   literais com travessão era de propósito, um SVG com caracteres fora do ASCII que prova que a API
//   não estraga texto. Desde 2026-09-14 (P03) o repositório inteiro está sem travessão, testes e
//   comentários incluídos; esta guarda continua cobrando só o que chega a alguém, que é o que quebra.
//
// Por que o parser do rolldown, e não o do TypeScript: o TypeScript deste projeto é o 7, que não
// tem API em JavaScript. O rolldown já está na árvore porque é o empacotador do Vite 8, e se ele
// sair dali este teste falha no import, alto, e não passa em silêncio.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';
import { describe, expect, it } from 'vitest';

// Montado pelo código do caractere, e não escrito, para esta guarda não ser ela mesma um travessão no repositório.
const TRAVESSAO = String.fromCharCode(0x2014);
const RAIZ = fileURLToPath(new URL('..', import.meta.url));

interface No {
  type?: unknown;
  value?: unknown;
  start?: number;
  [chave: string]: unknown;
}

/** O texto de um nó que chega a alguém, ou `null` quando o nó não é texto. */
function textoDoNo(no: No): string | null {
  if (no.type === 'Literal' && typeof no.value === 'string') return no.value;
  if (no.type === 'JSXText' && typeof no.value === 'string') return no.value;
  if (no.type === 'TemplateElement') {
    const valor = no.value as { raw?: unknown } | undefined;
    return typeof valor?.raw === 'string' ? valor.raw : '';
  }
  return null;
}

/** As linhas em que um texto que chega a alguém tem travessão. Comentário não conta. */
export function linhasComTravessao(codigo: string, lang: 'js' | 'ts' | 'tsx'): number[] {
  // Atalho honesto: sem o caractere no arquivo, não há o que o parser achar.
  if (!codigo.includes(TRAVESSAO)) return [];

  const linhas: number[] = [];
  const visitar = (valor: unknown): void => {
    if (Array.isArray(valor)) {
      valor.forEach(visitar);
      return;
    }
    if (valor === null || typeof valor !== 'object') return;

    const no = valor as No;
    const texto = textoDoNo(no);
    if (texto !== null && texto.includes(TRAVESSAO) && typeof no.start === 'number') {
      linhas.push(codigo.slice(0, no.start).split('\n').length);
    }
    for (const chave of Object.keys(no)) visitar(no[chave]);
  };
  visitar(parseAst(codigo, { lang }));

  return linhas;
}

function arquivosDeCodigo(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return nome === 'node_modules' ? [] : arquivosDeCodigo(caminho);
    return /\.(tsx?|mjs)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

/** O `.mjs` entra porque o servidor local da API escreve no terminal de quem integra. */
function linguagemDe(arquivo: string): 'js' | 'ts' | 'tsx' {
  if (arquivo.endsWith('.tsx')) return 'tsx';
  return arquivo.endsWith('.mjs') ? 'js' : 'ts';
}

describe('nenhum texto que chega a alguém usa travessão (R8-A62)', () => {
  it('zero travessão em literal e em texto de JSX de src/ e api/, fora dos testes', () => {
    // Contraprova de que o `.mjs` entrou na conta: o servidor local tinha dois `console.log` com travessão.
    expect(arquivosDeCodigo(join(RAIZ, 'api')).some((arquivo) => arquivo.endsWith('.mjs'))).toBe(true);
    const arquivos = [...arquivosDeCodigo(join(RAIZ, 'src')), ...arquivosDeCodigo(join(RAIZ, 'api'))];
    // Contraprova de que a varredura andou: uma pasta errada daria zero achados em zero arquivos.
    expect(arquivos.length).toBeGreaterThan(100);

    const achados = arquivos.flatMap((arquivo) =>
      linhasComTravessao(readFileSync(arquivo, 'utf8'), linguagemDe(arquivo)).map(
        (linha) => `${relative(RAIZ, arquivo)}:${linha}`,
      ),
    );

    expect(achados).toEqual([]);
  });
});

describe('a varredura reprova o que deve e só isso (contraprova sintética)', () => {
  it('reprova travessão num literal de texto', () => {
    expect(linhasComTravessao(`const a = 1;\nconst frase = 'uma ${TRAVESSAO} outra';`, 'ts')).toEqual([2]);
  });

  it('reprova travessão num template, dentro e em volta da interpolação', () => {
    expect(linhasComTravessao(`const f = (x: string) => \`a ${TRAVESSAO} \${x} b\`;`, 'ts')).toEqual([1]);
  });

  it('reprova travessão em texto de JSX, mesmo quebrando linha', () => {
    const codigo = `export const P = () => (\n  <p>\n    Primeira linha\n    segunda ${TRAVESSAO} linha\n  </p>\n);`;

    expect(linhasComTravessao(codigo, 'tsx')).toHaveLength(1);
  });

  it('NÃO reprova travessão em comentário de linha, de bloco ou no fim de uma linha de código', () => {
    const codigo = [
      `// linha ${TRAVESSAO} inteira`,
      `/* bloco ${TRAVESSAO} */`,
      `const a = 'limpo'; // fim ${TRAVESSAO} de linha`,
      `const P = () => <p>{/* em JSX ${TRAVESSAO} */}limpo</p>;`,
    ].join('\n');

    expect(linhasComTravessao(codigo, 'tsx')).toEqual([]);
  });

  it('NÃO reprova hífen nem meia-risca, que a regra não proíbe', () => {
    expect(linhasComTravessao(`const a = 'a - b – c';`, 'ts')).toEqual([]);
  });
});
