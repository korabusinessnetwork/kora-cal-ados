// O primeiro teste deste projeto que olha a cor na TELA, e não a cor no arquivo.
//
// Toda a suíte até aqui conferia o número escrito no glTF. Entre esse número e o pixel que uma
// pessoa enxerga ainda existem a conversão de sRGB para linear e o renderizador, e é exatamente
// essa distância que o princípio nº1 do projeto existe para vigiar. Um teste que para no arquivo
// aprova um `baseColorFactor` correto que chega torto na tela.
//
// Pulado, e não reprovado, numa máquina sem Chrome: mesmo molde de `skipIf(!temAmbiente)` dos
// testes de banco. O risco assumido, e ele é real, está na §"Fragilidade" de
// `specs/cor-na-tela.md`: este teste depende de um navegador instalado e de renderização por
// software, então ele é o mais lento e o mais frágil da suíte. O troco é ser o único que responde
// a pergunta que o projeto inteiro gira em torno de responder.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AbaDeTeste, CHROME } from './chrome';
import { corConfere, matiz, rgbDoHex, saturacao, type Rgb } from './matiz';
import {
  clicarBotao,
  clicarNaCena,
  escreverNoControle,
  ESPERAR_CENA,
  INSTALAR_LEITOR,
  LER_PIXELS,
  subirServidor,
  TEXTO_DA_TELA,
} from './sonda';

/** As cores de `composicaoDeProva()`, que é o que a tela abre mostrando. */
const PEDIDAS = {
  sola: '#F2F2F2',
  cabedal: '#1F4FA8',
  cadarco: '#E8B33C',
} as const;

interface Grupo extends Rgb {
  pixels: number;
}

interface Medida {
  largura: number;
  altura: number;
  pintados: number;
  grupos: Grupo[];
}

/**
 * A face que melhor representa uma peça na tela: mesmo matiz da cor pedida, e a mais saturada
 * entre as candidatas.
 *
 * Duas etapas, e cada uma responde a um problema diferente. O matiz separa as PEÇAS umas das
 * outras, porque a face de cima e a de lado da mesma peça saem em brilhos diferentes no mesmo
 * quadro e só o matiz as mantém juntas. A saturação máxima escolhe qual dessas faces perguntar,
 * e a resposta é: a menos lavada pela luz. Reflexo e luz ambiente só tiram saturação, nunca
 * acrescentam, então a face mais saturada é a que está mais perto da cor do material de verdade.
 *
 * Sem a segunda etapa o teste perguntaria à face mais VISÍVEL, que é a mais iluminada, que é
 * justamente a que menos sabe responder.
 */
function faceDaPeca(medida: Medida, hexPedido: string): Grupo | undefined {
  const pedida = rgbDoHex(hexPedido);

  // Folga de saturação aberta no peneiramento: aqui a pergunta é só "esta face é desta peça?".
  // O julgamento de saturação vem depois, sobre a face escolhida, e é ele que vale.
  const candidatas = medida.grupos.filter(
    (grupo) => corConfere(pedida, grupo, { saturacao: 1 }).confere,
  );

  return candidatas.reduce<Grupo | undefined>(
    (melhor, grupo) =>
      melhor === undefined || saturacao(grupo) > saturacao(melhor) ? grupo : melhor,
    undefined,
  );
}

/** A face da peça, já julgada nos dois eixos. `undefined` quando a peça não está na tela. */
function grupoDaCor(medida: Medida, hexPedido: string): Grupo | undefined {
  const face = faceDaPeca(medida, hexPedido);

  return face !== undefined && corConfere(rgbDoHex(hexPedido), face).confere ? face : undefined;
}

