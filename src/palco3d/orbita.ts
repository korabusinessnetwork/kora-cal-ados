// A órbita da câmera (ADR-007 D2), em aritmética esférica pura.
//
// **Não importa `three` e não toca no DOM**, de propósito. É o que torna "gira com o mouse"
// verificável sem navegador: o palco tem GPU e nenhum teste alcança, então toda regra que puder
// sair de lá tem que sair. O que sobra no palco é traduzir evento do ponteiro em número e
// escrever o resultado na câmera.
//
// Órbita e não voo livre: a câmera anda sobre uma esfera de raio fixo em volta do alvo, então
// arrastar nunca aproxima nem afasta. É a manipulação que o ADR-007 D2 pede (girar o calçado
// para ver o outro lado), não uma câmera de jogo.

/** Onde a câmera está, em coordenadas esféricas ao redor do alvo. */
export interface Orbita {
  /** Radianos em volta do eixo vertical. Sem limite: dar voltas é comportamento válido. */
  azimute: number;
  /** Radianos a partir do polo norte. Travado longe de 0 e de π, ver `LIMITE_DO_POLO`. */
  elevacao: number;
  /** Metros até o alvo. O arraste nunca mexe nisto. */
  distancia: number;
}

export interface PontoNoEspaco {
  x: number;
  y: number;
  z: number;
}

/**
 * Quão perto do polo a câmera pode chegar.
 *
 * Exatamente no polo o vetor "para cima" da câmera fica indefinido e a imagem começa a girar
 * sozinha em volta do próprio eixo, sem ninguém ter pedido. Passar do polo é pior: a cena
 * aparece de cabeça para baixo e o arraste inverte de sentido, o que dá a sensação de que o
 * controle quebrou. Os dois são o defeito clássico de órbita escrita à mão, e a trava custa
 * uma linha.
 */
const LIMITE_DO_POLO = 0.05;

/** Quantos radianos por pixel arrastado. Meia tela horizontal dá quase meia volta. */
const RADIANOS_POR_PIXEL = 0.008;

/** A vista inicial: de frente, um pouco de cima, como alguém segurando o calçado na mão. */
export function orbitaInicial(distancia: number): Orbita {
  return { azimute: Math.PI / 4, elevacao: Math.PI / 2.6, distancia };
}

/**
 * O arraste do ponteiro vira uma órbita nova.
 *
 * Horizontal mexe só no azimute e vertical mexe só na elevação: são eixos independentes, e
 * misturá-los faria um arraste reto na tela produzir um movimento torto na cena.
 *
 * O sinal de cada eixo segue a expectativa de quem arrasta um objeto, não de quem move uma
 * câmera. Arrastar para a direita gira a peça para a direita, ou seja, a câmera anda para a
 * esquerda. **O eixo vertical obedece à mesma lógica**, e é onde a intuição engana: puxar a peça
 * para baixo inclina o topo dela na direção de quem olha, então arrastar para baixo LEVANTA a
 * câmera. É a mesma convenção do `OrbitControls` do three, e o que importa é que os dois eixos
 * concordem; inverter só um deles é o que faz o controle parecer quebrado. O princípio nº1 é
 * explícito sobre qual dos dois vale.
 */
export function orbitarPorArraste(atual: Orbita, deltaX: number, deltaY: number): Orbita {
  return {
    azimute: atual.azimute - deltaX * RADIANOS_POR_PIXEL,
    elevacao: travarNoPolo(atual.elevacao - deltaY * RADIANOS_POR_PIXEL),
    distancia: atual.distancia,
  };
}

/** Nunca deixa a elevação alcançar 0 nem π. Ver `LIMITE_DO_POLO`. */
export function travarNoPolo(elevacao: number): number {
  return Math.min(Math.PI - LIMITE_DO_POLO, Math.max(LIMITE_DO_POLO, elevacao));
}

/**
 * A posição da câmera no espaço, a partir da órbita e do alvo.
 *
 * Convenção do three.js: Y é para cima. A elevação é medida do polo norte para baixo, que é a
 * convenção esférica padrão, e é por isso que Y usa `cos` enquanto X e Z usam `sin`.
 */
export function posicaoDaCamera(orbita: Orbita, alvo: PontoNoEspaco): PontoNoEspaco {
  const { azimute, elevacao, distancia } = orbita;
  const raioHorizontal = distancia * Math.sin(elevacao);

  return {
    x: alvo.x + raioHorizontal * Math.sin(azimute),
    y: alvo.y + distancia * Math.cos(elevacao),
    z: alvo.z + raioHorizontal * Math.cos(azimute),
  };
}
