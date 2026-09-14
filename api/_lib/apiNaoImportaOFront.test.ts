// Varredura de `api/`: o que a função serverless pode importar do front, e o que não pode.
//
// Existe como teste, e não como revisão de código, porque o erro que ela pega é INVISÍVEL
// na leitura. `api/` roda com `service_role`, que bypassa a RLS: aqui o Postgres não guarda
// mais nada, e o isolamento entre marcas concorrentes passa a ser deste código
// (`api/README.md`). Código de `src/` foi escrito sob a hipótese oposta, que a RLS filtra
// por trás. Reusado aqui, ele roda sem filtro nenhum e continua parecendo correto.
//
// A checagem é textual de propósito: pega o import mesmo que nenhum teste execute a linha.
// Comentários são descontados, explicar a regra é o que os READMEs deste projeto fazem.

import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = 'api';
const EXTENSOES = new Set(['.ts', '.tsx']);

function arquivosDeFonte(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivosDeFonte(caminho);
    return EXTENSOES.has(extname(entrada.name)) ? [caminho] : [];
  });
}

/** Remove comentários: a proibição é sobre import, não sobre citar o caminho proibido. */
function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

/**
 * Todo módulo citado no arquivo: `from '…'`, `import '…'` de efeito colateral e
 * `import('…')` dinâmico. Vale ler os três, o dinâmico é justamente por onde alguém
 * contornaria uma varredura que só olhasse `from`.
 */
