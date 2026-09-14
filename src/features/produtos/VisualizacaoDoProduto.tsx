// A moldura do produto aberto: cabeçalho, estados do download e o espaço onde o editor de
// zonas entra.
//
// Ela não desenha o calçado e não conhece zona. Quem desenha é `PalcoDeMarcacao`, dentro de
// `EditorDeZonas`, passando o arquivo por `gerarVarianteDeCor`, o mesmo motor da API. Até a
// Etapa 3 esta tela injetava o canônico ela mesma; com o editor ao lado seriam dois lugares
// desenhando o mesmo calçado e só um passando pelo motor, que é o princípio nº1 quebrado.
//
// Apresentacional: não busca nada, não guarda estado.

import type { ReactNode } from 'react';
import { contarElementos } from '../../lib/texto/contarElementos';

export interface PropsDaVisualizacaoDoProduto {
  nome: string;
  estado: 'carregando' | 'erro' | 'pronto';
  erro: string | null;
  /** Quantos elementos aceitam cor, exatamente o que o editor pode marcar. */
  elementosMarcaveis: number | null;
  /** O editor de zonas montado. Quantas zonas existem é assunto do painel, dentro dele. */
  editor: ReactNode;
  aoVoltar: () => void;
  /** Baixar de novo, sem sair do modelo. Erro sem ação obriga a voltar e reabrir. */
  aoTentarDeNovo: () => void;
}

export function VisualizacaoDoProduto({
  nome,
  estado,
  erro,
  elementosMarcaveis,
  editor,
  aoVoltar,
  aoTentarDeNovo,
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
            {contarElementos(elementosMarcaveis, { singular: 'marcável', plural: 'marcáveis' })}
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
          {/* A falha mais provável aqui é de rede, e rede volta. Sem este botão a única
              saída era voltar para a lista e reabrir o modelo (BUG-016). */}
          <button type="button" onClick={aoTentarDeNovo}>
            Tentar de novo
          </button>
        </div>
      )}

      <div className="produto__area" hidden={estado !== 'pronto'}>
        {editor}
      </div>
    </main>
  );
}
