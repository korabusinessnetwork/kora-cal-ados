// Os botões do rodapé de telas são alvo de toque de pelo menos 24 px (R8-A60).
//
// A medida de verdade é no navegador, e foi feita lá: 18 px de altura antes, com centros a 19 px um
// do outro a 375 px, e 24 px depois, nas quatro telas. jsdom não calcula layout, então o que fica
// preso aqui é a regra da folha que produz a medida. Sem ela, apagar uma linha de CSS devolveria os
// 18 px e nenhum teste de markup perceberia.
//
// Os comentários saem antes de olhar, pelo mesmo motivo de `ListaDeProdutos.test.tsx`: o comentário
// da própria regra cita "24 px", e a guarda tem de olhar a declaração, não a explicação.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const folha = readFileSync(new URL('./sessao.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ' ',
);

function declaracoesDe(seletor: string): string {
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const achado = folha.match(new RegExp(`(?:^|\\})\\s*${escapado}\\s*\\{([^}]*)\\}`));
  if (achado === null) throw new Error(`A regra "${seletor}" não está em sessao.css.`);

  return achado[1] ?? '';
}

describe('o alvo de toque do rodapé de telas (R8-A60)', () => {
  it('os botões têm altura mínima de pelo menos 24 px', () => {
    const altura = declaracoesDe('.rodape-telas button').match(/min-height:\s*(\d+(?:\.\d+)?)px/);

    expect(altura).not.toBe(null);
    expect(Number(altura?.[1])).toBeGreaterThanOrEqual(24);
  });

  it('os links do rodapé da rede de proteção não ganharam regra de altura', () => {
    // O critério do item pede que o rodapé de links continue com a mesma aparência. A altura mora
    // só na regra dos botões, e esta é a contraprova de que ela não vazou para a dos links.
    expect(declaracoesDe('.rodape-telas a')).not.toMatch(/height/);
  });
});
