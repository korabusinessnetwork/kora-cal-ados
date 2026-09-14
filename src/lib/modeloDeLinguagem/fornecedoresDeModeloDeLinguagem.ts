// Os fornecedores de modelo de linguagem que a marca pode escolher (D13).
//
// A lista veio do catálogo de planos grátis do OmniRoute (`docs/reference/FREE_TIERS.md`), cortada
// pelo que serve a este projeto: fornecedor com chave própria, com endpoint compatível com OpenAI
// (`/chat/completions`) e com modelo de texto bom o bastante para responder JSON. Ficaram de fora
// os fornecedores sem chave (anônimos, com espera de segundos entre chamadas e uso comercial
// incerto) e os que só atendem pelo formato próprio.
//
// Mora em `src/lib/` e não em `api/_lib/` porque os dois lados precisam da MESMA lista: a tela
// mostra nome, link e modelo sugerido, e o servidor usa o endereço. Duas listas divergiriam, e o
// servidor chamaria um endereço que a tela não mostrou. Por isso este arquivo não depende de
// navegador nem de Node.
//
// O endereço dos fornecedores da lista é FIXO aqui, e não configurável pelo owner: é o que impede
// a opção "Groq" de virar uma chamada a um endereço qualquer. Endereço livre só existe na API
// própria, que passa pela guarda de `validarEnderecoDaApiPropria`.
//
// Os modelos sugeridos envelhecem (fornecedor aposenta modelo sem aviso). Por isso o modelo é campo
// livre na tela, com estes como sugestão, e "Testar conexão" é o que confirma que ele existe.

export type IdDoFornecedor =
  | 'groq'
  | 'gemini'
  | 'cerebras'
  | 'mistral'
  | 'openrouter'
  | 'sambanova'
  | 'github_models'
  | 'api_propria';

export interface FornecedorDeModeloDeLinguagem {
  id: IdDoFornecedor;
  nome: string;
  /** Sem barra no fim. `null` só na API própria, em que quem informa é o owner. */
  enderecoBase: string | null;
  /** Onde a marca cria a chave dela. `null` só na API própria. */
  linkDaChave: string | null;
  modelosSugeridos: readonly string[];
  /** O que o plano grátis permite, em uma frase, para a marca saber o que esperar antes de colar a chave. */
  planoGratis: string | null;
}

export const FORNECEDORES_DE_MODELO_DE_LINGUAGEM: readonly FornecedorDeModeloDeLinguagem[] = [
  {
    id: 'groq',
    nome: 'Groq',
    enderecoBase: 'https://api.groq.com/openai/v1',
    linkDaChave: 'https://console.groq.com/keys',
    // Os Llama saíram do plano grátis em 2026-08-16 (a Groq devolve 404 para eles). Os GPT OSS são
    // modelos que raciocinam antes de responder: por isso o teto de tokens da chamada é folgado.
    modelosSugeridos: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
    planoGratis: 'Grátis com limite por minuto e por dia, e muito rápido.',
  },
  {
    id: 'gemini',
    nome: 'Google Gemini',
    enderecoBase: 'https://generativelanguage.googleapis.com/v1beta/openai',
    linkDaChave: 'https://aistudio.google.com/apikey',
    modelosSugeridos: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    planoGratis:
      'Grátis com limite por minuto e por dia. No plano grátis o Google pode usar os pedidos para melhorar os modelos dele.',
  },
  {
    id: 'cerebras',
    nome: 'Cerebras',
    enderecoBase: 'https://api.cerebras.ai/v1',
    linkDaChave: 'https://cloud.cerebras.ai',
    modelosSugeridos: ['llama-3.3-70b', 'llama3.1-8b'],
    planoGratis: 'Grátis com limite de tokens por dia.',
  },
  {
    id: 'mistral',
    nome: 'Mistral',
    enderecoBase: 'https://api.mistral.ai/v1',
    linkDaChave: 'https://console.mistral.ai/api-keys',
    modelosSugeridos: ['mistral-small-latest', 'open-mistral-nemo'],
    planoGratis: 'Plano grátis de experimentação, com limite por minuto.',
  },
  {
    id: 'openrouter',
    nome: 'OpenRouter',
    enderecoBase: 'https://openrouter.ai/api/v1',
    linkDaChave: 'https://openrouter.ai/keys',
    modelosSugeridos: ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free'],
    planoGratis: 'Os modelos terminados em ":free" são grátis, com limite por dia.',
  },
  {
    id: 'sambanova',
    nome: 'SambaNova',
    enderecoBase: 'https://api.sambanova.ai/v1',
    linkDaChave: 'https://cloud.sambanova.ai/apis',
    modelosSugeridos: ['Meta-Llama-3.3-70B-Instruct', 'Meta-Llama-3.1-8B-Instruct'],
    planoGratis: 'Grátis com limite por minuto.',
  },
  {
    id: 'github_models',
    nome: 'GitHub Models',
    enderecoBase: 'https://models.github.ai/inference',
    linkDaChave: 'https://github.com/settings/personal-access-tokens',
    modelosSugeridos: ['openai/gpt-4.1-mini', 'meta/Llama-3.3-70B-Instruct'],
    planoGratis: 'Grátis para experimentar, com limite por dia. A chave é um token do GitHub com a permissão "Models".',
  },
  {
    id: 'api_propria',
    nome: 'API própria',
    enderecoBase: null,
    linkDaChave: null,
    modelosSugeridos: [],
    planoGratis: null,
  },
];

const POR_ID = new Map<string, FornecedorDeModeloDeLinguagem>(
  FORNECEDORES_DE_MODELO_DE_LINGUAGEM.map((fornecedor) => [fornecedor.id, fornecedor]),
);

/** O fornecedor pelo id, ou `undefined` para id fora da lista (o id chega de entrada não confiável). */
export function fornecedorPorId(id: unknown): FornecedorDeModeloDeLinguagem | undefined {
  return typeof id === 'string' ? POR_ID.get(id) : undefined;
}

/** Fornecedor da lista usa o plano grátis e custa zero; só a API própria tem preço. */
export function ehApiPropria(id: IdDoFornecedor): boolean {
  return id === 'api_propria';
}
