// A ordem destes ids vira `svg_selector` no banco (via `montarSeletorDeZona`). Se o
// comportamento aqui mudar, muda o que foi gravado como zona — é por isso que este teste
// existe, mesmo a regra sendo curta.

import { describe, expect, it } from 'vitest';
import { alternarId, desfazerUltimo } from './marcacaoEmCurso';

describe('marcação em curso', () => {
  describe('alternar id', () => {
    it('marcar acrescenta no fim, preservando a ordem de clique', () => {
      // A ordem de clique é a ordem do seletor gravado; inverter aqui inverteria o banco.
      expect(alternarId(['sola'], 'cabedal')).toEqual(['sola', 'cabedal']);
    });

    it('marcar de novo o mesmo id desmarca — o clique é o desfazer do usuário', () => {
      expect(alternarId(['sola', 'cabedal'], 'sola')).toEqual(['cabedal']);
    });

    it('desmarcar preserva a ordem dos outros marcados', () => {
      expect(alternarId(['a', 'b', 'c', 'd'], 'b')).toEqual(['a', 'c', 'd']);
    });

    it('remarcar um id desmarcado o coloca no fim, não no lugar antigo', () => {
      // Intencional: o id volta como marcação nova. Marcar A, marcar B, desmarcar A e
      // marcar A de novo deixa ['b', 'a'] — e é esse seletor que vai para o banco.
      const passo1 = alternarId([], 'a');
      const passo2 = alternarId(passo1, 'b');
      const passo3 = alternarId(passo2, 'a');

      expect(alternarId(passo3, 'a')).toEqual(['b', 'a']);
    });

    it('id vazio ou só com espaço é ignorado, não vira entrada fantasma no seletor', () => {
      expect(alternarId(['sola'], '')).toEqual(['sola']);
      expect(alternarId(['sola'], '   ')).toEqual(['sola']);
    });

    it('não muta o array recebido ao marcar', () => {
      // Mutar o array que está no useState faz a tela não atualizar (React compara por
      // identidade) e o defeito não aparece em revisão de código.
      const entrada = ['sola'];

      const saida = alternarId(entrada, 'cabedal');

      expect(entrada).toEqual(['sola']);
      expect(saida).not.toBe(entrada);
    });

    it('não muta o array recebido ao desmarcar', () => {
      const entrada = ['sola', 'cabedal'];

      const saida = alternarId(entrada, 'sola');

      expect(entrada).toEqual(['sola', 'cabedal']);
      expect(saida).not.toBe(entrada);
    });
  });

  describe('desfazer último', () => {
    it('remove o último marcado e mantém o resto na ordem', () => {
      expect(desfazerUltimo(['a', 'b', 'c'])).toEqual(['a', 'b']);
    });

    it('em lista vazia devolve vazia, sem erro', () => {
      // Desfazer sem nada para desfazer é uso normal, não falha.
      expect(desfazerUltimo([])).toEqual([]);
    });

    it('não muta o array recebido', () => {
      const entrada = ['a', 'b'];

      const saida = desfazerUltimo(entrada);

      expect(entrada).toEqual(['a', 'b']);
      expect(saida).not.toBe(entrada);
    });
  });
});
