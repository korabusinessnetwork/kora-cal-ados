// Carrega os produtos do tenant ativo e expõe os quatro estados obrigatórios
// (carregando / erro / vazio / sucesso — CLAUDE.md).
//
// O estado vive num hook e não no componente para a lista poder ser testada como função
// pura de props, sem rede.

import { useCallback, useEffect, useState } from 'react';
import { clienteSupabase } from '../../../lib/supabase/cliente';
import { listarProdutos, type Produto } from '../listarProdutos';

export type EstadoDaLista = 'carregando' | 'erro' | 'vazia' | 'pronta';

export interface ListaDeProdutosCarregada {
  estado: EstadoDaLista;
  produtos: Produto[];
  erro: string | null;
  recarregar: () => void;
}

export function useProdutos(tenantId: string): ListaDeProdutosCarregada {
  const [estado, setEstado] = useState<EstadoDaLista>('carregando');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    setEstado('carregando');
    setErro(null);

    listarProdutos(clienteSupabase(), tenantId)
      .then((achados) => {
        if (!vivo) return;
        setProdutos(achados);
        setEstado(achados.length === 0 ? 'vazia' : 'pronta');
      })
      .catch((falha: unknown) => {
        if (!vivo) return;
        // Lista vazia por engano seria lida como "essa marca não tem produto". O erro
        // precisa dizer que foi falha, não ausência.
        setErro(falha instanceof Error ? falha.message : 'Falha ao carregar os produtos.');
        setEstado('erro');
      });

    // Trocar de marca com uma requisição em voo não pode deixar o produto da marca
    // anterior aparecer na tela da nova.
    return () => {
      vivo = false;
    };
  }, [tenantId, tentativa]);

  return { estado, produtos, erro, recarregar };
}
