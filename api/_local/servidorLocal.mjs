// Servidor local das funcoes de `api/v1/**`.
//
// Por que ele existe: o handler tem assinatura Web (`export default { fetch(Request) }`,
// ver `api/README.md`), e a unica forma de dirigir um handler assim hoje seria com deploy.
// Este arquivo abre uma porta HTTP e entrega o mesmo handler ao `curl`, sem segunda
// implementacao do handler, que e o que divergiria da que roda em producao.
//
// Por que ele carrega TypeScript pelo Vite: e o mesmo motivo de
// `supabase/scripts/executar.mjs`, o handler importa `api/_lib/*` e `src/lib/render/*` com
// imports sem extensao, que `moduleResolution: "bundler"` permite e o `node` cru nao
// resolve (ERR_MODULE_NOT_FOUND). O Vite ja e dependencia do projeto e resolve isso em
// tres linhas; tsx/vite-node seriam dependencia nova sem justificativa
// (`memory/restrictions.md`).
//
// Uso: node api/_local/servidorLocal.mjs   (script `npm run api:local`)
// O que ele NAO prova esta em `api/_local/README.md`, leia antes de concluir qualquer
// coisa sobre a Vercel a partir do que sair daqui.

import { createServer as criarServidorVite } from 'vite';
import { createServer as criarServidorHttp } from 'node:http';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Raiz derivada do proprio arquivo, e nao de `process.cwd()`: assim o servidor sobe igual
// sendo chamado da raiz pelo npm ou de dentro de qualquer subdiretorio.
const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const DIRETORIO_DAS_ROTAS = path.join(RAIZ, 'api', 'v1');
const ARQUIVO_DE_AMBIENTE = path.join(RAIZ, '.env.local');

// 5173 e 5174 sao do Vite (`npm run dev`) e costumam estar ocupadas nesta maquina.
const PORTA_PADRAO = 3210;
const VARIAVEL_DA_PORTA = 'PORTA_API_LOCAL';

const EXTENSOES_DE_HANDLER = ['.ts', '.mts', '.js', '.mjs'];
// A Vercel so aceita corpo nos metodos que o tem; o construtor de `Request` recusa corpo em
// GET/HEAD. A lista fica curta de proposito: e a mesma do contrato desta leva.
const METODOS_COM_CORPO = new Set(['POST', 'PUT', 'PATCH']);

const VARIAVEIS_EXIGIDAS_PELA_API = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

// --- ambiente ---------------------------------------------------------------------------

// Equivalente ao `--env-file=.env.local` que os scripts de `supabase/scripts/` usam no
// `package.json`; aqui e feito em codigo porque o comando publicado e `node` puro.
function carregarAmbienteLocal() {
  try {
    process.loadEnvFile(ARQUIVO_DE_AMBIENTE);
    return true;
  } catch {
    // Ausencia de `.env.local` nao impede subir: o servidor sobe e cada chamada responde o
    // 500 que `criarClienteDeServico` levanta. Falhar aqui esconderia o 404 de rota, que e
    // util mesmo sem banco.
    return false;
  }
}

// --- rotas derivadas do sistema de arquivos ---------------------------------------------

function escaparParaRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SEGMENTO_DINAMICO = /^\[(\.\.\.)?(.+)\]$/;

// Uma rota so: caminho do arquivo -> padrao de URL. Escrever uma tabela de rotas a mao
// seria uma segunda definicao da rota, e ela divergiria da Vercel no dia em que alguem
// renomeasse um diretorio, que e justamente o dia em que ninguem olharia para ca.
function montarRota(segmentos, arquivo) {
  const partesDoPadrao = [];
  const partesDoRotulo = [];
  let temCoringa = false;

  for (const segmento of segmentos) {
    const dinamico = SEGMENTO_DINAMICO.exec(segmento);
    if (!dinamico) {
      partesDoPadrao.push(escaparParaRegex(segmento));
      partesDoRotulo.push(segmento);
      continue;
    }
    const catchAll = Boolean(dinamico[1]);
    if (catchAll) temCoringa = true;
    partesDoPadrao.push(catchAll ? '(.+)' : '([^/]+)');
    partesDoRotulo.push(`${catchAll ? '*' : ':'}${dinamico[2]}`);
  }

  const caminhoRelativo = path.relative(RAIZ, arquivo).split(path.sep).join('/');
  const ehArquivoDeTeste = /\.(test|spec)\.[^.]+$/.test(path.basename(arquivo));

  return {
    ehArquivoDeTeste,
    rotulo: `/api/v1/${partesDoRotulo.join('/')}`,
    padrao: new RegExp(`^/api/v1/${partesDoPadrao.join('/')}/?$`),
    // `ssrLoadModule` espera caminho relativo a raiz do Vite, com barra normal, inclusive
    // no Windows, onde `path.sep` e `\` e quebraria a resolucao.
    caminhoDoModulo: `/${caminhoRelativo}`,
    caminhoRelativo,
    temCoringa,
  };
}

