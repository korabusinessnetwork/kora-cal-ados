// A moldura do produto aberto: cabeçalho, estados e os dois espaços que o editor de zonas
// preenche — o palco e a lateral.
//
// Até a Etapa 3 este componente injetava o SVG canônico ele mesmo. Não injeta mais: quem
// desenha é `PalcoDeMarcacao`, que passa o arquivo por `gerarVarianteDeCor` — o mesmo motor
// da API. Dois lugares desenhando o calçado é exatamente o que o princípio nº1 proíbe, e
// era o que ia acontecer no minuto em que o palco entrasse ao lado deste `innerHTML`.
//
// Apresentacional: não busca nada, não guarda estado.

import type { ReactNode } from 'react';

export interface PropsDaVisualizacaoDoProduto {
  nome: string;
  estado: 'carregando' | 'erro' | 'pronto';
  erro: string | null;
  /** Quantos elementos aceitam cor — exatamente o que o editor pode marcar. */
  elementosMarcaveis: number | null;
  /** Quantas zonas já estão gravadas em `product_zones`. */
  zonasMarcadas: number | null;
  /** O palco desenhado (`PalcoDeMarcacao`). */
  palco: ReactNode;
  /** Painel lateral: formulário da zona em curso, lista de zonas. */
  lateral: ReactNode;
  aoVoltar: () => void;
}

export function VisualizacaoDoProduto({
  nome,
  estado,
  erro,
  elementosMarcaveis,
  zonasMarcadas,
  palco,
  lateral,
  aoVoltar,
}: PropsDaVisualizacaoDoProduto) {
  return (
    <main className="produto">
      <div className="produto__cabecalho">
        <button type="button" className="produto__voltar" onClick={aoVoltar}>
          ← Modelos
        </button>
        <h1 className="produto__titulo">{nome}</h1>
        {elementosMarcaveis !== null && (
          <span className="produto__selo">
            {elementosMarcaveis} elementos marcáveis · {descreverZonas(zonasMarcadas)}
          </span>
        )}
      </div>

      {estado === 'carregando' && (
        <p className="produtos__aviso" aria-busy="true">
          Baixando o asset-base…
        </p>
      )}

      {estado === 'erro' && (
        <div className="produtos__erro" role="alert">
          <p>{erro ?? 'Não foi possível baixar o asset-base.'}</p>
        </div>
      )}

      {/* O palco não recebe filtro, sombra nem overlay: o que aparece aqui é o pixel que a
          API devolve (design system, itens 6 e 7). */}
      <div className="produto__area" hidden={estado !== 'pronto'}>
        <div className="produto__palco">{palco}</div>
        <aside className="produto__lateral">{lateral}</aside>
      </div>
    </main>
  );
}

/** Zero zonas é estado nomeado, não silêncio: palco desenhado e sem texto parece um editor
 *  que não respondeu ao clique. */
function descreverZonas(zonas: number | null): string {
  if (zonas === null || zonas === 0) return 'nenhuma zona marcada';
  return zonas === 1 ? '1 zona marcada' : `${zonas} zonas marcadas`;
}
