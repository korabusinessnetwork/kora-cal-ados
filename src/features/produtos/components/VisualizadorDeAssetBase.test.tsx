// Render em markup estático: o ambiente de teste do projeto é Node puro (vitest.setup.ts),
// e o componente é apresentacional justamente para poder ser provado assim, sem DOM e sem
// biblioteca de teste de UI a mais.
//
// O teste do `<img>` não é cosmético: é o que impede alguém de trocar por
// `dangerouslySetInnerHTML` numa rodada futura sem perceber que reabriu o BUG-004 (script
// embutido em SVG de terceiro executando no navegador de outro membro do tenant).

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisualizadorDeAssetBase } from './VisualizadorDeAssetBase';

const PADRAO = {
  urlAssinada: null,
  nomeDoProduto: null,
  mensagemDeErro: '',
  aoTentarDeNovo: () => {},
};

describe('VisualizadorDeAssetBase', () => {
  it('sem seleção, instrui em vez de mostrar área vazia', () => {
    const html = renderToStaticMarkup(<VisualizadorDeAssetBase {...PADRAO} estado="nenhum" />);

    expect(html).toContain('Selecione um modelo');
  });

  it('carregando, anuncia o estado para leitor de tela', () => {
    const html = renderToStaticMarkup(<VisualizadorDeAssetBase {...PADRAO} estado="carregando" />);

    expect(html).toContain('role="status"');
    expect(html).toContain('Abrindo o desenho');
  });

  it('em erro, mostra a mensagem recebida e o botão de tentar de novo', () => {
    const html = renderToStaticMarkup(
      <VisualizadorDeAssetBase
        {...PADRAO}
        estado="erro"
        mensagemDeErro="Este arquivo pertence a outra marca e não pode ser aberto por esta conta."
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('pertence a outra marca');
    expect(html).toContain('Tentar de novo');
  });

  it('pronto, exibe o desenho por img — nunca SVG embutido na página', () => {
    const html = renderToStaticMarkup(
      <VisualizadorDeAssetBase
        {...PADRAO}
        estado="pronto"
        urlAssinada="https://exemplo/assinada"
        nomeDoProduto="Tênis Alfa"
      />,
    );

    expect(html).toContain('<img');
    expect(html).toContain('src="https://exemplo/assinada"');
    expect(html).toContain('Desenho base do modelo Tênis Alfa');
    // A prova da inércia: o conteúdo do arquivo não entra na árvore da página.
    expect(html).not.toContain('<svg');
  });
});
