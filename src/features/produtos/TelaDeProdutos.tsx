// A tela de produtos: a lista, ou o modelo aberto com o editor de zonas dentro.
// O estado daqui é só "qual produto está aberto", o estado do editor mora em
// `EditorDeZonas`, na feature de zonas, que é quem entende de zona.

import { useMemo, useState } from 'react';
import { PINTAVEIS, expandirPintaveis } from '../../lib/render/alvosPintaveis';
import { analisarSvg } from '../../lib/render/dom';
import { EditorDeZonas } from '../zonas/EditorDeZonas';
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

  return <ProdutoAberto produto={aberto} tenantId={tenantId} aoVoltar={() => setAberto(null)} />;
}

/**
 * Componente à parte porque `useAssetBase` só pode ser chamado quando há produto aberto,
 * hook não pode ficar atrás de um `if`.
 */
function ProdutoAberto({
  produto,
  tenantId,
  aoVoltar,
}: {
  produto: Produto;
  tenantId: string;
  aoVoltar: () => void;
}) {
  const asset = useAssetBase(produto.base_asset_path);

  // Conta pela MESMA regra que o motor usa para decidir o que recebe cor. Contar `[id]`
  // seria mais simples e mentiria: incluiria o `<linearGradient>` e as costuras
  // `fill="none"`, que o editor nunca vai conseguir marcar. Número na tela que não bate com
  // o que dá para fazer é pior que número nenhum.
  const elementosMarcaveis = useMemo(() => {
    if (!asset.svg) return null;
    const documento = analisarSvg(asset.svg);
    return expandirPintaveis([...documento.querySelectorAll(PINTAVEIS)]).length;
  }, [asset.svg]);

  return (
    <VisualizacaoDoProduto
      nome={produto.nome}
      estado={asset.estado}
      erro={asset.erro}
      elementosMarcaveis={elementosMarcaveis}
      aoVoltar={aoVoltar}
      aoTentarDeNovo={asset.recarregar}
      editor={
        asset.svg && (
          <EditorDeZonas productId={produto.id} tenantId={tenantId} svgCanonico={asset.svg} />
        )
      }
    />
  );
}
