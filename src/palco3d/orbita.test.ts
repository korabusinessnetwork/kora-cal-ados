import { describe, expect, it } from 'vitest';

import { orbitaInicial, orbitarPorArraste, posicaoDaCamera, travarNoPolo } from './orbita';

const ALVO = { x: 0, y: 0.05, z: 0 };

/** Distância da câmera até o alvo, para provar que a órbita não aproxima nem afasta. */
function distanciaAte(orbita: Parameters<typeof posicaoDaCamera>[0]): number {
  const camera = posicaoDaCamera(orbita, ALVO);

  return Math.hypot(camera.x - ALVO.x, camera.y - ALVO.y, camera.z - ALVO.z);
}

describe('orbitarPorArraste', () => {
  it('arrastar na horizontal mexe só no azimute', () => {
    const antes = orbitaInicial(0.5);
    const depois = orbitarPorArraste(antes, 40, 0);

    expect(depois.azimute).not.toBe(antes.azimute);
    expect(depois.elevacao).toBe(antes.elevacao);
  });

  it('arrastar na vertical mexe só na elevação', () => {
    const antes = orbitaInicial(0.5);
    const depois = orbitarPorArraste(antes, 0, 40);

    expect(depois.elevacao).not.toBe(antes.elevacao);
    expect(depois.azimute).toBe(antes.azimute);
  });

  it('arrastar para a direita gira a peça para a direita, e não ao contrário', () => {
    // Sinal invertido aqui é a diferença entre "intuitivo" e "quebrado", e o princípio nº1 é
    // explícito sobre qual dos dois vale. Arrastar para a direita move a CÂMERA para a
    // esquerda, ou seja, diminui o azimute.
    const antes = orbitaInicial(0.5);

    expect(orbitarPorArraste(antes, 40, 0).azimute).toBeLessThan(antes.azimute);
  });

  it('arrastar para baixo levanta o ponto de vista, e para cima abaixa', () => {
    // O mesmo "agarrar a peça" do eixo horizontal, aplicado ao vertical: puxar a peça para baixo
    // inclina o topo dela na direção de quem olha, ou seja, a câmera sobe. É a convenção do
    // `OrbitControls` do three, e é o que mantém os dois eixos com a mesma lógica. Inverter só um
    // deles é exatamente o que faz um controle de órbita parecer quebrado.
    //
    // Este teste já nasceu errado uma vez, afirmando o contrário, e foi ele que estava errado, não
    // o código. Fica registrado para ninguém "consertar" o sinal de volta.
    const antes = orbitaInicial(0.5);

    // Elevação é medida a partir do polo norte, então câmera mais alta é elevação MENOR.
    expect(orbitarPorArraste(antes, 0, 40).elevacao).toBeLessThan(antes.elevacao);
    expect(orbitarPorArraste(antes, 0, -40).elevacao).toBeGreaterThan(antes.elevacao);
    expect(posicaoDaCamera(orbitarPorArraste(antes, 0, 40), ALVO).y).toBeGreaterThan(
      posicaoDaCamera(antes, ALVO).y,
    );
  });

  it('a distância nunca muda com o arraste: é órbita, não aproximação', () => {
    let orbita = orbitaInicial(0.5);
    const inicial = distanciaAte(orbita);

    for (const [dx, dy] of [[120, 40], [-300, -90], [17, 400], [-5, -1000]] as const) {
      orbita = orbitarPorArraste(orbita, dx, dy);
      expect(orbita.distancia).toBe(0.5);
      expect(distanciaAte(orbita)).toBeCloseTo(inicial, 12);
    }
  });

  it('o azimute dá a volta sem pular: arrastar muito não teleporta a peça', () => {
    // O azimute é deliberadamente sem limite. Um `%` para mantê-lo em 0..2π introduziria um
    // salto de uma volta inteira num quadro só, e a peça giraria sozinha no meio do arraste.
    let orbita = orbitaInicial(0.5);
    let anterior = orbita.azimute;

    for (let passo = 0; passo < 200; passo += 1) {
      orbita = orbitarPorArraste(orbita, 10, 0);
      expect(Math.abs(orbita.azimute - anterior)).toBeLessThan(0.5);
      anterior = orbita.azimute;
    }
  });
});

