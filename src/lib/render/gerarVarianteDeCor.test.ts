// Os 9 casos que reprovaram o protótipo em 2026-08-12 (BUG-001..005), agora exigindo
// o comportamento correto. Cada caso é um export real de Illustrator/Figma, não hipótese.
//
// O fluxo testado é o de produção: normalizarSvg (upload) → gerarVarianteDeCor (API).

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { normalizarSvg } from './normalizarSvg';
import { gerarVarianteDeCor, relatorioDeZonas, type Zona } from './gerarVarianteDeCor';
import { ErroDeVariante } from './erros';

const NOVA = '#FF0000';
const ZONA_SOLA: Zona[] = [{ zone_key: 'sola', svg_selector: '#zona-sola' }];

/** Sobe o arquivo e gera a variante — o caminho que o cliente percorre de verdade. */
function subirEGerar(svgCru: string, zonas: Zona[], cores: Record<string, string>): string {
  return gerarVarianteDeCor(normalizarSvg(svgCru).svg, zonas, cores);
}

function esperaRecolorCompleto(saida: string, corAntiga: string) {
  expect(saida).toMatch(new RegExp(NOVA, 'i'));
  expect(saida).not.toMatch(new RegExp(corAntiga, 'i'));
}

describe('cor sai igual ao pedido (BUG-001)', () => {
  it('atributo fill', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" fill="#333333"/></svg>`;
    esperaRecolorCompleto(subirEGerar(svg, ZONA_SOLA, { sola: NOVA }), '#333333');
  });

  it('style inline (export Figma)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" style="fill:#333333" fill="#333333"/></svg>`;
    esperaRecolorCompleto(subirEGerar(svg, ZONA_SOLA, { sola: NOVA }), '#333333');
  });

  it('classe CSS em bloco <style> (export Illustrator)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>.st0{fill:#333333;}</style><rect id="zona-sola" class="st0"/></svg>`;
    esperaRecolorCompleto(subirEGerar(svg, ZONA_SOLA, { sola: NOVA }), '#333333');
  });

  it('classe perde para style inline, como no navegador', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>.st0{fill:#333333;}</style><rect id="zona-sola" class="st0" style="fill:#ABCDEF"/></svg>`;
    const { svg: canonico } = normalizarSvg(svg);
    expect(canonico).toMatch(/fill="#ABCDEF"/i);
    expect(canonico).not.toMatch(/#333333/i);
  });

  it('regra mais específica vence a menos específica', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>.st0{fill:#333333;} #zona-sola{fill:#ABCDEF;}</style><rect id="zona-sola" class="st0"/></svg>`;
    expect(normalizarSvg(svg).svg).toMatch(/fill="#ABCDEF"/i);
  });
});

