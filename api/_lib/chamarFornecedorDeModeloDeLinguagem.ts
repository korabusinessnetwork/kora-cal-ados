// A chamada ao fornecedor de modelo de linguagem, no formato compatível com OpenAI (D13).
//
// Um formato só porque é o que todos os fornecedores da lista atendem: `POST {base}/chat/completions`
// com `messages`, e a resposta em `choices[0].message.content` mais `usage`. Um adaptador por
// fornecedor seria sete caminhos para o mesmo pedido, e seis deles sem ninguém para testar.
//
// As regras que moram aqui, e o porquê de cada uma:
//
// 1. **A chave nunca aparece em erro, log ou resposta.** A mensagem do fornecedor NÃO é repassada:
//    ela traz cabeçalho, endereço e, em alguns, o começo da chave. O que sai é um código da nossa
//    tabela (CLAUDE.md, nunca logar nem expor dado sensível).
// 2. **Tem prazo.** Sem `AbortSignal.timeout`, um fornecedor lento segura a função até o limite da
//    Vercel e a pessoa fica olhando "Gerando" por um minuto.
// 3. **Redirecionamento é recusado.** `redirect: 'manual'` fecha o caminho mais curto de um endereço
//    público para um interno, que é o que a guarda de DNS sozinha não cobriria.
// 4. **A resposta vem como TEXTO.** Quem transforma em composição é o guarda de
//    `src/lib/composicao/`, como com qualquer modelo. Aqui não se faz `JSON.parse` do conteúdo.
//
// O `fetch` entra por parâmetro para o teste rodar sem rede, como o cliente Supabase nos outros
// módulos daqui.

import { criarFalhaDeTransporte } from './traduzirParaFalhaDaApi';

export interface PedidoAoFornecedor {
  enderecoBase: string;
  chave: string;
  modelo: string;
  instrucao: string;
  prompt: string;
  /** Teto de tokens da resposta. Composição cabe folgada; serve para o custo não explodir. */
  maximoDeTokens?: number;
}

export interface RespostaDoFornecedor {
  texto: string;
  tokensDeEntrada: number;
  tokensDeSaida: number;
}

export const SEGUNDOS_DE_ESPERA = 25;
const MAXIMO_DE_TOKENS_PADRAO = 900;
/** Resposta gigante de um endereço que não é fornecedor nenhum não vira memória nossa. */
const MAXIMO_DE_CARACTERES_DA_RESPOSTA = 200_000;

export type Buscador = typeof fetch;

export async function chamarFornecedorDeModeloDeLinguagem(
  pedido: PedidoAoFornecedor,
  buscar: Buscador = fetch,
): Promise<RespostaDoFornecedor> {
  let resposta: Response;
  try {
    resposta = await buscar(`${pedido.enderecoBase}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pedido.chave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: pedido.modelo,
        // A instrução e o catálogo vão como mensagem de sistema, e o texto da pessoa como mensagem
        // do usuário. É o que impede o prompt de se passar por instrução (ADR-008, D1).
        messages: [
          { role: 'system', content: pedido.instrucao },
          { role: 'user', content: pedido.prompt },
        ],
        // Temperatura baixa porque a saída é JSON com ids copiados do catálogo, não criação livre.
        temperature: 0.2,
        max_tokens: pedido.maximoDeTokens ?? MAXIMO_DE_TOKENS_PADRAO,
      }),
      redirect: 'manual',
      signal: AbortSignal.timeout(SEGUNDOS_DE_ESPERA * 1000),
    });
  } catch {
    // Rede fora, DNS, TLS, prazo estourado. O erro original não sobe: vira log, não resposta.
    throw criarFalhaDeTransporte('FORNECEDOR_NAO_RESPONDEU');
  }

  if (!resposta.ok) throw falhaDoStatus(resposta.status);

  let corpo: unknown;
  try {
    const texto = await resposta.text();
    if (texto.length > MAXIMO_DE_CARACTERES_DA_RESPOSTA) throw new Error('resposta grande demais');
    corpo = JSON.parse(texto);
  } catch {
    throw criarFalhaDeTransporte(
      'FORNECEDOR_NAO_RESPONDEU',
      'O fornecedor respondeu algo que não é do formato esperado. Confira o endereço e o modelo.',
    );
  }

  const texto = conteudoDaResposta(corpo);
  if (texto === null) {
    throw criarFalhaDeTransporte(
      'FORNECEDOR_NAO_RESPONDEU',
      'O fornecedor respondeu sem conteúdo. Tente de novo, ou troque o modelo.',
    );
  }

  const uso = (corpo as { usage?: Record<string, unknown> }).usage ?? {};
  return {
    texto,
    tokensDeEntrada: inteiro(uso.prompt_tokens),
    tokensDeSaida: inteiro(uso.completion_tokens),
  };
}

/**
 * O status do fornecedor vira um código nosso.
 *
 * 404 e 400 caem em "não tem o modelo" porque é a causa de longe mais comum das duas: nome de modelo
 * aposentado. O endereço errado também dá 404, e a mensagem do código cita as duas coisas.
 */
function falhaDoStatus(status: number) {
  if (status === 401 || status === 403) return criarFalhaDeTransporte('FORNECEDOR_RECUSOU_A_CHAVE');
  if (status === 429) return criarFalhaDeTransporte('FORNECEDOR_NO_LIMITE');
  if (status === 400 || status === 404 || status === 422) return criarFalhaDeTransporte('FORNECEDOR_NAO_TEM_O_MODELO');
  // 3xx cai aqui por causa do `redirect: 'manual'`, e é para cair: seguir o desvio é o caminho
  // mais curto de um endereço público para um interno.
  return criarFalhaDeTransporte('FORNECEDOR_NAO_RESPONDEU');
}

/** `choices[0].message.content`, tolerando o conteúdo em partes que alguns fornecedores devolvem. */
function conteudoDaResposta(corpo: unknown): string | null {
  const escolha = (corpo as { choices?: unknown[] })?.choices?.[0] as { message?: { content?: unknown } } | undefined;
  const conteudo = escolha?.message?.content;

  if (typeof conteudo === 'string' && conteudo.trim() !== '') return conteudo;
  if (Array.isArray(conteudo)) {
    const juntado = conteudo
      .map((parte) => (typeof parte === 'string' ? parte : ((parte as { text?: unknown })?.text ?? '')))
      .filter((parte): parte is string => typeof parte === 'string')
      .join('');
    if (juntado.trim() !== '') return juntado;
  }
  return null;
}

/** O `usage` vem do fornecedor, que é terceiro: ausente ou quebrado conta zero. */
function inteiro(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 0;
}
