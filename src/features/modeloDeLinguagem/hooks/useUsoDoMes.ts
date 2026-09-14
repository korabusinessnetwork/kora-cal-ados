// O painel de gasto de um mês, lido de `GET /api/v1/modelo-de-linguagem/uso`.
//
// "Vazio" é estado próprio, e não uma tabela de zeros: um mês sem chamada nenhuma é informação
// ("ninguém usou ainda"), e zeros em todos os cartões parecem painel quebrado.

import { useCallback, useEffect, useState } from 'react';

import type { ResumoDoUsoDoMes } from '../../../lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import { mensagemDaFalha, type ChamadorDaApi } from '../chamarApiDoModeloDeLinguagem';

export type EstadoDoUso = 'carregando' | 'erro' | 'vazio' | 'pronto';

export type ResumoRecebido = ResumoDoUsoDoMes & { completo: boolean };

export interface UsoDoMesCarregado {
  estado: EstadoDoUso;
  resumo: ResumoRecebido | null;
  erro: string | null;
  recarregar: () => void;
}

export function useUsoDoMes(tenantId: string, mes: string, chamar: ChamadorDaApi): UsoDoMesCarregado {
  const [estado, setEstado] = useState<EstadoDoUso>('carregando');
  const [resumo, setResumo] = useState<ResumoRecebido | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado('carregando');
    setErro(null);

    chamar<ResumoRecebido>('uso', tenantId, { busca: { mes } })
      .then((dados) => {
        if (!vivo) return;
        setResumo(dados);
        setEstado(dados.totais.chamadas === 0 ? 'vazio' : 'pronto');
      })
      .catch((falha: unknown) => {
        if (!vivo) return;
        setErro(mensagemDaFalha(falha));
        setEstado('erro');
      });

    return () => {
      vivo = false;
    };
    // `chamar` fora das dependências, pelo motivo escrito em `useConfiguracaoDoFornecedor`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, mes, versao]);

  const recarregar = useCallback(() => setVersao((atual) => atual + 1), []);

  return { estado, resumo, erro, recarregar };
}