describe('zona é conjunto de elementos, não um id (BUG-002)', () => {
  it('grupo <g> repinta os filhos', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><g id="zona-cabedal"><path d="M0 0" fill="#CCCCCC"/><path d="M1 1" fill="#CCCCCC"/></g></svg>`;
    const zonas: Zona[] = [{ zone_key: 'cabedal', svg_selector: '#zona-cabedal' }];
    esperaRecolorCompleto(subirEGerar(svg, zonas, { cabedal: NOVA }), '#CCCCCC');
  });

  it('zona com N paths repinta todos', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-cadarco" fill="#555555"/><rect id="zona-cadarco-2" fill="#555555"/></svg>`;
    const zonas: Zona[] = [{ zone_key: 'cadarco', svg_selector: '#zona-cadarco, #zona-cadarco-2' }];
    esperaRecolorCompleto(subirEGerar(svg, zonas, { cadarco: NOVA }), '#555555');
  });

  it('id duplicado é desambiguado no upload e a zona alcança os dois', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" fill="#111111"/><rect id="zona-sola" fill="#222222"/></svg>`;
    const { svg: canonico, relatorio } = normalizarSvg(svg);

    expect(relatorio.idsRenomeados).toEqual([{ de: 'zona-sola', para: 'zona-sola-2' }]);

    // O seletor é a lista de ids exatos que o editor gravaria depois da desambiguação, e
    // não `[id^="zona-sola"]`: o ADR-005 proíbe prefixo porque ele pegaria de brinde uma
    // zona futura `zona-sola-lateral`. Escrever o padrão proibido aqui, no teste do motor,
    // é como ele volta — é deste arquivo que se copia exemplo de `svg_selector`.
    const zonas: Zona[] = [{ zone_key: 'sola', svg_selector: '#zona-sola, #zona-sola-2' }];
    const saida = gerarVarianteDeCor(canonico, zonas, { sola: NOVA });

    // As duas cores originais têm de sumir: se a lista alcançasse só um dos rects, a outra
    // sobreviveria. É esta dupla que faz o teste falar sobre "os dois", e não sobre um.
    esperaRecolorCompleto(saida, '#222222');
    expect(saida).not.toMatch(/#111111/i);
  });

  it('contorno sem preenchimento (fill="none") não é pintado', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><g id="zona-sola"><path d="M0 0" fill="#333333"/><path d="M1 1" fill="none" stroke="#000000"/></g></svg>`;
    const saida = subirEGerar(svg, ZONA_SOLA, { sola: NOVA });
    expect(saida).toMatch(/fill="none"/i);
    expect(saida).toMatch(new RegExp(NOVA, 'i'));
  });
});

describe('falha alto, nunca em silêncio (BUG-003 e BUG-005)', () => {
  const svgSimples = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" fill="#000000"/></svg>`;

  it('zone_key que não existe no produto', () => {
    expect(() => subirEGerar(svgSimples, ZONA_SOLA, { cabedal: NOVA })).toThrow(
      expect.objectContaining({ codigo: 'ZONA_NAO_ENCONTRADA' }),
    );
  });

  it('seletor que não acha nada no SVG', () => {
    const zonas: Zona[] = [{ zone_key: 'sola', svg_selector: '#nao-existe' }];
    expect(() => subirEGerar(svgSimples, zonas, { sola: NOVA })).toThrow(
      expect.objectContaining({ codigo: 'ZONA_NAO_ENCONTRADA' }),
    );
  });

  it('seletor que não é CSS válido vira erro com código, não exceção crua do DOM', () => {
    // O motor resolve `svg_selector` como CSS, seja ele qual for — não conhece "formato de
    // zona". Quem garante que o gravado é lista de ids exatos é `montarSeletorDeZona`
    // (ADR-005), e por isso nenhum teste daqui usa prefixo como exemplo: seria ensinar o
    // padrão proibido para provar uma indiferença que este caso já prova.
    //
    // Linha quebrada no banco não pode subir `SyntaxError` do DOM para o cliente da API:
    // vira `ZONA_NAO_ENCONTRADA` nomeando o seletor, que é o que permite remarcar a zona.
    const zonas: Zona[] = [{ zone_key: 'sola', svg_selector: '#' }];
    expect(() => subirEGerar(svgSimples, zonas, { sola: NOVA })).toThrow(
      expect.objectContaining({ codigo: 'ZONA_NAO_ENCONTRADA' }),
    );
    expect(() => subirEGerar(svgSimples, zonas, { sola: NOVA })).toThrow(/seletor CSS válido/);
  });

  it('cor fora do formato hex', () => {
    expect(() => subirEGerar(svgSimples, ZONA_SOLA, { sola: 'banana' })).toThrow(
      expect.objectContaining({ codigo: 'COR_INVALIDA' }),
    );
  });

  it('cor em nome CSS também é recusada (ADR-004, q3)', () => {
    expect(() => subirEGerar(svgSimples, ZONA_SOLA, { sola: 'red' })).toThrow(ErroDeVariante);
  });

  it('zona com gradiente', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="grad"><stop stop-color="#333333"/></linearGradient></defs><rect id="zona-sola" fill="url(#grad)"/></svg>`;
    expect(() => subirEGerar(svg, ZONA_SOLA, { sola: NOVA })).toThrow(
      expect.objectContaining({ codigo: 'ZONA_NAO_RECOLORIVEL' }),
    );
  });

  it('nenhuma zona é pintada quando outra zona do mesmo pedido falha', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" fill="#333333"/></svg>`;
    const zonas: Zona[] = [
      { zone_key: 'sola', svg_selector: '#zona-sola' },
      { zone_key: 'cabedal', svg_selector: '#nao-existe' },
    ];
    expect(() => subirEGerar(svg, zonas, { sola: NOVA, cabedal: '#00FF00' })).toThrow(
      ErroDeVariante,
    );
  });
});

describe('hex curto e caixa', () => {
  it('#F00 vira #FF0000', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" fill="#333333"/></svg>`;
    expect(subirEGerar(svg, ZONA_SOLA, { sola: '#f00' })).toMatch(/fill="#FF0000"/);
  });
});

