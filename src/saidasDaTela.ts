// Para onde cada tela leva, e com que palavras.
//
// Antes disto cada uma das quatro telas escrevia a própria lista de saídas à mão dentro do
// `App.tsx`, e quatro listas escritas à mão divergem. Divergiram: o esboço oferecia UMA saída,
// "ir para o editor (pede login)", enquanto as outras três ofereciam as três irmãs cada uma. Ou
// seja, a única tela que um clone recém-baixado abre, sem conta e sem `.env.local`, oferecia como
// único caminho justamente a que ia pedir credencial, e o palco 3D e o calçado montado, que também
// rodam sem banco, ficavam indescobríveis para quem chegasse por ali.
//
// O rótulo também tinha divergido: o palco 3D era "ver o palco 3D (sem banco, sem conta)" numa
// tela, "ver o palco 3D (idem)" noutra e "← ver uma peça por vez (palco 3D)" numa terceira. Três
// nomes para o mesmo destino é exatamente o que o ADR-003 proíbe ("um termo, um nome, sempre"),
// e num rodapé de navegação o custo é direto: a pessoa não reconhece que já esteve lá.
//
// A regra virou dado, e o dado é testável. É a diferença entre consertar o esboço e impedir que a
// quinta tela nasça com o mesmo defeito.

import type { Tela } from './telaInicial';

/** A ordem em que as saídas aparecem, sempre a mesma, em qualquer tela. */
const ORDEM: Tela[] = ['esboco', 'palco3d', 'composicao', 'app'];

/**
 * O que cada botão de saída diz.
 *
 * O parêntese não é enfeite, é o que a pessoa precisa saber ANTES de clicar: as três primeiras
 * dizem o que a tela mostra, e a do editor avisa que vai pedir login. Prevenção de erro antes de
 * mensagem de erro, que é o princípio nº1 aplicado à navegação.
 */
export const ROTULO_DA_SAIDA: Record<Tela, string> = {
  esboco: 'ver o esboço do motor (2D, sem banco)',
  palco3d: 'ver o palco 3D (uma peça por vez)',
  composicao: 'ver o calçado montado (as peças juntas)',
  app: 'ir para o editor (pede login)',
};

/**
 * As saídas de uma tela: todas as outras, na ordem canônica.
 *
 * É "todas as outras" e não uma lista por tela de propósito. Lista por tela é o que estava escrito
 * no `App.tsx` e é o que divergiu; aqui, acrescentar uma tela nova a `Tela` e a `ROTULO_DA_SAIDA`
 * já a faz aparecer no rodapé das outras, sem ninguém precisar lembrar de quatro lugares.
 *
 * A tela de configuração ausente usa `saidasDe('app')`, e é o comportamento certo: ela É a área
 * protegida falhando, então o que ela deve oferecer são justamente as três que rodam sem banco.
 */
export function saidasDe(atual: Tela): Tela[] {
  return ORDEM.filter((tela) => tela !== atual);
}
