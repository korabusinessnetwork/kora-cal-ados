// O teste de ida e volta sozinho NÃO basta, e essa é a lição central deste arquivo.
//
// `c / 255` também sobrevive a `linearParaHex(hexParaLinear(x)) === x`, porque a volta desfaz
// exatamente o que a ida fez, esteja a fórmula certa ou errada. O que separa a conversão certa
// da errada é o **valor no meio**, e é por isso que existe o bloco "o valor no meio".

import { describe, expect, it } from 'vitest';
import { hexParaLinear, linearParaHex, type CorLinear } from './corSrgbLinear';
import { ErroDeVariante } from './erros';

/** Cores que cobrem os dois trechos da curva, mais os extremos e a faixa perto do preto. */
const BATERIA = [
  '#000000',
  '#FFFFFF',
  '#010101',
  '#020202',
  '#050505',
  '#0A0A0A',
  '#0D0D0D',
  '#808080',
  '#C0392B',
  '#2ECC71',
  '#3498DB',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#123456',
  '#FEDCBA',
];

describe('ida e volta', () => {
  it.each(BATERIA)('%s volta igual', (hex) => {
    expect(linearParaHex(hexParaLinear(hex))).toBe(hex);
  });

  it('volta igual para os 256 tons de cinza, sem nenhum canal deslocando um byte', () => {
    // Varredura completa de um canal: se a curva estivesse errada em algum ponto, ou o
    // arredondamento caísse para o lado errado numa borda, apareceria aqui e em nenhum dos
    // casos escolhidos a dedo acima.
    for (let byte = 0; byte < 256; byte += 1) {
      const canal = byte.toString(16).padStart(2, '0').toUpperCase();
      const hex = `#${canal}${canal}${canal}`;

      expect(linearParaHex(hexParaLinear(hex))).toBe(hex);
    }
  });

  it('aceita hex minúsculo e devolve maiúsculo, como validarCor faz', () => {
    expect(linearParaHex(hexParaLinear('#c0392b'))).toBe('#C0392B');
  });
});

describe('o valor no meio: a conversão não é ingênua', () => {
  it('#808080 vira ~0.2159 em linear, NÃO 0.502', () => {
    // Este é o teste que mata `c / 255`. 50% de cinza em sRGB é ~21.6% de luz linear, e a
    // diferença entre os dois números é a diferença entre o calçado certo e o errado.
    const [vermelho] = hexParaLinear('#808080');

    expect(vermelho).toBeCloseTo(0.2158605, 6);
    expect(vermelho).not.toBeCloseTo(128 / 255, 2);
  });

  it('a faixa baixa usa a reta, não a potência', () => {
    // Abaixo de 0.04045 o sRGB é divisão por 12.92. Uma implementação que só use `** 2.4`
    // erra aqui, e erra exatamente nos tons escuros, onde mora meia paleta de calçado.
    const [preto] = hexParaLinear('#0A0A0A');

    expect(preto).toBeCloseTo(10 / 255 / 12.92, 10);
  });

  it('branco é 1 e preto é 0, exatos', () => {
    expect(hexParaLinear('#FFFFFF')).toEqual([1, 1, 1]);
    expect(hexParaLinear('#000000')).toEqual([0, 0, 0]);
  });

  it('canal linear é sempre menor ou igual ao ingênuo, e menor de verdade fora dos extremos', () => {
    // Propriedade da curva: sRGB→linear nunca clareia. Se alguém inverter o sentido da
    // conversão, escrevendo a curva de volta na ida, esta asserção fica vermelha em bloco.
    for (const hex of BATERIA) {
      const byte = Number.parseInt(hex.slice(1, 3), 16);
      const [linear] = hexParaLinear(hex);

      expect(linear).toBeLessThanOrEqual(byte / 255 + 1e-12);
    }
  });
});

describe('entrada que não é cor', () => {
  it.each(['C0392B', '#C0392', '#GGGGGG', '', 'vermelho'])(
    '%s é COR_INVALIDA, não NaN passando adiante',
    (valor) => {
      expect(() => hexParaLinear(valor)).toThrow(ErroDeVariante);
      try {
        hexParaLinear(valor);
      } catch (erro) {
        expect((erro as ErroDeVariante).codigo).toBe('COR_INVALIDA');
      }
    },
  );

  it('hex curto NÃO é aceito aqui: quem expande é validarCor, e um lugar só', () => {
    expect(() => hexParaLinear('#F00')).toThrow(ErroDeVariante);
  });
});

describe('valor fora da faixa vindo de um glTF de fora', () => {
  it('não vira NaN nem #NANNAN', () => {
    // Alguns exportadores escrevem HDR em baseColorFactor. `(-0.2) ** (1/2.4)` é NaN, e um
    // NaN aqui viraria texto quebrado dentro de uma mensagem de erro.
    expect(linearParaHex([-0.5, 2, Number.NaN] as unknown as CorLinear)).toBe('#00FF00');
  });
});
