// Estes testes existem por causa de um modo de falha que não aparece na tela: o editor
// dizer "isto é a zona sola" enquanto a API pinta outra coisa. A prova principal é a
// invariante do fim do arquivo — para todo elemento pintável do asset canônico REAL, a
// zona que `resolverZonaDoElemento` devolve é exatamente a que o seletor daquela zona
// resolve. Se alguém trocar a regra de pertencimento por uma comparação mais barata
// (`elemento.matches(seletor)`), essa invariante fica vermelha sobre o asset de verdade.

import { describe, it, expect } from 'vitest';
import { analisarSvg } from '../../lib/render/dom';
import { expandirPintaveis, PINTAVEIS } from '../../lib/render/alvosPintaveis';
import { montarSeletorDeZona } from '../../lib/render/montarSeletorDeZona';
import { normalizarSvg } from '../../lib/render/normalizarSvg';
import { assetBaseCru } from '../../esboco/produtoDemo';
import { resolverZonaDoElemento, mapaDeZonasPorElemento } from './resolverZonaDoElemento';
import type { ZonaDoProduto } from './tiposDeZona';

/** Linha de `product_zones` com seletor cru — só para o caso do seletor quebrado. */
function zonaComSeletor(zoneKey: string, seletor: string): ZonaDoProduto {
  return {
    id: `linha-${zoneKey}`,
    product_id: 'produto-de-teste',
    tenant_id: 'tenant-de-teste',
    zone_key: zoneKey,
    svg_selector: seletor,
    label: null,
    cor_default: null,
  };
}

/** Zona montada como o editor monta: `montarSeletorDeZona` a partir de ids reais. */
function zona(zoneKey: string, ids: string[]): ZonaDoProduto {
  return zonaComSeletor(zoneKey, montarSeletorDeZona(ids));
}

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path id="sola-1" fill="#2E2E33" d="M 0 90 L 100 90 L 100 100 L 0 100 Z"/>
  <g id="grupo-cabedal">
    <path id="cabedal-corpo" fill="#E9E4DA" d="M 10 10 L 90 10 L 90 60 L 10 60 Z"/>
    <path id="cabedal-costura" fill="none" stroke="#B9B2A4" d="M 12 20 L 88 20"/>
  </g>
  <path id="nunca-marcado" fill="#123456" d="M 40 70 L 60 70 L 60 80 Z"/>
