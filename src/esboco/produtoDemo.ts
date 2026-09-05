// O produto de demonstração do esboço — o que viria de `products` + `product_zones`
// se o banco já estivesse ligado. Nada aqui é dado real de tenant.
//
// `?raw` traz o SVG como texto: o motor recebe string, nunca um <img> ou um nó do DOM.

import svgCru from './tenis-demo-cru.svg?raw';
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

// Ordem = ordem de leitura do calçado (de baixo para cima), não ordem de desenho.
export const zonasDoProduto: ZonaDoProduto[] = [
  { zone_key: 'sola', rotulo: 'Sola', svg_selector: '#zona-sola', corInicial: '#2E2E33' },
  { zone_key: 'entressola', rotulo: 'Entressola', svg_selector: '#zona-entressola', corInicial: '#C9C4B8' },
  { zone_key: 'cabedal', rotulo: 'Cabedal', svg_selector: '#zona-cabedal', corInicial: '#E9E4DA' },
  { zone_key: 'biqueira', rotulo: 'Biqueira', svg_selector: '#zona-biqueira', corInicial: '#DDD6C8' },
  { zone_key: 'logo', rotulo: 'Logo', svg_selector: '#zona-logo', corInicial: '#B23A2E' },
  // Seletor de prefixo: os 4 cadarços nascem com o mesmo id e a normalização os
  // desambigua (zona-cadarco-2, -3, -4). É o caso do BUG-002 — zona = N elementos.
  { zone_key: 'cadarco', rotulo: 'Cadarço', svg_selector: '[id^="zona-cadarco"]', corInicial: '#F5F2EC' },
  { zone_key: 'lingua', rotulo: 'Língua', svg_selector: '#zona-lingua', corInicial: '#D5CEC0' },
  { zone_key: 'colarinho', rotulo: 'Colarinho', svg_selector: '#zona-colarinho', corInicial: '#C4BCAB' },
  // Pintada com gradiente de propósito: é a zona que faz o motor recusar (ADR-004, q1).
  { zone_key: 'detalhe', rotulo: 'Detalhe (gradiente)', svg_selector: '#zona-detalhe', corInicial: null },
];

/** Estado inicial de `zone_colors`: exatamente o que já está no asset-base. */
export function coresIniciais(): Record<string, string> {
  return Object.fromEntries(
    zonasDoProduto
      .filter((zona) => zona.corInicial !== null)
      .map((zona) => [zona.zone_key, zona.corInicial as string]),
  );
}

/** Atalhos de cor do esboço. Cor de zona é dado do cliente, não token de tema. */
export const paletaDeAtalho = [
  '#1B1B1F', '#F5F2EC', '#B23A2E', '#1F6F5C',
  '#2B4C7E', '#E0A526', '#7A4E9C', '#C9C4B8',
];
