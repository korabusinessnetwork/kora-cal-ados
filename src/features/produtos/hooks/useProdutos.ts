// Carrega os produtos do tenant ativo e expõe os quatro estados obrigatórios
// (carregando / erro / vazio / sucesso, CLAUDE.md).
//
// O estado vive num hook e não no componente para a lista poder ser testada como função
// pura de props, sem rede.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clienteSupabase } from '../../../lib/supabase/cliente';
import { listarProdutos, type Produto } from '../listarProdutos';

export type EstadoDaLista = 'carregando' | 'erro' | 'vazia' | 'pronta';

export interface ListaDeProdutosCarregada {
  estado: EstadoDaLista;
  produtos: Produto[];
  erro: string | null;
  recarregar: () => void;
}

/**
 * A leitura inteira, ETIQUETADA com a marca de onde ela veio.
 *
 * Estado, lista e erro num objeto só, e não em três `useState`, porque os três são a mesma
 * notícia: "o que sabemos hoje sobre a marca X". Separados, existe o instante em que o estado
 * já é de uma marca e a lista ainda é de outra, que é exatamente o defeito que este hook
 * precisa não ter.
 */
interface LeituraDaLista {
  /** De qual marca é esta leitura. É a etiqueta que impede a lista de uma aparecer sob a outra. */
  de: string;
  estado: EstadoDaLista;
  produtos: Produto[];
  erro: string | null;
}

const aindaNaoLido = (de: string): LeituraDaLista => ({
  de,
  estado: 'carregando',
  produtos: [],
  erro: null,
});

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
export function useProdutos(
  tenantId: string,
  cliente: SupabaseClient = clienteSupabase(),
): ListaDeProdutosCarregada {
  const banco = useRef(cliente);
  banco.current = cliente;

  const [leitura, setLeitura] = useState<LeituraDaLista>(() => aindaNaoLido(tenantId));
  const [tentativa, setTentativa] = useState(0);

  // A etiqueta é conferida durante o RENDER, e não só no efeito, e é isso que fecha a janela
  // inteira. Entre o render que troca de marca e o efeito que limpa o estado existe uma passagem
  // em que a lista ainda é da marca anterior sob o id da nova. Uma passagem é a tela: o produto é
  // multi-tenant com marcas CONCORRENTES, e um nome de produto da marca A visível por um frame na
  // tela da marca B é exatamente o vazamento que o isolamento existe para impedir.
  const daTela = leitura.de === tenantId ? leitura : aindaNaoLido(tenantId);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    // Necessário pelo `tentativa`: quando é o botão de recarregar que dispara, a etiqueta não
    // mudou, e sem esta linha a tentativa nova começaria mostrando o resultado da anterior.
    setLeitura(aindaNaoLido(tenantId));

    listarProdutos(banco.current, tenantId)
      .then((achados) => {
        if (!vivo) return;
        setLeitura({
          de: tenantId,
          estado: achados.length === 0 ? 'vazia' : 'pronta',
          produtos: achados,
          erro: null,
        });
      })
      .catch((falha: unknown) => {
        if (!vivo) return;
        // Lista vazia por engano seria lida como "essa marca não tem produto". O erro
        // precisa dizer que foi falha, não ausência.
        setLeitura({
          de: tenantId,
          estado: 'erro',
          produtos: [],
          erro: falha instanceof Error ? falha.message : 'Falha ao carregar os produtos.',
        });
      });

    // Trocar de marca com uma requisição em voo não pode deixar o produto da marca
    // anterior aparecer na tela da nova. A etiqueta acima já impediria a exibição; o `vivo`
    // impede antes disso, que a resposta morta chegue a mexer no estado e re-renderizar.
    return () => {
      vivo = false;
    };
  }, [tenantId, tentativa]);

  return { estado: daTela.estado, produtos: daTela.produtos, erro: daTela.erro, recarregar };
}
