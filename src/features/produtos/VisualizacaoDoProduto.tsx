// Mostra o asset-base canônico que veio do Storage. Ainda SEM zonas: marcar zona é a
// próxima etapa, e esta tela existe para provar que o arquivo certo chegou ao navegador.
//
// Apresentacional: recebe o SVG já baixado. Quem baixa é `useAssetBase`.

import { useEffect, useRef } from 'react';

export interface PropsDaVisualizacaoDoProduto {
  nome: string;
  estado: 'carregando' | 'erro' | 'pronto';
  svg: string | null;
  erro: string | null;
  /** Quantos elementos aceitam cor — exatamente o que o editor vai poder marcar. */
  elementosMarcaveis: number | null;
  aoVoltar: () => void;
}

export function VisualizacaoDoProduto({
  nome,
  estado,
  svg,
  erro,
  elementosMarcaveis,
  aoVoltar,
}: PropsDaVisualizacaoDoProduto) {
  const palco = useRef<HTMLDivElement>(null);

  // Markup no DOM, não `<img>`: o editor precisa clicar em elemento, e elemento dentro de
  // `<img>` não existe para o DOM. É seguro porque o arquivo é o CANÔNICO — `normalizarSvg`
  // já removeu <script>, handlers on* e referência externa antes de ele subir ao Storage.
  useEffect(() => {
    const area = palco.current;
    if (!area) return;

    area.innerHTML = svg ?? '';
  }, [svg]);

  return (
    <main className="produto">
      <div className="produto__cabecalho">
        <button type="button" className="produto__voltar" onClick={aoVoltar}>
          ← Modelos
        </button>
        <h1 className="produto__titulo">{nome}</h1>
        {elementosMarcaveis !== null && (
          <span className="produto__selo">
            {elementosMarcaveis} elementos marcáveis · nenhuma zona marcada
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
      <div className="produto__palco" ref={palco} hidden={estado !== 'pronto'} />
    </main>
  );
}
