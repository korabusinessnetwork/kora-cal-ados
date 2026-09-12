// O produto de demonstração do esboço — o que viria de `products` + `product_zones`
// se o banco já estivesse ligado. Nada aqui é dado real de tenant.
//
// `?raw` traz o SVG como texto: o motor recebe string, nunca um <img> ou um nó do DOM.

import svgCru from './tenis-demo-cru.svg?raw';
import { montarSeletorDeZona } from '../lib/render/montarSeletorDeZona';
import type { Zona } from '../lib/render/gerarVarianteDeCor';

export const assetBaseCru = svgCru;

/** Uma linha de `product_zones` + o que o editor precisa para desenhar a lista. */
export interface ZonaDoProduto extends Zona {
  rotulo: string;
  /** Cor que já está no asset-base. `null` = zona com gradiente, que não aceita cor chapa. */
  corInicial: string | null;
}

export const produtoDemo = {
  id: 'tenis-demo',
  nome: 'Tênis Demo · Runner',
  arquivo: 'tenis-demo-cru.svg',
} as const;

// Os seletores saem de `montarSeletorDeZona`, e não de string escrita à mão, pelo mesmo
// motivo do editor de verdade: `svg_selector` tem UMA fonte de formato (ADR-005, decisão 2).
// Dado de demonstração que se monta por outro caminho vira o exemplo que alguém copia —
// e o formato do banco passa a ter duas fontes que podem divergir.
//
// Ordem = ordem de leitura do calçado (de baixo para cima), não ordem de desenho.
export const zonasDoProduto: ZonaDoProduto[] = [
  { zone_key: 'sola', rotulo: 'Sola', svg_selector: montarSeletorDeZona(['zona-sola']), corInicial: '#2E2E33' },
  { zone_key: 'entressola', rotulo: 'Entressola', svg_selector: montarSeletorDeZona(['zona-entressola']), corInicial: '#C9C4B8' },
  { zone_key: 'cabedal', rotulo: 'Cabedal', svg_selector: montarSeletorDeZona(['zona-cabedal']), corInicial: '#E9E4DA' },
  { zone_key: 'biqueira', rotulo: 'Biqueira', svg_selector: montarSeletorDeZona(['zona-biqueira']), corInicial: '#DDD6C8' },
  { zone_key: 'logo', rotulo: 'Logo', svg_selector: montarSeletorDeZona(['zona-logo']), corInicial: '#B23A2E' },
  // Zona = N elementos (BUG-002): os 4 cadarços nascem com o MESMO id no arquivo cru e é a
  // normalização que os desambigua em `zona-cadarco`, `-2`, `-3`, `-4`. Por isso a lista
  // tem quatro ids: no canônico — o único arquivo que o editor e a API leem — cada um
  // endereça um path.
  //
  // Prefixo (`[id^="zona-cadarco"]`) é proibido pelo ADR-005: capturaria uma zona futura
  // `zona-cadarco-lateral` e pintaria o lugar errado em silêncio.
  //
  // Por que a mesma lista também funciona no arquivo CRU do comparativo, onde os ids ainda
  // são iguais: em CSS `#zona-cadarco` é igualdade de atributo, não `getElementById` — ele
  // casa TODOS os elementos com aquele id, e os outros três termos da lista não casam nada.
  // Os dois lados do comparativo continuam capturando os mesmos 4 paths; o que muda entre
  // eles é só a cor que sai (BUG-001), que é justamente o que o comparativo existe para
  // mostrar. `produtoDemo.test.ts` prende as duas contagens para essa igualdade não sumir
  // numa refatoração.
  {
    zone_key: 'cadarco',
    rotulo: 'Cadarço',
    svg_selector: montarSeletorDeZona([
      'zona-cadarco',
      'zona-cadarco-2',
      'zona-cadarco-3',
      'zona-cadarco-4',
    ]),
    corInicial: '#F5F2EC',
  },
  { zone_key: 'lingua', rotulo: 'Língua', svg_selector: montarSeletorDeZona(['zona-lingua']), corInicial: '#D5CEC0' },
  { zone_key: 'colarinho', rotulo: 'Colarinho', svg_selector: montarSeletorDeZona(['zona-colarinho']), corInicial: '#C4BCAB' },
  // Pintada com gradiente de propósito: é a zona que faz o motor recusar (ADR-004, q1).
  { zone_key: 'detalhe', rotulo: 'Detalhe (gradiente)', svg_selector: montarSeletorDeZona(['zona-detalhe']), corInicial: null },
];

/** Estado inicial de `zone_colors`: exatamente o que já está no asset-base. */
export function coresIniciais(): Record<string, string> {
  return Object.fromEntries(
    zonasDoProduto
      .filter((zona) => zona.corInicial !== null)
      .map((zona) => [zona.zone_key, zona.corInicial as string]),
  );
}

/**
 * Atalhos de cor do esboço. Cor de zona é dado do cliente, não token de tema.
 *
 * O NOME EXISTE PORQUE O HEX NÃO É NOME. Os oito atalhos eram só hex, e o hex era o único texto
 * que o botão tinha: quem usa leitor de tela ouvia "sustenido B 2 3 A 2 E", que não identifica cor
 * nenhuma, e quem usa o mouse via um quadrado colorido sem legenda. O hex continua ali, ao lado do
 * nome, porque ele é o que a marca tem no manual dela e é o que vai no corpo do POST.
 *
 * Os nomes são genéricos de propósito. Cor de zona é dado do TENANT, e batizar estes oito com nome
 * de marca faria o esboço parecer uma paleta oficial do produto, que é justamente o que ele não é.
 */
export const paletaDeAtalho: { hex: string; nome: string }[] = [
  { hex: '#1B1B1F', nome: 'preto' },
  { hex: '#F5F2EC', nome: 'branco' },
  { hex: '#B23A2E', nome: 'vermelho' },
  { hex: '#1F6F5C', nome: 'verde' },
  { hex: '#2B4C7E', nome: 'azul' },
  { hex: '#E0A526', nome: 'amarelo' },
  { hex: '#7A4E9C', nome: 'roxo' },
  { hex: '#C9C4B8', nome: 'cinza' },
];
