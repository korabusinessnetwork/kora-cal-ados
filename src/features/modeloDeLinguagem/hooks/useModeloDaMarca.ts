// Quem responde o prompt da marca: o fornecedor configurado pelo owner, ou o gerador de prova.
//
// Lê `GET em-uso`, que qualquer membro pode ler (a configuração é do owner). A tela da composição
// só abre depois desta leitura, de propósito: abrir com o gerador de prova e trocar para o
// fornecedor no meio faria a frase "quem responde é..." mudar debaixo do olho de quem já leu.
//
// Falha ao ler NÃO é "sem fornecedor". A tela abre com o gerador de prova, que é o que de fato vai
// responder, e diz que não conseguiu saber, com "Tentar de novo".

import { useCallback, useEffect, useState } from 'react';

import type { FornecedorEmUso } from '../../../lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import { MODELO_DE_PROVA_DA_TELA, type ModeloDaTela } from '../../../palco3d/TelaDaComposicao';
import { mensagemDaFalha, type ChamadorDaApi } from '../chamarApiDoModeloDeLinguagem';
import { modeloDoFornecedorDaMarca } from '../modeloDaMarca';

export type SituacaoDoModelo =
  | { tipo: 'carregando' }
  | { tipo: 'fornecedor'; emUso: FornecedorEmUso; modeloDaTela: ModeloDaTela }
  | { tipo: 'sem-fornecedor'; modeloDaTela: ModeloDaTela }
  | { tipo: 'nao-foi-possivel-saber'; erro: string; modeloDaTela: ModeloDaTela };

export function useModeloDaMarca(tenantId: string, chamar: ChamadorDaApi) {
  const [situacao, setSituacao] = useState<SituacaoDoModelo>({ tipo: 'carregando' });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    setSituacao({ tipo: 'carregando' });

    chamar<{ fornecedor_em_uso: FornecedorEmUso | null }>('em-uso', tenantId)
      .then(({ fornecedor_em_uso: emUso }) => {
        if (!vivo) return;
        setSituacao(
          emUso
            ? { tipo: 'fornecedor', emUso, modeloDaTela: modeloDoFornecedorDaMarca(chamar, tenantId, emUso) }
            : { tipo: 'sem-fornecedor', modeloDaTela: MODELO_DE_PROVA_DA_TELA },
        );
      })
      .catch((falha: unknown) => {
        if (!vivo) return;
        setSituacao({ tipo: 'nao-foi-possivel-saber', erro: mensagemDaFalha(falha), modeloDaTela: MODELO_DE_PROVA_DA_TELA });
      });

    return () => {
      vivo = false;
    };
    // `chamar` fora das dependências, pelo motivo escrito em `useConfiguracaoDoFornecedor`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, versao]);

  const tentarDeNovo = useCallback(() => setVersao((atual) => atual + 1), []);

  return { situacao, tentarDeNovo };
}