// Varre `api/v1/**` a cada requisicao (sao poucos arquivos): assim um handler criado depois
// que o servidor subiu passa a responder sem reiniciar nada.
async function varrerRotas(diretorio = DIRETORIO_DAS_ROTAS, segmentos = []) {
  let entradas;
  try {
    entradas = await readdir(diretorio, { withFileTypes: true });
  } catch {
    // `api/v1/` pode ainda nao existir. Nao e erro do servidor, e ausencia de handler, e
    // quem diz isso e a mensagem de subida / o 404.
    return [];
  }

  const rotas = [];
  for (const entrada of entradas) {
    // Mesma exclusao da Vercel: `_` e `.` na frente do nome nao viram rota.
    if (entrada.name.startsWith('_') || entrada.name.startsWith('.')) continue;

    if (entrada.isDirectory()) {
      rotas.push(
        ...(await varrerRotas(path.join(diretorio, entrada.name), [...segmentos, entrada.name])),
      );
      continue;
    }

    if (entrada.name.endsWith('.d.ts')) continue;
    const extensao = path.extname(entrada.name);
    if (!EXTENSOES_DE_HANDLER.includes(extensao)) continue;

    const base = entrada.name.slice(0, -extensao.length);
    // `index` vira a rota do proprio diretorio, como na Vercel.
    const segmentosDaRota = base === 'index' ? segmentos : [...segmentos, base];
    rotas.push(montarRota(segmentosDaRota, path.join(diretorio, entrada.name)));
  }
  return rotas;
}

// --- conversao node:http <-> Web ---------------------------------------------------------

async function lerCorpo(requisicao) {
  const pedacos = [];
  for await (const pedaco of requisicao) pedacos.push(pedaco);
  return Buffer.concat(pedacos);
}

async function converterParaRequest(requisicao, porta) {
  // `Request` exige URL absoluta; `requisicao.url` e so caminho + query.
  const url = new URL(requisicao.url, `http://${requisicao.headers.host ?? `localhost:${porta}`}`);

  const cabecalhos = new Headers();
  for (const [nome, valor] of Object.entries(requisicao.headers)) {
    if (valor === undefined) continue;
    if (Array.isArray(valor)) for (const item of valor) cabecalhos.append(nome, item);
    else cabecalhos.set(nome, valor);
  }

  const metodo = (requisicao.method ?? 'GET').toUpperCase();
  let corpo;
  if (METODOS_COM_CORPO.has(metodo)) {
    const bruto = await lerCorpo(requisicao);
    if (bruto.length > 0) corpo = bruto;
  } else {
    // Sem isto o socket fica esperando um corpo que ninguem vai ler.
    requisicao.resume();
  }

  return new Request(url, { method: metodo, headers: cabecalhos, body: corpo });
}

async function escreverResposta(resposta, saida) {
  saida.statusCode = resposta.status;

  for (const [nome, valor] of resposta.headers) {
    if (nome.toLowerCase() === 'set-cookie') continue;
    if (nome.toLowerCase() === 'content-length') continue;
    saida.setHeader(nome, valor);
  }
  const cookies = resposta.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) saida.setHeader('set-cookie', cookies);

  // Bytes, nunca string: o SVG sai `charset=utf-8` e um acento reencodado pelo caminho
  // seria mudanca silenciosa do arquivo entregue, a classe de defeito que o principio n1
  // proibe. `content-length` e recalculado aqui pelo mesmo motivo.
  const corpo = Buffer.from(await resposta.arrayBuffer());
  saida.setHeader('content-length', String(corpo.length));
  saida.end(corpo);
}

