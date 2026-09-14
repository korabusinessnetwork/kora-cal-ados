// O custo estimado de uma chamada ao fornecedor (D13, item 9).
//
// Preço em dólar por milhão de tokens, que é como todo fornecedor publica. Arredondado em 6 casas
// porque é a precisão da coluna `numeric(12,6)`: arredondar aqui, e não deixar o banco arredondar,
// faz o valor que o teste confere ser o mesmo que fica gravado.

export interface PrecoPorMilhaoDeTokens {
  entrada: number;
  saida: number;
}

export const SEM_CUSTO: PrecoPorMilhaoDeTokens = { entrada: 0, saida: 0 };

export function calcularCustoEstimado(
  tokensDeEntrada: number,
  tokensDeSaida: number,
  preco: PrecoPorMilhaoDeTokens,
): number {
  const custo =
    (inteiroNaoNegativo(tokensDeEntrada) * preco.entrada + inteiroNaoNegativo(tokensDeSaida) * preco.saida) / 1_000_000;
  return Math.round(custo * 1_000_000) / 1_000_000;
}

/** O `usage` vem do fornecedor, que é terceiro: número ausente, negativo ou quebrado conta zero. */
export function inteiroNaoNegativo(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 0;
}

/** Custo em dólar para a tela. Abaixo de um centavo mostra as casas que fazem diferença. */
export function formatarCustoEmDolar(valor: number): string {
  const casas = valor > 0 && valor < 0.01 ? 4 : 2;
  return `US$ ${valor.toFixed(casas).replace('.', ',')}`;
}
