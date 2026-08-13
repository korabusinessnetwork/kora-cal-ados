// Traduz `tenants.tema` (jsonb livre) em custom properties CSS.
//
// Função pura e defensiva de propósito: `tema` é dado que veio do banco, editável por
// owner, e um valor bobo lá não pode derrubar o app inteiro do tenant. Chave que o
// projeto não conhece é IGNORADA em vez de virar `--qualquer-coisa: <valor>` — senão o
// tema vira um vetor de injeção de CSS arbitrário na interface.

/** Chaves aceitas em `tenants.tema` → token correspondente em src/estilos/tokens.css. */
const TOKENS_DO_TENANT: Record<string, string> = {
  cor_primaria: '--cor-primaria',
  cor_primaria_texto: '--cor-primaria-texto',
  cor_superficie: '--cor-superficie',
  cor_superficie_elevada: '--cor-superficie-elevada',
  cor_borda: '--cor-borda',
  cor_texto: '--cor-texto',
  cor_texto_suave: '--cor-texto-suave',
};

/** Só cor hex — mesma disciplina do motor de render (ADR-004, q3). */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export type TemaDoTenant = Record<string, unknown> | null | undefined;

/**
 * Devolve só os pares (token, valor) válidos. Não toca no DOM: quem aplica é o provider,
 * o que mantém esta parte testável sem navegador.
 */
export function lerTemaDoTenant(tema: TemaDoTenant): Array<[string, string]> {
  if (!tema || typeof tema !== 'object') return [];

  const aplicaveis: Array<[string, string]> = [];

  for (const [chave, valor] of Object.entries(tema)) {
    const token = TOKENS_DO_TENANT[chave];

    if (!token) continue;
    if (typeof valor !== 'string' || !HEX.test(valor.trim())) continue;

    aplicaveis.push([token, valor.trim()]);
  }

  return aplicaveis;
}

/** Escreve os tokens do tenant no elemento raiz. Tema vazio deixa os neutros de pé. */
export function aplicarTemaDoTenant(tema: TemaDoTenant, raiz: HTMLElement): void {
  for (const [token, valor] of lerTemaDoTenant(tema)) {
    raiz.style.setProperty(token, valor);
  }
}