describe('modelo completo (fixtures/teste-zona.svg)', () => {
  const modelo = readFileSync(new URL('./fixtures/teste-zona.svg', import.meta.url), 'utf-8');
  const zonas: Zona[] = [
    { zone_key: 'sola', svg_selector: '#zona-sola' },
    { zone_key: 'cabedal', svg_selector: '#zona-cabedal' },
    // Lista de ids exatos, o único formato que `montarSeletorDeZona` produz (ADR-005).
    { zone_key: 'cadarco', svg_selector: '#zona-cadarco, #zona-cadarco-2' },
  ];

  it('troca as três zonas de uma vez, sem sobrar cor original', () => {
    const saida = subirEGerar(modelo, zonas, {
      sola: '#C0392B',
      cabedal: '#111111',
      cadarco: '#F5F5F5',
    });

    expect(saida).toMatch(/fill="#C0392B"/);
    expect(saida).toMatch(/fill="#111111"/);
    expect((saida.match(/fill="#F5F5F5"/g) ?? []).length).toBe(2); // cadarço tem 2 paths
    for (const original of ['#CCCCCC', '#333333', '#555555']) {
      expect(saida).not.toMatch(new RegExp(original, 'i'));
    }
  });

  it('trocar só uma zona não mexe nas outras', () => {
    const saida = subirEGerar(modelo, zonas, { sola: '#C0392B' });

    expect(saida).toMatch(/fill="#CCCCCC"/i);
    expect(saida).toMatch(/fill="#555555"/i);
    expect(saida).not.toMatch(/#333333/i);
  });
});

describe('relatório de zonas (prevenção no cadastro)', () => {
  it('conta quantos elementos cada zona captura', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="zona-sola" fill="#111111"/><rect id="zona-cadarco" fill="#555555"/><rect id="zona-cadarco-2" fill="#555555"/></svg>`;
    const zonas: Zona[] = [
      { zone_key: 'sola', svg_selector: '#zona-sola' },
      { zone_key: 'cadarco', svg_selector: '#zona-cadarco, #zona-cadarco-2' },
      { zone_key: 'logo', svg_selector: '#zona-logo' },
    ];

    expect(relatorioDeZonas(normalizarSvg(svg).svg, zonas)).toEqual([
      { zone_key: 'sola', elementos: 1 },
      { zone_key: 'cadarco', elementos: 2 },
      { zone_key: 'logo', elementos: 0 },
    ]);
  });
});

describe('zonas sobrepostas são recusadas (BUG-013)', () => {
  // Sem isso, a ORDEM DAS CHAVES do JSON decide a cor: o motor pinta zona por zona, em
  // sequência, e a última chave sobrescreve o elemento compartilhado — sem erro e sem
  // aviso. É o princípio nº 1 violado em silêncio.
  const svgCru = `<svg xmlns="http://www.w3.org/2000/svg"><g id="zona-cabedal"><rect id="zona-lingueta" fill="#333333"/></g><rect id="zona-sola" fill="#555555"/></svg>`;
  const sobrepostas: Zona[] = [
    { zone_key: 'cabedal', svg_selector: '#zona-cabedal' },
    { zone_key: 'lingueta', svg_selector: '#zona-lingueta' },
  ];

  it('lança ZONAS_SOBREPOSTAS em vez de deixar a última chave vencer', () => {
    expect(() => subirEGerar(svgCru, sobrepostas, { cabedal: NOVA, lingueta: '#0000FF' })).toThrow(
      expect.objectContaining({ codigo: 'ZONAS_SOBREPOSTAS' }),
    );
  });

  it('a ordem das chaves não muda o resultado — recusa nos dois sentidos', () => {
    // Se o motor pintasse, estes dois pedidos dariam calçados DIFERENTES com o mesmo dado.
    expect(() => subirEGerar(svgCru, sobrepostas, { lingueta: '#0000FF', cabedal: NOVA })).toThrow(
      ErroDeVariante,
    );
  });

  it('a mensagem nomeia as duas zonas em conflito', () => {
    expect(() => subirEGerar(svgCru, sobrepostas, { cabedal: NOVA, lingueta: '#0000FF' })).toThrow(
      /cabedal.*lingueta|lingueta.*cabedal/,
    );
  });

  it('zona sobreposta que NÃO foi pedida não bloqueia a variante', () => {
    // A checagem é sobre o que vai ser pintado agora. Bloquear um pedido de uma zona só
    // por causa de um mapeamento ruim em outra deixaria o produto inteiro travado.
    const saida = subirEGerar(svgCru, sobrepostas, { cabedal: NOVA });

    expect(saida).toMatch(new RegExp(NOVA, 'i'));
    expect(saida).toMatch(/fill="#555555"/i);
  });

  it('zonas disjuntas continuam gerando normalmente', () => {
    const zonas: Zona[] = [
      { zone_key: 'lingueta', svg_selector: '#zona-lingueta' },
      { zone_key: 'sola', svg_selector: '#zona-sola' },
    ];

    expect(() => subirEGerar(svgCru, zonas, { lingueta: NOVA, sola: '#0000FF' })).not.toThrow();
  });
});
