// Um Chrome de verdade, dirigido pelo protocolo de DevTools, sem instalar dependência nenhuma.
//
// Por que isto existe: até 2026-09-11 este projeto acreditava que "não dá para testar o 3D". A
// frase era verdadeira sobre o **jsdom**, que não tem WebGL, e o projeto a tratou como verdade
// sobre a máquina. Não é: há Chrome instalado, ele roda WebGL por software em modo headless, e o
// Node 24 traz `WebSocket` global. O custo em dependência é zero, e o que se ganha é o primeiro
// teste do projeto que olha a cor na TELA, e não a cor no arquivo.
//
// O que este módulo NÃO é: um Puppeteer. Ele fala o pedaço do protocolo que um teste precisa,
// `Target` para abrir a aba e `Runtime.evaluate` para rodar uma expressão dentro dela, e para por
// aí. Tudo que for medição acontece em JavaScript dentro da página e volta como JSON, porque
// medir lá dentro dispensa decodificar imagem aqui fora.

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Onde procurar o Chrome, em ordem.
 *
 * `CHROME_PATH` vem primeiro porque é a única entrada que uma pessoa controla: numa máquina em que
 * o navegador está num lugar esquisito, ou em que se quer apontar para o Chromium em vez do
 * Chrome, essa variável é a resposta, e ela não exige mexer neste arquivo.
 *
 * Recebe plataforma e ambiente por parâmetro para a lista poder ser conferida por teste numa
 * máquina que não é a do caso. Sem isso, só daria para testar o ramo da própria máquina.
 */
