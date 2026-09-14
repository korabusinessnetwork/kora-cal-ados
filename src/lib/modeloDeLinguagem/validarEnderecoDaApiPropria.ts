// A guarda do endereço da API própria, na parte que dá para decidir sem rede (D13, item 8).
//
// O endereço é digitado pelo owner, e depois é o SERVIDOR que faz a chamada, com a chave junto.
// Sem guarda, "API própria" é um jeito de mandar a função serverless bater em
// `169.254.169.254` (credenciais da nuvem) ou em qualquer serviço interno. Isso tem nome, SSRF, e
// esta é a primeira metade da defesa:
//
// - só `https`, porque a chave vai no cabeçalho e em `http` ela atravessa a rede em claro;
// - sem usuário e senha no endereço, que seria credencial fora do campo de chave, indo para log;
// - sem IP literal: fornecedor de verdade tem nome, e IP é o jeito mais curto de apontar para
//   rede privada;
// - sem `localhost`, sem nome sem ponto e sem os sufixos que só existem em rede interna;
// - sem porta diferente de 443, porque serviço interno costuma morar em porta alta.
//
// A segunda metade (o nome não pode RESOLVER para rede privada) precisa de DNS e mora em
// `api/_lib/verificarEnderecoPublico.ts`, porque DNS é rede. As duas são necessárias: esta sozinha
// deixa passar um nome público que aponta para 10.0.0.1, e aquela sozinha deixaria a tela aceitar
// `http://`.

export type ResultadoDoEndereco = { valido: true; endereco: string } | { valido: false; motivo: string };

export const TAMANHO_MAXIMO_DO_ENDERECO = 300;

const SUFIXOS_INTERNOS = ['.localhost', '.local', '.internal', '.lan', '.home', '.corp', '.intranet'];

/** O endereço normalizado, sem barra no fim, ou o motivo da recusa em frase de tela. */
export function validarEnderecoDaApiPropria(texto: unknown): ResultadoDoEndereco {
  if (typeof texto !== 'string' || texto.trim() === '') {
    return { valido: false, motivo: 'Informe o endereço da API, por exemplo https://api.exemplo.com/v1.' };
  }
  if (texto.trim().length > TAMANHO_MAXIMO_DO_ENDERECO) {
    return { valido: false, motivo: `O endereço tem mais de ${TAMANHO_MAXIMO_DO_ENDERECO} caracteres.` };
  }

  let url: URL;
  try {
    url = new URL(texto.trim());
  } catch {
    return { valido: false, motivo: 'O endereço não é uma URL válida. Comece com https://.' };
  }

  if (url.protocol !== 'https:') {
    return { valido: false, motivo: 'O endereço precisa começar com https://, porque a chave vai junto na chamada.' };
  }
  if (url.username !== '' || url.password !== '') {
    return { valido: false, motivo: 'Tire o usuário e a senha do endereço. A chave vai no campo de chave.' };
  }
  if (url.port !== '' && url.port !== '443') {
    return { valido: false, motivo: 'Use o endereço na porta padrão do https, sem número de porta.' };
  }
  if (url.search !== '' || url.hash !== '') {
    return { valido: false, motivo: 'Tire do endereço o que vem depois de "?" ou "#".' };
  }

  const nome = url.hostname.toLowerCase();
  if (ehIpLiteral(nome)) {
    return { valido: false, motivo: 'Use o nome do servidor, e não um número de IP.' };
  }
  if (nome === 'localhost' || !nome.includes('.') || SUFIXOS_INTERNOS.some((sufixo) => nome.endsWith(sufixo))) {
    return { valido: false, motivo: 'O endereço precisa ser de um servidor público na internet.' };
  }

  const caminho = url.pathname.replace(/\/+$/, '');
  // `/chat/completions` é acrescentado pelo servidor. Aceitar o endereço já com ele produziria
  // `/chat/completions/chat/completions`, e a pessoa só descobriria no "Testar conexão".
  if (caminho.endsWith('/chat/completions')) {
    return { valido: false, motivo: 'Informe o endereço base, sem "/chat/completions" no fim.' };
  }

  return { valido: true, endereco: `https://${nome}${caminho}` };
}

/**
 * IPv6 literal chega do `URL` entre colchetes. IPv4 é conferido depois de o `URL` normalizar, e é
 * por isso que `https://0x7f.1/` e `https://2130706433/` também caem aqui: o `URL` os reescreve como
 * `127.0.0.1`.
 */
function ehIpLiteral(nome: string): boolean {
  return nome.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(nome);
}
