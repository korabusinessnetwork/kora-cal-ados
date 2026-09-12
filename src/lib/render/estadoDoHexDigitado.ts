// Em que pé está o hex que alguém ainda está digitando.
//
// Existe porque a mesma decisão estava escrita em três lugares, com três regras diferentes:
// `features/zonas/coresDoPreview.ts` tinha `RASCUNHO_DE_HEX` e deixava `validarCor` julgar o resto,
// `esboco/PainelDeZonas.tsx` tinha `HEX_COMPLETO` e não conhecia rascunho nenhum, e a tela da
// composição não tinha campo de texto, então também não tinha a regra. Acrescentar o campo lá ia
// escrever a quarta versão, que é exatamente o que aconteceu com a contagem de elementos antes do
// R2-A22.
//
// Quem decide o que É um hex continua sendo `validarCor`, o mesmo validador que a API usa (princípio
// nº1: cor no editor = cor na API). O que este arquivo decide é só QUANDO ainda é cedo para
// reclamar, que é decisão de interface, não de cor.

import { validarCor } from './validarCor';

export type EstadoDoHex =
  /** Campo em branco. Não é erro, é ausência de cor: a zona simplesmente não tem preview. */
  | 'vazio'
  /** `validarCor` aceita. É esta, e só esta, que pode ir para o motor. */
  | 'completo'
  /** Ainda pode virar cor se a pessoa continuar digitando: `#`, `#C`, `#C0`, `#C039`, `#C0392`. */
  | 'rascunho'
  /** Nenhuma tecla a mais salva: `vermelho`, `#GGG`, `C0392B` sem `#`, `#C0392BB`. */
  | 'errado';

/**
 * Até 5 dígitos, porque com 6 já é hex completo, e com 3 também, na forma curta. Acima disso quem
 * julga é `validarCor`.
 *
 * O limite dos dois lados importa: acusar cedo demais reclama de quem não errou, tarde demais deixa
 * texto claramente errado sem aviso até o momento de salvar, que é o pior momento possível.
 *
 * Nota de quem for mexer aqui: trocar o 5 por 6 não muda resultado nenhum, e a mutação que fez isso
 * sobreviveu aos testes. O motivo é a ORDEM abaixo, não o número: seis dígitos já saíram como
 * `completo` antes de esta regra ser consultada. Quem faz o trabalho de verdade é o teto, e ele está
 * preso: com 7 o `#C0392BB` viraria rascunho, e dois testes morrem.
 */
const RASCUNHO = /^#[0-9a-fA-F]{0,5}$/;

export function estadoDoHexDigitado(texto: string): EstadoDoHex {
  const cru = texto.trim();

  if (cru === '') return 'vazio';

  // Completo ANTES de rascunho, porque `#ABC` casa com os dois: três dígitos é a forma curta, que
  // `validarCor` aceita, e é também um prefixo válido de seis. Invertido, a forma curta nunca
  // chegaria ao motor.
  try {
    validarCor(cru, 'hex digitado');
    return 'completo';
  } catch {
    // Não é cor ainda, ou nunca será. As duas linhas abaixo separam os dois casos.
  }

  return RASCUNHO.test(cru) ? 'rascunho' : 'errado';
}
