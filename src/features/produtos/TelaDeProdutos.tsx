// A tela de produtos: lista, ou o produto aberto. Único lugar desta feature com estado —
// os dois componentes abaixo dela são burros (mesmo padrão de `EsbocoDoEditor`).

import { useMemo, useState } from 'react';
import { PINTAVEIS, expandirPintaveis } from '../../lib/render/alvosPintaveis';
import { analisarSvg } from '../../lib/render/dom';
import { ListaDeProdutos } from './ListaDeProdutos';
import { VisualizacaoDoProduto } from './VisualizacaoDoProduto';
import { useAssetBase } from './hooks/useAssetBase';
import { useProdutos } from './hooks/useProdutos';
import type { Produto } from './listarProdutos';

export function TelaDeProdutos({ tenantId }: { tenantId: string }) {
  const [aberto, setAberto] = useState<Produto | null>(null);
  const lista = useProdutos(tenantId);

  if (!aberto) {
    return (
      <ListaDeProdutos
        estado={lista.estado}
        produtos={lista.produtos}
        erro={lista.erro}
        aoAbrir={setAberto}
        aoRecarregar={lista.recarregar}
      />
    );
  }

  return <ProdutoAberto produto={aberto} aoVoltar={() => setAberto(null)} />;
}

/**
 * Componente à parte porque `useAssetBase` só pode ser chamado quando há produto aberto —
 * hook não pode ficar atrás de um `if`.
 */
function ProdutoAberto({ produto, aoVoltar }: { produto: Produto; aoVoltar: () => void }) {
  const asset = useAssetBase(produto.base_asset_path);

  // Conta pela MESMA regra que o motor usa para decidir o que recebe cor. Contar `[id]`
  // seria mais simples e mentiria: incluiria o `<linearGradient>` e as costuras
  // `fill="none"`, que o editor nunca vai conseguir marcar. Número na tela que não bate
  // com o que dá para fazer é pior que número nenhum.
  const elementosMarcaveis = useMemo(() => {
    if (!asset.svg) return null;
    const documento = analisarSvg(asset.svg);
    return expandirPintaveis([...documento.querySelectorAll(PINTAVEIS)]).length;
  }, [asset.svg]);

  return (
    <VisualizacaoDoProduto
      nome={produto.nome}
      estado={asset.estado}
      svg={asset.svg}
      erro={asset.erro}
      elementosMarcaveis={elementosMarcaveis}
      aoVoltar={aoVoltar}
    />
  );
}
