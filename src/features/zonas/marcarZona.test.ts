// Prova que `marcarZona` recusa todo estado inválido ANTES do banco: elemento que não
// existe no asset-base, elemento que não aceita cor, e principalmente sobreposição de
// zonas (BUG-013 — sem essa recusa, a ordem das chaves do JSON decidiria a cor na
// geração, em silêncio). Cada teste afirma o `codigo` do erro, não só que lançou: código
// errado vira mensagem errada na UI e o time não sabe o que corrigir.

import { describe, expect, it } from 'vitest';
import { ErroDeVariante } from '../../lib/render/erros';
import { montarSeletorDeZona } from '../../lib/render/montarSeletorDeZona';
import { idsDoSeletor, marcarZona } from './marcarZona';
import type { PedidoDeMarcacao } from './marcarZona';
import type { ZonaDoProduto } from './tiposDeZona';

const svgCanonico = `<svg xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad"><stop offset="0" stop-color="#000000"/></linearGradient>
  </defs>
  <g id="grupo-cabedal">
    <path id="painel" fill="#111111"/>
    <path id="lingueta" fill="#222222"/>
  </g>
  <path id="sola" fill="#333333"/>
  <path id="costura" fill="none" stroke="#000000"/>
  <path id="brilho" fill="url(#grad)"/>
</svg>`;

function zonaGravada(parcial: Partial<ZonaDoProduto> & Pick<ZonaDoProduto, 'zone_key' | 'svg_selector'>): ZonaDoProduto {
  return {
    id: 'linha-1',
    product_id: 'produto-1',
    tenant_id: 'tenant-1',
    label: null,
    cor_default: null,
    ...parcial,
  };
}

function pedido(parcial: Partial<PedidoDeMarcacao>): PedidoDeMarcacao {
  return {
    svgCanonico,
    zonasAtuais: [],
    zoneKey: 'sola',
    idsMarcados: ['sola'],
    ...parcial,
  };
}

/** Devolve o erro lançado para o teste conferir `codigo` e mensagem. */
function erroDe(acao: () => unknown): ErroDeVariante {
  try {
    acao();
  } catch (erro) {
    if (erro instanceof ErroDeVariante) return erro;
    throw erro;
  }

  throw new Error('Esperava um ErroDeVariante, mas nada foi lançado.');
}

describe('marcarZona — zona nova', () => {
  it('devolve idExistente null (é INSERT) e o seletor no formato do motor', () => {
    const zona = marcarZona(pedido({ zoneKey: 'sola', idsMarcados: ['sola'] }));

    expect(zona.idExistente).toBeNull();
    expect(zona.zone_key).toBe('sola');
    expect(zona.svg_selector).toBe(montarSeletorDeZona(['sola']));
  });

  it('aceita vários elementos numa zona só, preservando a ordem da marcação', () => {
    const zona = marcarZona(pedido({ zoneKey: 'cabedal', idsMarcados: ['lingueta', 'painel'] }));

    expect(zona.svg_selector).toBe('#lingueta, #painel');
  });

  it('aceita um <g> inteiro como zona — o motor expande para os filhos pintáveis', () => {
    const zona = marcarZona(pedido({ zoneKey: 'cabedal', idsMarcados: ['grupo-cabedal'] }));

    expect(zona.svg_selector).toBe('#grupo-cabedal');
  });

  it('normaliza a zone_key (trim) antes de gravar — a chave é contrato com a API', () => {
    expect(marcarZona(pedido({ zoneKey: '  sola  ' })).zone_key).toBe('sola');
  });

  it('id repetido na mesma marcação não duplica no seletor', () => {
    const zona = marcarZona(pedido({ zoneKey: 'sola', idsMarcados: ['sola', 'sola'] }));

    expect(zona.svg_selector).toBe('#sola');
  });
});

