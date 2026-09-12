// As expressões que rodam DENTRO da página, e o servidor que serve a página.
//
// A medição acontece lá dentro, e não aqui, por uma razão de custo: ler o framebuffer no lugar
// onde ele existe devolve números; trazer a imagem para cá exigiria decodificar PNG para chegar
// nos mesmos números. O protocolo de DevTools carrega JSON muito melhor do que carrega imagem.
//
// Estas expressões são texto porque é assim que `Runtime.evaluate` as recebe. O preço é não terem
// verificação de tipo; o troco é que a régua que julga o resultado delas (`matiz.ts`) é TypeScript
// normal, com teste próprio que roda mesmo numa máquina sem navegador.

import { createServer, type ViteDevServer } from 'vite';

/** Um servidor de verdade servindo o app de verdade, na porta que o sistema der. */
export async function subirServidor(): Promise<{ url: string; parar: () => Promise<void> }> {
  // Porta zero pela mesma razão do Chrome: a porta 5173 costuma estar ocupada pelo `npm run dev`
  // de quem está trabalhando, e um teste que exige a máquina parada é um teste que ninguém roda.
  //
  // `host` fixo em IPv4 não é preciosismo: sem ele o Vite escuta só em `::1`, o Chrome resolve
  // `127.0.0.1` por IPv4, e a aba abre num `ERR_CONNECTION_REFUSED` que chega neste teste
  // disfarçado de "a cena nunca desenhou". Foi exatamente assim que ele falhou na primeira vez.
  const servidor: ViteDevServer = await createServer({
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    // O teste não quer saber de HMR nem de abrir navegador sozinho: ele já tem o dele.
    optimizeDeps: { noDiscovery: false },
    logLevel: 'error',
  });

  await servidor.listen();

  const endereco = servidor.httpServer?.address();

  if (endereco === null || endereco === undefined || typeof endereco === 'string') {
    await servidor.close();
    throw new Error('o servidor de teste subiu sem porta utilizável');
  }

  return {
    url: `http://127.0.0.1:${endereco.port}`,
    parar: () => servidor.close(),
  };
}

/**
 * Espera a cena existir e ter desenhado algo.
 *
 * Sem esta espera o teste mediria a tela de "Montando o calçado…": o canvas já existe, o WebGL já
 * respondeu, e ainda não há um único pixel de calçado. O corte é por quantidade de pixel que não é
 * fundo, e não por tempo, porque tempo fixo é lento numa máquina rápida e curto numa lenta.
 */
export const ESPERAR_CENA = `(async () => {
  const limite = Date.now() + 30000;

  while (Date.now() < limite) {
    const tela = document.querySelector('canvas');

    if (tela) {
      const medida = await window.__koraLerPixels();

      if (medida && medida.pintados > 500) return { pronto: true, pintados: medida.pintados };
    }

    await new Promise((segue) => setTimeout(segue, 100));
  }

  return { pronto: false, pintados: 0 };
})()`;

/**
 * Instala o leitor de framebuffer na página.
 *
 * Ele lê no quadro SEGUINTE ao pedido, e não no atual, porque o palco desenha num laço de
 * `requestAnimationFrame`: entrar na fila garante que o que se lê é um quadro recém desenhado, e
 * não o resto de um que o compositor já limpou.
 *
 * O agrupamento joga fora os 2 bits baixos de cada canal antes de contar. É o que transforma o
 * degradê de iluminação de uma face em UMA entrada na contagem, em vez de dezenas de tons quase
 * iguais que empurrariam a peça de verdade para fora das primeiras posições.
 */