describe('travarNoPolo', () => {
  it('não deixa a câmera chegar ao polo norte', () => {
    // Exatamente no polo o "para cima" da câmera fica indefinido e a imagem gira sozinha.
    expect(travarNoPolo(0)).toBeGreaterThan(0);
    expect(travarNoPolo(-10)).toBeGreaterThan(0);
  });

  it('não deixa a câmera chegar ao polo sul', () => {
    expect(travarNoPolo(Math.PI)).toBeLessThan(Math.PI);
    expect(travarNoPolo(99)).toBeLessThan(Math.PI);
  });

  it('não mexe numa elevação que já está no meio', () => {
    expect(travarNoPolo(Math.PI / 2)).toBe(Math.PI / 2);
  });

  it('arrastar sem parar não vira a cena de cabeça para baixo, nos dois sentidos', () => {
    // O defeito clássico de órbita escrita à mão: passar do polo inverte o sentido do arraste e
    // a cena aparece invertida, dando a sensação de que o controle quebrou. A trava precisa
    // segurar nos dois extremos, e continuar segurando depois de o usuário insistir.
    let paraCima = orbitaInicial(0.5);
    let paraBaixo = orbitaInicial(0.5);

    for (let passo = 0; passo < 500; passo += 1) {
      paraCima = orbitarPorArraste(paraCima, 0, 50);
      paraBaixo = orbitarPorArraste(paraBaixo, 0, -50);
    }

    expect(paraCima.elevacao).toBe(travarNoPolo(0));
    expect(paraBaixo.elevacao).toBe(travarNoPolo(Math.PI));
    // Acima do alvo num extremo e abaixo no outro, e o raio horizontal positivo nos dois, que é
    // o jeito de dizer "nunca chegou ao polo" sem repetir a constante da trava.
    expect(posicaoDaCamera(paraCima, ALVO).y).toBeGreaterThan(ALVO.y);
    expect(posicaoDaCamera(paraBaixo, ALVO).y).toBeLessThan(ALVO.y);
    expect(Math.sin(paraCima.elevacao)).toBeGreaterThan(0);
    expect(Math.sin(paraBaixo.elevacao)).toBeGreaterThan(0);
  });
});

describe('posicaoDaCamera', () => {
  it('fica exatamente à distância pedida do alvo', () => {
    expect(distanciaAte({ azimute: 1.2, elevacao: 0.9, distancia: 0.42 })).toBeCloseTo(0.42, 12);
  });

  it('orbita em volta do alvo, não em volta da origem', () => {
    // Sem isto a peça, que está acima do chão, giraria em torno de um ponto fora dela e sairia
    // do quadro ao ser girada.
    const camera = posicaoDaCamera({ azimute: 0, elevacao: Math.PI / 2, distancia: 1 }, ALVO);

    expect(camera.y).toBeCloseTo(ALVO.y, 12);
  });

  it('com elevação no equador a câmera fica na altura do alvo', () => {
    const camera = posicaoDaCamera({ azimute: 0.7, elevacao: Math.PI / 2, distancia: 2 }, ALVO);

    expect(camera.y).toBeCloseTo(ALVO.y, 12);
  });

  it('elevação menor põe a câmera mais alta', () => {
    const alta = posicaoDaCamera({ azimute: 0, elevacao: 0.4, distancia: 1 }, ALVO);
    const baixa = posicaoDaCamera({ azimute: 0, elevacao: 1.4, distancia: 1 }, ALVO);

    expect(alta.y).toBeGreaterThan(baixa.y);
  });
});

describe('orbitaInicial', () => {
  it('começa de frente e um pouco de cima, como quem segura o calçado na mão', () => {
    const orbita = orbitaInicial(0.6);
    const camera = posicaoDaCamera(orbita, ALVO);

    expect(camera.y).toBeGreaterThan(ALVO.y);
    expect(orbita.distancia).toBe(0.6);
  });

  it('a vista inicial já respeita a trava do polo', () => {
    expect(travarNoPolo(orbitaInicial(1).elevacao)).toBe(orbitaInicial(1).elevacao);
  });
});
