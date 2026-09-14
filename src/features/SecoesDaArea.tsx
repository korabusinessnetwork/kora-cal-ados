// As seções da área protegida e a barra que troca entre elas.
//
// Mora na raiz de `features/`, ao lado de `AreaProtegida.tsx`, pelo mesmo motivo dele: é o ponto
// onde features diferentes se juntam, e dentro de qualquer uma delas precisaria importar da outra.
//
// A lista de seções é função do PAPEL, e não uma lista fixa com botões escondidos por CSS: membro
// não recebe a entrada "Fornecedor de modelo de linguagem" no DOM. Esconder não é permissão (quem decide é o servidor,
// com 403), mas uma entrada que leva a "você não pode" é ruído na tela de quem trabalha todo dia.

import type { TenantDoUsuario } from './sessao/carregarTenantsDoUsuario';

export type SecaoDaArea = 'produtos' | 'fornecedor';

interface DescricaoDaSecao {
  id: SecaoDaArea;
  rotulo: string;
}

export function secoesDoPapel(papel: TenantDoUsuario['papel']): DescricaoDaSecao[] {
  const secoes: DescricaoDaSecao[] = [{ id: 'produtos', rotulo: 'Modelos' }];
  if (papel === 'owner') secoes.push({ id: 'fornecedor', rotulo: 'Fornecedor de modelo de linguagem' });
  return secoes;
}

export function SecoesDaArea({
  papel,
  atual,
  aoEscolher,
}: {
  papel: TenantDoUsuario['papel'];
  atual: SecaoDaArea;
  aoEscolher: (secao: SecaoDaArea) => void;
}) {
  return (
    <nav className="secoes-da-area" aria-label="Seções">
      {secoesDoPapel(papel).map((secao) => (
        <button
          key={secao.id}
          type="button"
          className="secoes-da-area__botao"
          aria-current={secao.id === atual ? 'page' : undefined}
          onClick={() => aoEscolher(secao.id)}
        >
          {secao.rotulo}
        </button>
      ))}
    </nav>
  );
}
