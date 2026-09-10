// A fronteira entre o que tem teste e o que nenhum teste alcança, virada em teste.
//
// Os critérios 18 e 20 da spec (`specs/palco-3d.md`) são os únicos do palco que não descrevem
// um comportamento e sim uma disciplina de arquitetura: `orbita.ts` não pode importar `three`
// nem tocar no DOM, e `PalcoDeModelo3d.tsx` não pode conter regra nenhuma. Disciplina que só existe
// como frase num README dura até a primeira pressa. Estas varreduras são baratas e falham alto.
//
// Varredura de FONTE, e não de comportamento, de propósito: o que se quer proteger aqui é
// justamente o arquivo que nenhum teste de comportamento consegue exercitar, porque jsdom não
// tem WebGL. É o mesmo molde de `src/lib/supabase/semServiceRoleNoFront.test.ts`.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function fonte(arquivo: string): string {
  return readFileSync(new URL(arquivo, import.meta.url), 'utf8');
}

describe('orbita.ts é aritmética pura (critério 18)', () => {
  const ORBITA = fonte('./orbita.ts');

  it('não importa nada, three inclusive', () => {
    // Sem `three`, a órbita é testável sem navegador, e é isso que faz "gira com o mouse" ter
    // 16 testes em vez de virar mais um item da conferência a olho.
    expect(ORBITA).not.toMatch(/^import /m);
    expect(ORBITA).not.toContain("from 'three'");
  });

  it('não toca no DOM', () => {
    // Uma referência a `window` aqui traria o navegador de volta para dentro do módulo e o
    // teste que roda em ambiente Node quebraria na chamada mais simples.
    for (const proibido of ['document', 'window', 'PointerEvent', 'HTMLElement']) {
      expect(ORBITA).not.toContain(proibido);
    }
  });
});

describe('PalcoDeModelo3d.tsx não decide nada (critério 20)', () => {
  const PALCO = fonte('./PalcoDeModelo3d.tsx');

  it('não faz aritmética de câmera: quem sabe onde a câmera fica é orbita.ts', () => {
    // Aritmética esférica aqui dentro seria uma segunda implementação da órbita, no único
    // arquivo onde nenhum teste olharia se ela divergisse da primeira.
    for (const proibido of ['Math.sin', 'Math.cos', 'Math.PI', 'Spherical']) {
      expect(PALCO).not.toContain(proibido);
    }
  });

  it('não decide o que o ponteiro acertou: quem sabe é nomeDaMalhaNoPonto.ts', () => {
    // O endereço da zona (ADR-007 D4) sair daqui é o análogo tridimensional do seletor que
    // pega o path errado, e seria o caminho sem teste até esse defeito.
    for (const proibido of ['Raycaster', 'intersectObject', '.parent']) {
      expect(PALCO).not.toContain(proibido);
    }
  });

  it('delega às três funções que têm teste, em vez de reimplementá-las', () => {
    // Contraprova das duas varreduras acima: elas provariam o mesmo se o arquivo estivesse
    // vazio. Isto exige que o trabalho esteja sendo feito, e feito no lugar certo.
    expect(PALCO).toContain("from './orbita'");
    expect(PALCO).toContain("from './nomeDaMalhaNoPonto'");
    expect(PALCO).toContain("from './carregarPecaNaCena'");
  });

  it('libera o contexto WebGL ao sair da tela (critério 21)', () => {
    // Vazar contexto trava o navegador depois de algumas trocas de tela, e o navegador descarta
    // os contextos velhos em silêncio: não existe erro para procurar quando acontece.
    expect(PALCO).toContain('renderizador.dispose()');
    expect(PALCO).toContain('cancelAnimationFrame');
  });
});
