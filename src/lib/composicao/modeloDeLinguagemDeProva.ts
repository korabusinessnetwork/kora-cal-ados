// O gerador de prova: um modelo de linguagem FALSO, sem IA, sem rede e sem custo (D12).
//
// Existe para a esteira prompt → composição funcionar de ponta a ponta enquanto nenhum fornecedor
// foi escolhido, que é decisão paga do dono. Cumpre o mesmo contrato de um fornecedor de verdade,
// `ModeloDeLinguagem`, e por isso as três regras abaixo não são enfeite:
//
// 1. **Lê só o que recebeu.** O catálogo vem do pedido, em texto, como vai para um fornecedor. Ele
//    não importa o acervo de prova, então não tem como escolher peça que o pedido não ofereceu.
// 2. **Responde texto**, e quem transforma em composição é o guarda, como com qualquer modelo.
// 3. **Não finge ser IA.** Ele entende palavras-chave: nome de categoria, palavras do rótulo da
//    peça, "sem <categoria>", nome de cor e hex, "grossa" e "fina". A tela diz isso, porque a
//    regra de transparência de `memory/restrictions.md` proíbe atribuir a uma IA o que ela não fez.
//
// A regra de "a qual peça esta palavra se refere" é a mais simples que responde frases como
// "sola tratorada branca, cabedal azul": a cor e a espessura valem para a categoria citada por
// último ANTES delas. Cor sem categoria antes vale para o calçado inteiro.

import type { CatalogoParaModelo } from './montarCatalogoParaModelo';
import type { ModeloDeLinguagem } from './gerarComposicaoPorPrompt';

/**
 * Nome de cor em português para um hex. Sem significado de marca: identidade vem do tenant, e isto
 * é só o tom mais comum de cada nome. As duas flexões moram aqui porque "sola branca" e "cabedal
 * branco" são o mesmo pedido.
 */
const CORES: Readonly<Record<string, string>> = {
  vermelho: '#C0392B', vermelha: '#C0392B',
  azul: '#1F4FA8',
  verde: '#2E8B57',
  amarelo: '#E8B33C', amarela: '#E8B33C',
  preto: '#1A1A1A', preta: '#1A1A1A',
  branco: '#F2F2F2', branca: '#F2F2F2',
  cinza: '#8C8C8C',
  rosa: '#E07AA0',
  laranja: '#E67E22',
  marrom: '#7B4A2A',
  bege: '#D8C3A5',
  roxo: '#6C3FA0', roxa: '#6C3FA0',
};

/** Palavras que levam os parâmetros da categoria ao máximo ou ao mínimo da faixa (ADR-008 D7). */
const AO_MAXIMO = new Set(['grossa', 'grosso', 'robusta', 'robusto']);
const AO_MINIMO = new Set(['fina', 'fino']);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/;

/** O gerador de prova no formato de qualquer modelo de linguagem. */
export const modeloDeLinguagemDeProva: ModeloDeLinguagem = async ({ catalogo, prompt }) =>
  responderComoGeradorDeProva(catalogo, prompt);

/** A resposta em si, síncrona e pura, para o teste não depender de promessa. */
export function responderComoGeradorDeProva(textoDoCatalogo: string, prompt: string): string {
  const catalogo = JSON.parse(textoDoCatalogo) as CatalogoParaModelo;
  const palavras = normalizar(prompt).split(/[^a-z0-9#]+/).filter(Boolean);

  const escolhas = catalogo.categorias.flatMap(({ categoria, obrigatoria }) => {
    const nome = normalizar(categoria);
    // Categoria obrigatória não é dispensável, nem a pedido: o guarda recusaria o calçado inteiro.
    const dispensada =
      !obrigatoria && palavras.some((palavra, i) => palavra === 'sem' && ehNomeDaCategoria(palavras[i + 1], nome));
    if (dispensada) return [];

    const pecas = catalogo.pecas.filter((peca) => peca.categoria === categoria);
    const escolhida = pecaMaisCitada(pecas, palavras, nome);
    if (escolhida === undefined) return [];

    // Onde, no prompt, esta categoria foi citada: pelo nome dela ou por uma palavra do rótulo da
    // peça escolhida. É o que a cor e a espessura seguintes vão procurar para trás.
    const citacoes = palavras.flatMap((palavra, i) =>
      ehNomeDaCategoria(palavra, nome) || palavrasDoRotulo(escolhida.rotulo, nome).includes(palavra) ? [i] : [],
    );

    return [{ categoria, peca: escolhida, citacoes }];
  });

  const resposta = escolhas.map(({ categoria, peca }) => {
    const escolha: { peca_id: string; cor?: string; parametros?: Record<string, number> } = { peca_id: peca.peca_id };
    const dona = (i: number) => categoriaCitadaAntes(escolhas, i);

    palavras.forEach((palavra, i) => {
      const cor = HEX.test(palavra) ? palavra : CORES[palavra];
      if (cor !== undefined && (dona(i) === categoria || (dona(i) === undefined && escolha.cor === undefined))) {
        escolha.cor = cor;
      }

      const extremo = AO_MAXIMO.has(palavra) ? 'maximo' : AO_MINIMO.has(palavra) ? 'minimo' : undefined;
      if (extremo !== undefined && dona(i) === categoria && peca.parametros.length > 0) {
        escolha.parametros = Object.fromEntries(peca.parametros.map((p) => [p.nome, p[extremo]]));
      }
    });

    return escolha;
  });

  return JSON.stringify({ forma_id: catalogo.forma_id, pecas: resposta });
}

type PecaParaModelo = CatalogoParaModelo['pecas'][number];

/** A peça com mais palavras do rótulo no prompt. Empate, ou nenhuma citada, fica com a primeira. */
function pecaMaisCitada(pecas: PecaParaModelo[], palavras: string[], nomeDaCategoria: string) {
  let melhor = pecas[0];
  let pontos = 0;

  for (const peca of pecas) {
    const citadas = palavrasDoRotulo(peca.rotulo, nomeDaCategoria).filter((p) => palavras.includes(p)).length;
    if (citadas > pontos) {
      melhor = peca;
      pontos = citadas;
    }
  }

  return melhor;
}

/**
 * As palavras do rótulo que distinguem a peça. Fica de fora o nome da categoria ("Sola" em "Sola
 * plana" não diz qual sola) e palavra curta ("de", "com"), que casaria com qualquer frase.
 */
function palavrasDoRotulo(rotulo: string, nomeDaCategoria: string): string[] {
  return normalizar(rotulo)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3 && !ehNomeDaCategoria(p, nomeDaCategoria));
}

/** A categoria citada por último antes da posição `i`, ou `undefined` se nenhuma foi. */
function categoriaCitadaAntes(escolhas: { categoria: string; citacoes: number[] }[], i: number) {
  let dona: string | undefined;
  let posicao = -1;

  for (const { categoria, citacoes } of escolhas) {
    for (const c of citacoes) {
      if (c < i && c > posicao) {
        dona = categoria;
        posicao = c;
      }
    }
  }

  return dona;
}

/** "cadarco" e "cadarcos" são a mesma categoria. */
function ehNomeDaCategoria(palavra: string | undefined, nome: string): boolean {
  return palavra === nome || palavra === `${nome}s`;
}

/** Minúsculo e sem acento, porque "cadarço" escrito à mão raramente vem igual à `zone_key`. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
