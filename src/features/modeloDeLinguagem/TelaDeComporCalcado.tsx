// "Compor calçado" dentro da área da marca: a tela da composição com o fornecedor da marca (D13).
//
// Qualquer papel entra. Quem compõe é o time; quem escolhe o fornecedor é o owner.
//
// A tela da composição (e com ela o three.js) entra por `import()` tardio, igual ao `App.tsx`: sem
// isso o chunk da área protegida, que todo login baixa, levaria o motor 3D para quem só abre
// "Modelos". E ela só monta depois de saber quem responde o prompt, para a frase de transparência
// não mudar com a pessoa já lendo (ver `useModeloDaMarca`).

import { lazy, Suspense, useMemo } from 'react';

import { clienteSupabase } from '../../lib/supabase/cliente';
import type { TenantDoUsuario } from '../sessao/carregarTenantsDoUsuario';
import { criarChamadorDaApi, lerTokenDoCliente, type ChamadorDaApi } from './chamarApiDoModeloDeLinguagem';
import { useModeloDaMarca, type SituacaoDoModelo } from './hooks/useModeloDaMarca';

const TelaDaComposicao = lazy(async () => ({
  default: (await import('../../palco3d/TelaDaComposicao')).TelaDaComposicao,
}));

export interface PropsDaTelaDeComporCalcado {
  tenant: TenantDoUsuario;
  /** Injetável para teste. Em produção, a API com o token da sessão Supabase. */
  chamar?: ChamadorDaApi;
}

export function TelaDeComporCalcado({ tenant, chamar }: PropsDaTelaDeComporCalcado) {
  const chamador = useMemo(
    () => chamar ?? criarChamadorDaApi({ lerToken: lerTokenDoCliente(clienteSupabase()) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const { situacao, tentarDeNovo } = useModeloDaMarca(tenant.id, chamador);

  if (situacao.tipo === 'carregando') {
    return (
      <p className="compor__situacao" aria-busy="true">
        Conferindo o fornecedor de modelo de linguagem da {tenant.nome}…
      </p>
    );
  }

  return (
    <div className="compor">
      <div className={situacao.tipo === 'nao-foi-possivel-saber' ? 'compor__situacao compor__situacao--erro' : 'compor__situacao'} role={situacao.tipo === 'nao-foi-possivel-saber' ? 'alert' : 'status'}>
        <p>{textoDaSituacao(situacao, tenant)}</p>
        {situacao.tipo === 'nao-foi-possivel-saber' && (
          <button type="button" onClick={tentarDeNovo}>
            Tentar de novo
          </button>
        )}
      </div>
      <Suspense fallback={<p className="compor__situacao">Carregando o calçado montado…</p>}>
        <TelaDaComposicao modeloDaTela={situacao.modeloDaTela} />
      </Suspense>
    </div>
  );
}

export function textoDaSituacao(situacao: Exclude<SituacaoDoModelo, { tipo: 'carregando' }>, tenant: TenantDoUsuario): string {
  switch (situacao.tipo) {
    case 'fornecedor':
      return `O prompt é respondido por ${situacao.emUso.nome_do_fornecedor} (modelo ${situacao.emUso.modelo}), com a chave da ${tenant.nome}. Cada geração conta no gasto do mês.`;
    case 'sem-fornecedor':
      return tenant.papel === 'owner'
        ? 'Nenhum fornecedor configurado. Quem responde o prompt é o gerador de prova, que não é IA. Configure em "Fornecedor de modelo de linguagem".'
        : 'Nenhum fornecedor configurado. Quem responde o prompt é o gerador de prova, que não é IA. Quem configura é o owner da marca.';
    case 'nao-foi-possivel-saber':
      return `Não foi possível saber o fornecedor da marca (${situacao.erro}). Até conseguir, quem responde o prompt é o gerador de prova, que não é IA.`;
  }
}
