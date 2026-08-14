// Catálogo do tenant. Os quatro estados são renderizados explicitamente
// (memory/patterns.md): nenhum deles pode virar uma tela em branco sem explicação.

import type { EstadoDaLista, Produto } from '../hooks/useProdutos';
import './ListaDeProdutos.css';

interface Props {
  produtos: Produto[];
  estado: EstadoDaLista;
  aoTentarDeNovo(): void;
  aoSelecionar(produto: Produto): void;
  produtoSelecionadoId: string | null;
}

export function ListaDeProdutos({
  produtos,
  estado,
  aoTentarDeNovo,
  aoSelecionar,
  produtoSelecionadoId,
}: Props) {
  if (estado === 'carregando') {
    return (
      <p className="lista-de-produtos__estado" role="status">
        Carregando modelos…
      </p>
    );
  }

  if (estado === 'erro') {
    return (
      <div className="lista-de-produtos__erro" role="alert">
        <p>Não foi possível carregar os modelos.</p>
        <button type="button" onClick={aoTentarDeNovo}>
          Tentar de novo
        </button>
      </div>
    );
  }

  if (estado === 'vazio') {
    return (
      <p className="lista-de-produtos__estado">
        Nenhum modelo ainda. Cadastre o primeiro no formulário ao lado.
      </p>
    );
  }

  return (
    <ul className="lista-de-produtos">
      {produtos.map((produto) => (
        <li key={produto.id}>
          {/* O item é botão, não div com onClick: seleção precisa alcançar teclado e
              leitor de tela, e `aria-pressed` é o que anuncia qual modelo está aberto. */}
          <button
            type="button"
            className="lista-de-produtos__item"
            aria-pressed={produto.id === produtoSelecionadoId}
            onClick={() => aoSelecionar(produto)}
          >
            <span className="lista-de-produtos__nome">{produto.nome}</span>
            <span className="lista-de-produtos__data">
              {new Date(produto.created_at).toLocaleDateString('pt-BR')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