function responderEmJson(saida, status, corpo) {
  const bytes = Buffer.from(`${JSON.stringify(corpo, null, 2)}\n`, 'utf-8');
  saida.statusCode = status;
  saida.setHeader('content-type', 'application/json; charset=utf-8');
  saida.setHeader('content-length', String(bytes.length));
  saida.end(bytes);
}

// --- o servidor --------------------------------------------------------------------------

const ambienteCarregado = carregarAmbienteLocal();
const porta = Number(process.env[VARIAVEL_DA_PORTA] ?? PORTA_PADRAO);

if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
  console.error(`[api-local] ${VARIAVEL_DA_PORTA} precisa ser um numero de porta valido.`);
  process.exit(1);
}

const vite = await criarServidorVite({
  root: RAIZ,
  // `middlewareMode` para o Vite nao abrir uma porta HTTP so para carregar modulo, e
  // `ws: false` para nao abrir a porta 24678 do WebSocket de HMR, que nao serve a
  // ninguem aqui (nao ha navegador) e ainda faz a segunda instancia do servidor imprimir
  // um erro de porta ocupada que nao e o nosso. Sem `ws` o watcher continua vivo, que e o
  // que faz um handler corrigido responder sem reiniciar o servidor.
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
  logLevel: 'warn',
});

const servidorHttp = criarServidorHttp(async (requisicao, saida) => {
  const rotas = await varrerRotas();
  const caminho = new URL(requisicao.url ?? '/', 'http://localhost').pathname;
  const rota = rotas.find((candidata) => candidata.padrao.test(caminho));

  if (!rota) {
    // Precisa ficar obvio que quem nao achou foi o roteador DAQUI, e nao a API respondendo
    // PRODUTO_NAO_ENCONTRADO, confundir os dois manda alguem depurar o handler por causa
    // de um erro de digitacao na URL. Por isso este corpo nao usa o envelope da API.
    responderEmJson(saida, 404, {
      servidor_local: 'api/_local/servidorLocal.mjs',
      erro: 'ROTA_NAO_ENCONTRADA_NO_SERVIDOR_LOCAL',
      mensagem:
        `Nenhum arquivo em api/v1/** corresponde a ${requisicao.method} ${caminho}. ` +
        'Isto e o roteador do servidor local falando, NAO a API: nenhum handler foi ' +
        'executado, e este 404 nao tem relacao com PRODUTO_NAO_ENCONTRADO.',
      rotas_encontradas: rotas.map((candidata) => candidata.rotulo),
    });
    return;
  }

  let handler;
  try {
    const modulo = await vite.ssrLoadModule(rota.caminhoDoModulo);
    handler = modulo.default;
  } catch (erro) {
    // Stack no terminal e 500 na resposta, sem derrubar o processo: quem esta com o curl na
    // mao corrige o handler e chama de novo.
    console.error(`[api-local] falha ao carregar ${rota.caminhoRelativo}:`);
    console.error(erro);
    responderEmJson(saida, 500, {
      servidor_local: 'api/_local/servidorLocal.mjs',
      erro: 'FALHA_AO_CARREGAR_O_HANDLER',
      mensagem:
        `O modulo ${rota.caminhoRelativo} nao carregou. O stack completo esta no terminal ` +
        'onde o servidor local esta rodando. A API nao chegou a ser executada.',
    });
    return;
  }

  if (!handler || typeof handler.fetch !== 'function') {
    responderEmJson(saida, 500, {
      servidor_local: 'api/_local/servidorLocal.mjs',
      erro: 'HANDLER_SEM_FETCH',
      mensagem:
        `${rota.caminhoRelativo} carregou, mas nao exporta \`default\` com um metodo ` +
        '`fetch(Request)`. Ver a secao "O handler tem assinatura Web" em api/README.md.',
    });
    return;
  }

  try {
    const pedido = await converterParaRequest(requisicao, porta);
    const resposta = await handler.fetch(pedido);
    if (!(resposta instanceof Response)) {
      throw new TypeError(`handler.fetch devolveu ${typeof resposta}, esperado Response`);
    }
    await escreverResposta(resposta, saida);
  } catch (erro) {
    console.error(`[api-local] excecao em ${rota.caminhoRelativo}:`);
    console.error(erro);
    if (saida.headersSent) {
      saida.end();
      return;
    }
    responderEmJson(saida, 500, {
      servidor_local: 'api/_local/servidorLocal.mjs',
      erro: 'EXCECAO_NAO_TRATADA_NO_HANDLER',
      mensagem:
        'O handler lancou antes de devolver uma Response. O stack completo esta no ' +
        'terminal onde o servidor local esta rodando.',
    });
  }
});

