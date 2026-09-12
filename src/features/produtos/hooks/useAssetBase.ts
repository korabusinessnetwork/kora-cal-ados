// Baixa o asset-base canônico do produto aberto.
//
// Separado de `useProdutos` porque a lista não deve pagar o download de N SVGs para
// mostrar N nomes — o arquivo só desce quando alguém abre o produto.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clienteSupabase } from '../../../lib/supabase/cliente';
import { baixarAssetBase } from '../baixarAssetBase';

export interface AssetBaseCarregado {
  estado: 'carregando' | 'erro' | 'pronto';
  svg: string | null;
  erro: string | null;
  /** Baixa de novo. A falha mais provável aqui é de rede, e rede volta (BUG-016). */
  recarregar(): void;
}

/**
 * O cliente entra por parâmetro, com o de hoje como padrão.
 *
 * Existe para este hook ter teste. Sem o parâmetro, `clienteSupabase()` é lido de dentro, e como
 * este projeto não usa `vi.mock` em lugar nenhum, montar o hook num teste exigiria ou rede de
 * verdade ou o singleton global remendado, que vaza para o arquivo de teste seguinte. Com ele, a
 * sonda passa um cliente de mentira e o caminho da rede fica alcançável.
 *
 * Não entra na lista de dependências do efeito, e sim por referência: uma chamada que criasse o
 * cliente na própria linha (`useProdutos(id, criarCliente())`) daria identidade nova a cada render
 * e o efeito recarregaria para sempre. Mesmo desenho, e mesmo motivo, dos callbacks do
 * `PalcoDeModelo3d`. A consequência é dita por inteiro: trocar de cliente NÃO recarrega sozinho,
 * e quem precisar disso troca o que já recarrega, que é o id.
 */
export function useAssetBase(
  baseAssetPath: string,
  cliente: SupabaseClient = clienteSupabase(),
): AssetBaseCarregado {
  const banco = useRef(cliente);
  banco.current = cliente;

  const [estado, setEstado] = useState<AssetBaseCarregado['estado']>('carregando');
  const [svg, setSvg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Contador em vez de um `recarregar` que chama a função direto: assim a tentativa nova
  // passa pelo MESMO efeito, com a mesma limpeza do `vivo` — dois caminhos de download
  // acabariam divergindo justamente no cancelamento.
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado('carregando');
    setSvg(null);
    setErro(null);

    baixarAssetBase(banco.current, baseAssetPath)
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
  }, [baseAssetPath, tentativa]);

  const recarregar = useCallback(() => setTentativa((numero) => numero + 1), []);

  return { estado, svg, erro, recarregar };
}
