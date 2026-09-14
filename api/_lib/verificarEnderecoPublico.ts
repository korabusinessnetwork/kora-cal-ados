// A segunda metade da guarda de SSRF: o nome da API própria não pode RESOLVER para rede privada.
//
// A primeira metade (`src/lib/modeloDeLinguagem/validarEnderecoDaApiPropria.ts`) é texto e roda nos
// dois lados. Esta precisa de DNS, então é de servidor. Sem ela, `https://interno.exemplo.com`
// passa na guarda de texto e aponta para `10.0.0.5`, e a função serverless vira um proxy para a
// rede de quem a hospeda, com a chave do tenant junto.
//
// O que ela NÃO promete, e precisa estar escrito para ninguém confiar demais: entre a checagem e a
// chamada existe uma segunda resolução de DNS, feita pelo `fetch`, e um DNS hostil pode responder
// diferente nas duas (isso tem nome, DNS rebinding). Fechar essa janela exigiria abrir o socket na
// mão, com `lookup` próprio, o que significaria reimplementar TLS e HTTP por cima. O que reduz o
// risco aqui: a resposta do fornecedor só volta para a tela como TEXTO que ainda passa pelo guarda
// da composição, e redirecionamento é recusado (`redirect: 'manual'` em
// `chamarFornecedorDeModeloDeLinguagem.ts`), que é o caminho mais curto de um endereço público para
// um interno.

import { lookup } from 'node:dns/promises';
import { criarFalhaDeTransporte } from './traduzirParaFalhaDaApi';

/** Só para o teste injetar o DNS. Em produção é o `lookup` do Node. */
export type ResolvedorDeNome = (nome: string) => Promise<{ address: string; family: number }[]>;

const resolverComDns: ResolvedorDeNome = (nome) => lookup(nome, { all: true, verbatim: true });

/**
 * Recusa o endereço que resolve para endereço não público, e devolve nada quando está tudo bem.
 *
 * Lança `ENDERECO_NAO_PERMITIDO` também quando o nome não resolve: um nome que não existe não tem
 * como ser o fornecedor da marca, e deixar passar levaria a mesma pergunta ao `fetch`.
 */
export async function verificarEnderecoPublico(
  endereco: string,
  resolver: ResolvedorDeNome = resolverComDns,
): Promise<void> {
  let nome: string;
  try {
    nome = new URL(endereco).hostname;
  } catch {
    throw criarFalhaDeTransporte('ENDERECO_NAO_PERMITIDO', 'O endereço da API própria não é uma URL válida.');
  }

  let enderecos: { address: string; family: number }[];
  try {
    enderecos = await resolver(nome);
  } catch {
    throw criarFalhaDeTransporte(
      'ENDERECO_NAO_PERMITIDO',
      `O nome "${nome}" não foi encontrado no DNS. Confira o endereço da API própria.`,
    );
  }

  if (enderecos.length === 0 || enderecos.some(({ address }) => !ehPublico(address))) {
    throw criarFalhaDeTransporte(
      'ENDERECO_NAO_PERMITIDO',
      `O endereço "${nome}" aponta para uma rede privada. A API própria precisa ser um servidor público na internet.`,
    );
  }
}

/** Endereço que não é de rede privada, de loopback, de link-local nem reservado. */
export function ehPublico(endereco: string): boolean {
  return endereco.includes(':') ? ehIpv6Publico(endereco.toLowerCase()) : ehIpv4Publico(endereco);
}

function ehIpv4Publico(endereco: string): boolean {
  const partes = endereco.split('.').map(Number);
  if (partes.length !== 4 || partes.some((parte) => !Number.isInteger(parte) || parte < 0 || parte > 255)) return false;

  const [a = 0, b = 0] = partes;
  if (a === 0 || a === 10 || a === 127) return false; // este host, privada, loopback
  if (a === 169 && b === 254) return false; // link-local, onde mora o endpoint de metadados da nuvem
  if (a === 172 && b >= 16 && b <= 31) return false; // privada
  if (a === 192 && b === 168) return false; // privada
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 192 && b === 0) return false; // reservada (inclui 192.0.0.0/24 e a documentação)
  if (a === 198 && (b === 18 || b === 19)) return false; // teste de desempenho
  if (a >= 224) return false; // multicast e reservada

  return true;
}

function ehIpv6Publico(endereco: string): boolean {
  // IPv4 mapeado (`::ffff:10.0.0.1`) é a forma mais curta de contornar a lista de cima.
  const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(endereco);
  if (mapeado) return ehIpv4Publico(mapeado[1] ?? '');

  if (endereco === '::' || endereco === '::1') return false;
  const inicio = endereco.split(':')[0] ?? '';
  if (/^f[cd]/.test(inicio)) return false; // único local
  if (/^fe[89ab]/.test(inicio)) return false; // link-local
  if (/^ff/.test(inicio)) return false; // multicast

  return true;
}
