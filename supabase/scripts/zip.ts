// Um escritor e um leitor de ZIP, em cima do `zlib` que o Node já traz.
//
// Por que escrever isto em vez de instalar uma biblioteca: o ADR-009 diz que a saída do cliente
// "não é um projeto, é um script de zip", e a seção Custo do `CLAUDE.md` manda preferir o gratuito.
// Uma dependência para escrever um formato de 1989, num script que roda uma vez por cliente
// cancelado, é dependência para manter e auditar sem contrapartida.
//
// Por que o LEITOR também mora aqui, e não só no teste: um exportador cuja saída ninguém consegue
// abrir é um exportador em que ninguém pode confiar. O ADR-009 D5 separa exportar de apagar
// justamente para o cliente **conferir** o que recebeu antes de perder o original; conferir é
// operação de produto, e precisa de código de produto. É também o que torna possível o único teste
// que o ADR pede em letra: "o zip contém uma zona que foi marcada".
//
// O que este módulo NÃO faz, de propósito: ZIP64 (arquivos acima de 4 GB), senha, e qualquer
// método de compressão que não seja "guardado" ou "deflate". A saída de um tenant é feita de
// alguns JSONs e alguns SVGs. Suportar o resto do formato seria código sem caso de uso, que é
// código que apodrece sem ninguém notar, exatamente o risco que o próprio ADR-009 anota.

import { deflateRawSync, inflateRawSync } from 'node:zlib';

/** Um arquivo dentro do pacote. `nome` usa barra normal, inclusive no Windows: é o que o ZIP pede. */
export interface ArquivoDoZip {
  nome: string;
  conteudo: Buffer | string;
}

const ASSINATURA_LOCAL = 0x04034b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_FIM = 0x06054b50;
const GUARDADO = 0;
const DEFLATE = 8;
/** Bit 11: os nomes vão em UTF-8. Sem ele, "cadarço.json" chega quebrado em metade dos leitores. */
const BANDEIRA_UTF8 = 0x0800;

/**
 * A tabela do CRC-32, montada uma vez.
 *
 * O ZIP exige CRC-32 por arquivo, e é ele que faz um leitor recusar um pacote corrompido. Sem essa
 * conferência o cliente descobriria o problema ao abrir um SVG truncado, meses depois, e é
 * precisamente o caso que o ADR-009 D5 quer evitar ao mandar exportar, conferir e só então apagar.
 */
const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);

  for (let i = 0; i < 256; i++) {
    let valor = i;

    for (let bit = 0; bit < 8; bit++) {
      valor = valor & 1 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1;
    }

    tabela[i] = valor >>> 0;
  }

  return tabela;
})();

/** O CRC-32 de um conteúdo, como o ZIP o quer. */
export function crc32(dados: Buffer): number {
  let acumulado = 0xffffffff;

  for (const byte of dados) {
    acumulado = (TABELA_CRC[(acumulado ^ byte) & 0xff] as number) ^ (acumulado >>> 8);
  }

  return (acumulado ^ 0xffffffff) >>> 0;
}

/**
 * Data e hora no formato do MS-DOS, que é o que o ZIP guarda.
 *
 * O padrão é uma data FIXA, e não `new Date()`, porque o mesmo conteúdo deve produzir o mesmo
 * arquivo byte a byte. Sem isso não dá para comparar duas exportações do mesmo tenant e responder
 * "mudou alguma coisa?", que é a pergunta que alguém faz quando desconfia de uma saída.
 */
export function dataDosFormatoDos(quando = new Date(Date.UTC(2026, 0, 1, 0, 0, 0))): {
  hora: number;
  data: number;
} {
  const ano = Math.max(quando.getUTCFullYear(), 1980);

  return {
    hora:
      (quando.getUTCHours() << 11) |
      (quando.getUTCMinutes() << 5) |
      Math.floor(quando.getUTCSeconds() / 2),
    data: ((ano - 1980) << 9) | ((quando.getUTCMonth() + 1) << 5) | quando.getUTCDate(),
  };
}

/**
 * Os arquivos viram um ZIP.
 *
 * Cada arquivo é comprimido com deflate, **menos quando comprimir não ajuda**: um SVG minúsculo ou
 * um PNG já comprimido saem maiores depois do deflate, e um pacote em que um arquivo engordou é um
 * pacote que levanta a pergunta errada na cabeça de quem confere.
 */
