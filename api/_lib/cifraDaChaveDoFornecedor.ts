// A chave do fornecedor cifrada antes de ir para o banco, e decifrada só na hora de chamar (D13).
//
// Por que cifrar, se a tabela já não tem caminho nenhum a partir do navegador: são defesas de
// camadas diferentes. O privilégio protege contra quem chega pelo PostgREST; a cifra protege contra
// quem chega ao DADO, um dump, um backup, um log de replicação, um print do SQL editor. A chave de
// cifra não está no banco, então nenhuma dessas cópias entrega a chave do fornecedor.
//
// Por que AES-256-GCM, e não hash: hash não serve, a chave precisa ser USADA para chamar o
// fornecedor, e portanto precisa voltar em claro no servidor. GCM traz o selo de integridade junto,
// então uma linha adulterada no banco falha na decifra em vez de virar uma chave meio certa que a
// gente mandaria para algum lugar.
//
// O formato gravado é `v1.<nonce>.<selo>.<texto>`, tudo em base64url. O `v1` na frente existe para
// o dia de trocar de algoritmo: sem ele, a única forma de migrar seria adivinhar pelo tamanho.
//
// A chave de cifra vem de `CHAVE_DE_CIFRA_DOS_FORNECEDORES`, SEM prefixo `VITE_`, porque com o
// prefixo ela iria para o bundle do navegador e a cifra inteira viraria enfeite (CLAUDE.md).

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VARIAVEL_DA_CHAVE_DE_CIFRA = 'CHAVE_DE_CIFRA_DOS_FORNECEDORES';
const ALGORITMO = 'aes-256-gcm';
const VERSAO = 'v1';
const BYTES_DA_CHAVE = 32;
const BYTES_DO_NONCE = 12;

/** Ambiente sem a chave de cifra. Falha alto: sem ela não dá para gravar nem usar chave nenhuma. */
export class CifraNaoConfigurada extends Error {
  constructor(motivo: string) {
    super(
      `${VARIAVEL_DA_CHAVE_DE_CIFRA} ${motivo}. Gere uma com \`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"\` ` +
        `e configure na Vercel (Project Settings → Environment Variables) e em \`.env.local\`. ` +
        `Ela NÃO leva prefixo VITE_: com o prefixo iria para o navegador e a cifra deixaria de proteger.`,
    );
    this.name = 'CifraNaoConfigurada';
  }
}

/** Texto gravado que não abre: linha adulterada, chave de cifra trocada, ou formato de outra versão. */
export class ChaveCifradaIlegivel extends Error {
  constructor() {
    // Sem detalhe do porquê de propósito: o detalhe só ajudaria quem está tentando adivinhar.
    super('A chave gravada do fornecedor não pôde ser lida. Grave a chave de novo em Modelo de linguagem.');
    this.name = 'ChaveCifradaIlegivel';
  }
}

/** A chave de cifra do ambiente, conferida. Recebe o ambiente por parâmetro, como `clienteDeServico`. */
export function lerChaveDeCifra(ambiente: Record<string, string | undefined> = process.env): Buffer {
  const valor = (ambiente[VARIAVEL_DA_CHAVE_DE_CIFRA] ?? '').trim();
  if (valor === '') throw new CifraNaoConfigurada('não está configurada');

  const bytes = Buffer.from(valor, 'base64');
  if (bytes.length !== BYTES_DA_CHAVE) {
    throw new CifraNaoConfigurada(`precisa ser ${BYTES_DA_CHAVE} bytes em base64, e tem ${bytes.length}`);
  }
  return bytes;
}

export function cifrarChaveDoFornecedor(chave: string, chaveDeCifra: Buffer): string {
  const nonce = randomBytes(BYTES_DO_NONCE);
  const cifrador = createCipheriv(ALGORITMO, chaveDeCifra, nonce);
  const texto = Buffer.concat([cifrador.update(chave, 'utf8'), cifrador.final()]);

  return [VERSAO, base64url(nonce), base64url(cifrador.getAuthTag()), base64url(texto)].join('.');
}

export function decifrarChaveDoFornecedor(gravado: string, chaveDeCifra: Buffer): string {
  const partes = gravado.split('.');
  if (partes.length !== 4 || partes[0] !== VERSAO) throw new ChaveCifradaIlegivel();

  try {
    const decifrador = createDecipheriv(ALGORITMO, chaveDeCifra, deBase64url(partes[1] ?? ''));
    decifrador.setAuthTag(deBase64url(partes[2] ?? ''));
    return Buffer.concat([decifrador.update(deBase64url(partes[3] ?? '')), decifrador.final()]).toString('utf8');
  } catch (causa) {
    // A causa original não sobe: a mensagem do OpenSSL não diz nada de acionável e vira log.
    throw new ChaveCifradaIlegivel();
  }
}

/**
 * Os 4 últimos caracteres da chave, que é o que a tela mostra (D13, item 4).
 *
 * Do FIM e não do começo: o começo de uma chave é o prefixo do fornecedor (`gsk_`, `sk-`), igual em
 * todas, e não ajudaria ninguém a reconhecer qual chave está gravada.
 */
export function finalDaChave(chave: string): string {
  return chave.slice(-4);
}

function base64url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

function deBase64url(texto: string): Buffer {
  return Buffer.from(texto, 'base64url');
}
