// A composição sobrevive ao F5 (R7-A57), e a gravação velha nunca vira calçado pela metade.
//
// O armazenamento é um falso feito à mão, e não o `localStorage` do jsdom, porque as três falhas
// que importam, ler que lança, gravar que lança e não existir armazenamento, precisam ser
// provocadas de propósito, e o `localStorage` de verdade não falha quando se pede.

import { describe, expect, it } from 'vitest';

import {
  CHAVE_DA_COMPOSICAO,
  guardarComposicao,
  lerComposicaoGuardada,
  type Armazenamento,
} from './composicaoGuardada';
import { composicaoDasEscolhas, escolhasDaComposicao, mudarEscolhaDaTela } from './composicaoDaTela';
import { catalogoDeProva, composicaoDeProva } from '../lib/acervo/acervoDeProva';
import { validarComposicao } from '../lib/composicao/validarComposicao';
import type { Forma } from '../lib/composicao/tiposDaComposicao';

const CATALOGO = catalogoDeProva();
const FORMA = CATALOGO.formas[0] as Forma;
const DEMO = validarComposicao(composicaoDeProva(), CATALOGO);

/** Um armazenamento em memória que conta as remoções, para a limpeza da recusa ser afirmável. */
function armazenamentoFalso(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  const removidas: string[] = [];
  const armazenamento: Armazenamento = {
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => void dados.set(chave, valor),
    removeItem: (chave) => {
      removidas.push(chave);
      dados.delete(chave);
    },
  };

  return { armazenamento, dados, removidas };
}

function textoDe(escolhas: Parameters<typeof composicaoDasEscolhas>[1]) {
  return JSON.stringify(composicaoDasEscolhas(FORMA, escolhas), null, 2);
}

describe('guardar e ler a composição (R7-A57)', () => {
  it('o que foi guardado volta igual, cor e peça', () => {
    // A afirmação que vale o item: o cabedal pintado de verde é verde depois do F5.
    const pintada = mudarEscolhaDaTela(escolhasDaComposicao(DEMO), 'cabedal', { cor: '#22AA44' });
    const { armazenamento } = armazenamentoFalso();

    guardarComposicao(armazenamento, textoDe(pintada));
    const lida = lerComposicaoGuardada(armazenamento, FORMA, CATALOGO);

    expect(lida).not.toBe(null);
    expect(textoDe(lida!)).toBe(textoDe(pintada));
    expect(lida!.get('cabedal')?.cor?.toUpperCase()).toBe('#22AA44');
  });

  it('sem gravação, devolve null e não apaga nada', () => {
    const { armazenamento, removidas } = armazenamentoFalso();

    expect(lerComposicaoGuardada(armazenamento, FORMA, CATALOGO)).toBe(null);
    expect(removidas).toEqual([]);
  });

  it('gravação de OUTRA forma é recusada pelo guarda e apagada', () => {
    const deOutraForma = JSON.stringify({ ...composicaoDasEscolhas(FORMA, escolhasDaComposicao(DEMO)), forma_id: 'forma-que-nao-existe' });
    const { armazenamento, dados, removidas } = armazenamentoFalso({ [CHAVE_DA_COMPOSICAO]: deOutraForma });

    expect(lerComposicaoGuardada(armazenamento, FORMA, CATALOGO)).toBe(null);
    expect(removidas).toEqual([CHAVE_DA_COMPOSICAO]);
    expect(dados.has(CHAVE_DA_COMPOSICAO)).toBe(false);
  });

  it('gravação que o guarda recusa por peça inexistente é apagada, não montada pela metade', () => {
    // O caso do acervo que mudou entre gravar e ler: uma peça saiu. Montar o resto daria um
    // calçado sem zona, que é o que o princípio nº1 proíbe.
    const composicao = composicaoDasEscolhas(FORMA, escolhasDaComposicao(DEMO));
    const semPeca = JSON.stringify({
      ...composicao,
      pecas: composicao.pecas.map((peca, i) => (i === 0 ? { ...peca, peca_id: 'peca-que-saiu' } : peca)),
    });
    const { armazenamento, removidas } = armazenamentoFalso({ [CHAVE_DA_COMPOSICAO]: semPeca });

    expect(lerComposicaoGuardada(armazenamento, FORMA, CATALOGO)).toBe(null);
    expect(removidas).toEqual([CHAVE_DA_COMPOSICAO]);
  });

  it('texto que não é JSON é apagado', () => {
    const { armazenamento, removidas } = armazenamentoFalso({ [CHAVE_DA_COMPOSICAO]: '{meio json' });

    expect(lerComposicaoGuardada(armazenamento, FORMA, CATALOGO)).toBe(null);
    expect(removidas).toEqual([CHAVE_DA_COMPOSICAO]);
  });

  it('armazenamento ausente não lança, nem para ler nem para gravar', () => {
    expect(lerComposicaoGuardada(null, FORMA, CATALOGO)).toBe(null);
    expect(() => guardarComposicao(null, '{}')).not.toThrow();
  });

  it('armazenamento que LANÇA ao ler ou gravar não derruba quem chama', () => {
    // Cota cheia, dados de site bloqueados: o navegador lança, e a tela tem de seguir de pé.
    const bloqueado: Armazenamento = {
      getItem: () => {
        throw new DOMException('bloqueado', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('cheio', 'QuotaExceededError');
      },
      removeItem: () => {
        throw new DOMException('bloqueado', 'SecurityError');
      },
    };

    expect(lerComposicaoGuardada(bloqueado, FORMA, CATALOGO)).toBe(null);
    expect(() => guardarComposicao(bloqueado, '{}')).not.toThrow();
  });
});
