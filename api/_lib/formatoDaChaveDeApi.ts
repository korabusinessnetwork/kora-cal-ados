// O formato da chave de API, num lugar só: gerar, interpretar e derivar o hash.
//
// Por que isto é um módulo próprio e não duas funções soltas onde forem usadas: o gerador
// (script de criação) e o validador (função serverless) rodam em processos diferentes,
// meses diferentes, e são escritos por agentes diferentes. Se divergirem em um caractere,
// TODA chave já emitida deixa de autenticar, e a integração do cliente cai sem que nada
// tenha sido "mudado". Um arquivo, um round-trip testado, nenhuma segunda leitura do
// formato em lugar nenhum.
//
// Formato (ADR-006, D1):
//
//   kora_live_7f3ab902_kZ9x...43 caracteres...
//   └─┬─┘ └─┬┘ └──┬───┘ └────────────┬───────┘
//     │     │     │                  └── segredo: 32 bytes aleatórios em base64url
//     │     │     └── prefixo: 8 hex, em claro no banco, identifica sem autenticar
//     │     └── ambiente: live | test
//     └── produto
//
// O banco guarda `prefixo` e o SHA-256 do **segredo**. Nunca a chave.

import { createHash, randomBytes } from 'node:crypto';

/** `live` é a chave que atende cliente; `test` existe para não se testar em produção. */
export type AmbienteDaChave = 'live' | 'test';

const AMBIENTES: readonly AmbienteDaChave[] = ['live', 'test'];

const PRODUTO = 'kora';

/** 4 bytes em hex. Curto para caber num log de uma linha, largo para não colidir na prática. */
const BYTES_DO_PREFIXO = 4;
const CARACTERES_DO_PREFIXO = BYTES_DO_PREFIXO * 2;

/**
 * 32 bytes = 256 bits. É o número que sustenta o D2 do ADR-006: com esta entropia não
 * existe dicionário a atacar, e por isso SHA-256 (rápido) basta onde senha humana exigiria
 * bcrypt. Baixar isto invalida aquela decisão em silêncio.
 */
const BYTES_DO_SEGREDO = 32;

/** 32 bytes em base64url sem padding dão exatamente 43 caracteres. */
const CARACTERES_DO_SEGREDO = 43;

const PREFIXO_VALIDO = new RegExp(`^[0-9a-f]{${CARACTERES_DO_PREFIXO}}$`);
const SEGREDO_VALIDO = new RegExp(`^[A-Za-z0-9_-]{${CARACTERES_DO_SEGREDO}}$`);

/** O que a criação devolve: a chave para mostrar uma vez, e as duas colunas para gravar. */
export interface ChaveGerada {
  /** A chave inteira. Só existe neste objeto e no que for impresso, nunca é gravada. */
  readonly chave: string;
  readonly ambiente: AmbienteDaChave;
  /** Coluna `prefixo`, em claro. */
  readonly prefixo: string;
  /** Coluna `hash`: SHA-256 do segredo, em hex. */
  readonly hash: string;
}

/** O que se consegue ler de uma chave recebida, sem consultar o banco. */
export interface ChaveInterpretada {
  readonly ambiente: AmbienteDaChave;
  readonly prefixo: string;
  readonly segredo: string;
}

/**
 * Um digest com a forma certa e que não corresponde a segredo nenhum.
 *
 * Serve a `autenticarChaveDeApi`: quando o prefixo não existe no banco, a comparação é
 * feita **mesmo assim**, contra este valor. Sem isso, prefixo inexistente responderia mais
 * rápido que prefixo real com segredo errado, e essa diferença de tempo é um oráculo que
 * diz ao atacante quando ele acertou um prefixo, exatamente o que o ADR-006 quer negar ao
 * mandar chave revogada e chave inventada responderem igual.
 */
export const HASH_QUE_NUNCA_CONFERE = '0'.repeat(64);

/** SHA-256 do segredo, em hex. É isto, e só isto, que a coluna `hash` guarda. */
export function hashDoSegredo(segredo: string): string {
  return createHash('sha256').update(segredo, 'utf8').digest('hex');
}

/** Gera uma chave nova. O segredo sai de `randomBytes`, nunca de contador, tempo ou id. */
export function gerarChaveDeApi(ambiente: AmbienteDaChave): ChaveGerada {
  const prefixo = randomBytes(BYTES_DO_PREFIXO).toString('hex');
  const segredo = randomBytes(BYTES_DO_SEGREDO).toString('base64url');

  return {
    chave: [PRODUTO, ambiente, prefixo, segredo].join('_'),
    ambiente,
    prefixo,
    hash: hashDoSegredo(segredo),
  };
}

/**
 * Lê uma chave recebida. Devolve `null` para qualquer coisa que não seja exatamente o
 * formato, nunca lança: quem chama está tratando entrada de rede, e entrada de rede
 * malformada é resposta 401, não exceção.
 *
 * **A separação NÃO é `split('_')` em quatro partes**, e este é o ponto do arquivo que mais
 * merece atenção. O alfabeto base64url inclui o próprio `_`, então um segredo legítimo pode
 * conter underscores e produzir cinco, seis ou dez pedaços. Um validador que exigisse
 * "quatro partes" recusaria por volta de uma chave em cada três, de forma intermitente,
 * dependendo de sorte no sorteio, que é o pior modo de falha possível: passa em todo teste
 * escrito à mão e quebra em produção sem padrão visível.
 *
 * Por isso a leitura é posicional: os três primeiros separadores delimitam produto,
 * ambiente e prefixo, e **todo o resto é o segredo**. A ambiguidade some porque o segredo
 * tem tamanho e alfabeto exatos, a estrutura fica determinada mesmo com `_` dentro dele.
 */
export function interpretarChaveDeApi(chave: unknown): ChaveInterpretada | null {
  if (typeof chave !== 'string') return null;

  const pedacos = chave.split('_');
  // Menos de 4 nunca é chave; mais de 4 pode ser, se o segredo tiver `_`.
  if (pedacos.length < 4) return null;

  const [produto, ambiente, prefixo] = pedacos;
  const segredo = pedacos.slice(3).join('_');

  if (produto !== PRODUTO) return null;
  if (!ehAmbiente(ambiente)) return null;
  if (!prefixo || !PREFIXO_VALIDO.test(prefixo)) return null;
  if (!SEGREDO_VALIDO.test(segredo)) return null;

  return { ambiente, prefixo, segredo };
}

function ehAmbiente(valor: string | undefined): valor is AmbienteDaChave {
  return valor !== undefined && (AMBIENTES as readonly string[]).includes(valor);
}