export function caminhosCandidatos(
  plataforma: NodeJS.Platform,
  ambiente: Record<string, string | undefined>,
): string[] {
  const doAmbiente = ambiente.CHROME_PATH?.trim();
  const daPlataforma =
    plataforma === 'win32'
      ? [
          join(ambiente.PROGRAMFILES ?? 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
          join(
            ambiente['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
            'Google\\Chrome\\Application\\chrome.exe',
          ),
          join(ambiente.LOCALAPPDATA ?? '', 'Google\\Chrome\\Application\\chrome.exe'),
          join(ambiente.PROGRAMFILES ?? 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
        ]
      : plataforma === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
          ];

  return (doAmbiente ? [doAmbiente, ...daPlataforma] : daPlataforma).filter(
    (caminho) => caminho.trim() !== '',
  );
}

/** O primeiro candidato que existe no disco, ou `null` numa máquina sem navegador. */
export function acharChrome(
  plataforma: NodeJS.Platform = process.platform,
  ambiente: Record<string, string | undefined> = process.env,
): string | null {
  return caminhosCandidatos(plataforma, ambiente).find((caminho) => existsSync(caminho)) ?? null;
}

/**
 * Tem navegador nesta máquina?
 *
 * Quem lê isto é o `describe.skipIf`, no mesmo molde dos testes de banco: sem ambiente o teste é
 * **pulado, não reprovado**. Reprovar puniria a máquina de quem não tem Chrome por um defeito que
 * não é dela, e um teste que reprova por ambiente vira um teste que todo mundo aprende a ignorar.
 */
export const CHROME = acharChrome();

const ARGUMENTOS = [
  '--headless=new',
  // Sem estes dois não há WebGL numa máquina sem GPU exposta ao headless, e a cena sai preta. É
  // renderização por software: lenta e suficiente, porque o que se mede aqui é cor, não quadros
  // por segundo.
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-networking',
  // Porta zero: o sistema escolhe uma livre. Porta fixa brigaria com uma segunda rodada de testes
  // ou com um Chrome que a pessoa já tenha aberto em modo de depuração.
  '--remote-debugging-port=0',
];

interface Pendente {
  resolve: (valor: unknown) => void;
  reject: (erro: Error) => void;
}

/** Uma aba aberta num Chrome de verdade, pronta para receber expressões. */
export class AbaDeTeste {
  #processo: ChildProcess;
  #socket: WebSocket;
  #perfil: string;
  #sessao = '';
  #proximoId = 1;
  #pendentes = new Map<number, Pendente>();
  #eventos = new Map<string, (() => void)[]>();

  private constructor(processo: ChildProcess, socket: WebSocket, perfil: string) {
    this.#processo = processo;
    this.#socket = socket;
    this.#perfil = perfil;
  }

  /** Sobe o Chrome, abre uma aba no endereço pedido e espera a página carregar. */
  static async abrir(url: string, executavel: string | null = CHROME): Promise<AbaDeTeste> {
    if (executavel === null) throw new Error('sem Chrome nesta máquina');

    const perfil = mkdtempSync(join(tmpdir(), 'kora-chrome-'));
    const processo = spawn(executavel, [...ARGUMENTOS, `--user-data-dir=${perfil}`], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    try {
      const endereco = await enderecoDoNavegador(processo);
      const socket = await conectar(endereco);
      const aba = new AbaDeTeste(processo, socket, perfil);

      aba.#ouvir();

      const { targetId } = (await aba.#enviar('Target.createTarget', { url: 'about:blank' })) as {
        targetId: string;
      };
      const { sessionId } = (await aba.#enviar('Target.attachToTarget', {
        targetId,
        flatten: true,
      })) as { sessionId: string };

      aba.#sessao = sessionId;

      await aba.#enviar('Page.enable', {});
      await aba.irPara(url);

      return aba;
    } catch (erro) {
      processo.kill();
      rmSync(perfil, { recursive: true, force: true });
      throw erro;
    }
  }

  /** Navega e só devolve quando a página terminou de carregar. */
  async irPara(url: string): Promise<void> {
    const carregou = this.#esperarEvento('Page.loadEventFired');

    await this.#enviar('Page.navigate', { url });
    await carregou;
  }

  /**
   * Roda uma expressão dentro da página e devolve o valor dela como JSON.
   *
   * `awaitPromise` está ligado porque toda medição de cor precisa esperar um quadro ser desenhado,
   * e esperar quadro é promessa. Sem isso, o valor voltaria como "uma Promise" e o teste mediria
   * o objeto em vez do pixel.
   */
  async avaliar<T>(expressao: string): Promise<T> {
    const resposta = (await this.#enviar('Runtime.evaluate', {
      expression: expressao,
      awaitPromise: true,
      returnByValue: true,
    })) as {
      result: { value: T };
      exceptionDetails?: { text: string; exception?: { description?: string } };
    };

    if (resposta.exceptionDetails) {
      const { text, exception } = resposta.exceptionDetails;

      throw new Error(`a página lançou: ${exception?.description ?? text}`);
    }

    return resposta.result.value;
  }

  /** Fecha o navegador e apaga o perfil temporário. */
  async fechar(): Promise<void> {
    for (const pendente of this.#pendentes.values()) {
      pendente.reject(new Error('a aba foi fechada com uma chamada em aberto'));
    }
    this.#pendentes.clear();

    try {
      this.#socket.close();
    } catch {
      // Socket já fechado pelo lado de lá: fechar de novo não muda nada.
    }

    this.#processo.kill();
    await new Promise((pronto) => this.#processo.once('exit', pronto));
    rmSync(this.#perfil, { recursive: true, force: true });
  }

  #ouvir(): void {
    this.#socket.addEventListener('message', (evento) => {
      const mensagem = JSON.parse(String((evento as MessageEvent).data)) as {
        id?: number;
        result?: unknown;
        error?: { message: string };
        method?: string;
      };

      if (mensagem.id === undefined) {
        const metodo = mensagem.method ?? '';

        this.#eventos.get(metodo)?.forEach((resolver) => resolver());
        this.#eventos.delete(metodo);

        return;
      }

      const pendente = this.#pendentes.get(mensagem.id);

      if (pendente === undefined) return;

      this.#pendentes.delete(mensagem.id);

      if (mensagem.error) pendente.reject(new Error(mensagem.error.message));
      else pendente.resolve(mensagem.result);
    });
  }

  #esperarEvento(metodo: string): Promise<void> {
    return new Promise((resolver) => {
      this.#eventos.set(metodo, [...(this.#eventos.get(metodo) ?? []), resolver]);
    });
  }

  #enviar(metodo: string, parametros: object): Promise<unknown> {
    const id = this.#proximoId++;
    const mensagem: Record<string, unknown> = { id, method: metodo, params: parametros };

    if (this.#sessao !== '' && !metodo.startsWith('Target.')) mensagem.sessionId = this.#sessao;

    return new Promise((resolve, reject) => {
      this.#pendentes.set(id, { resolve, reject });
      this.#socket.send(JSON.stringify(mensagem));
    });
  }
}

/**
 * O endereço do protocolo, lido da saída de erro do Chrome.
 *
 * O Chrome anuncia `DevTools listening on ws://...` no stderr e não tem outra forma de contar em
 * que porta parou quando a porta é zero. É frágil por natureza, então o tempo limite existe e diz
 * o que aconteceu, em vez de a suíte inteira pendurar sem explicação.
 */
function enderecoDoNavegador(processo: ChildProcess, limiteEmMs = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let acumulado = '';
    const relogio = setTimeout(() => {
      reject(new Error(`o Chrome não anunciou o DevTools em ${limiteEmMs} ms. Saída: ${acumulado}`));
    }, limiteEmMs);

    processo.stderr?.on('data', (pedaco: Buffer) => {
      acumulado += pedaco.toString();

      const achado = /ws:\/\/[^\s]+/.exec(acumulado);

      if (achado) {
        clearTimeout(relogio);
        resolve(achado[0]);
      }
    });

    processo.once('error', (erro) => {
      clearTimeout(relogio);
      reject(erro);
    });
  });
}

function conectar(endereco: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endereco);

    socket.addEventListener('open', () => resolve(socket), { once: true });
    socket.addEventListener('error', () => reject(new Error(`não conectou em ${endereco}`)), {
      once: true,
    });
  });
}
