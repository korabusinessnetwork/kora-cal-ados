// O teste da régua. Roda em qualquer máquina, com ou sem Chrome, de propósito: se a régua estiver
// torta, o teste de cor na tela mente nas duas direções, e ninguém descobre numa máquina sem
// navegador.

import { describe, expect, it } from 'vitest';

import { corConfere, distanciaDeMatiz, matiz, rgbDoHex, saturacao } from './matiz';

// As três cores da composição de prova, que são as que o teste de navegador mede de verdade.
const SOLA = '#F2F2F2';
const CABEDAL = '#1F4FA8';
const CADARCO = '#E8B33C';

describe('rgbDoHex', () => {
  it('lê os três canais', () => {
    expect(rgbDoHex(CABEDAL)).toEqual({ r: 31, g: 79, b: 168 });
  });

  it('aceita sem cerquilha, em minúscula e com espaço em volta', () => {
    // O hex chega de três lugares diferentes: do acervo, do `input type=color` e do que o teste
    // escreve à mão. Cada um tem um costume, e nenhum deles é erro de quem escreveu.
    expect(rgbDoHex('  1f4fa8 ')).toEqual(rgbDoHex(CABEDAL));
  });

  it('recusa o que não é cor, em vez de devolver NaN silencioso', () => {
    // `parseInt('zz', 16)` é `NaN`, e `NaN` atravessaria a conta inteira até virar um veredito
    // sem sentido. A recusa explícita é a mesma escolha de `normalizarModelo3d`.
    expect(() => rgbDoHex('#12345')).toThrow(/hex inválido/);
    expect(() => rgbDoHex('azul')).toThrow(/hex inválido/);
  });
});

