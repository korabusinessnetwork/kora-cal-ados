import { describe, expect, it } from 'vitest';

import { catalogoDeProva, gltfDaPecaDeProva } from './acervoDeProva';
import { malhaNaForma } from './malhaNaForma';

// Critérios 3, 4 e 5 de `specs/acervo-com-cara-de-tenis.md`, conferidos no glTF **gravado** das
// 5 peças. Os testes de cada geometria já conferem a malha antes de virar arquivo; este confere o
// que sai do buffer, porque é no caminho até lá (arredondar, transladar, juntar partes) que um
// índice troca de vizinho ou um `min` fica velho. E é o único lugar em que o cadarço, que não tem
// teste de normal próprio, passa por essa conferência.

const IDS = catalogoDeProva().pecas.map(({ id }) => id);

type Vetor = [number, number, number];

const trincaDe = (lista: number[], indice: number): Vetor => [
  lista[indice * 3] ?? 0,
  lista[indice * 3 + 1] ?? 0,
  lista[indice * 3 + 2] ?? 0,
];

describe.each(IDS)('%s gravada', (id) => {
  const malha = malhaNaForma(gltfDaPecaDeProva(id), id);
  const vertices = malha.posicoesGravadas.length / 3;

  it('min e max do POSITION são os das posições gravadas, em float32 (critério 3)', () => {
    const menor: Vetor = [Infinity, Infinity, Infinity];
    const maior: Vetor = [-Infinity, -Infinity, -Infinity];

    for (let vertice = 0; vertice < vertices; vertice += 1) {
      trincaDe(malha.posicoesGravadas, vertice).forEach((valor, eixo) => {
        menor[eixo] = Math.min(menor[eixo] ?? 0, valor);
        maior[eixo] = Math.max(maior[eixo] ?? 0, valor);
      });
    }

    // Igualdade exata, de propósito: o validador da Khronos também compara sem tolerância.
    expect(malha.limitesDeclarados).toEqual({ min: menor, max: maior });
  });

  it('toda normal gravada é unitária (critério 5)', () => {
    expect(malha.normais).toHaveLength(malha.posicoesGravadas.length);

    let pior = 0;
    for (let vertice = 0; vertice < vertices; vertice += 1) {
      pior = Math.max(pior, Math.abs(Math.hypot(...trincaDe(malha.normais, vertice)) - 1));
    }

    // float32 guarda uns 7 dígitos: o erro de um vetor unitário arredondado fica abaixo disto.
    expect(pior).toBeLessThan(1e-6);
  });

  it('todo triângulo está virado para o mesmo lado das normais dos seus vértices (critério 4)', () => {
    // Triângulo do avesso some da tela com face única e acende a luz do lado errado com dupla face.
    // A conferência é a do renderizador: a normal do triângulo, tirada do sentido dos índices,
    // contra a soma das normais dos três cantos.
    const avessos: number[] = [];

    for (let triangulo = 0; triangulo < malha.indices.length; triangulo += 3) {
      const cantos = [0, 1, 2].map((canto) => malha.indices[triangulo + canto] ?? 0);
      const [a, b, c] = cantos.map((indice) => trincaDe(malha.posicoesGravadas, indice)) as [Vetor, Vetor, Vetor];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const daFace = [
        (u[1] ?? 0) * (v[2] ?? 0) - (u[2] ?? 0) * (v[1] ?? 0),
        (u[2] ?? 0) * (v[0] ?? 0) - (u[0] ?? 0) * (v[2] ?? 0),
        (u[0] ?? 0) * (v[1] ?? 0) - (u[1] ?? 0) * (v[0] ?? 0),
      ];

      // Triângulo sem área não tem lado; as pontas do contorno do pé fecham em zero exato.
      if (Math.hypot(...daFace) < 1e-12) continue;

      const dosCantos = cantos
        .map((indice) => trincaDe(malha.normais, indice))
        .reduce((soma, normal) => [soma[0] + normal[0], soma[1] + normal[1], soma[2] + normal[2]]);
      const alinhamento = daFace.reduce((soma, valor, eixo) => soma + valor * (dosCantos[eixo] ?? 0), 0);

      if (alinhamento <= 0) avessos.push(triangulo / 3);
    }

    expect(avessos).toEqual([]);
  });
});
