// Carrega as zonas do produto aberto e grava a zona marcada no editor.
//
// O estado vive aqui e não no componente para o editor e a lista de zonas serem testados
// como função pura de props, sem rede (mesmo padrão de `useProdutos`).
//
// `salvando` e `erroAoGravar` são separados de `estado` e `erro` de propósito: falhar ao
// gravar não pode apagar da tela a lista que já carregou — a pessoa perderia de vista o
// que já estava marcado justo no momento em que precisa decidir se tenta de novo.
//
// `tenantId` chega por parâmetro e NÃO de `sessao/`: a regra de dependência de
// `src/features/README.md` só permite a seta `produtos/ → zonas/`, e ler o tenant da
// sessão abriria uma segunda, na diagonal. O efeito prático da amarra é o que mais custa:
// o hook passaria a exigir `<ProvedorDeSessao>` montado para ser testado, e quebraria por
// um motivo que não tem nada a ver com zona. Quem tem o tenant em mãos é quem chama.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clienteSupabase } from '../../../lib/supabase/cliente';
import { listarZonasDoProduto } from '../listarZonasDoProduto';
import { gravarZonaNoBanco } from '../gravarZonaNoBanco';
import type { ZonaDoProduto, ZonaParaGravar } from '../tiposDeZona';

export type EstadoDasZonas = 'carregando' | 'erro' | 'pronta';

export interface ZonasCarregadas {
  estado: EstadoDasZonas;
  zonas: ZonaDoProduto[];
  erro: string | null;
  salvando: boolean;
  erroAoGravar: string | null;
  recarregar(): void;
  /** true = gravou. Em falha devolve false e preenche `erroAoGravar`, sem lançar. */
  gravar(zona: ZonaParaGravar): Promise<boolean>;
}

/**
 * A leitura das zonas, ETIQUETADA com o produto de onde ela veio.
 *
 * Estado, lista e erro num objeto só, e não em três `useState`, porque os três são a mesma
 * notícia: "o que sabemos hoje sobre as zonas do produto X".
 */
interface LeituraDasZonas {
  /** De qual produto é esta leitura. É a etiqueta que impede a lista errada de aparecer. */
  de: string;
  estado: EstadoDasZonas;
  zonas: ZonaDoProduto[];
  erro: string | null;
}

/** O estado da gravação, etiquetado pelo mesmo motivo, e com um efeito colateral bom: ver abaixo. */
interface Gravacao {
  de: string;
  salvando: boolean;
  erro: string | null;
}

const aindaNaoLido = (de: string): LeituraDasZonas => ({
  de,
  estado: 'carregando',
  zonas: [],
  erro: null,
});

