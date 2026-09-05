// Baixa o asset-base canônico do produto aberto.
//
// Separado de `useProdutos` porque a lista não deve pagar o download de N SVGs para
// mostrar N nomes — o arquivo só desce quando alguém abre o produto.

import { useEffect, useState } from 'react';
import { clienteSupabase } from '../../../lib/supabase/cliente';
import { baixarAssetBase } from '../baixarAssetBase';

export interface AssetBaseCarregado {
  estado: 'carregando' | 'erro' | 'pronto';
  svg: string | null;
  erro: string | null;
}

export function useAssetBase(baseAssetPath: string): AssetBaseCarregado {
  const [estado, setEstado] = useState<AssetBaseCarregado['estado']>('carregando');
  const [svg, setSvg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setEstado('carregando');
    setSvg(null);
    setErro(null);

    baixarAssetBase(clienteSupabase(), baseAssetPath)
      .then((texto) => {
        if (!vivo) return;
        setSvg(texto);
        setEstado('pronto');
      })
      .catch((falha: unknown) => {
        if (!vivo) return;
        setErro(falha instanceof Error ? falha.message : 'Falha ao baixar o asset-base.');
        setEstado('erro');
      });

    // A URL assinada expira em 5 min; abrir outro produto antes disso não pode fazer o
    // desenho anterior aparecer no lugar do novo.
    return () => {
      vivo = false;
    };
  }, [baseAssetPath]);

  return { estado, svg, erro };
}