export function montarZip(arquivos: ArquivoDoZip[], quando?: Date): Buffer {
  const { hora, data } = dataDosFormatoDos(quando);
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let deslocamento = 0;

  for (const { nome, conteudo } of arquivos) {
    const nomeEmBytes = Buffer.from(nome, 'utf8');
    const cru = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo, 'utf8');
    const comprimido = deflateRawSync(cru);
    const comprimeBem = comprimido.length < cru.length;
    const corpo = comprimeBem ? comprimido : cru;
    const metodo = comprimeBem ? DEFLATE : GUARDADO;
    const soma = crc32(cru);

    const cabecalhoLocal = Buffer.alloc(30);
    cabecalhoLocal.writeUInt32LE(ASSINATURA_LOCAL, 0);
    cabecalhoLocal.writeUInt16LE(20, 4);
    cabecalhoLocal.writeUInt16LE(BANDEIRA_UTF8, 6);
    cabecalhoLocal.writeUInt16LE(metodo, 8);
    cabecalhoLocal.writeUInt16LE(hora, 10);
    cabecalhoLocal.writeUInt16LE(data, 12);
    cabecalhoLocal.writeUInt32LE(soma, 14);
    cabecalhoLocal.writeUInt32LE(corpo.length, 18);
    cabecalhoLocal.writeUInt32LE(cru.length, 22);
    cabecalhoLocal.writeUInt16LE(nomeEmBytes.length, 26);
    cabecalhoLocal.writeUInt16LE(0, 28);

    const cabecalhoCentral = Buffer.alloc(46);
    cabecalhoCentral.writeUInt32LE(ASSINATURA_CENTRAL, 0);
    cabecalhoCentral.writeUInt16LE(20, 4);
    cabecalhoCentral.writeUInt16LE(20, 6);
    cabecalhoCentral.writeUInt16LE(BANDEIRA_UTF8, 8);
    cabecalhoCentral.writeUInt16LE(metodo, 10);
    cabecalhoCentral.writeUInt16LE(hora, 12);
    cabecalhoCentral.writeUInt16LE(data, 14);
    cabecalhoCentral.writeUInt32LE(soma, 16);
    cabecalhoCentral.writeUInt32LE(corpo.length, 20);
    cabecalhoCentral.writeUInt32LE(cru.length, 24);
    cabecalhoCentral.writeUInt16LE(nomeEmBytes.length, 28);
    cabecalhoCentral.writeUInt32LE(deslocamento, 42);

    locais.push(cabecalhoLocal, nomeEmBytes, corpo);
    centrais.push(cabecalhoCentral, nomeEmBytes);
    deslocamento += cabecalhoLocal.length + nomeEmBytes.length + corpo.length;
  }

  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(ASSINATURA_FIM, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);

  return Buffer.concat([...locais, diretorio, fim]);
}

/**
 * O ZIP volta a ser arquivos.
 *
 * Lê pelo **diretório central**, e não varrendo os cabeçalhos locais do começo ao fim, porque o
 * diretório central é a única parte do formato que é autoritativa: é dele que qualquer leitor de
 * verdade parte, e ler diferente seria conferir um pacote que não é o que os outros veem.
 */
export function lerZip(pacote: Buffer): ArquivoDoZip[] {
  const fim = acharFimDoDiretorio(pacote);
  const quantos = pacote.readUInt16LE(fim + 10);
  let cursor = pacote.readUInt32LE(fim + 16);
  const arquivos: ArquivoDoZip[] = [];

  for (let i = 0; i < quantos; i++) {
    if (pacote.readUInt32LE(cursor) !== ASSINATURA_CENTRAL) {
      throw new Error(`diretório central corrompido na entrada ${i}`);
    }

    const metodo = pacote.readUInt16LE(cursor + 10);
    const soma = pacote.readUInt32LE(cursor + 16);
    const tamanhoComprimido = pacote.readUInt32LE(cursor + 20);
    const tamanhoCru = pacote.readUInt32LE(cursor + 24);
    const tamanhoDoNome = pacote.readUInt16LE(cursor + 28);
    const tamanhoDoExtra = pacote.readUInt16LE(cursor + 30);
    const tamanhoDoComentario = pacote.readUInt16LE(cursor + 32);
    const inicioLocal = pacote.readUInt32LE(cursor + 42);
    const nome = pacote.toString('utf8', cursor + 46, cursor + 46 + tamanhoDoNome);

    const nomeLocal = pacote.readUInt16LE(inicioLocal + 26);
    const extraLocal = pacote.readUInt16LE(inicioLocal + 28);
    const inicioDoCorpo = inicioLocal + 30 + nomeLocal + extraLocal;
    const corpo = pacote.subarray(inicioDoCorpo, inicioDoCorpo + tamanhoComprimido);
    const conteudo = metodo === DEFLATE ? inflateRawSync(corpo) : Buffer.from(corpo);

    // As duas conferências que fazem este leitor valer como conferência de verdade. Sem elas ele
    // devolveria bytes corrompidos com cara de arquivo bom, que é pior do que não ler nada.
    if (conteudo.length !== tamanhoCru) {
      throw new Error(`"${nome}" tem ${conteudo.length} bytes e o pacote diz ${tamanhoCru}`);
    }

    if (crc32(conteudo) !== soma) {
      throw new Error(`"${nome}" não bate com o CRC gravado: o pacote está corrompido`);
    }

    arquivos.push({ nome, conteudo });
    cursor += 46 + tamanhoDoNome + tamanhoDoExtra + tamanhoDoComentario;
  }

  return arquivos;
}

/** O conteúdo de um arquivo do pacote, como texto. Recusa se não estiver lá. */
export function textoDoZip(pacote: Buffer, nome: string): string {
  const achado = lerZip(pacote).find((arquivo) => arquivo.nome === nome);

  if (achado === undefined) throw new Error(`"${nome}" não está no pacote`);

  return Buffer.isBuffer(achado.conteudo) ? achado.conteudo.toString('utf8') : achado.conteudo;
}

/**
 * Onde começa o registro de fim do diretório.
 *
 * Procura de trás para frente porque o registro é o último do arquivo, e tem tamanho variável por
 * causa do comentário opcional. Os 22 bytes mínimos mais 65535 de comentário é o pior caso do
 * formato, e parar aí evita varrer um arquivo grande inteiro atrás de uma assinatura que só pode
 * estar no fim.
 */
function acharFimDoDiretorio(pacote: Buffer): number {
  const minimo = Math.max(0, pacote.length - 22 - 0xffff);

  for (let posicao = pacote.length - 22; posicao >= minimo; posicao--) {
    if (pacote.readUInt32LE(posicao) === ASSINATURA_FIM) return posicao;
  }

  throw new Error('não é um ZIP: o registro de fim do diretório não foi encontrado');
}