servidorHttp.on('error', (erro) => {
  if (erro.code === 'EADDRINUSE') {
    console.error(
      `[api-local] a porta ${porta} ja esta em uso. Suba em outra: ` +
        `${VARIAVEL_DA_PORTA}=3211 npm run api:local`,
    );
  } else {
    console.error(`[api-local] nao foi possivel abrir a porta ${porta}: ${erro.message}`);
  }
  vite.close().finally(() => process.exit(1));
});

servidorHttp.listen(porta, async () => {
  const rotas = await varrerRotas();

  console.log(`[api-local] ouvindo em http://localhost:${porta}`);
  console.log(`[api-local] porta configuravel por ${VARIAVEL_DA_PORTA} (padrao ${PORTA_PADRAO})`);

  if (rotas.length === 0) {
    console.log('[api-local] nenhuma rota encontrada em api/v1/**, o handler ainda nao esta');
    console.log('[api-local] no disco. O servidor segue de pe e responde 404 ate ele existir.');
  } else {
    console.log('[api-local] rotas derivadas de api/v1/**:');
    for (const rota of rotas) {
      console.log(`[api-local]   ${rota.rotulo}  <-  ${rota.caminhoRelativo}`);
      if (rota.temCoringa) {
        console.log('[api-local]   (segmento catch-all: a correspondencia aqui e nossa, nao a da Vercel)');
      }
      if (rota.ehArquivoDeTeste) {
        // Nao filtramos arquivo de teste: a Vercel tambem nao filtra, e esconder a rota aqui
        // esconderia que ela viraria endpoint publicado no deploy.
        console.log('[api-local]   AVISO: isto e arquivo de teste co-locado. Ele vira rota aqui');
        console.log('[api-local]   porque viraria funcao publicada na Vercel, e o `_` e o unico');
        console.log('[api-local]   jeito de um arquivo em api/ nao virar endpoint.');
      }
    }
  }

  // Presenca, nunca valor: imprimir chave, mesmo truncada, poe segredo no terminal e no
  // historico de quem rodar isto.
  const faltando = VARIAVEIS_EXIGIDAS_PELA_API.filter((nome) => !process.env[nome]);
  console.log(
    `[api-local] .env.local: ${ambienteCarregado ? 'carregado' : 'AUSENTE'}` +
      ` | ${VARIAVEIS_EXIGIDAS_PELA_API.map((nome) => `${nome}: ${process.env[nome] ? 'presente' : 'ausente'}`).join(' | ')}`,
  );
  if (faltando.length > 0) {
    console.log(
      '[api-local] AVISO: sem essas variaveis o cliente de service_role nao sobe e TODA',
    );
    console.log('[api-local] chamada autenticada responde 500. Ver .env.example.');
  }

  // Exemplo sai de uma rota de verdade, nunca de um arquivo de teste co-locado, copiar um
  // curl que bate em `variants.test` custaria uma sessao de depuracao a quem colar.
  const rotaDeExemplo =
    (rotas.find((rota) => !rota.ehArquivoDeTeste) ?? rotas[0])?.rotulo ??
    '/api/v1/products/:productId/variants';
  const caminhoDeExemplo = rotaDeExemplo.replace(/:([^/]+)/g, '<$1>');
  console.log('[api-local] exemplo:');
  console.log(
    `  curl -i -X POST "http://localhost:${porta}${caminhoDeExemplo}" \\\n` +
      '    -H "Authorization: Bearer <chave gerada por npm run criar-chave>" \\\n' +
      '    -H "Content-Type: application/json" \\\n' +
      '    -d \'{"sola": "#C0392B"}\'',
  );
  console.log('[api-local] o que este servidor NAO prova: api/_local/README.md');
});

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    servidorHttp.close();
    vite.close().finally(() => process.exit(0));
  });
}
