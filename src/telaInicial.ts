// De onde sai a tela que o app abre, e qual delas dispensa o Supabase.
//
// Mora fora do `App` por dois motivos. O primeiro é banal: é a única regra daquele
// arquivo que dá para testar sem montar React. O segundo importa mais — "qual tela abre
// sem sessão" é decisão de segurança, e decisão de segurança escondida num `if` no meio
// de um componente é a que ninguém revisa e alguém amplia sem perceber.
//
// A regra inteira é uma frase: existe uma LISTA de telas sem banco, e só o que está nela
// a URL pode escolher. Qualquer outro valor cai na área protegida, que tem o portão
// inteiro pela frente. O padrão é o lado seguro, não o lado conveniente.
//
// A lista nasceu com um item só e já tem dois. Ela é explícita, e não um `!== 'app'`, para
// acrescentar uma tela exigir escrever o nome dela aqui: é a linha onde alguém para e
// pergunta de que lado do portão a tela nova fica.

/** As telas sem banco: nenhuma delas faz uma requisição sequer nem pede sessão. */
const TELAS_SEM_BANCO = ['esboco', 'palco3d'] as const;

/** As telas do app. As de `TELAS_SEM_BANCO` dispensam o Supabase; `app` é tudo atrás do portão. */
export type Tela = 'app' | (typeof TELAS_SEM_BANCO)[number];

/**
 * A tela que o `npm run dev` abre, lida da query string.
 *
 * `?tela=esboco` abre o esboço do motor sem pedir conta — ele lê um SVG commitado
 * (`src/esboco/produtoDemo.ts`) e não faz uma requisição sequer. `?tela=palco3d` abre o
 * palco 3D, que monta a peça a partir de código (`src/lib/acervo/`) e também não pede
 * nada à rede. Não é bypass de autenticação: não existe caminho de nenhuma das duas para
 * qualquer tela que consulte o banco.
 *
 * Recebe a busca por parâmetro para o teste não depender de `window`.
 */
export function lerTelaDaUrl(busca: string): Tela {
  // Tolerante a caixa e espaço porque este endereço é digitado à mão, por gente que
  // acabou de ler o nome dele num README. `?tela=Esboco` cair na tela de login seria
  // um erro sem mensagem — e mensagem de erro que não existe é a pior de todas.
  const pedida = new URLSearchParams(busca).get('tela')?.trim().toLowerCase();
  const encontrada = TELAS_SEM_BANCO.find((tela) => tela === pedida);

  return encontrada ?? 'app';
}

/**
 * O endereço que aponta para uma tela — para a barra do navegador acompanhar o que está
 * na tela, e um F5 não jogar de volta no login.
 *
 * O caminho é parâmetro OBRIGATÓRIO, não opcional com `window.location.pathname` de
 * padrão: parâmetro com padrão é avaliado justamente quando é omitido, então o padrão
 * traria `window` de volta para dentro do módulo — e o teste que roda em ambiente Node
 * quebraria na chamada mais simples. Sem referência a `window`, este arquivo é puro e
 * testável inteiro. Quem sabe o que é `window` é o `App`. Voltar para o app limpa a
 * query em vez de escrever `?tela=app` — um endereço que não pede nada é a forma certa
 * de dizer "a tela padrão", e evita dar a impressão de que existe um valor de query
 * capaz de escolher a área protegida.
 */
export function urlDaTela(tela: Tela, caminho: string): string {
  return tela === 'app' ? caminho : `?tela=${tela}`;
}