describe('marcarZona — zona existente é UPDATE, nunca um segundo INSERT', () => {
  // `unique (product_id, zone_key)`: um segundo INSERT voltaria 23505, e um `upsert` cego
  // apagaria o mapeamento que um colega acabou de gravar.
  const cabedal = zonaGravada({ id: 'linha-cabedal', zone_key: 'cabedal', svg_selector: '#painel' });

  it('acrescentar elemento devolve o id da linha a atualizar', () => {
    const zona = marcarZona(
      pedido({ zonasAtuais: [cabedal], zoneKey: 'cabedal', idsMarcados: ['lingueta'] }),
    );

    expect(zona.idExistente).toBe('linha-cabedal');
  });

  it('o seletor cresce sem perder o que já estava gravado, gravados primeiro', () => {
    const zona = marcarZona(
      pedido({ zonasAtuais: [cabedal], zoneKey: 'cabedal', idsMarcados: ['lingueta'] }),
    );

    expect(zona.svg_selector).toBe('#painel, #lingueta');
  });

  it('remarcar um elemento que já estava na zona não o duplica', () => {
    const zona = marcarZona(
      pedido({ zonasAtuais: [cabedal], zoneKey: 'cabedal', idsMarcados: ['painel', 'lingueta'] }),
    );

    expect(zona.svg_selector).toBe('#painel, #lingueta');
  });

  it('a própria zona não conta como sobreposição consigo mesma', () => {
    // Sem essa exceção, todo acréscimo a uma zona existente seria recusado como BUG-013.
    expect(() =>
      marcarZona(pedido({ zonasAtuais: [cabedal], zoneKey: 'cabedal', idsMarcados: ['painel'] })),
    ).not.toThrow();
  });
});

describe('marcarZona — recusas, cada uma com o código certo', () => {
  it('zone_key inválida recusa com ZONE_KEY_INVALIDA', () => {
    expect(erroDe(() => marcarZona(pedido({ zoneKey: 'Sola Lateral' }))).codigo).toBe(
      'ZONE_KEY_INVALIDA',
    );
  });

  it('elemento que não existe no asset-base recusa com ZONA_NAO_ENCONTRADA', () => {
    // O caso real: o SVG foi trocado no Storage enquanto o editor estava aberto.
    const erro = erroDe(() => marcarZona(pedido({ idsMarcados: ['fantasma'] })));

    expect(erro.codigo).toBe('ZONA_NAO_ENCONTRADA');
    expect(erro.message).toContain('fantasma');
  });

  it('elemento fill="none" recusa com ZONA_NAO_RECOLORIVEL, explicando que é contorno', () => {
    const erro = erroDe(() => marcarZona(pedido({ zoneKey: 'costura', idsMarcados: ['costura'] })));

    expect(erro.codigo).toBe('ZONA_NAO_RECOLORIVEL');
    expect(erro.message).toContain('contorno');
  });

  it('elemento com gradiente recusa com ZONA_NAO_RECOLORIVEL', () => {
    // A regra mora em `alvosPintaveis`; aqui só se prova que ela não foi contornada.
    expect(
      erroDe(() => marcarZona(pedido({ zoneKey: 'brilho', idsMarcados: ['brilho'] }))).codigo,
    ).toBe('ZONA_NAO_RECOLORIVEL');
  });

  it('cor_default inválida recusa com COR_INVALIDA', () => {
    expect(erroDe(() => marcarZona(pedido({ corDefault: 'vermelho' }))).codigo).toBe(
      'COR_INVALIDA',
    );
  });

  it('zona sem nenhum elemento marcado recusa com ZONA_NAO_ENCONTRADA', () => {
    expect(erroDe(() => marcarZona(pedido({ idsMarcados: [] }))).codigo).toBe(
      'ZONA_NAO_ENCONTRADA',
    );
  });
});