const semGravacao = (de: string): Gravacao => ({ de, salvando: false, erro: null });

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
export function useZonasDoProduto(
  productId: string,
  tenantId: string,
  cliente: SupabaseClient = clienteSupabase(),
): ZonasCarregadas {
  const banco = useRef(cliente);
  banco.current = cliente;

  const [leitura, setLeitura] = useState<LeituraDasZonas>(() => aindaNaoLido(productId));
  const [gravacao, setGravacao] = useState<Gravacao>(() => semGravacao(productId));
  const [tentativa, setTentativa] = useState(0);

  // Qual produto está aberto AGORA. `gravar` compara contra isto depois do await, porque
  // uma gravação em voo enquanto alguém troca de produto não pode escrever a lista do
  // produto antigo por cima da tela do novo.
  const produtoAberto = useRef(productId);
  produtoAberto.current = productId;

  // A etiqueta é conferida durante o RENDER, e não só no efeito, e é isso que fecha a janela
  // inteira. Entre o render que troca de produto e o efeito que limpa o estado existe uma passagem
  // em que as zonas ainda são as do produto anterior sob o id do novo. Uma passagem é a tela, e
  // aqui a tela aceita clique: marcar em cima da lista errada grava no banco um `svg_selector` que
  // aponta para outro produto, e isso sobrevive à sessão parecendo correto.
  const daTela = leitura.de === productId ? leitura : aindaNaoLido(productId);
  // A mesma etiqueta na gravação resolve de quebra um travamento: quem trocava de produto no meio
  // de um `gravar` ficava com `salvando` ligado para sempre, porque quem o desliga é o fim da
  // gravação, e o fim da gravação é justamente o trecho que se recusa a escrever na tela de outro
  // produto. Etiquetado, o produto novo nasce sem gravação nenhuma em andamento.
  const gravacaoDaTela = gravacao.de === productId ? gravacao : semGravacao(productId);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    // Necessário pelo `tentativa`: quando é o botão de recarregar que dispara, a etiqueta não
    // mudou, e sem esta linha a tentativa nova começaria mostrando o resultado da anterior.
    setLeitura(aindaNaoLido(productId));
    setGravacao((antes) => (antes.de === productId ? { ...antes, erro: null } : antes));

    listarZonasDoProduto(banco.current, productId)
      .then((achadas) => {
        if (!vivo) return;
        // Zona vazia não é erro nem estado próprio: produto novo simplesmente ainda não
        // foi mapeado. Quem escreve "nenhuma zona marcada" é a UI.
        setLeitura({ de: productId, estado: 'pronta', zonas: achadas, erro: null });
      })
      .catch((falha: unknown) => {
        if (!vivo) return;
        setLeitura({
          de: productId,
          estado: 'erro',
          zonas: [],
          erro: mensagemDe(falha, 'Não foi possível carregar as zonas deste produto.'),
        });
      });

    // Trocar de produto com requisição em voo não pode deixar a zona do produto anterior
    // aparecer no novo — seria marcar em cima do desenho errado. A etiqueta acima já impediria a
    // exibição; o `vivo` impede antes disso, que a resposta morta chegue a mexer no estado.
    return () => {
      vivo = false;
    };
  }, [productId, tentativa]);

  const gravar = useCallback(
    async (zona: ZonaParaGravar): Promise<boolean> => {
      const alvo = productId;
      const aindaVale = () => produtoAberto.current === alvo;
      /**
       * Escrever na gravação DESTE produto, onde quer que a pessoa esteja agora.
       *
       * Diferente da leitura, aqui não se pergunta se o produto ainda está aberto: a etiqueta
       * `de` já garante que isto não aparece na tela de outro produto, e o resultado de uma
       * gravação que terminou é notícia verdadeira sobre o produto em que ela começou. Quem
       * trocou de produto e voltou tem direito de ver que aquela gravação acabou, e se ela
       * falhou, de ver por quê.
       */
      const naGravacaoDoAlvo = (mudanca: Omit<Gravacao, 'de'>) =>
        setGravacao((antes) => (antes.de === alvo ? { de: alvo, ...mudanca } : antes));

      if (!tenantId.trim()) {
        // Sem tenant, `product_zones.tenant_id` (not null) viraria linha órfã que a RLS
        // esconde de todo mundo. Recusa antes da rede, como as outras guardas.
        setGravacao({ de: alvo, salvando: false, erro: 'Escolha uma marca antes de gravar a zona.' });
        return false;
      }

      setGravacao({ de: alvo, salvando: true, erro: null });
      const doBanco = banco.current;

      try {
        await gravarZonaNoBanco(doBanco, { tenantId, productId: alvo, zona });
      } catch (falha: unknown) {
        naGravacaoDoAlvo({
          salvando: false,
          erro: mensagemDe(falha, 'Não foi possível gravar a zona.'),
        });
        return false;
      }

      // Relê do banco em vez de emendar a linha devolvida na lista local: não existe
      // `updated_at`, então não há lock otimista, e a releitura é a mitigação registrada
      // no plano para o last-write-wins — quem gravou vê imediatamente o que o colega
      // mudou em outra zona no meio tempo.
      try {
        const atuais = await listarZonasDoProduto(doBanco, alvo);
        // Aqui o `aindaVale` é obrigatório, e não decorativo: a leitura é um lugar só, e
        // escrever nele a lista do produto antigo apagaria a lista do novo, que não seria
        // recarregada por ninguém. A etiqueta impede a lista errada de APARECER; é esta guarda
        // que impede a resposta morta de ATROPELAR o estado.
        if (aindaVale()) setLeitura({ de: alvo, estado: 'pronta', zonas: atuais, erro: null });
      } catch (falha: unknown) {
        // A gravação passou: devolver false aqui faria a tela pedir para gravar de novo
        // uma zona que já está no banco. O que falhou foi a lista, e é a lista que avisa.
        if (aindaVale()) {
          setLeitura((antes) => ({
            ...antes,
            estado: 'erro',
            erro: mensagemDe(falha, 'A zona foi gravada, mas a lista não pôde ser recarregada.'),
          }));
        }
      }

      naGravacaoDoAlvo({ salvando: false, erro: null });
      return true;
    },
    [productId, tenantId],
  );

  return {
    estado: daTela.estado,
    zonas: daTela.zonas,
    erro: daTela.erro,
    salvando: gravacaoDaTela.salvando,
    erroAoGravar: gravacaoDaTela.erro,
    recarregar,
    gravar,
  };
}

function mensagemDe(falha: unknown, padrao: string): string {
  return falha instanceof Error ? falha.message : padrao;
}
