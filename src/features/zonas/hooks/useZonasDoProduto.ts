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

export function useZonasDoProduto(productId: string, tenantId: string): ZonasCarregadas {
  const [estado, setEstado] = useState<EstadoDasZonas>('carregando');
  const [zonas, setZonas] = useState<ZonaDoProduto[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroAoGravar, setErroAoGravar] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  // Qual produto está aberto AGORA. `gravar` compara contra isto depois do await, porque
  // uma gravação em voo enquanto alguém troca de produto não pode escrever a lista do
  // produto antigo por cima da tela do novo.
  const produtoAberto = useRef(productId);
  produtoAberto.current = productId;

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    setEstado('carregando');
    setErro(null);
    setErroAoGravar(null);

    listarZonasDoProduto(clienteSupabase(), productId)
      .then((achadas) => {
        if (!vivo) return;
        setZonas(achadas);
        // Zona vazia não é erro nem estado próprio: produto novo simplesmente ainda não
        // foi mapeado. Quem escreve "nenhuma zona marcada" é a UI.
        setEstado('pronta');
      })
      .catch((falha: unknown) => {
        if (!vivo) return;
        setErro(mensagemDe(falha, 'Não foi possível carregar as zonas deste produto.'));
        setEstado('erro');
      });

    // Trocar de produto com requisição em voo não pode deixar a zona do produto anterior
    // aparecer no novo — seria marcar em cima do desenho errado.
    return () => {
      vivo = false;
    };
  }, [productId, tentativa]);

  const gravar = useCallback(
    async (zona: ZonaParaGravar): Promise<boolean> => {
      const alvo = productId;
      const aindaVale = () => produtoAberto.current === alvo;

      if (!tenantId.trim()) {
        // Sem tenant, `product_zones.tenant_id` (not null) viraria linha órfã que a RLS
        // esconde de todo mundo. Recusa antes da rede, como as outras guardas.
        setErroAoGravar('Escolha uma marca antes de gravar a zona.');
        return false;
      }

      setSalvando(true);
      setErroAoGravar(null);
      const cliente = clienteSupabase();

      try {
        await gravarZonaNoBanco(cliente, { tenantId, productId: alvo, zona });
      } catch (falha: unknown) {
        if (aindaVale()) {
          setErroAoGravar(mensagemDe(falha, 'Não foi possível gravar a zona.'));
          setSalvando(false);
        }
        return false;
      }

      // Relê do banco em vez de emendar a linha devolvida na lista local: não existe
      // `updated_at`, então não há lock otimista, e a releitura é a mitigação registrada
      // no plano para o last-write-wins — quem gravou vê imediatamente o que o colega
      // mudou em outra zona no meio tempo.
      try {
        const atuais = await listarZonasDoProduto(cliente, alvo);
        if (aindaVale()) {
          setZonas(atuais);
          setEstado('pronta');
          setErroAoGravar(null);
        }
      } catch (falha: unknown) {
        // A gravação passou: devolver false aqui faria a tela pedir para gravar de novo
        // uma zona que já está no banco. O que falhou foi a lista, e é a lista que avisa.
        if (aindaVale()) {
          setErro(mensagemDe(falha, 'A zona foi gravada, mas a lista não pôde ser recarregada.'));
          setEstado('erro');
        }
      }

      if (aindaVale()) setSalvando(false);
      return true;
    },
    [productId, tenantId],
  );

  return { estado, zonas, erro, salvando, erroAoGravar, recarregar, gravar };
}

function mensagemDe(falha: unknown, padrao: string): string {
  return falha instanceof Error ? falha.message : padrao;
}
