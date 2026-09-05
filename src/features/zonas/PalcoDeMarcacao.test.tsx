// O teste que impede o editor de divergir da API.
//
// O palco é o único lugar do produto onde alguém decide uma cor OLHANDO. Se ele pintasse
// por conta própria — CSS, filtro, overlay — a tela mostraria uma cor que a geração não
// produz, e o erro só apareceria no calçado fabricado. Por isso a asserção principal aqui
// é byte a byte contra `gerarVarianteDeCor`, e não "tem a cor tal no HTML".
//
// `renderToStaticMarkup` e não testing-library (convenção do projeto): o que interessa é
// exatamente o markup que sai, sem camada nenhuma reescrevendo o HTML.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { gerarVarianteDeCor } from '../../lib/render/gerarVarianteDeCor';
import { PalcoDeMarcacao } from './PalcoDeMarcacao';
import type { PropsDoPalcoDeMarcacao } from './PalcoDeMarcacao';
import type { ZonaDoProduto } from './tiposDeZona';

const canonico =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150">' +
  '<rect id="elemento-1" x="20" y="115" width="260" height="20" fill="#333333"/>' +
  '<ellipse id="elemento-2" cx="150" cy="75" rx="130" ry="55" fill="#CCCCCC"/>' +
  '</svg>';

const canonicoSemViewBox =
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150">' +
  '<rect id="elemento-1" x="20" y="115" width="260" height="20" fill="#333333"/>' +
  '</svg>';

const canonicoComGradiente =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150">' +
  '<defs><linearGradient id="gradiente-1"><stop offset="0" stop-color="#111111"/></linearGradient></defs>' +
  '<rect id="elemento-1" x="20" y="115" width="260" height="20" fill="url(#gradiente-1)"/>' +
  '</svg>';

const zona = (zoneKey: string, seletor: string): ZonaDoProduto => ({
  id: `id-${zoneKey}`,
  product_id: 'produto-1',
  tenant_id: 'tenant-1',
  zone_key: zoneKey,
  svg_selector: seletor,
  label: null,
  cor_default: null,
});

const zonas = [zona('sola', '#elemento-1'), zona('cabedal', '#elemento-2')];

const CAMADA_DE_CONTORNO = /<svg class="palco__contorno"[\s\S]*?<\/svg>/;

const renderizar = (props: Partial<PropsDoPalcoDeMarcacao> = {}): string =>
  renderToStaticMarkup(
    <PalcoDeMarcacao
      svgCanonico={canonico}
      zonas={zonas}
      idsMarcados={[]}
      aoClicarElemento={() => {}}
      {...props}
    />,
  );

describe('palco de marcação — o desenho', () => {
  it('sem cor pedida, contém byte a byte a saída de gerarVarianteDeCor', () => {
    // Esta é a asserção que protege o princípio nº1: o palco não tem desenho próprio, ele
    // exibe o markup do MOTOR mesmo quando não há nada para pintar. Qualquer atalho
    // ("é só mostrar o canônico direto") passaria a divergir no dia em que o motor mudar.
    expect(renderizar()).toContain(gerarVarianteDeCor(canonico, zonas, {}));
  });

  it('com cor pedida, contém byte a byte a saída de gerarVarianteDeCor', () => {
    // O mesmo, agora com pintura: se o palco aplicasse a cor por CSS, o HTML aqui não
    // bateria com o que a API devolve — e é exatamente essa divergência que ninguém
    // descobre até o calçado sair fabricado.
    const coresPorZona = { sola: '#C0392B' };

    expect(renderizar({ coresPorZona })).toContain(
      gerarVarianteDeCor(canonico, zonas, coresPorZona),
    );
  });

  it('marcar elementos não altera um byte do desenho', () => {
    // Regra 6 do design system: o realce vive na camada de contorno. Tirada a camada, o
    // markup tem de ser idêntico ao de um palco sem marcação nenhuma.
    const semMarcacao = renderizar();
    const comMarcacao = renderizar({ idsMarcados: ['elemento-1', 'elemento-2'] });

    expect(comMarcacao).toMatch(CAMADA_DE_CONTORNO);
    expect(comMarcacao.replace(CAMADA_DE_CONTORNO, '')).toBe(semMarcacao);
  });
});

describe('palco de marcação — erro do motor', () => {
  it('zona com gradiente vira alerta com código, sem pintar nada', () => {
    const html = renderToStaticMarkup(
      <PalcoDeMarcacao
        svgCanonico={canonicoComGradiente}
        zonas={[zona('sola', '#elemento-1')]}
        coresPorZona={{ sola: '#C0392B' }}
        idsMarcados={[]}
        aoClicarElemento={() => {}}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('ZONA_NAO_RECOLORIVEL');
    expect(html).toContain('gradiente');
    // "Quase certo" é o modo de falha proibido: o palco mostra o canônico cru.
    expect(html).not.toContain('#C0392B');
    expect(html).toContain('fill="url(#gradiente-1)"');
  });

  it('zonas sobrepostas viram alerta com código, sem pintar nada', () => {
    const sobrepostas = [zona('sola', '#elemento-1'), zona('solado', '#elemento-1')];
    const html = renderizar({
      zonas: sobrepostas,
      coresPorZona: { sola: '#C0392B', solado: '#1B7F3B' },
    });

    expect(html).toContain('role="alert"');
    expect(html).toContain('ZONAS_SOBREPOSTAS');
    expect(html).not.toContain('#C0392B');
    expect(html).not.toContain('#1B7F3B');
    expect(html).toContain('fill="#333333"');
  });
});

describe('palco de marcação — camada de contorno', () => {
  it('traz um <use> por id marcado, com o viewBox do canônico e aria-hidden', () => {
    const camada = CAMADA_DE_CONTORNO.exec(
      renderizar({ idsMarcados: ['elemento-1', 'elemento-2'] }),
    )?.[0];

    expect(camada).toBeDefined();
    expect(camada).toContain('viewBox="0 0 300 150"');
    expect(camada).toContain('aria-hidden="true"');
    expect(camada).toContain('href="#elemento-1"');
    expect(camada).toContain('href="#elemento-2"');
    expect(camada?.match(/<use/g)).toHaveLength(2);
  });

  it('sem id marcado não existe <use> nenhum', () => {
    expect(renderizar()).not.toContain('<use');
  });

  it('canônico sem viewBox não gera camada de contorno', () => {
    // Chutar um viewBox alinharia o contorno com o desenho por acaso; contorno no lugar
    // errado é marcação no lugar errado.
    const html = renderizar({ svgCanonico: canonicoSemViewBox, idsMarcados: ['elemento-1'] });

    expect(html).not.toContain('palco__contorno');
    expect(html).not.toContain('<use');
  });
});

describe('palco de marcação — estado desabilitado', () => {
  it('anuncia o desabilitado na classe e na acessibilidade', () => {
    const html = renderizar({ desabilitado: true });

    expect(html).toContain('palco--desabilitado');
    expect(html).toContain('aria-disabled="true"');
  });

  it('habilitado não carrega o modificador nem aria-disabled', () => {
    const html = renderizar();

    expect(html).not.toContain('palco--desabilitado');
    expect(html).not.toContain('aria-disabled');
  });
});
