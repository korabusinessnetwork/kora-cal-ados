// A frase que um campo de hex mostra enquanto a cor digitada ainda não é cor.
//
// Existe por causa do R9-A70. A frase morava dentro de `CampoDeCorDaCategoria.tsx`, e o campo do
// esboço (`esboco/PainelDeZonas.tsx`) tinha a sua própria, uma só para qualquer recusa: "Cor
// incompleta" para `vermelho`, para `#GGGGGG` e para `22aa44`. O último é o pior caso, porque é o
// formato que ferramenta de design copia, a cor está completa e falta só o `#`, e a tela dizia que
// faltava cor. As duas telas já dividiam a REGRA de quando o hex está completo
// (`estadoDoHexDigitado.ts`); agora dividem também a frase que explica o que falta.
//
// O campo continua recusando hex sem `#`, e é de propósito: a API recusa (`validarCor`), e o editor
// aceitar o que a API recusa é a divergência que o princípio nº1 proíbe. A frase diz o conserto em
// vez de o campo fazê-lo em silêncio.
//
// Texto que a pessoa lê merece teste tanto quanto a regra que o escolhe, e por isso esta função é
// separada e pura.

import { estadoDoHexDigitado } from './estadoDoHexDigitado';

/** Só dígitos hexadecimais, até seis: é hex, ou começo de hex, com o `#` esquecido. */
const SEM_CERQUILHA = /^[0-9a-fA-F]{1,6}$/;

/**
 * A frase para o texto digitado, ou `''` quando ele já é cor e não há nada a dizer.
 *
 * @param oQueMuda o que só muda quando a cor fecha, dito do jeito de cada tela: "a peça" na
 *   composição, "o preview" no esboço.
 *
 * As frases são diferentes de propósito: "continue digitando", "falta o #" e "isso não vai virar
 * cor" são notícias distintas, e dar a mesma para todas faz quem digitou `#C0` achar que errou.
 */
export function mensagemDoHexDigitado(texto: string, oQueMuda: string): string {
  const cru = texto.trim();
  const estado = estadoDoHexDigitado(cru);

  if (estado === 'completo') return '';
  if (estado === 'vazio') return 'Sem cor. Digite um hex como #C0392B, ou use o seletor ao lado.';

  if (estado === 'rascunho') {
    return `Cor incompleta. O formato é #RGB ou #RRGGBB, e ${oQueMuda} só muda quando ela fecha.`;
  }

  if (SEM_CERQUILHA.test(cru)) {
    return estadoDoHexDigitado(`#${cru}`) === 'completo'
      ? `Falta o # no começo. Escreva #${cru}.`
      : 'Falta o # no começo. O formato é #RGB ou #RRGGBB.';
  }

  return 'Isso não é um hex. O formato é #RGB ou #RRGGBB, por exemplo #C0392B.';
}
