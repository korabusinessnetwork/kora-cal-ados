// O que este painel precisa provar não é "renderiza a lista": é que o time CONSEGUE VER,
// antes de gerar variante, que marcou o que achou que marcou. Cada teste abaixo protege um
// modo de falha silenciosa — zona que não pega nada, zonas que dividem elemento (BUG-013) e
// cor que o motor recusou — porque depois da geração o erro já é calçado fabricado errado.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PainelDeZonas } from './PainelDeZonas';
import type { ZonaNoPainel } from './PainelDeZonas';

const zona = (parcial: Partial<ZonaNoPainel> = {}): ZonaNoPainel => ({
  zone_key: 'sola',
  label: 'Sola',
  elementos: 3,
  corEmEdicao: '',
  erroDaCor: null,
  ...parcial,
});

const painel = (props: Partial<Parameters<typeof PainelDeZonas>[0]> = {}) =>
  renderToStaticMarkup(
    <PainelDeZonas
      zonas={[zona()]}
      sobreposicoes={[]}
      zoneKeyEmFoco={null}
      aoFocarZona={() => {}}
      aoMudarCor={() => {}}
      aoLimparCores={() => {}}
      {...props}
    />,
  );

/** Os `<li>` da lista, um por string — não há `<li>` aninhado neste painel. */
function itens(html: string): string[] {
  return html.split('<li').slice(1);
}

describe('painel de zonas', () => {
  it('sem zona nenhuma fala do mapeamento e do próximo passo, e NÃO é alerta', () => {
    // Modelo sem zona é catálogo vazio, não falha: `role="alert"` aqui ensinaria o time a
    // ignorar alerta justamente na tela em que sobreposição precisa gritar.
    const html = painel({ zonas: [] });

    expect(html).toContain('painel-zonas__vazio');
    expect(html).toContain('ainda não tem nenhuma zona mapeada');
    expect(html).toContain('Clique numa parte do calçado');
    expect(html).not.toContain('role="alert"');
  });

  it('lista as zonas com a contagem de elementos no singular e no plural', () => {
    const html = painel({
      zonas: [zona({ zone_key: 'sola', elementos: 1 }), zona({ zone_key: 'cabedal', elementos: 8 })],
    });

    expect(html).toContain('1 elemento<');
    expect(html).toContain('8 elementos');
    expect(html).not.toContain('1 elementos');
  });

  it('zona que captura 0 elementos vira alerta dizendo que a geração vai falhar ali', () => {
    // Seletor gravado que não acha nada no canônico é mapeamento quebrado. Mostrar só
    // "0 elementos" deixaria o time descobrir isso na hora de gerar — falhar alto aqui.
    const html = painel({ zonas: [zona({ zone_key: 'bico', elementos: 0 })] });

    expect(html).toContain('role="alert"');
    expect(html).toContain('não encontra nenhum elemento');
    expect(html).toContain('Gerar variante com ela vai falhar');
  });

  it('sobreposição vira alerta nomeando as duas zonas e quantos elementos elas dividem', () => {
    const html = painel({
      zonas: [zona({ zone_key: 'sola' }), zona({ zone_key: 'entressola' })],
      sobreposicoes: [{ zone_key_a: 'sola', zone_key_b: 'entressola', elementos: 2 }],
    });

    expect(html).toContain('painel-zonas__sobreposicao');
    expect(html).toContain('role="alert"');
    expect(html).toContain('>sola<');
    expect(html).toContain('>entressola<');
    expect(html).toContain('2 elementos');
    // A consequência escrita, não só o fato: com sobreposição, gerar variante com as duas
    // cores falha porque a ordem das chaves do pedido decidiria a cor (BUG-013).
    expect(html).toContain('gerar variante pedindo cor para as duas falha');
    expect(html).toContain('ordem das chaves');
  });

  it('sem sobreposição e com todas as zonas resolvendo, não há alerta nenhum na tela', () => {
    const html = painel({
      zonas: [zona({ zone_key: 'sola', elementos: 3 }), zona({ zone_key: 'cabedal', elementos: 5 })],
      sobreposicoes: [],
    });

    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('painel-zonas__sobreposicao');
  });

  it('o foco marca o item da zona em foco e só ele', () => {
    const html = painel({
      zonas: [zona({ zone_key: 'sola' }), zona({ zone_key: 'cabedal' }), zona({ zone_key: 'bico' })],
      zoneKeyEmFoco: 'cabedal',
    });
    const emFoco = itens(html).filter((item) => item.includes('painel-zonas__item--foco'));

    expect(emFoco).toHaveLength(1);
    expect(emFoco[0]).toContain('cabedal');
    expect(emFoco[0]).toContain('aria-current="true"');
    expect(html.match(/aria-current/g)).toHaveLength(1);
  });

  it('erro de cor aparece ao lado do campo e o valor digitado continua intacto', () => {
    // Conserto silencioso é proibido: a cor que a pessoa vê no campo é a que ela digitou,
    // e a mensagem é a do motor (`validarCor`), não uma segunda redação da regra de hex.
    const html = painel({
      zonas: [
        zona({ zone_key: 'sola', corEmEdicao: '#GG0', erroDaCor: 'Cor inválida para a zona sola.' }),
      ],
    });

    expect(html).toContain('value="#GG0"');
    expect(html).toContain('Cor inválida para a zona sola.');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="painel-zonas-cor-sola-erro"');
    expect(html).toContain('id="painel-zonas-cor-sola-erro"');
  });

  it('limpar cores só é oferecido quando há cor em edição, e não promete apagar zona', () => {
    // Apagar zona não existe nesta entrega: um botão ambíguo aqui destruiria mapeamento.
    const semCor = painel({ zonas: [zona({ corEmEdicao: '' })] });
    const comCor = painel({ zonas: [zona({ corEmEdicao: '#112233' })] });

    expect(semCor).not.toContain('painel-zonas__acoes');
    expect(comCor).toContain('painel-zonas__acoes');
    expect(comCor).toContain('Limpar as cores de teste');
    expect(comCor).toContain('As zonas mapeadas continuam exatamente como estão');
  });

  it('zona sem label mostra só a chave da API, sem texto inventado', () => {
    const html = painel({ zonas: [zona({ zone_key: 'contraforte', label: null })] });

    expect(html).toContain('>contraforte<');
    expect(html).not.toContain('painel-zonas__rotulo');
    expect(html).not.toMatch(/sem nome|sem rótulo|não nomeada/i);
  });

  it('a chave da API aparece junto do rótulo — é ela que o cliente manda no JSON', () => {
    const html = painel({ zonas: [zona({ zone_key: 'sola', label: 'Sola de borracha' })] });

    expect(html).toContain('painel-zonas__chave');
    expect(html).toContain('>sola<');
    expect(html).toContain('Sola de borracha');
  });

  it('não renderiza nome de marca — o produto é white-label', () => {
    const html = painel({
      zonas: [zona({ zone_key: 'sola', elementos: 0, corEmEdicao: '#x', erroDaCor: 'erro' })],
      sobreposicoes: [{ zone_key_a: 'sola', zone_key_b: 'cabedal', elementos: 1 }],
    });

    expect(html).not.toMatch(/kora|aurora|runner/i);
  });

  it('nenhum estilo inline no painel — estilo mora no CSS, para o white-label', () => {
    const html = painel({
      zonas: [zona({ corEmEdicao: '#112233' }), zona({ zone_key: 'bico', elementos: 0 })],
      sobreposicoes: [{ zone_key_a: 'sola', zone_key_b: 'bico', elementos: 1 }],
    });

    expect(html).not.toContain('style=');
  });
});