describe('saturacao e matiz', () => {
  it('a sola de prova é cinza, e cinza não tem matiz', () => {
    // `#F2F2F2` tem os três canais iguais. Inventar um matiz para ela seria dar resposta a uma
    // pergunta que não existe, e o teste de navegador acabaria comparando ruído com ruído.
    expect(saturacao(rgbDoHex(SOLA))).toBe(0);
    expect(matiz(rgbDoHex(SOLA))).toBeNull();
  });

  it('o cabedal é azul e o cadarço é amarelo, nos graus que as sondas mediram', () => {
    // 219° e 42° são os números das duas passadas independentes em navegador de verdade.
    expect(matiz(rgbDoHex(CABEDAL))).toBeCloseTo(219, 0);
    expect(matiz(rgbDoHex(CADARCO))).toBeCloseTo(42, 0);
  });

  it('preto não tem matiz e não divide por zero', () => {
    // O fundo da cena é quase preto, e o varredor de pixels encosta nele. Uma divisão por zero
    // aqui viraria `NaN` e o `NaN` reprova qualquer comparação sem dizer por quê.
    expect(matiz({ r: 0, g: 0, b: 0 })).toBeNull();
    expect(saturacao({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it('o corte de saturação é ajustável, porque o que é cinza depende da pergunta', () => {
    const quaseCinza = { r: 130, g: 128, b: 126 };

    expect(matiz(quaseCinza)).toBeNull();
    expect(matiz(quaseCinza, 0)).not.toBeNull();
  });
});

describe('distanciaDeMatiz', () => {
  it('vai pelo caminho curto do círculo', () => {
    // Sem isto, um vermelho na tela a 359° contra um vermelho pedido a 1° seria reprovado por
    // 358° de distância, quando os dois são o mesmo vermelho.
    expect(distanciaDeMatiz(359, 1)).toBe(2);
    expect(distanciaDeMatiz(1, 359)).toBe(2);
  });

  it('o maior afastamento possível é meia volta', () => {
    expect(distanciaDeMatiz(0, 180)).toBe(180);
    expect(distanciaDeMatiz(90, 270)).toBe(180);
  });

  it('aceita grau fora da volta sem mudar de resposta', () => {
    expect(distanciaDeMatiz(370, 10)).toBe(0);
    expect(distanciaDeMatiz(-10, 350)).toBe(0);
  });
});

describe('corConfere, o veredito do princípio nº1', () => {
  it('o azul iluminado da tela ainda é o azul escolhido', () => {
    // `#2854AC` é a face de frente do cabedal medida na tela: mais clara que o `#1F4FA8` pedido,
    // porque está iluminada, e com o mesmo matiz, porque luz não gira cor. É este par que separa
    // "está iluminado" de "está errado", e é a razão de o teste olhar matiz e não os três canais.
    const veredito = corConfere(rgbDoHex(CABEDAL), rgbDoHex('#2854AC'));

    expect(veredito.confere).toBe(true);
    expect(veredito.motivo).toMatch(/distância 1°|distância 0°/);
  });

  it('o amarelo saturado pela luz de cima ainda é o amarelo escolhido', () => {
    expect(corConfere(rgbDoHex(CADARCO), rgbDoHex('#FCCC58')).confere).toBe(true);
  });

  it('reprova quando a peça saiu com a cor de OUTRA peça', () => {
    // É o defeito que este teste existe para pegar: a sola pintada de vermelho pintando o cadarço
    // junto. A troca de cor entre peças dá dezenas ou centenas de graus, muito além da tolerância.
    const veredito = corConfere(rgbDoHex(CADARCO), rgbDoHex('#2854AC'));

    expect(veredito.confere).toBe(false);
    expect(veredito.motivo).toMatch(/matiz pedido 42°, na tela 220°/);
  });

  it('cinza pedido exige cinza na tela', () => {
    expect(corConfere(rgbDoHex(SOLA), rgbDoHex('#F8F8F8')).confere).toBe(true);
    expect(corConfere(rgbDoHex(SOLA), rgbDoHex('#D02C2C')).confere).toBe(false);
  });

  it('cor pedida com matiz que sai cinza na tela é reprovada, e o motivo diz isso', () => {
    // É o formato do defeito em que a cor simplesmente não chegou ao material e a peça saiu na
    // cor padrão do renderizador. Passar isso como "sem matiz para comparar" esconderia o pior
    // caso possível dentro de um `null`.
    const veredito = corConfere(rgbDoHex(CABEDAL), rgbDoHex('#CCCCCC'));

    expect(veredito.confere).toBe(false);
    expect(veredito.motivo).toMatch(/a tela veio neutra/);
  });

  it('a tolerância é parâmetro, e apertá-la reprova o que a folgada aceita', () => {
    const claro = rgbDoHex('#2854AC');

    expect(corConfere(rgbDoHex(CABEDAL), claro, { graus: 8 }).confere).toBe(true);
    expect(corConfere(rgbDoHex(CABEDAL), claro, { graus: 0 }).confere).toBe(false);
  });

  // O eixo da saturação nasceu de uma mutação que SOBREVIVEU ao teste de navegador: pular a
  // conversão de sRGB para linear passava batido por uma régua que só olhava matiz. Os números
  // abaixo são medições de verdade, feitas em Chrome headless nas duas versões do código, e é por
  // isso que estão aqui com o valor exato em vez de um número redondo escolhido a olho.

  it('pega a conversão de sRGB para linear quebrada, que o matiz sozinho deixa passar', () => {
    // `#64A0D8` é o cabedal medido na tela com a conversão pulada. Note o matiz: 211° contra os
    // 219° pedidos, uma distância de 8°, que passa raspando por dentro da folga de matiz. Quem
    // acusa é a saturação, que cai de 0,81 para 0,54.
    const quebrado = { r: 100, g: 156, b: 216 };

    expect(distanciaDeMatiz(matiz(rgbDoHex(CABEDAL)) ?? 0, matiz(quebrado) ?? 0)).toBeLessThan(9);

    const veredito = corConfere(rgbDoHex(CABEDAL), quebrado);

    expect(veredito.confere).toBe(false);
    expect(veredito.motivo).toMatch(/queda 0\.2[0-9]/);
  });

  it('pega o mesmo defeito no cadarço, onde o matiz nem se move o bastante para desconfiar', () => {
    // O amarelo com a conversão pulada sai a 46° contra 42° pedidos: 4° de distância, metade da
    // folga. Só a saturação separa, e separa por larga margem.
    const quebrado = { r: 228, g: 204, b: 124 };

    expect(corConfere(rgbDoHex(CADARCO), quebrado).confere).toBe(false);
  });

  it('aceita a peça lavada pela luz até o limite da folga, e reprova depois dele', () => {
    // Reflexo e luz ambiente tiram saturação, e isso é iluminação normal, não defeito. A folga
    // existe para essa faixa, e o teste marca onde ela acaba.
    const pedida = rgbDoHex(CABEDAL);

    expect(corConfere(pedida, { r: 40, g: 84, b: 172 }).confere).toBe(true);
    expect(corConfere(pedida, { r: 40, g: 84, b: 172 }, { saturacao: 0.01 }).confere).toBe(false);
  });

  it('cor MAIS saturada na tela do que a pedida não é reprovada pela folga', () => {
    // A folga é só para baixo, de propósito. Nenhuma iluminação normal satura uma peça acima do
    // material dela, então reprovar por isso seria inventar um defeito; e se acontecesse, o eixo
    // do matiz continua de pé para acusar o que importa.
    const veredito = corConfere(rgbDoHex('#8899AA'), { r: 0, g: 60, b: 120 });

    expect(veredito.confere).toBe(true);
  });
});
