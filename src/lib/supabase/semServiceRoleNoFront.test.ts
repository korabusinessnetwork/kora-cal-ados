// Varredura de `src/`: nada que vai para o bundle do navegador pode tocar a service_role.
//
// Existe como teste, e não como revisão de código, porque é a falha mais cara possível do
// projeto e a mais fácil de introduzir sem querer, um `import` de `supabase/tests/`
// "só para reusar o helper" bastaria. A service_role ignora RLS: no navegador ela
// entregaria o banco inteiro, incluindo os tenants concorrentes, a qualquer visitante.
//
// A checagem é textual de propósito: pega o caso mesmo quando o código não é executado
// por nenhum outro teste. Comentários são descontados, explicar por que a service_role
// é proibida é justamente o que os READMEs e comentários deste projeto devem fazer.

import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = 'src';
const EXTENSOES = new Set(['.ts', '.tsx']);

function arquivosDeFonte(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivosDeFonte(caminho);
    return EXTENSOES.has(extname(entrada.name)) ? [caminho] : [];
  });
}

/** Remove comentários: a proibição é sobre código, não sobre explicar a regra. */
function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

/**
 * `configuracaoDoSupabase.ts` é o ÚNICO que pode citar o termo em código: é ele que
 * recusa a chave errada, e para recusar precisa nomeá-la. O teste dele idem.
 */
const ISENTOS = new Set([
  join('src', 'lib', 'supabase', 'configuracaoDoSupabase.ts'),
  join('src', 'lib', 'supabase', 'configuracaoDoSupabase.test.ts'),
  join('src', 'lib', 'supabase', 'semServiceRoleNoFront.test.ts'),
]);

const fontes = arquivosDeFonte(RAIZ)
  .filter((caminho) => !ISENTOS.has(caminho))
  .map((caminho) => ({ caminho, conteudo: semComentarios(readFileSync(caminho, 'utf8')) }));

describe('a service_role nunca chega ao navegador', () => {
  it('nenhum arquivo de src/ menciona SERVICE_ROLE', () => {
    const culpados = fontes
      .filter(({ conteudo }) => /SERVICE_ROLE|service_role/.test(conteudo))
      .map(({ caminho }) => caminho);

    expect(culpados).toEqual([]);
  });

  it('nenhum arquivo de src/ importa de supabase/ (onde a service_role vive)', () => {
    // `supabase/tests/ambiente.ts` cria usuário com poder de admin. Importar de lá
    // arrastaria a chave para o bundle junto com o helper.
    const culpados = fontes
      .filter(({ conteudo }) => /from\s+['"][^'"]*\.\.\/supabase\//.test(conteudo))
      .map(({ caminho }) => caminho);

    expect(culpados).toEqual([]);
  });

  it('só `configuracaoDoSupabase.ts` lê variável de ambiente do Supabase', () => {
    // Um ponto de leitura só é o que torna a recusa da chave errada inescapável: quem
    // ler `import.meta.env` direto pula a validação inteira.
    const culpados = fontes
      .filter(({ conteudo }) => /import\.meta\.env/.test(conteudo))
      .map(({ caminho }) => caminho);

    expect(culpados).toEqual([]);
  });

  it('nenhum arquivo de src/ lê `process.env`', () => {
    // Este caso passou a ser necessário quando o `tsconfig.json` ganhou `"node"` em
    // `types` (para `api/` compilar): `process.env` COMPILA dentro de `src/` desde então.
    // Antes o compilador recusava; agora aceita, e quem segura isto é esta varredura.
    //
    // O front lê ambiente por `import.meta.env.VITE_*`. Um `process.env` em `src/` vira
    // `undefined` no navegador, falha silenciosa, sem erro nenhum, ou, se algum bundler
    // o substituir, embute no bundle uma variável sem prefixo `VITE_`, ou seja, uma que
    // nunca foi pensada como pública. É por aí que a service_role entraria sem a palavra
    // `service_role` aparecer em lugar nenhum.
    const culpados = fontes
      .filter(({ conteudo }) => /process\.env/.test(conteudo))
      .map(({ caminho }) => caminho);

    expect(culpados).toEqual([]);
  });

  it('a varredura está mesmo olhando os arquivos (canário)', () => {
    // Sem isto, um erro no caminho da pasta faria os quatro testes acima passarem sempre.
    expect(fontes.length).toBeGreaterThan(20);
    expect(fontes.some(({ caminho }) => caminho.includes('cliente.ts'))).toBe(true);
  });
});
