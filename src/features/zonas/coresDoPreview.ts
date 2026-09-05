// Separa **texto em edição** (o que está no campo, caractere a caractere) de **cores
// válidas** (o que o motor recebe). A pessoa digita `#`, `#C`, `#C0`… e cada tecla dispara
// um render: se o texto cru fosse direto para `gerarVarianteDeCor`, o palco cairia em
// `COR_INVALIDA` a cada tecla, o calçado sumiria durante a digitação e o painel acusaria
// um erro que a pessoa ainda não cometeu — ela só não terminou de digitar.
//
// A regra mora fora do hook de propósito, como em `marcacaoEmCurso.ts`: não usamos
// testing-library neste projeto (restrição de custo, `memory/restrictions.md`), então
// lógica dentro de hook é lógica não testada.
//
// Quem decide se um texto é cor válida é sempre `validarCor` — o mesmo validador que a API
// usa (princípio nº1: cor no editor = cor na API). Aqui só se decide **quando ainda é cedo
// para reclamar**, nunca o que é um hex.

import { ErroDeVariante } from '../../lib/render/erros';
import { validarCor } from '../../lib/render/validarCor';
import type { CoresPorZona } from '../../lib/render/gerarVarianteDeCor';

/** `zone_key` → o texto cru do campo, exatamente como foi digitado. */
export type CoresEmEdicao = Record<string, string>;

/**
 * Rascunho = texto que ainda pode virar um hex se a pessoa continuar digitando: `#`, `#C`,
 * `#C0`, `#C039`, `#C0392`. Até 5 dígitos, porque com 6 já é hex completo (e com 3 também,
 * na forma curta) — aí `validarCor` decide, não esta regra.
 *
 * O que é rascunho não vira erro; qualquer outra coisa vira. `vermelho`, `#GGG`, `C0392B`
 * sem `#` e `#C0392BB` são erro na hora: nenhuma tecla a mais os transforma em cor, então
 * esperar até o salvar só adiaria a mesma má notícia para o pior momento.
 *
 * O limite dos dois lados importa: erro cedo demais acusa quem não errou, tarde demais
 * deixa texto claramente errado sem aviso.
 */
const RASCUNHO_DE_HEX = /^#[0-9a-fA-F]{0,5}$/;

function ehRascunho(texto: string): boolean {
  return RASCUNHO_DE_HEX.test(texto);
}

/**
 * Só o que `validarCor` aceita, já normalizado em `#RRGGBB` maiúsculo — é isto que vai
 * para `gerarVarianteDeCor`. Rascunho e texto errado simplesmente não participam do
 * pedido: uma zona sendo digitada não pode impedir as outras de continuarem pintadas.
 */
export function coresValidas(emEdicao: CoresEmEdicao): CoresPorZona {
  const cores: CoresPorZona = {};

  for (const [zoneKey, texto] of Object.entries(emEdicao)) {
    try {
      cores[zoneKey] = validarCor(texto, zoneKey);
    } catch {
      // Não é cor ainda (ou nunca será): quem avisa é `errosDeCor`, não este caminho.
    }
  }

  return cores;
}

/**
 * `zone_key` → mensagem do motor, só para o que está errado de verdade. Campo vazio não é
 * erro (é ausência de preview) e rascunho ainda incompleto também não.
 *
 * A mensagem é a que `validarCor` produz, não uma frase escrita aqui: se a regra de cor
 * mudar, o texto que a pessoa lê muda junto, sem duas versões da mesma explicação.
 */
export function errosDeCor(emEdicao: CoresEmEdicao): Record<string, string> {
  const erros: Record<string, string> = {};

  for (const [zoneKey, texto] of Object.entries(emEdicao)) {
    const cru = texto.trim();
    if (cru === '' || ehRascunho(cru)) continue;

    try {
      validarCor(cru, zoneKey);
    } catch (erro) {
      if (!(erro instanceof ErroDeVariante)) throw erro;
      erros[zoneKey] = erro.message;
    }
  }

  return erros;
}

/**
 * Define ou limpa a cor de uma zona sem mutar o objeto recebido — mutar o objeto que está
 * no `useState` faz a tela não atualizar (React compara por identidade).
 *
 * Valor vazio **remove a chave** em vez de guardar `''`: zona sem preview e zona com
 * preview vazio são o mesmo estado, e duas representações do mesmo estado divergem.
 */
export function definirCor(
  emEdicao: CoresEmEdicao,
  zoneKey: string,
  valor: string,
): CoresEmEdicao {
  if (valor.trim() === '') {
    if (!(zoneKey in emEdicao)) return emEdicao;

    const resto: CoresEmEdicao = { ...emEdicao };
    delete resto[zoneKey];
    return resto;
  }

  // Mesmo texto de novo devolve o mesmo objeto: render sem mudança nenhuma é render que
  // repassa o SVG inteiro pelo motor à toa.
  if (emEdicao[zoneKey] === valor) return emEdicao;

  return { ...emEdicao, [zoneKey]: valor };
}
