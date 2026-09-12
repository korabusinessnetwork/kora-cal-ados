// O corpo cru do POST → JSON, com TETO DE BYTES.
//
// POR QUE O TETO PRECISA ESTAR AQUI, E NÃO EM `lerCoresPedidas`: o teto que já existia é o de 90
// zonas, e ele é conferido DEPOIS do parse. `lerCoresPedidas` explica que as outras duas dimensões
// do corpo já são limitadas pelo motor (`validarZoneKey` recusa chave acima de 40 caracteres e
// `validarCor` recusa o que não é hex de 4 ou 7), e isso é verdade, mas as três só são conferidas
// com o corpo inteiro já na memória. A dimensão em bytes era a única que ninguém limitava, e era
// justamente a que se paga antes de qualquer recusa.
//
// Medido antes de este arquivo existir: um corpo de 7.088.891 bytes com 300.000 pares foi
// inteiramente lido e parseado por `Request.json()` em 202 ms, custando 13,4 MB de heap, para só
// então ser recusado por passar de 90 zonas. Em função serverless, cobrada por tempo e por
// memória, isso é conta paga para recusar pedido. O teto de 90 zonas existe, segundo o comentário
// dele, como "mitigação de custo zero contra cliente com laço mal escrito", e este é o mesmo ator:
// o corpo só é lido no passo 5 do handler, depois de autenticação e de o produto ser do tenant, ou
// seja, quem chega aqui é chave válida com laço errado, ou chave vazada.
//
// POR QUE DUAS CONFERÊNCIAS, `content-length` E CONTAGEM DURANTE A LEITURA: o cabeçalho é barato e
// recusa antes de ler um byte, mas é o cliente quem o escreve. Requisição com `transfer-encoding:
// chunked` não traz cabeçalho nenhum, e cabeçalho mentiroso é o primeiro contorno que alguém
// tentaria. A contagem durante a leitura é a que não depende da palavra do cliente.
//
// O STATUS NÃO É ESCRITO AQUI, pelo mesmo motivo de `lerCoresPedidas`: `criarFalhaDeTransporte` é
// de `traduzirParaFalhaDaApi.ts`, dono único da tabela código → status. A mensagem, sim, é daqui.

import { criarFalhaDeTransporte } from './traduzirParaFalhaDaApi';

/**
 * Teto de bytes do corpo.
 *
 * De onde saiu o número: o maior corpo LEGÍTIMO possível é 90 zonas (o teto de `lerCoresPedidas`)
 * com a chave no comprimento máximo que `validarZoneKey` aceita, 40 caracteres, e cor de 7. Cada
 * par custa então cerca de 53 bytes com aspas e vírgula, e o corpo inteiro cerca de 4,8 kB. Com
 * indentação e quebras de linha de um JSON formatado, algo como 8 kB.
 *
 * 64 kB é uma ordem de grandeza acima disso. Cobre qualquer pedido honesto, inclusive um gerado
 * por ERP que formate o JSON com folga, e recusa de imediato o corpo que não chega perto de 64 kB
 * porque chega a megabytes, que é o formato do erro de laço.
 */
export const TETO_DE_BYTES_DO_CORPO = 64 * 1024;

/** A mesma frase nos dois caminhos: para o integrador, a causa é uma só. */
function falhaDeCorpoGrande(): ReturnType<typeof criarFalhaDeTransporte> {
  return criarFalhaDeTransporte(
    'CORPO_INVALIDO',
    `O corpo passa do limite de ${TETO_DE_BYTES_DO_CORPO} bytes. Envie uma zona por chave, no máximo 90.`,
  );
}

/**
 * Lê o corpo do pedido e devolve o JSON já parseado.
 *
 * Lança `FalhaDaApi` `CORPO_INVALIDO` 400 quando o corpo passa do teto ou não é JSON válido.
 * Corpo vazio também cai aqui: `JSON.parse('')` lança, e o contrato de
 * `docs/07_APIS/endpoints.md` manda `CORPO_INVALIDO` para ele.
 */
export async function lerCorpoDoPedido(pedido: Request): Promise<unknown> {
  const anunciado = Number(pedido.headers.get('content-length'));

  // `Number(null)` é 0 e `Number('abc')` é NaN, e nenhum dos dois é maior que o teto, então
  // cabeçalho ausente ou lixo simplesmente cai na contagem durante a leitura, que é a conferência
  // que não depende do cliente. Recusar aqui é só o atalho barato do caso honesto.
  if (anunciado > TETO_DE_BYTES_DO_CORPO) throw falhaDeCorpoGrande();

  const texto = await lerAteOTeto(pedido);

  try {
    return JSON.parse(texto);
  } catch {
    throw criarFalhaDeTransporte(
      'CORPO_INVALIDO',
      'O corpo precisa ser um JSON válido: um objeto de zona para cor, como {"sola": "#C0392B"}.',
    );
  }
}

/**
 * O corpo como texto, abortando a leitura no primeiro pedaço que passa do teto.
 *
 * Abortar no meio é o ponto: acumular tudo para medir depois seria exatamente o custo que este
 * módulo existe para não pagar.
 */
async function lerAteOTeto(pedido: Request): Promise<string> {
  const corpo = pedido.body;

  // POST sem corpo nenhum. Devolve vazio e deixa o `JSON.parse` acima transformar isso no
  // `CORPO_INVALIDO` que o contrato manda, em vez de inventar aqui uma segunda mensagem.
  if (corpo === null) return '';

  const leitor = corpo.getReader();
  // `stream: true` a cada pedaço porque um caractere multibyte pode ficar partido entre dois
  // pedaços, e decodificar cada um isoladamente viraria `�` no meio de um hex ou de uma
  // `zone_key`. O `decode()` final fecha o que tiver sobrado.
  const decodificador = new TextDecoder();
  let texto = '';
  let bytes = 0;

  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;

    bytes += value.byteLength;
    // Sai no primeiro pedaço que passa, sem ler o resto e sem cancelar o stream à mão. Cancelar
    // seria um `try/catch` a mais para engolir uma falha de cancelamento que não pode virar 500 no
    // lugar do 400, e não compraria nada: quem encerra a requisição recusada é a resposta que o
    // handler devolve logo em seguida.
    if (bytes > TETO_DE_BYTES_DO_CORPO) throw falhaDeCorpoGrande();

    texto += decodificador.decode(value, { stream: true });
  }

  return texto + decodificador.decode();
}
