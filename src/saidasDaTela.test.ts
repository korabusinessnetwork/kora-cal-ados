// O que este arquivo prende é a SIMETRIA: nenhuma tela oferece menos caminhos que as outras.
//
// O defeito que deu origem a ele não era um bug de código, era uma lista escrita à mão em quatro
// lugares do `App.tsx` e que só em três deles estava completa. Nenhum teste podia pegar isso
// enquanto a regra fosse JSX. Virando dado, pega.

import { describe, expect, it } from 'vitest';
import { ROTULO_DA_SAIDA, saidasDe } from './saidasDaTela';
import type { Tela } from './telaInicial';

const TODAS: Tela[] = ['app', 'esboco', 'palco3d', 'composicao'];

describe('saídas de cada tela', () => {
  it('toda tela oferece exatamente as outras três', () => {
    // A afirmação central, e a que o esboço reprovava: ele oferecia uma saída, não três.
    for (const tela of TODAS) {
      expect(saidasDe(tela)).toHaveLength(TODAS.length - 1);
    }
  });

  it('nenhuma tela se oferece a si mesma', () => {
    for (const tela of TODAS) {
      expect(saidasDe(tela)).not.toContain(tela);
    }
  });

  it('a ordem é a mesma em toda tela', () => {
    // Rodapé que embaralha a ordem conforme a tela faz a pessoa reler os três a cada troca.
    expect(saidasDe('app')).toEqual(['esboco', 'palco3d', 'composicao']);
    expect(saidasDe('esboco')).toEqual(['palco3d', 'composicao', 'app']);
    expect(saidasDe('palco3d')).toEqual(['esboco', 'composicao', 'app']);
    expect(saidasDe('composicao')).toEqual(['esboco', 'palco3d', 'app']);
  });

  it('do esboço se chega às duas telas do palco, que também rodam sem banco', () => {
    // O achado literal: quem abre um clone recém-baixado cai no esboço, e o palco 3D e o calçado
    // montado rodam sem conta e sem `.env.local` exatamente como ele. Eram indescobríveis dali.
    expect(saidasDe('esboco')).toContain('palco3d');
    expect(saidasDe('esboco')).toContain('composicao');
  });

  it('cada destino tem um rótulo, e não há dois iguais', () => {
    // Dois rótulos iguais no mesmo rodapé são dois botões que a pessoa não consegue distinguir.
    const rotulos = TODAS.map((tela) => ROTULO_DA_SAIDA[tela]);

    expect(rotulos.every((rotulo) => rotulo.length > 0)).toBe(true);
    expect(new Set(rotulos).size).toBe(TODAS.length);
  });

  it('o rótulo do editor avisa que vai pedir login', () => {
    // É a única saída que pode terminar numa tela de credencial. Avisar antes é prevenção de erro.
    expect(ROTULO_DA_SAIDA.app).toContain('login');
  });

  it('toda saída oferecida tem rótulo, em qualquer tela', () => {
    // ADR-003, "um termo, um nome, sempre". O palco 3D já foi "ver o palco 3D (sem banco, sem
    // conta)", "ver o palco 3D (idem)" e "← ver uma peça por vez (palco 3D)" em três rodapés
    // diferentes. Vindo de um `Record` só há um nome possível; o que falta prender é que nenhuma
    // saída caia num rótulo inexistente, que é como uma tela nova estrearia com um botão em branco.
    const semRotulo = TODAS.flatMap((tela) =>
      saidasDe(tela).filter((destino) => !ROTULO_DA_SAIDA[destino]),
    );

    expect(semRotulo).toEqual([]);
    expect(Object.keys(ROTULO_DA_SAIDA).sort()).toEqual([...TODAS].sort());
  });
});
