// Catálogo de produtos do tenant.
//
// Nenhuma consulta filtra por `tenant_id` vindo do cliente: a RLS já devolve só o que o
// usuário pode ver. Filtrar aqui daria a impressão de que o front é a barreira — e um
// front adulterado passaria por cima dela. Campos são sempre explícitos, nunca `select *`.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/cliente';
import { analisarArquivo, enviarAssetBase, type ArquivoAnalisado } from './uploadDeAssetBase';

export interface Produto {
  id: string;
  nome: string;
  base_asset_path: string;
  created_at: string;
}

export type EstadoDaLista = 'carregando' | 'vazio' | 'erro' | 'pronto';

export function useProdutos(tenantId: string | null) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [estado, setEstado] = useState<EstadoDaLista>('carregando');

  const buscar = useCallback(async () => {
    setEstado('carregando');

    const { data, error } = await supabase
      .from('products')
      .select('id, nome, base_asset_path, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setEstado('erro');
      return;
    }

    const lista = (data ?? []) as Produto[];
    setProdutos(lista);
    setEstado(lista.length === 0 ? 'vazio' : 'pronto');
  }, []);

  useEffect(() => {
    if (tenantId) void buscar();
  }, [tenantId, buscar]);

  /** Sobe o asset e só então cria a linha — ver o comentário em `enviarAssetBase`. */
  const criarProduto = useCallback(
    async (nome: string, analisado: ArquivoAnalisado, tenantIdAtual: string) => {
      const produtoId = crypto.randomUUID();
      const caminho = await enviarAssetBase(analisado.svgCanonico, tenantIdAtual, produtoId);

      const { error } = await supabase.from('products').insert({
        id: produtoId,
        tenant_id: tenantIdAtual,
        nome,
        base_asset_path: caminho,
      });

      if (error) {
        // A sessão pode ter expirado no meio: a RLS recusa a escrita e o usuário precisa
        // saber que é para entrar de novo, não que "deu erro".
        const { data } = await supabase.auth.getSession();
        throw new Error(
          data.session
            ? 'Não foi possível cadastrar o produto. Tente de novo.'
            : 'Sua sessão expirou. Entre novamente para cadastrar o produto.',
        );
      }

      await buscar();
    },
    [buscar],
  );

  return { produtos, estado, buscar, criarProduto, analisarArquivo };
}
