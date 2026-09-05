// A lista de modelos do tenant. Puramente apresentacional: recebe o estado já resolvido,
// não busca nada. É o que permite testar os quatro estados sem rede.

import type { Produto } from './listarProdutos';
import type { EstadoDaLista } from './hooks/useProdutos';

export interface PropsDaListaDeProdutos {
  estado: EstadoDaLista;
  produtos: Produto[];
  erro: string | null;
  aoAbrir: (produto: Produto) => void;
  aoRecarregar: () => void;
}

export function ListaDeProdutos({
  estado,
  produtos,
  erro,
  aoAbrir,
  aoRecarregar,
}: PropsDaListaDeProdutos) {
  return (
    <main className="produtos">
      <h1 className="produtos__titulo">Modelos</h1>

      {estado === 'carregando' && (
        <p className="produtos__aviso" aria-busy="true">
          Carregando os modelos…
        </p>
      )}

      {estado === 'erro' && (
        // Banner com ação, que fica até alguém agir (memory/patterns.md) — não um toast
        // que some antes de ser lido.
        <div className="produtos__erro" role="alert">
          <p>{erro ?? 'Não foi possível carregar os modelos.'}</p>
          <button type="button" onClick={aoRecarregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {estado === 'vazia' && (
        <p className="produtos__aviso">
          Nenhum modelo cadastrado nesta marca ainda. Na Fase 1 o cadastro é feito por quem
          provisiona a conta.
        </p>
      )}

      {estado === 'pronta' && (
        <ul className="produtos__lista">
          {produtos.map((produto) => (
            <li key={produto.id}>
              <button
                type="button"
                className="produtos__item"
                onClick={() => aoAbrir(produto)}
              >
                <span className="produtos__nome">{produto.nome}</span>
                <span className="produtos__meta">abrir</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