</svg>`;

const documentoFixture = analisarSvg(FIXTURE);

function elemento(id: string): Element {
  const encontrado = documentoFixture.getElementById(id);
  if (!encontrado) throw new Error(`fixture sem o elemento "${id}"`);
  return encontrado;
}

const zonasFixture: ZonaDoProduto[] = [
  zona('sola', ['sola-1']),
  zona('cabedal', ['grupo-cabedal']),
];

describe('resolverZonaDoElemento', () => {
  it('devolve a zone_key do elemento que já está marcado', () => {
    expect(resolverZonaDoElemento(elemento('sola-1'), zonasFixture)).toBe('sola');
  });

  it('devolve null para elemento que nenhuma zona captura', () => {
    expect(resolverZonaDoElemento(elemento('nunca-marcado'), zonasFixture)).toBeNull();
  });

  it('devolve a chave do grupo para elemento dentro de um <g> marcado (BUG-002)', () => {
    // O motor pinta o filho quando a zona é o grupo; o palco tem de dizer o mesmo, senão
    // o time marcaria "de novo" um elemento que já é da zona cabedal.
    expect(resolverZonaDoElemento(elemento('cabedal-corpo'), zonasFixture)).toBe('cabedal');
    expect(resolverZonaDoElemento(elemento('grupo-cabedal'), zonasFixture)).toBe('cabedal');
  });

  it('não considera da zona a costura fill="none" que está dentro do seletor', () => {
    // O motor não pinta `fill="none"` (pintá-la mudaria o desenho). Dizer que ela é da
    // zona faria o palco prometer uma cor que a API nunca aplica.
    expect(resolverZonaDoElemento(elemento('cabedal-costura'), zonasFixture)).toBeNull();
  });

  it('sobrevive a zona com seletor inválido e continua resolvendo as zonas sãs', () => {
    // Igual a `zonasSobrepostas`: seletor quebrado não contribui com elemento e não lança.
    // Quem reclama de zona quebrada é `relatorioDeZonas`, não a leitura do palco.
    const zonas = [zonaComSeletor('quebrada', '#'), ...zonasFixture];

    expect(() => resolverZonaDoElemento(elemento('sola-1'), zonas)).not.toThrow();
    expect(resolverZonaDoElemento(elemento('sola-1'), zonas)).toBe('sola');
    expect(resolverZonaDoElemento(elemento('nunca-marcado'), zonas)).toBeNull();
  });

  it('com duas zonas casando o mesmo elemento, a primeira da lista vence', () => {
    // Estado que a marcação recusa; se aparecer (linha antiga no banco), a resposta é
    // determinística por escolha, nunca dependente da ordem de varredura do DOM.
    const zonas = [zona('primeira', ['sola-1']), zona('segunda', ['sola-1'])];

    expect(resolverZonaDoElemento(elemento('sola-1'), zonas)).toBe('primeira');
  });
});

describe('mapaDeZonasPorElemento', () => {
  it('traz todos os elementos de todas as zonas, com a chave de cada um', () => {
    const mapa = mapaDeZonasPorElemento(documentoFixture, zonasFixture);

    expect(mapa.get(elemento('sola-1'))).toBe('sola');
    expect(mapa.get(elemento('grupo-cabedal'))).toBe('cabedal');
    expect(mapa.get(elemento('cabedal-corpo'))).toBe('cabedal');
  });

  it('deixa de fora o que não pertence a zona nenhuma (inclusive fill="none")', () => {
    const mapa = mapaDeZonasPorElemento(documentoFixture, zonasFixture);

    expect(mapa.has(elemento('nunca-marcado'))).toBe(false);
    expect(mapa.has(elemento('cabedal-costura'))).toBe(false);
    expect(mapa.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------------------
// A invariante, sobre o asset de demonstração REAL do projeto.
// ---------------------------------------------------------------------------------------
//
// As zonas daqui são montadas com `montarSeletorDeZona`, nunca com string escrita à mão:
// `svg_selector` é lista de ids exatos e tem uma fonte de formato só (ADR-005, decisão 2).
// Elas também não são copiadas de `produtoDemo.ts` — a lista abaixo tem uma zona a mais
// (`costura`), que existe só para provar a regra do `fill="none"` e nunca seria uma linha
// de `product_zones` de verdade.
//
// `idsReais` continua existindo porque a costura chega ao canônico com id cunhado
// (`elemento-N`): descobrir esses ids no documento é honesto, e o que vai para a zona
// continua sendo a lista exata que `montarSeletorDeZona` devolve.

const canonico = normalizarSvg(assetBaseCru).svg;
const documentoReal = analisarSvg(canonico);

function idsReais(seletor: string): string[] {
  return [...documentoReal.querySelectorAll(seletor)].map((alvo) => alvo.getAttribute('id') ?? '');
}

const zonasReais: ZonaDoProduto[] = [
  zona('sola', ['zona-sola']),
  zona('entressola', ['zona-entressola']),
  zona('cabedal', ['zona-cabedal']),
  zona('biqueira', ['zona-biqueira']),
  zona('logo', ['zona-logo']),
  // Os 4 cadarços nascem com o mesmo id e a normalização os desambigua em `-2`, `-3`, `-4`
  // (`produtoDemo.test.ts` prende esse renomeio). Os ids vão escritos, e não descobertos
  // por `idsReais('[id^="zona-cadarco"]')`: prefixo é o padrão que o ADR-005 proíbe, e um
  // exemplo dele aqui seria copiado para uma zona de verdade.
  zona('cadarco', ['zona-cadarco', 'zona-cadarco-2', 'zona-cadarco-3', 'zona-cadarco-4']),
  zona('lingua', ['zona-lingua']),
  zona('colarinho', ['zona-colarinho']),
  zona('detalhe', ['zona-detalhe']),
  // As costuras tracejadas são `fill="none"`: estão DENTRO do seletor de uma zona e ainda
  // assim não pertencem a ela, porque o motor não as pinta. É este par que separa a regra
  // certa de uma comparação ingênua com `matches`.
  zona('costura', idsReais('[fill="none"]')),
];

/** A verdade de referência: resolver os seletores direto, zona a zona. */
function zonaPeloSeletorDireto(alvo: Element): string | null {
  for (const candidata of zonasReais) {
    const alvos = expandirPintaveis([...documentoReal.querySelectorAll(candidata.svg_selector)]);
    if (alvos.includes(alvo)) return candidata.zone_key;
  }

  return null;
}

describe('invariante sobre o asset canônico real', () => {
  const pintaveis = [...documentoReal.querySelectorAll(PINTAVEIS)];

  it('o asset tem elementos pintáveis marcados e não marcados (a invariante não é vazia)', () => {
    expect(pintaveis.length).toBeGreaterThanOrEqual(20);
    expect(pintaveis.some((alvo) => zonaPeloSeletorDireto(alvo) !== null)).toBe(true);
    expect(pintaveis.some((alvo) => zonaPeloSeletorDireto(alvo) === null)).toBe(true);
  });

  it('para todo elemento pintável, a zona resolvida é exatamente a que o seletor daquela zona resolve', () => {
    for (const alvo of pintaveis) {
      expect(
        resolverZonaDoElemento(alvo, zonasReais),
        `elemento #${alvo.getAttribute('id')}`,
      ).toBe(zonaPeloSeletorDireto(alvo));
    }
  });

  it('o mapa responde o mesmo que a resolução elemento a elemento', () => {
    // As duas funções compartilham a expansão, e este teste prende o compartilhamento.
    // Não é sobre o palco de hoje (ele só usa a resolução elemento a elemento): é a
    // garantia de que trocar uma pela outra amanhã não muda resposta nenhuma.
    const mapa = mapaDeZonasPorElemento(documentoReal, zonasReais);

    for (const alvo of pintaveis) {
      expect(mapa.get(alvo) ?? null, `elemento #${alvo.getAttribute('id')}`).toBe(
        resolverZonaDoElemento(alvo, zonasReais),
      );
    }
  });
});
