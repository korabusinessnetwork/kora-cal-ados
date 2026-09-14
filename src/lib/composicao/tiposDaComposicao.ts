// O vocabulário do modo gerado (ADR-008), em tipos. Nenhum comportamento mora aqui.
//
// Duas metades com donos diferentes, e a diferença é de confiança, não de estilo:
//
// - **catálogo** (`CatalogoDoAcervo`, `Forma`, `PecaDoAcervo`) é NOSSO dado, vindo do banco
//   sob RLS. A validação o trata como verdade.
// - **composição** (`Composicao`, `EscolhaDePeca`) é entrada NÃO CONFIÁVEL: ou veio da
//   resposta de um modelo de linguagem, ou veio do corpo de um pedido. Por isso
//   `validarComposicao` a recebe como `unknown` e nunca como `Composicao`, declarar o tipo
//   na entrada seria afirmar exatamente o que está por verificar.
//
// Campos de dado em snake_case porque atravessam banco e API, como `zone_key` e
// `svg_selector` já fazem. Nome de função e de variável local segue camelCase.

/**
 * Um número contínuo que a peça aceita (ADR-008 D7), com a faixa que ele respeita.
 *
 * A faixa mora na PEÇA e não no validador de propósito: espessura de sola de tênis e de
 * chinelo não têm o mesmo limite, e um número escrito no validador seria o mesmo limite para
 * as duas.
 */
export interface ParametroDePeca {
  nome: string;
  minimo: number;
  maximo: number;
  /** Usado quando a composição não menciona o parâmetro. Nunca inventado pelo validador. */
  padrao: number;
}

/**
 * Um item do acervo: **uma** sola específica, **um** cabedal específico.
 *
 * `categoria` é o papel que a peça cumpre, e no produto gerado ela É a `zone_key` da zona
 * correspondente (ADR-008 D3: cada peça é uma zona). Não é analogia, é o mesmo texto, no
 * mesmo campo público, e por isso ela passa por `validarZoneKey`.
 */
export interface PecaDoAcervo {
  id: string;
  categoria: string;
  /** Só combina com peça da mesma forma (ADR-008 D4). Misturar é estado inválido. */
  forma_id: string;
  rotulo: string;
  /** Vazio é legítimo: peça sem variação paramétrica. D7 é opcional por peça. */
  parametros: ParametroDePeca[];
}

/** Uma categoria que a forma prevê, e se o calçado fica de pé sem ela. */
export interface CategoriaDaForma {
  categoria: string;
  obrigatoria: boolean;
  /**
   * Sobre qual categoria esta assenta, quando o calçado é montado em cena (T14).
   *
   * Mora na FORMA e não numa lista fixa no código, pela mesma razão que as categorias moram:
   * chinelo não tem cadarço, e sandália não empilha como tênis. Anatomia é conhecimento da
   * forma, não do montador.
   *
   * Opcional de propósito: categoria sem este campo assenta no chão. É o certo para a sola, e é
   * o certo para toda forma que ainda não declarou empilhamento nenhum, que continua montando
   * com cada peça no assento em que foi modelada.
   */
  assenta_sobre?: string;
}

/**
 * O molde do pé, e o que agrupa o acervo (ADR-008 D4).
 *
 * A forma é quem declara suas categorias, e não existe lista fixa de categorias no código:
 * chinelo não tem cadarço, e uma lista fixa transformaria isso em recusa permanente.
 */
export interface Forma {
  id: string;
  rotulo: string;
  categorias: CategoriaDaForma[];
}

/** O acervo visível a um tenant: base mais o próprio, já recortado por RLS antes de chegar. */
export interface CatalogoDoAcervo {
  formas: Forma[];
  pecas: PecaDoAcervo[];
}

/**
 * Uma escolha da composição: qual peça, em que cor, com que parâmetros.
 *
 * **Não carrega a categoria de propósito.** A peça já sabe a sua, e um segundo campo dizendo
 * a mesma coisa é um campo que pode discordar, a composição diria `cadarco` apontando para
 * uma sola, e alguém teria que decidir qual dos dois vale. Campo redundante que pode divergir
 * é a família de defeito que este projeto persegue desde o BUG-013.
 */
export interface EscolhaDePeca {
  peca_id: string;
  /** Ausente é válido: a peça mantém a cor própria. Presente passa por `validarCor`. */
  cor?: string;
  parametros?: Record<string, number>;
}

/**
 * O que define um calçado gerado (ADR-008 D2): JSON de algumas linhas, nunca um arquivo 3D.
 *
 * `pecas` é uma **lista** e não um objeto com chave por categoria. A razão é a única decisão
 * de forma que importa aqui: num objeto, categoria repetida é indetectável, porque
 * `JSON.parse` descarta a chave duplicada em silêncio e fica com a última. Seria a última
 * chave do JSON decidindo a cor do calçado sem ninguém ver, o BUG-013 por um terceiro
 * caminho. Em lista, `sola` duas vezes é visível e vira recusa.
 */
export interface Composicao {
  forma_id: string;
  pecas: EscolhaDePeca[];
}

/**
 * Uma escolha já resolvida contra o acervo.
 *
 * `peca` é **a entrada do catálogo**, não o id que veio na entrada. É a propriedade que faz
 * este módulo ser um guarda e não um conferidor: quem consome uma `ComposicaoValidada` não
 * tem em mãos a string que o modelo de linguagem escreveu, então não tem como transformá-la
 * em caminho de arquivo. O id inventado morre na validação, não três camadas adiante.
 */
export interface PecaValidada {
  /** Vem da peça do catálogo. Repetido aqui porque é a `zone_key` da zona gerada. */
  categoria: string;
  peca: PecaDoAcervo;
  /** Já em `#RRGGBB` maiúsculo quando presente, `validarCor` expande a forma curta. */
  cor?: string;
  /** Sempre completo: parâmetro não mencionado entra com o `padrao` declarado pela peça. */
  parametros: Record<string, number>;
}

/** A composição inteira, resolvida. Sai assim ou não sai, a validação não devolve meio. */
export interface ComposicaoValidada {
  forma: Forma;
  pecas: PecaValidada[];
}