export const INSTALAR_LEITOR = `(() => {
  window.__koraLerPixels = (tentativas = 5) => new Promise((pronto) => {
    const tela = document.querySelector('canvas');

    if (!tela) return pronto(null);

    const gl = tela.getContext('webgl2') || tela.getContext('webgl');

    if (!gl) return pronto(null);

    const tentar = (restam) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const largura = gl.drawingBufferWidth;
      const altura = gl.drawingBufferHeight;
      const dados = new Uint8Array(largura * altura * 4);

      gl.readPixels(0, 0, largura, altura, gl.RGBA, gl.UNSIGNED_BYTE, dados);

      const contagem = new Map();
      let pintados = 0;

      for (let i = 0; i < dados.length; i += 4) {
        const r = dados[i], g = dados[i + 1], b = dados[i + 2];

        // O fundo da cena é quase preto. Contá-lo faria o fundo ganhar de qualquer peça por
        // ordem de grandeza, e as peças nunca apareceriam nas primeiras posições.
        if (r < 40 && g < 40 && b < 40) continue;

        pintados++;

        const chave = (r >> 2) + ',' + (g >> 2) + ',' + (b >> 2);
        contagem.set(chave, (contagem.get(chave) || 0) + 1);
      }

      // Um quadro sem nada pintado costuma ser um quadro que o compositor limpou antes da
      // leitura. Tentar de novo é mais barato, e mais honesto, do que reprovar por isso.
      if (pintados === 0 && restam > 0) return tentar(restam - 1);

      const grupos = [...contagem.entries()]
        .sort((um, outro) => outro[1] - um[1])
        .slice(0, 12)
        .map(([chave, quantos]) => {
          const [r, g, b] = chave.split(',').map((n) => Number(n) << 2);

          return { r, g, b, pixels: quantos };
        });

      pronto({ largura, altura, pintados, grupos });
    }));

    tentar(tentativas);
  });

  return true;
})()`;

/** Mede a cena agora e devolve os grupos de cor. */
export const LER_PIXELS = 'window.__koraLerPixels()';

/** Clica no botão cujo rótulo visível é exatamente este texto. */
export function clicarBotao(rotulo: string): string {
  return `(() => {
    const alvo = [...document.querySelectorAll('button')]
      .find((botao) => botao.textContent.trim() === ${JSON.stringify(rotulo)});

    if (!alvo) throw new Error('não achei o botão ' + ${JSON.stringify(rotulo)});

    alvo.click();

    return true;
  })()`;
}

/**
 * Escreve num controle de formulário do jeito que o React entende.
 *
 * Mexer em `input.value` direto não é suficiente: o React guarda o valor anterior no nó e ignora
 * um `input` cujo valor "não mudou" na contabilidade dele. Chamar o setter nativo do protótipo é o
 * caminho conhecido para o React ver a mudança, e é o que faz este teste exercitar o MESMO
 * caminho de código que um dedo humano exercita.
 */
export function escreverNoControle(rotulo: string, valor: string): string {
  return `(() => {
    const alvo = document.querySelector('[aria-label=' + ${JSON.stringify(JSON.stringify(rotulo))} + ']');

    if (!alvo) throw new Error('não achei o controle ' + ${JSON.stringify(rotulo)});

    const prototipo = Object.getPrototypeOf(alvo);
    const setter = Object.getOwnPropertyDescriptor(prototipo, 'value').set;

    setter.call(alvo, ${JSON.stringify(valor)});
    alvo.dispatchEvent(new Event('input', { bubbles: true }));
    alvo.dispatchEvent(new Event('change', { bubbles: true }));

    return alvo.value;
  })()`;
}

/** O texto visível da tela, para as asserções que não são sobre cor. */
export const TEXTO_DA_TELA = 'document.querySelector("main").innerText';

/** Clica no ponto da cena, em fração da largura e da altura do canvas. */
export function clicarNaCena(fracaoX: number, fracaoY: number): string {
  return `(() => {
    const tela = document.querySelector('canvas');
    const caixa = tela.getBoundingClientRect();
    const x = caixa.left + caixa.width * ${fracaoX};
    const y = caixa.top + caixa.height * ${fracaoY};

    for (const tipo of ['pointerdown', 'pointerup', 'click']) {
      tela.dispatchEvent(new PointerEvent(tipo, {
        bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true,
      }));
    }

    return { x, y };
  })()`;
}
