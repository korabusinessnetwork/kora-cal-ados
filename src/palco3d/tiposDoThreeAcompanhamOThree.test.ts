// O `@types/three` acompanha o `three`, e isso vira teste porque a divergência é INVISÍVEL.
//
// O que aconteceu para este arquivo existir: `three` estava em 0.186.0 e `@types/three` em
// ^0.185.4. Nada acusou. O `tsc --noEmit` passava verde conferindo cada chamada de three contra a
// superfície da r185, enquanto a r186 era a que rodava no navegador. `npm audit` não olha versão de
// tipo, `npm outdated` lista os dois entre nove pacotes atrasados e não diz que estes dois têm de
// andar juntos, e nenhum teste alcança o palco porque jsdom não tem WebGL.
//
// A consequência do buraco é específica e ruim: o que a versão nova tivesse renomeado ou removido
// passaria pelo typecheck, porque o typecheck estaria lendo a definição antiga, e só falharia em
// runtime, na única tela que a suíte não exercita. Ou seja, a ferramenta que existe para pegar
// exatamente esse erro estaria olhando para o lugar errado, em silêncio.
//
// Varredura de arquivo, e não de comportamento, pelo mesmo motivo de `fronteiraSemGpu.test.ts`:
// o que se protege aqui é uma disciplina, e disciplina que só existe como frase num README dura
// até a primeira pressa.
//
// A conferência é sobre a MINOR, e não sobre a versão exata: o `three` versiona o `0.x.y` com a
// quebra na minor, e o `@types/three` acompanha essa minor com a patch própria dele. Exigir
// igualdade nas três partes reprovaria um `0.186.1` de tipo que é justamente a correção esperada.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** `package.json` da raiz: dois níveis acima deste arquivo (`src/palco3d/`). */
const PACOTE = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/** `^0.186.0` vira `0.186`. Devolve `null` para faixa que este teste não sabe comparar. */
function minorDeclarada(faixa: string | undefined): string | null {
  const casou = /^\^?(\d+)\.(\d+)\./.exec(faixa ?? '');

  return casou === null ? null : `${casou[1]}.${casou[2]}`;
}

describe('os tipos do three acompanham o three', () => {
  it('as duas faixas declaradas apontam para a mesma minor', () => {
    const runtime = minorDeclarada(PACOTE.dependencies?.three);
    const tipos = minorDeclarada(PACOTE.devDependencies?.['@types/three']);

    // Falha explícita em vez de `null === null` passando: faixa que este teste não sabe ler é
    // motivo para reescrever o teste, nunca para ele ficar verde sem ter comparado nada.
    expect(runtime).not.toBeNull();
    expect(tipos).not.toBeNull();
    expect(tipos).toBe(runtime);
  });

  it('o que está instalado bate com o que está declarado', () => {
    // A faixa `^` deixa o lockfile resolver uma patch adiante, o que é desejado. O que não pode é
    // a minor instalada divergir, que é o estado exato em que este projeto esteve.
    const versao = (caminho: string) =>
      (JSON.parse(readFileSync(new URL(caminho, import.meta.url), 'utf8')) as { version: string })
        .version;

    const runtime = minorDeclarada(versao('../../node_modules/three/package.json'));
    const tipos = minorDeclarada(versao('../../node_modules/@types/three/package.json'));

    // Mesma razão do teste acima: dois `null` iguais passariam sem ter comparado versão nenhuma.
    expect(runtime).not.toBeNull();
    expect(tipos).toBe(runtime);
  });
});
