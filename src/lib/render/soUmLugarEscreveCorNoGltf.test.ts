// Varredura de `src/` e `api/`: a conversão sRGB→linear mora em UM arquivo, e a cor só é escrita
// no glTF a partir de UM arquivo (ADR-007, decisão 3).
//
// Existe como teste, e não como revisão de código, porque o defeito que ela impede é o mais
// silencioso do projeto. Uma segunda conversão escrita em outro lugar, provavelmente `c / 255`
// porque parece óbvio, não quebra nada: ela produz uma cor plausível, alguns tons mais clara. O
// editor mostraria uma, a API entregaria outra, os dois com 200, e a divergência só apareceria
// quando o cliente comparasse o calçado fabricado com o Pantone. Nenhum teste de comportamento
// pega isso, porque cada metade está "certa" isolada.
//
// A checagem é textual de propósito: pega o caso mesmo em código que nenhum outro teste executa.
// Comentários são descontados antes de comparar, porque explicar a regra é exatamente o que os
// comentários deste projeto devem fazer (aprendizado de 2026-09-08: guarda que lê prosa passa em
// falso, e o modo de falha é invisível).

import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZES = ['src', 'api'];
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
 * Produção é o que pode chegar ao cliente. Teste é o `.test.ts` **e** o que vive em `fixtures/`:
 * um construtor de modelo de teste existe para escrever cor em `baseColorFactor`, é essa a função
 * dele, e ele nunca é importado por código de produção. Tratá-lo como produção transformaria a
 * guarda numa que só sabe reclamar do próprio andaime.
 */
const ehApoioDeTeste = (caminho: string) =>
  /\.test\.tsx?$/.test(caminho) || caminho.includes(`${join('', 'fixtures', '')}`);

const fontes = RAIZES.flatMap(arquivosDeFonte).map((caminho) => ({
  caminho,
  conteudo: semComentarios(readFileSync(caminho, 'utf8')),
}));

const producao = fontes.filter(({ caminho }) => !ehApoioDeTeste(caminho));

const CONVERSOR = join('src', 'lib', 'render', 'corSrgbLinear.ts');
const MOTOR_3D = join('src', 'lib', 'render', 'recolorirModelo3d.ts');

describe('a curva do sRGB existe em um lugar só', () => {
  it('as constantes da curva não aparecem em nenhum outro arquivo de produção', () => {
    // `1.055`, `0.04045` e `12.92` são a assinatura da conversão. Quem as escrever em outro
    // arquivo está construindo o segundo conversor, que é o defeito que este teste existe para
    // impedir.
    const culpados = producao
      .filter(({ caminho }) => caminho !== CONVERSOR)
      .filter(({ conteudo }) => /1\.055|0\.04045|0\.0031308|12\.92/.test(conteudo))
      .map(({ caminho }) => caminho);

    expect(culpados).toEqual([]);
  });

  it('o conversor realmente contém a curva, senão a varredura acima passaria vazia', () => {
    // Canário: sem esta linha, apagar `corSrgbLinear.ts` inteiro deixaria o teste anterior
    // verde. Guarda que não pode falhar não é guarda.
    const conversor = producao.find(({ caminho }) => caminho === CONVERSOR);

    expect(conversor).toBeDefined();
    expect(conversor?.conteudo).toMatch(/1\.055/);
    expect(conversor?.conteudo).toMatch(/0\.04045/);
    expect(conversor?.conteudo).toMatch(/12\.92/);
  });
});

describe('a cor entra no glTF por um caminho só', () => {
  it('só o motor 3D usa hexParaLinear em produção', () => {
    // Duas ou mais ocorrências, e não uma: a linha de `import` sobrevive intacta à remoção da
    // chamada, então exigir só uma deixaria a guarda verde num arquivo que importa e não usa
    // (aprendizado de 2026-09-08).
    const culpados = producao
      .filter(({ caminho }) => caminho !== CONVERSOR && caminho !== MOTOR_3D)
      .filter(({ conteudo }) => /hexParaLinear/.test(conteudo))
      .map(({ caminho }) => caminho);

    expect(culpados).toEqual([]);

    const motor = producao.find(({ caminho }) => caminho === MOTOR_3D);
    expect((motor?.conteudo.match(/hexParaLinear/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('baseColorFactor só é escrito nos arquivos que têm licença, e cada um por um motivo', () => {
    // A lista é curta e cada entrada tem razão escrita. Qualquer arquivo novo que apareça aqui
    // é um pedido de decisão, não um detalhe:
    //
    // - `recolorirModelo3d.ts`  escreve a cor pedida. É o ponto do ADR-007 D3.
    // - `normalizarModelo3d.ts` escreve `[1,1,1,1]` ao criar material que faltava. É o padrão
    //                           do glTF 2.0 copiado, não uma cor convertida.
    // - `tiposDoGltf.ts`        declara o campo. Declarar não é escrever.
    const COM_LICENCA = new Set([
      MOTOR_3D,
      join('src', 'lib', 'render', 'normalizarModelo3d.ts'),
      join('src', 'lib', 'render', 'tiposDoGltf.ts'),
    ]);

    const culpados = producao
      .filter(({ caminho }) => !COM_LICENCA.has(caminho))
      .filter(({ conteudo }) => /baseColorFactor/.test(conteudo))
      .map(({ caminho }) => caminho);

    expect(culpados).toEqual([]);
  });

  it('fora do motor 3D, ninguém converte canal de cor dividindo por 255', () => {
    // `c / 255` é a conversão ingênua. No caminho do SVG ela nem aparece (a cor vai crua no
    // atributo `fill`), então qualquer ocorrência em produção é alguém reinventando a curva.
    const culpados = producao
      .filter(({ caminho }) => caminho !== CONVERSOR)
      .filter(({ conteudo }) => /\/\s*255\b/.test(conteudo))
      .map(({ caminho }) => caminho);

    expect(culpados).toEqual([]);
  });
});
