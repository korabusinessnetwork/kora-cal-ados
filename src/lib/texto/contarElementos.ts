// A contagem de elementos do calçado escrita em frase, num lugar só.
//
// Por que virou função, se cada tela montava a sua: a regra do plural estava escrita quatro vezes,
// de três jeitos, e a quarta esqueceu dela. A tela do produto aberto mostrava "1 elementos
// marcáveis". O projeto já tinha decidido que "1 elementos" na tela do time lê como bug do sistema
// (o comentário está em `features/zonas/PainelDeZonas.tsx`, na função que esta aqui substitui); o
// que faltava era a decisão morar onde as quatro telas alcançassem.
//
// O adjetivo chega flexionado nas duas formas em vez de ser derivado do singular: "marcado" vira
// "marcados" e "marcável" vira "marcáveis", que não é a mesma regra. Função que adivinha plural de
// português acerta enquanto as palavras forem parecidas e erra calada na primeira que não for.

export interface FlexaoDoAdjetivo {
  /** Como o adjetivo se escreve com 1 elemento: "marcado", "marcável". */
  singular: string;
  /** Como ele se escreve com 0 ou mais de 1: "marcados", "marcáveis". */
  plural: string;
}

/**
 * `contarElementos(3)` → "3 elementos".
 * `contarElementos(1, { singular: 'marcável', plural: 'marcáveis' })` → "1 elemento marcável".
 *
 * Zero é plural em português ("0 elementos"), e é o caso que mais aparece: produto recém-aberto,
 * nada marcado ainda.
 */
export function contarElementos(quantidade: number, adjetivo?: FlexaoDoAdjetivo): string {
  const umSo = quantidade === 1;
  const substantivo = umSo ? 'elemento' : 'elementos';

  if (adjetivo === undefined) return `${quantidade} ${substantivo}`;

  return `${quantidade} ${substantivo} ${umSo ? adjetivo.singular : adjetivo.plural}`;
}