describe('marcarZona — sobreposição (BUG-013)', () => {
  it('elemento já usado por outra zona recusa com ZONAS_SOBREPOSTAS nomeando a outra zona', () => {
    const erro = erroDe(() =>
      marcarZona(
        pedido({
          zonasAtuais: [zonaGravada({ zone_key: 'cabedal', svg_selector: '#painel, #lingueta' })],
          zoneKey: 'logo',
          idsMarcados: ['lingueta'],
        }),
      ),
    );

    expect(erro.codigo).toBe('ZONAS_SOBREPOSTAS');
    expect(erro.message).toContain('cabedal');
  });

  it('conta quantos elementos as duas zonas dividiriam', () => {
    const erro = erroDe(() =>
      marcarZona(
        pedido({
          zonasAtuais: [zonaGravada({ zone_key: 'cabedal', svg_selector: '#painel, #lingueta' })],
          zoneKey: 'logo',
          idsMarcados: ['painel', 'lingueta'],
        }),
      ),
    );

    expect(erro.message).toContain('2');
  });

  it('pega o compartilhamento escondido dentro de um <g> — comparar seletor não veria', () => {
    // A outra zona endereça o grupo; a marcação nova endereça um filho dele.
    const erro = erroDe(() =>
      marcarZona(
        pedido({
          zonasAtuais: [zonaGravada({ zone_key: 'cabedal', svg_selector: '#grupo-cabedal' })],
          zoneKey: 'logo',
          idsMarcados: ['lingueta'],
        }),
      ),
    );

    expect(erro.codigo).toBe('ZONAS_SOBREPOSTAS');
  });

  it('zonas disjuntas passam', () => {
    expect(() =>
      marcarZona(
        pedido({
          zonasAtuais: [zonaGravada({ zone_key: 'cabedal', svg_selector: '#painel, #lingueta' })],
          zoneKey: 'sola',
          idsMarcados: ['sola'],
        }),
      ),
    ).not.toThrow();
  });
});

describe('marcarZona — label e cor_default', () => {
  const sola = zonaGravada({
    id: 'linha-sola',
    zone_key: 'sola',
    svg_selector: '#sola',
    label: 'Solado',
    cor_default: '#AABBCC',
  });

  it('ausentes preservam o que já está gravado', () => {
    const zona = marcarZona(pedido({ zonasAtuais: [sola], zoneKey: 'sola', idsMarcados: ['sola'] }));

    expect(zona.label).toBe('Solado');
    expect(zona.cor_default).toBe('#AABBCC');
  });

  it('presentes substituem o gravado', () => {
    const zona = marcarZona(
      pedido({
        zonasAtuais: [sola],
        zoneKey: 'sola',
        idsMarcados: ['sola'],
        label: 'Sola de borracha',
        corDefault: '#f00',
      }),
    );

    expect(zona.label).toBe('Sola de borracha');
    expect(zona.cor_default).toBe('#FF0000');
  });

  it('null presente limpa o gravado — apagar é uma intenção, não um esquecimento', () => {
    const zona = marcarZona(
      pedido({
        zonasAtuais: [sola],
        zoneKey: 'sola',
        idsMarcados: ['sola'],
        label: null,
        corDefault: null,
      }),
    );

    expect(zona.label).toBeNull();
    expect(zona.cor_default).toBeNull();
  });

  it('zona nova sem label nem cor nasce com null nos dois', () => {
    const zona = marcarZona(pedido({}));

    expect(zona.label).toBeNull();
    expect(zona.cor_default).toBeNull();
  });
});

describe('idsDoSeletor', () => {
  it('faz ida-e-volta com montarSeletorDeZona', () => {
    const ids = ['painel', 'lingueta', 'sola'];

    expect(idsDoSeletor(montarSeletorDeZona(ids))).toEqual(ids);
  });

  it('aceita seletor sem espaço depois da vírgula', () => {
    expect(idsDoSeletor('#painel,#sola')).toEqual(['painel', 'sola']);
  });

  it('seletor de prefixo legado recusa com ZONA_NAO_ENCONTRADA', () => {
    // `[id^="zona-"]` é proibido pelo ADR-005 e não é lista de ids exatos: acrescentar
    // elemento a ele exigiria adivinhar o que ele captura, e silenciar isso perderia o
    // mapeamento do colega.
    const erro = erroDe(() => idsDoSeletor('[id^="zona-"]'));

    expect(erro.codigo).toBe('ZONA_NAO_ENCONTRADA');
    expect(erro.message).toContain('ids exatos');
  });

  it('zona gravada com seletor legado não deixa marcarZona acrescentar elemento em silêncio', () => {
    const erro = erroDe(() =>
      marcarZona(
        pedido({
          zonasAtuais: [zonaGravada({ zone_key: 'sola', svg_selector: '[id^="sola"]' })],
          zoneKey: 'sola',
          idsMarcados: ['sola'],
        }),
      ),
    );

    expect(erro.codigo).toBe('ZONA_NAO_ENCONTRADA');
  });
});
