// O defeito que estes testes existem para impedir: o palco piscando `COR_INVALIDA` a cada
// tecla enquanto alguém digita `#C0392B`, com o calçado sumindo no meio da digitação e uma
// mensagem de erro acusando quem ainda não errou.

import { describe, expect, it } from 'vitest';
import { coresValidas, definirCor, errosDeCor } from './coresDoPreview';

describe('cores do preview', () => {
  describe('cores válidas', () => {
    it('entrega o hex longo normalizado em maiúsculo, como o motor recebe', () => {
      expect(coresValidas({ sola: '#c0392b' })).toEqual({ sola: '#C0392B' });
    });

    it('expande o hex curto para a forma longa (#f00 → #FF0000)', () => {
      // A expansão é de `validarCor`, o preview não pode ter a sua própria, senão a cor
      // do editor deixa de ser byte a byte a cor da API (princípio nº1).
      expect(coresValidas({ cabedal: '#f00' })).toEqual({ cabedal: '#FF0000' });
    });

    it('aceita espaço em volta, porque colar cor de planilha traz espaço junto', () => {
      expect(coresValidas({ sola: '  #C0392B  ' })).toEqual({ sola: '#C0392B' });
    });

    it('rascunho incompleto não entra no pedido, é o que segura o palco durante a digitação', () => {
      for (const rascunho of ['#', '#C', '#C0', '#C039', '#C0392']) {
        expect(coresValidas({ sola: rascunho })).toEqual({});
      }
    });

    it('texto claramente errado também não entra no pedido', () => {
      expect(coresValidas({ sola: 'vermelho' })).toEqual({});
      expect(coresValidas({ sola: '#GGG' })).toEqual({});
    });

    it('campo vazio não vira cor', () => {
      expect(coresValidas({ sola: '' })).toEqual({});
      expect(coresValidas({ sola: '   ' })).toEqual({});
    });
  });

  describe('erros de cor', () => {
    it('rascunho incompleto não vira erro, a pessoa só não terminou de digitar', () => {
      for (const rascunho of ['#', '#C', '#C0', '#C039', '#C0392']) {
        expect(errosDeCor({ sola: rascunho })).toEqual({});
      }
    });

    it('campo vazio não é erro: é ausência de preview', () => {
      expect(errosDeCor({ sola: '' })).toEqual({});
      expect(errosDeCor({ sola: '   ' })).toEqual({});
    });

    it('cor válida não é erro, nem na forma curta', () => {
      expect(errosDeCor({ sola: '#C0392B', cabedal: '#f00' })).toEqual({});
    });

    it('nome de cor vira erro com a mensagem do motor, citando a zona', () => {
      const erros = errosDeCor({ sola: 'vermelho' });

      expect(Object.keys(erros)).toEqual(['sola']);
      expect(erros['sola']).toContain('vermelho');
      expect(erros['sola']).toContain('sola');
    });

    it('hex com dígito inválido vira erro mesmo tendo o tamanho certo', () => {
      // `#GGG` tem 3 caracteres, mas nenhuma tecla a mais o transforma em cor.
      expect(Object.keys(errosDeCor({ sola: '#GGG' }))).toEqual(['sola']);
    });

    it('hex sem "#" vira erro na hora, não só na hora de salvar', () => {
      expect(Object.keys(errosDeCor({ sola: 'C0392B' }))).toEqual(['sola']);
    });

    it('hex longo demais vira erro, digitar mais não conserta', () => {
      expect(Object.keys(errosDeCor({ sola: '#C0392BB' }))).toEqual(['sola']);
    });
  });

  describe('várias zonas ao mesmo tempo', () => {
    it('as válidas continuam sendo entregues enquanto outra está sendo digitada', () => {
      // O palco não pode parar de pintar a sola porque alguém começou a digitar a cor do
      // cabedal, esse é o comportamento que faz o editor parecer quebrado.
      const emEdicao = { sola: '#c0392b', cabedal: '#C0', bico: 'vermelho', forro: '' };

      expect(coresValidas(emEdicao)).toEqual({ sola: '#C0392B' });
      expect(Object.keys(errosDeCor(emEdicao))).toEqual(['bico']);
    });
  });

  describe('definir cor', () => {
    it('guarda o texto cru, sem normalizar o que está sendo digitado', () => {
      // Normalizar no meio da digitação reescreveria o campo embaixo do cursor.
      expect(definirCor({}, 'sola', '#c0')).toEqual({ sola: '#c0' });
    });

    it('não muta o objeto recebido', () => {
      const entrada = { sola: '#C0392B' };

      const saida = definirCor(entrada, 'cabedal', '#FFF');

      expect(entrada).toEqual({ sola: '#C0392B' });
      expect(saida).not.toBe(entrada);
      expect(saida).toEqual({ sola: '#C0392B', cabedal: '#FFF' });
    });

    it('valor vazio remove a chave em vez de guardar string vazia', () => {
      // Zona sem preview e zona com preview vazio são o mesmo estado; duas representações
      // do mesmo estado divergem.
      const saida = definirCor({ sola: '#C0392B', cabedal: '#FFF' }, 'sola', '');

      expect(saida).toEqual({ cabedal: '#FFF' });
      expect('sola' in saida).toBe(false);
    });

    it('valor só com espaço também remove a chave', () => {
      expect(definirCor({ sola: '#C0392B' }, 'sola', '   ')).toEqual({});
    });

    it('limpar zona que não tem cor não muta nem troca a identidade do objeto', () => {
      const entrada = { sola: '#C0392B' };

      expect(definirCor(entrada, 'cabedal', '')).toBe(entrada);
    });

    it('repetir o mesmo texto devolve o mesmo objeto, evitando render sem mudança', () => {
      const entrada = { sola: '#C0392B' };

      expect(definirCor(entrada, 'sola', '#C0392B')).toBe(entrada);
    });
  });
});