describe.skipIf(CHROME === null)('a cor escolhida é a cor que aparece, medida em navegador', () => {
  let aba: AbaDeTeste;
  let parar: () => Promise<void>;

  beforeAll(async () => {
    const servidor = await subirServidor();

    parar = servidor.parar;
    aba = await AbaDeTeste.abrir(`${servidor.url}/?tela=composicao`);

    await aba.avaliar(INSTALAR_LEITOR);

    const cena = await aba.avaliar<{ pronto: boolean; pintados: number }>(ESPERAR_CENA);

    // Sem esta guarda, uma cena que nunca desenhou reprovaria os testes de cor com a mensagem
    // errada: eles diriam "a cor não confere" quando o defeito foi "não há cena".
    expect(cena.pronto, 'a cena nunca desenhou nada dentro do limite de espera').toBe(true);
  }, 120_000);

  // O mesmo orçamento da abertura, e pela mesma razão. Desmontar custa o que montar custa: matar o
  // Chrome, esperar o processo sair, apagar um perfil de navegador inteiro (milhares de arquivos,
  // com repetição enquanto o Windows ainda segura os identificadores) e derrubar o Vite. Isso
  // passava dos 10 segundos padrão numa máquina carregada, e o resultado era o pior possível: os 5
  // testes passavam e a suíte ficava vermelha no encerramento. Baseline que pisca vermelho sozinho
  // é o que o R3-A33 já tinha consertado uma vez, porque ele impede a regra de ouro de funcionar.
  afterAll(async () => {
    await aba?.fechar();
    await parar?.();
  }, 120_000);

  /**
   * Relê a tela até a condição valer, e devolve a última medida mesmo quando ela não valeu.
   *
   * Existe porque `LER_PIXELS` responde no segundo quadro depois do pedido, e isso garante que o
   * quadro é RECENTE, não que ele já contenha a mudança recém pedida. Entre escrever no campo e a
   * peça sair repintada existem o commit do React e o desenho seguinte do palco, e nada obriga os
   * dois a caberem em dois quadros numa máquina carregada. O leitor só repete a leitura quando o
   * quadro vem inteiro vazio, nunca quando ele vem pintado com a cor ANTIGA, que é justamente o
   * caso desta corrida.
   *
   * Não é hipótese: em 2026-09-12 a suíte completa reprovou 1 vez em 4 execuções aqui, com
   * "a sola não ficou vermelha", e o mesmo teste passava sozinho. Esperar pela condição, e não por
   * um número fixo de quadros, é o molde que `ESPERAR_CENA` já usa neste arquivo pelo mesmo motivo.
   *
   * Devolver a última medida em vez de estourar mantém a mensagem de falha sendo a do `expect` que
   * chamou, que é a que diz o que se esperava ver na tela. Um teste que fica vermelho continua
   * ficando vermelho, e só perde a parte da vermelhidão que era ansiedade.
   */
  async function medirAte(condicao: (medida: Medida) => boolean, limiteMs = 5_000): Promise<Medida> {
    const limite = Date.now() + limiteMs;
    let medida = await aba.avaliar<Medida>(LER_PIXELS);

    while (!condicao(medida) && Date.now() < limite) {
      medida = await aba.avaliar<Medida>(LER_PIXELS);
    }

    return medida;
  }

  it('o calçado aparece montado, com as três peças na tela', async () => {
    // O item 1 da conferência a olho. Uma tela preta, um erro de validação ou um calçado sem uma
    // das peças caem todos aqui, antes de qualquer pergunta sobre cor.
    const medida = await aba.avaliar<Medida>(LER_PIXELS);

    expect(medida.pintados).toBeGreaterThan(2_000);

    const encontradas = Object.entries(PEDIDAS).map(([zona, hex]) => [zona, grupoDaCor(medida, hex)]);

    expect(Object.fromEntries(encontradas.map(([zona, grupo]) => [zona, grupo !== undefined]))).toEqual(
      { sola: true, cabedal: true, cadarco: true },
    );
  });

  it('a cor de cada peça na tela é a cor do hex escolhido, em matiz e em saturação', async () => {
    // **Este é o teste.** É o princípio nº1 virando número: para cada zona, a cor pedida no código
    // e a cor medida no pixel, lado a lado, com o veredito no meio.
    //
    // O `motivo` entra na mensagem de falha de propósito. Um "esperava true, veio false" aqui
    // mandaria alguém abrir o navegador para descobrir o que houve, e a graça deste teste é
    // justamente não precisar disso: a linha já diz se o matiz girou, se a saturação caiu, ou se
    // a peça nem estava na tela.
    const medida = await aba.avaliar<Medida>(LER_PIXELS);

    const veredito = Object.entries(PEDIDAS).map(([zona, hex]) => {
      const face = faceDaPeca(medida, hex);

      return {
        zona,
        confere: face !== undefined && corConfere(rgbDoHex(hex), face).confere,
        motivo: face === undefined ? 'nenhuma face com este matiz na tela' : corConfere(rgbDoHex(hex), face).motivo,
      };
    });

    expect(veredito.map(({ zona, confere, motivo }) => ({ zona, confere, motivo }))).toEqual([
      { zona: 'sola', confere: true, motivo: expect.any(String) },
      { zona: 'cabedal', confere: true, motivo: expect.any(String) },
      { zona: 'cadarco', confere: true, motivo: expect.any(String) },
    ]);
  });

  it('trocar a cor de uma zona muda só aquela peça', async () => {
    // O item 3. A sola vermelha não pode pintar o cadarço, e a prova mais dura disponível é a
    // contagem de pixels das outras duas peças ficar IGUAL, e não só parecida.
    const antes = await aba.avaliar<Medida>(LER_PIXELS);
    const azulAntes = grupoDaCor(antes, PEDIDAS.cabedal);
    const amareloAntes = grupoDaCor(antes, PEDIDAS.cadarco);

    await aba.avaliar(escreverNoControle('cor da zona sola', '#cc2222'));

    const depois = await medirAte((medida) => grupoDaCor(medida, '#CC2222') !== undefined);

    expect(grupoDaCor(depois, '#CC2222'), 'a sola não ficou vermelha').toBeDefined();
    expect(grupoDaCor(depois, PEDIDAS.sola), 'sobrou branco onde a sola estava').toBeUndefined();

    expect(grupoDaCor(depois, PEDIDAS.cabedal)?.pixels).toBe(azulAntes?.pixels);
    expect(grupoDaCor(depois, PEDIDAS.cadarco)?.pixels).toBe(amareloAntes?.pixels);

    // Devolve a tela ao estado inicial para os testes seguintes não herdarem a sola vermelha, e
    // espera a volta acontecer: sair daqui com a tela em trânsito empurraria esta mesma corrida
    // para dentro do teste seguinte, onde ela seria ainda mais difícil de ler.
    await aba.avaliar(escreverNoControle('cor da zona sola', PEDIDAS.sola.toLowerCase()));
    await medirAte((medida) => grupoDaCor(medida, PEDIDAS.sola) !== undefined);
  });

  it('clicar numa peça devolve o nome dela, e o nome bate com a peça clicada', async () => {
    // O item 5. Clica no alto da cena, que é onde o cadarço está, e confere que o nome que aparece
    // é o do cadarço e não o de outra peça qualquer.
    await aba.avaliar(clicarNaCena(0.5, 0.42));

    const texto = await aba.avaliar<string>(TEXTO_DA_TELA);

    expect(texto).toMatch(/prova-(cadarco-reto|cabedal-baixo)/);
  });

  it('trocar de peça não quebra a tela, nos dois sentidos (BUG-019)', async () => {
    // A regressão do BUG-019 tem teste puro em `composicaoDaTela.test.ts`, e ele é o que explica o
    // defeito. Este aqui é o outro lado: prova que o conserto chega até o PIXEL, porque o sintoma
    // relatado não foi um valor errado, foi a tela inteira virar uma linha de erro.
    await aba.avaliar(clicarBotao('Cabedal cano alto'));

    // Trocar de modelo é mais lento que trocar uma cor: recarrega geometria. A mesma espera, pelo
    // mesmo motivo.
    const alto = await medirAte(
      (medida) => medida.pintados > 2_000 && grupoDaCor(medida, PEDIDAS.cabedal) !== undefined,
    );

    expect(alto.pintados, 'a tela apagou ao trocar para o cano alto').toBeGreaterThan(2_000);
    expect(grupoDaCor(alto, PEDIDAS.cabedal), 'o cabedal sumiu no cano alto').toBeDefined();

    await aba.avaliar(clicarBotao('Cabedal baixo'));

    const baixo = await medirAte(
      (medida) => medida.pintados > 2_000 && grupoDaCor(medida, PEDIDAS.cabedal) !== undefined,
    );

    expect(baixo.pintados, 'a tela apagou na volta para o cabedal baixo').toBeGreaterThan(2_000);
    expect(grupoDaCor(baixo, PEDIDAS.cabedal), 'o cabedal sumiu na volta').toBeDefined();
  });
});
