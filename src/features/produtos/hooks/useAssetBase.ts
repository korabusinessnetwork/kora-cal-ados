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
 * O desenho, ETIQUETADO com o caminho de onde ele veio.
 *
 * Estado, svg e erro num objeto só, e não em três `useState`: os três descrevem a mesma coisa,
 * "o que sabemos hoje sobre este arquivo", e separados existe o instante em que o estado já é de
 * um produto e o desenho ainda é do outro.
 */
interface LeituraDoAsset {
  /** De qual caminho é este desenho. É a etiqueta que impede o desenho errado de aparecer. */
  de: string;
  estado: AssetBaseCarregado['estado'];
  svg: string | null;
  erro: string | null;
}

const aindaNaoBaixado = (de: string): LeituraDoAsset => ({
  de,
  estado: 'carregando',
  svg: null,
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
export function useAssetBase(
  baseAssetPath: string,
  cliente: SupabaseClient = clienteSupabase(),
): AssetBaseCarregado {
  const banco = useRef(cliente);
  banco.current = cliente;

  const [leitura, setLeitura] = useState<LeituraDoAsset>(() => aindaNaoBaixado(baseAssetPath));
  // Contador em vez de um `recarregar` que chama a função direto: assim a tentativa nova
  // passa pelo MESMO efeito, com a mesma limpeza do `vivo` — dois caminhos de download
  // acabariam divergindo justamente no cancelamento.
  const [tentativa, setTentativa] = useState(0);

  // A etiqueta é conferida durante o RENDER, e não só no efeito. Entre o render que troca de
  // produto e o efeito que limpa o estado existe uma passagem inteira em que o desenho ainda é o
  // do produto anterior sob o caminho do novo, e é sobre o desenho que a pessoa CLICA para marcar
  // zona. Um clique nessa passagem grava `svg_selector` contra o desenho errado, e o registro
  // sobrevive à sessão parecendo correto.
  const daTela = leitura.de === baseAssetPath ? leitura : aindaNaoBaixado(baseAssetPath);

  useEffect(() => {
    let vivo = true;
    // Necessário pelo `tentativa`: no botão de recarregar a etiqueta não muda, e sem esta linha
    // a tentativa nova começaria mostrando o desenho da anterior.
    setLeitura(aindaNaoBaixado(baseAssetPath));

    baixarAssetBase(banco.current, baseAssetPath)
      .then((texto) => {
        if (!vivo) return;
        setLeitura({ de: baseAssetPath, estado: 'pronto', svg: texto, erro: null });
      })
      .catch((falha: unknown) => {
        if (!vivo) return;
        setLeitura({
          de: baseAssetPath,
          estado: 'erro',
          svg: null,
          erro: falha instanceof Error ? falha.message : 'Falha ao baixar o asset-base.',
        });
      });

    // A URL assinada expira em 5 min; abrir outro produto antes disso não pode fazer o
    // desenho anterior aparecer no lugar do novo. A etiqueta acima já impediria a exibição; o
    // `vivo` impede antes disso, que a resposta morta chegue a mexer no estado e re-renderizar.
    return () => {
      vivo = false;
    };
  }, [baseAssetPath, tentativa]);

  const recarregar = useCallback(() => setTentativa((numero) => numero + 1), []);

  return { estado: daTela.estado, svg: daTela.svg, erro: daTela.erro, recarregar };
}
