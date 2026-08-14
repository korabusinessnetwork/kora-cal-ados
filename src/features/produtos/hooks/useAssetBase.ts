// Estado da leitura do asset-base para a tela. É aqui que o cliente Supabase concreto é
// injetado em `leituraDeAssetBase` — o módulo de leitura não conhece o singleton de
// propósito, para a função serverless da rodada 3 poder reusar a mesma leitura com
// service_role.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/cliente';
import { obterUrlDoAssetBase } from './leituraDeAssetBase';

export type EstadoDoAssetBase = 'nenhum' | 'carregando' | 'erro' | 'pronto';

export interface LeituraDoAssetBase {
  urlAssinada: string | null;
  estado: EstadoDoAssetBase;
  mensagemDeErro: string;
  tentarDeNovo(): void;
}

/**
 * `caminho` e `tenantId` são primitivos de propósito: o objeto do produto muda de
 * identidade a cada `buscar()` da lista, e usá-lo como dependência refaria a leitura (e
 * gastaria uma URL assinada nova) a cada recarga do catálogo.
 */
export function useAssetBase(caminho: string | null, tenantId: string | null): LeituraDoAssetBase {
  const [urlAssinada, setUrlAssinada] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoDoAssetBase>('nenhum');
  const [mensagemDeErro, setMensagemDeErro] = useState('');
  const [tentativa, setTentativa] = useState(0);

  const tentarDeNovo = useCallback(() => setTentativa((numero) => numero + 1), []);

  useEffect(() => {
    // `caminho === null` e não `!caminho`: caminho vazio é modelo com asset quebrado, e
    // precisa chegar ao validador para virar erro explicado na tela. Tratá-lo como "nada
    // selecionado" faria o usuário clicar num modelo e ler "selecione um modelo".
    if (caminho === null || !tenantId) {
      setEstado('nenhum');
      setUrlAssinada(null);
      return;
    }

    // Troca de seleção durante o carregamento: a resposta da seleção antiga chega depois e
    // não pode sobrescrever a nova.
    let cancelado = false;

    setEstado('carregando');
    setUrlAssinada(null);

    obterUrlDoAssetBase(supabase, caminho, tenantId)
      .then((url) => {
        if (cancelado) return;
        setUrlAssinada(url);
        setEstado('pronto');
      })
      .catch((falha: unknown) => {
        if (cancelado) return;
        setMensagemDeErro(
          falha instanceof Error
            ? falha.message
            : 'Não foi possível abrir o arquivo deste modelo. Tente de novo.',
        );
        setEstado('erro');
      });

    return () => {
      cancelado = true;
    };
  }, [caminho, tenantId, tentativa]);

  return { urlAssinada, estado, mensagemDeErro, tentarDeNovo };
}
