// O que estes testes protegem: (1) que o corpo do cliente vire cor sem nenhuma validação
// própria deste módulo, os erros de cor e de chave têm de sair do MOTOR, com a classe e o
// código do motor, senão a API e o editor podem divergir (princípio nº1); e (2) que a forma
// do corpo seja recusada nos casos que passam por objeto sem ser um mapa de zonas, com o
// array na frente: `typeof [] === 'object'` é a pegadinha que deixa um array virar mapa vazio.

import { describe, expect, it } from 'vitest';
import { ErroDeVariante } from '../../src/lib/render/erros';
import { lerCoresPedidas } from './lerCoresPedidas';
import { FalhaDaApi } from './tiposDaApi';

/** Captura o erro lançado sem depender de `expect().toThrow`, que não expõe `codigo`. */
function capturar(corpo: unknown): unknown {
  try {
    lerCoresPedidas(corpo);
  } catch (erro) {
    return erro;
  }
  throw new Error('esperava um erro e a chamada passou');
}

describe('lerCoresPedidas, caminho feliz', () => {
  it('devolve o mapa de zona para cor que o motor recebe', () => {
    expect(lerCoresPedidas({ sola: '#C0392B', cabedal: '#111111' })).toEqual({
      sola: '#C0392B',
      cabedal: '#111111',
    });
  });

  it('devolve a cor NORMALIZADA pelo motor, não a string crua do cliente', () => {
    // Se este teste passar a devolver "#f00", alguém trocou `validarCor` por uma cópia local:
    // a expansão da forma curta e o caixa-alta são do motor, e é isso que garante que a cor
    // gravada pela API seja byte a byte a que o editor mostra.
    expect(lerCoresPedidas({ sola: '#f00', logo: '  #aabbcc  ' })).toEqual({
      sola: '#FF0000',
      logo: '#AABBCC',
    });
  });

  it('aceita um pedido no teto de 90 zonas', () => {
    const corpo = Object.fromEntries(
      Array.from({ length: 90 }, (_, i) => [`zona-${i}`, '#111111']),
    );
    expect(Object.keys(lerCoresPedidas(corpo))).toHaveLength(90);
  });
});

describe('lerCoresPedidas, os erros vêm do motor, não de uma segunda validação', () => {
  it('cor que não é hex propaga COR_INVALIDA do motor', () => {
    const erro = capturar({ sola: 'vermelho' });

    expect(erro).toBeInstanceOf(ErroDeVariante);
    expect(erro).not.toBeInstanceOf(FalhaDaApi);
    expect((erro as ErroDeVariante).codigo).toBe('COR_INVALIDA');
    // A mensagem do motor nomeia a zona, é o que torna o 422 acionável para o integrador.
    expect((erro as ErroDeVariante).message).toContain('sola');
  });

  it('cor que nem é texto propaga COR_INVALIDA do motor', () => {
    const erro = capturar({ sola: 16711680 });

    expect(erro).toBeInstanceOf(ErroDeVariante);
    expect((erro as ErroDeVariante).codigo).toBe('COR_INVALIDA');
  });

  it('zone_key maiúscula propaga ZONE_KEY_INVALIDA do motor', () => {
    const erro = capturar({ SOLA: '#C0392B' });

    expect(erro).toBeInstanceOf(ErroDeVariante);
    expect((erro as ErroDeVariante).codigo).toBe('ZONE_KEY_INVALIDA');
  });

  it('zone_key com acento ou espaço propaga ZONE_KEY_INVALIDA do motor', () => {
    for (const chave of ['cadarço', 'zona da sola', '__proto__']) {
      const erro = capturar({ [chave]: '#C0392B' });
      expect((erro as ErroDeVariante).codigo).toBe('ZONE_KEY_INVALIDA');
    }
  });

  it('a chave é validada antes da cor: chave e cor inválidas juntas dão ZONE_KEY_INVALIDA', () => {
    // Ordem importa para a mensagem: a de COR_INVALIDA cita a zona, e citar uma zona que já é
    // inválida mandaria o integrador corrigir a cor quando o defeito é o nome da chave.
    const erro = capturar({ SOLA: 'vermelho' });
    expect((erro as ErroDeVariante).codigo).toBe('ZONE_KEY_INVALIDA');
  });
});

describe('lerCoresPedidas, forma do corpo recusada com CORPO_INVALIDO 400', () => {
  it('array é recusado (typeof [] === "object" deixaria passar como mapa vazio)', () => {
    const erro = capturar([{ sola: '#C0392B' }]);

    expect(erro).toBeInstanceOf(FalhaDaApi);
    expect((erro as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
    expect((erro as FalhaDaApi).status).toBe(400);
  });

  it('array vazio é recusado, e não confundido com o corpo vazio {}', () => {
    expect((capturar([]) as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
  });

  it('null é recusado (typeof null === "object")', () => {
    const erro = capturar(null);
    expect(erro).toBeInstanceOf(FalhaDaApi);
    expect((erro as FalhaDaApi).status).toBe(400);
  });

  it('string é recusada', () => {
    expect((capturar('{"sola":"#C0392B"}') as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
  });

  it('número é recusado', () => {
    expect((capturar(7) as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
  });

  it('undefined (corpo ausente) é recusado', () => {
    expect((capturar(undefined) as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
  });

  it('corpo vazio {} é RECUSADO, variante sem cor nenhuma devolveria o asset-base intocado', () => {
    const erro = capturar({});

    expect(erro).toBeInstanceOf(FalhaDaApi);
    expect((erro as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
    expect((erro as FalhaDaApi).status).toBe(400);
  });

  it('91 zonas passa do teto e é recusado antes de validar par por par', () => {
    // A cor é inválida de propósito: se a resposta fosse COR_INVALIDA, o teto estaria sendo
    // conferido depois do laço, e o pedido gigante teria sido processado inteiro, que é
    // exatamente o custo que o limite existe para evitar.
    const corpo = Object.fromEntries(
      Array.from({ length: 91 }, (_, i) => [`zona-${i}`, 'vermelho']),
    );
    const erro = capturar(corpo);

    expect(erro).toBeInstanceOf(FalhaDaApi);
    expect((erro as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
    expect((erro as FalhaDaApi).message).toContain('91');
  });

  it('duas chaves que viram a mesma zone_key são recusadas, nunca a última calada', () => {
    // `" sola"` e `"sola"` são chaves distintas no JSON e a mesma zona depois do trim do
    // motor. Aceitar significaria perder uma cor sem erro nenhum.
    const erro = capturar({ ' sola': '#C0392B', sola: '#111111' });

    expect(erro).toBeInstanceOf(FalhaDaApi);
    expect((erro as FalhaDaApi).codigo).toBe('CORPO_INVALIDO');
  });
});
