// Exibe o SVG canônico do modelo selecionado. Componente apresentacional puro: recebe o
// estado pronto e não busca nada — é o que permite testar os quatro estados sem DOM nem
// rede (o ambiente de teste do projeto é Node puro, ver vitest.setup.ts).
//
// O SVG entra por `<img src>`, e essa escolha é de segurança, não de conveniência:
// `normalizarSvg` (que remove script embutido — BUG-004) roda só no navegador de quem
// sobe o arquivo, e o bucket foi criado sem trava de tipo ou tamanho. Ou seja, pode
// existir SVG não sanitizado gravado. Dentro de `<img>` o conteúdo é inerte: script não
// executa. Trocar por `dangerouslySetInnerHTML` para poder selecionar path (o que F002
// vai querer) reabre o BUG-004 e exige tratar TD001 antes.

import type { EstadoDoAssetBase } from '../hooks/useAssetBase';
import './VisualizadorDeAssetBase.css';

interface Props {
  estado: EstadoDoAssetBase;
  urlAssinada: string | null;
  nomeDoProduto: string | null;
  mensagemDeErro: string;
  aoTentarDeNovo(): void;
}

export function VisualizadorDeAssetBase({
  estado,
  urlAssinada,
  nomeDoProduto,
  mensagemDeErro,
  aoTentarDeNovo,
}: Props) {
  if (estado === 'nenhum') {
    return (
      <p className="visualizador-de-asset-base__estado">
        Selecione um modelo da lista para ver o desenho base.
      </p>
    );
  }

  if (estado === 'carregando') {
    return (
      <p className="visualizador-de-asset-base__estado" role="status">
        Abrindo o desenho…
      </p>
    );
  }

  if (estado === 'erro') {
    return (
      <div className="visualizador-de-asset-base__erro" role="alert">
        <p>{mensagemDeErro}</p>
        <button type="button" onClick={aoTentarDeNovo}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <figure className="visualizador-de-asset-base">
      <img
        className="visualizador-de-asset-base__desenho"
        src={urlAssinada ?? ''}
        alt={`Desenho base do modelo ${nomeDoProduto ?? ''}`.trim()}
      />
      <figcaption className="visualizador-de-asset-base__legenda">
        Desenho base normalizado. O link de acesso expira em 5 minutos.
      </figcaption>
    </figure>
  );
}
