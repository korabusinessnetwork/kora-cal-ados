// Como um parâmetro de peça aparece na tela: a medida em milímetros e o passo do controle.
//
// Existe por causa do R9-A68. As duas telas do palco que mostram parâmetro, a da composição
// (`ControlesDeParametro.tsx`) e a de uma peça (`ParametrosDaPeca.tsx`), tinham cada uma a sua cópia
// destas duas coisas, e o comentário de uma delas pedia justamente "mesmo texto e mesma ordem" da
// outra. Com duas cópias, mudar a casa decimal ou o passo numa tela deixava a outra para trás sem
// teste nenhum reprovar, e a mesma espessura passava a ser escrita de dois jeitos (ADR-003, um
// conceito, um lugar).

/** Quantos passos o controle deslizante tem entre o mínimo e o máximo da faixa. */
export const PASSOS_DO_PARAMETRO = 40;

/** Metros viram milímetros na tela: 0,018 m não se lê, 18 mm sim. */
export function milimetros(metros: number): string {
  return `${(metros * 1000).toFixed(1).replace('.', ',')} mm`;
}

/** O passo do controle de um parâmetro, para a faixa inteira caber em `PASSOS_DO_PARAMETRO` passos. */
export function passoDoParametro(parametro: { minimo: number; maximo: number }): number {
  return (parametro.maximo - parametro.minimo) / PASSOS_DO_PARAMETRO;
}
