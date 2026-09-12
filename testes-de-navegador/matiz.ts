// A matemática da comparação de cor, separada de tudo que precisa de navegador.
//
// Mora sozinha, e não dentro do teste, por um motivo que o projeto já pagou caro em outro lugar:
// regra escondida no arquivo que nenhum teste alcança é regra que ninguém revisa. O teste de cor
// na tela só roda quando há Chrome na máquina; a decisão de "estas duas cores são a mesma" precisa
// ter teste SEMPRE, inclusive numa máquina sem navegador nenhum.
//
// Por que matiz, e não distância entre os três canais: a peça na tela está iluminada. A face de
// cima recebe mais luz que a de lado, então o mesmo material sai em brilhos diferentes no mesmo
// quadro. O que a iluminação NÃO faz é girar a cor: um azul iluminado continua azul. Já uma
// conversão de sRGB para linear trocada, que é exatamente o defeito que o princípio nº1 persegue,
// muda o brilho MUITO e o matiz pouco. Comparar brilho acusaria a luz; comparar matiz acusa a
// conversão.

/** Uma cor em 0..255 por canal, do jeito que sai do framebuffer. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#1F4FA8` vira `{r:31,g:79,b:168}`. Aceita com e sem `#`, em qualquer caixa. */
export function rgbDoHex(hex: string): Rgb {
  const limpo = hex.trim().replace(/^#/, '');

  if (!/^[0-9a-fA-F]{6}$/.test(limpo)) {
    throw new Error(`hex inválido: ${JSON.stringify(hex)}`);
  }

  return {
    r: Number.parseInt(limpo.slice(0, 2), 16),
    g: Number.parseInt(limpo.slice(2, 4), 16),
    b: Number.parseInt(limpo.slice(4, 6), 16),
  };
}

/**
 * A saturação em 0..1, pela definição do HSV: quanto o canal mais forte se afasta do mais fraco.
 *
 * Existe para o teste poder dizer "esta cor é cinza" antes de perguntar o matiz dela. Cinza não
 * tem matiz, e perguntar mesmo assim devolve um número que parece resposta e não é.
 */
export function saturacao({ r, g, b }: Rgb): number {
  const maximo = Math.max(r, g, b);

  return maximo === 0 ? 0 : (maximo - Math.min(r, g, b)) / maximo;
}

/**
 * O matiz em graus, 0 a 360, ou `null` quando a cor é cinza demais para ter um.
 *
 * O corte de saturação é parâmetro e não constante escondida: a sola de prova é `#F2F2F2`, que é
 * cinza de propósito, e o teste precisa poder dizer "esta eu comparo como neutra" em vez de
 * inventar um matiz para ela.
 */
export function matiz(cor: Rgb, corteDeSaturacao = 0.1): number | null {
  const { r, g, b } = cor;
  const maximo = Math.max(r, g, b);
  const minimo = Math.min(r, g, b);
  const amplitude = maximo - minimo;

  if (amplitude === 0 || saturacao(cor) < corteDeSaturacao) return null;

  const setor =
    maximo === r
      ? ((g - b) / amplitude + 6) % 6
      : maximo === g
        ? (b - r) / amplitude + 2
        : (r - g) / amplitude + 4;

  return (setor * 60) % 360;
}

/**
 * A distância entre dois matizes, pelo caminho curto do círculo.
 *
 * Sem o caminho curto, 359° e 1° pareceriam 358° de distância quando na verdade são 2°, e um
 * vermelho na tela seria reprovado por ser vermelho.
 */
export function distanciaDeMatiz(um: number, outro: number): number {
  const bruta = Math.abs(((um % 360) + 360) % 360 - (((outro % 360) + 360) % 360));

  return Math.min(bruta, 360 - bruta);
}

/** As duas folgas do veredito. Separadas porque medem coisas diferentes, ver `corConfere`. */
export interface Tolerancias {
  /** Quanto o matiz pode girar, em graus. */
  graus?: number;
  /** Quanto a saturação pode cair, de 0 a 1. */
  saturacao?: number;
}

/**
 * O veredito do princípio nº1 para um par de cores: a cor que apareceu é a cor que se pediu?
 *
 * Confere em DOIS eixos, e os dois são necessários. A história de por que, porque ela custou uma
 * mutação sobrevivente para ser descoberta:
 *
 * **Matiz** pega a troca de cor entre peças, que é o defeito grosso: a sola vermelha pintando o
 * cadarço dá dezenas ou centenas de graus. A folga de 8° existe porque a luz difusa move o matiz
 * um pouco (as duas sondas em navegador acharam 1° a 2°).
 *
 * **Saturação** pega o que o matiz não vê, e é o defeito que este projeto mais teme: a conversão
 * de sRGB para linear trocada. Medida na tela, pular a conversão desloca o matiz do cabedal só de
 * 219° para 211°, que passa por dentro da folga de 8°, mas derruba a saturação de 0,815 para
 * 0,537. A assimetria tem causa física: iluminação difusa MULTIPLICA os três canais, o que
 * preserva a razão entre eles e portanto a saturação; um erro de gama aplica uma curva, que
 * comprime canal escuro e canal claro de formas diferentes e desmancha a razão.
 *
 * Por isso a folga de saturação é só para BAIXO. Reflexo especular e luz ambiente lavam a cor,
 * então uma peça na tela pode ser menos saturada que o hex escolhido; nenhuma iluminação normal a
 * deixa MAIS saturada, e uma que deixasse seria notícia, não ruído.
 */
export function corConfere(
  pedida: Rgb,
  naTela: Rgb,
  { graus = 8, saturacao: folgaDeSaturacao = 0.12 }: Tolerancias = {},
): { confere: boolean; motivo: string } {
  const matizPedido = matiz(pedida);
  const matizNaTela = matiz(naTela);

  if (matizPedido === null) {
    return matizNaTela === null
      ? { confere: true, motivo: 'as duas são neutras' }
      : { confere: false, motivo: `pedida é neutra e a tela veio com matiz ${round(matizNaTela)}°` };
  }

  if (matizNaTela === null) {
    return { confere: false, motivo: `pedida tem matiz ${round(matizPedido)}° e a tela veio neutra` };
  }

  const distancia = distanciaDeMatiz(matizPedido, matizNaTela);
  const satPedida = saturacao(pedida);
  const satNaTela = saturacao(naTela);
  const queda = satPedida - satNaTela;
  const motivo =
    `matiz pedido ${round(matizPedido)}°, na tela ${round(matizNaTela)}°, distância ${round(distancia)}°; ` +
    `saturação pedida ${satPedida.toFixed(2)}, na tela ${satNaTela.toFixed(2)}, queda ${queda.toFixed(2)}`;

  return { confere: distancia <= graus && queda <= folgaDeSaturacao, motivo };
}

function round(numero: number): number {
  return Math.round(numero);
}