function modulosImportados(codigo: string): string[] {
  return [...codigo.matchAll(/(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'"]+)['"]/g)].map(
    (achado) => achado[1] ?? '',
  );
}

/** O próprio arquivo cita os caminhos proibidos em `string`, montado para não se pegar. */
const ISENTOS = new Set([join('api', '_lib', 'apiNaoImportaOFront.test.ts')]);

const fontes = arquivosDeFonte(RAIZ)
  .filter((caminho) => !ISENTOS.has(caminho))
  .map((caminho) => ({
    caminho,
    modulos: modulosImportados(semComentarios(readFileSync(caminho, 'utf8'))),
  }));

/** `…/src/qualquer-coisa`, venha por `../../src/` ou por caminho mais fundo. */
const DE_SRC = /(?:^|\/)src\//;
const DO_MOTOR = /(?:^|\/)src\/lib\/render\//;

/**
 * A allowlist do que `api/` pode importar de `src/`, e o motivo de cada item. Ela cresce por
 * DECISÃO escrita, nunca porque um import ficou vermelho: o item entra aqui junto do porquê de ele
 * ser seguro sob `service_role`, que é a hipótese que o resto de `src/` não respeita.
 *
 * - `src/lib/render/`, o motor. Duas implementações do recolor divergem, e a cor do editor deixaria
 *   de ser a cor da API (princípio nº1 do projeto).
 * - `src/lib/modeloDeLinguagem/`, as regras dos fornecedores (D13). Puro: lista de fornecedores,
 *   guarda do endereço da API própria, custo e resumo do gasto. Não toca banco, não assume RLS nem
 *   sessão. Duplicar em `api/` faria o servidor chamar um endereço que a tela não mostrou.
 */
const PERMITIDOS_DE_SRC = [DO_MOTOR, /(?:^|\/)src\/lib\/modeloDeLinguagem\//];

const ehPermitido = (modulo: string) => PERMITIDOS_DE_SRC.some((permitido) => permitido.test(modulo));

function culpadosQueImportam(proibido: RegExp): string[] {
  return fontes
    .filter(({ modulos }) => modulos.some((modulo) => proibido.test(modulo)))
    .map(({ caminho }) => caminho);
}

describe('api/ não importa o front', () => {
  it('nenhum arquivo de api/ importa src/features/', () => {
    const culpados = culpadosQueImportam(/(?:^|\/)src\/features\//);

    expect(
      culpados,
      'Um arquivo de api/ importou src/features/. Perigo concreto: ' +
        '`src/features/zonas/listarZonasDoProduto.ts` NÃO filtra por tenant_id de propósito ' +
        '(o comentário dele diz: quem recusa é a RLS). Sob service_role não existe RLS, ' +
        'então reusar aquela função entrega as zonas de uma marca ao sistema de outra, e o ' +
        'código continua parecendo correto na leitura. Use o par com filtro explícito de ' +
        'tenant em api/_lib/.',
    ).toEqual([]);
  });

  it('nenhum arquivo de api/ importa src/lib/supabase/', () => {
    const culpados = culpadosQueImportam(/(?:^|\/)src\/lib\/supabase\//);

    expect(
      culpados,
      'Um arquivo de api/ importou src/lib/supabase/. Aquele cliente é o do navegador: ' +
        'chave anon, sessão do usuário, e toda consulta filtrada pela RLS. Usado aqui ele ' +
        'devolveria vazio em tudo (não há usuário autenticado), e a API responderia 404 ' +
        'para produto que existe. O cliente desta função é api/_lib/clienteDeServico.ts.',
    ).toEqual([]);
  });

  it('de src/, api/ só importa o que está na allowlist', () => {
    const culpados = fontes
      .filter(({ modulos }) => modulos.some((m) => DE_SRC.test(m) && !ehPermitido(m)))
      .map(({ caminho }) => caminho);

    expect(
      culpados,
      'Um arquivo de api/ importou de src/ algo que não está na allowlist (hoje o motor e ' +
        'src/lib/modeloDeLinguagem/). A lista é curta porque o resto de src/ foi escrito ' +
        'assumindo RLS e sessão de usuário; aqui não há nem uma nem outra, e a hipótese ' +
        'quebrada não aparece em nenhum teste de unidade, aparece como dado de um tenant ' +
        'saindo na resposta de outro. Item novo entra com o motivo escrito em PERMITIDOS_DE_SRC.',
    ).toEqual([]);
  });

  it('a allowlist não deixa passar o que ela não cita', () => {
    // Contraprova da própria lista: sem isto, uma regex frouxa demais (um `src/lib/` inteiro,
    // por exemplo) passaria despercebida e o teste acima ficaria verde para sempre.
    for (const proibido of [
      '../../src/features/zonas/listarZonasDoProduto',
      '../../src/lib/supabase/cliente',
      '../../src/lib/composicao/validarComposicao',
      '../../src/lib/acervo/acervoDeProva',
    ]) {
      expect(ehPermitido(proibido), proibido).toBe(false);
    }
    expect(ehPermitido('../../src/lib/modeloDeLinguagem/calcularCustoEstimado')).toBe(true);
    expect(ehPermitido('../../src/lib/render/erros')).toBe(true);
  });

  it('api/ importa o motor de src/lib/render/ (obrigatório, não só permitido)', () => {
    // O outro lado da regra: se um dia api/ parar de importar o motor, é porque alguém
    // copiou o recolor para cá. Duas implementações divergem, e a cor do editor deixa de
    // ser a cor da API, o princípio nº1 do projeto quebrado por construção.
    const importamOMotor = fontes.filter(({ modulos }) => modulos.some((m) => DO_MOTOR.test(m)));

    expect(
      importamOMotor.map(({ caminho }) => caminho).length,
      'Nenhum arquivo de api/ importa src/lib/render/. Ou o motor foi copiado para dentro ' +
        'de api/ (duas implementações do recolor divergem, e a cor do editor deixa de ser a ' +
        'cor da API), ou a varredura parou de enxergar os imports.',
    ).toBeGreaterThan(0);
  });

  it('a varredura está mesmo olhando os arquivos (canário)', () => {
    // Sem isto, um erro no caminho da pasta faria os testes acima passarem sempre.
    expect(fontes.length).toBeGreaterThan(3);
    expect(fontes.some(({ caminho }) => caminho.endsWith('tiposDaApi.ts'))).toBe(true);
    // E que a leitura de import funciona: tiposDaApi.ts importa o motor, é o caso conhecido.
    expect(fontes.flatMap(({ modulos }) => modulos)).toContain('../../src/lib/render/erros');
  });
});
