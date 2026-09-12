// O portão. Nada protegido renderiza sem usuário autenticado E tenant ativo.
//
// Os dois, não um: com usuário mas sem tenant, qualquer consulta sairia sem saber a que
// marca pertence — e "descobrir o tenant no meio da tela" é como um app multi-tenant
// acaba mostrando dado do concorrente.
//
// O `children` é função e não elemento de propósito: assim o tenant chega tipado e não
// existe caminho em que a tela renderize com `tenantAtivo` possivelmente nulo.

import type { ReactNode } from 'react';
import type { TenantDoUsuario } from './carregarTenantsDoUsuario';
import { SeletorDeTenant } from './SeletorDeTenant';
import { TelaDeLogin } from './TelaDeLogin';
import { useSessao } from './useSessao';

export function RotaProtegida({
  children,
}: {
  children: (tenant: TenantDoUsuario) => ReactNode;
}) {
  const { estado, tenants, tenantAtivo, erro, entrar, sair, escolherTenant, tentarDeNovo } =
    useSessao();

  if (estado === 'carregando') {
    return (
      <main className="sessao-aviso" aria-busy="true">
        <p>Verificando sua sessão…</p>
      </main>
    );
  }

  if (estado === 'anonimo' || estado === 'entrando') {
    // Mesmo componente nos dois estados, de propósito: React preserva o que já foi
    // digitado, então uma senha errada não custa redigitar o e-mail.
    return (
      <TelaDeLogin
        estado={estado === 'entrando' ? 'enviando' : 'pronta'}
        erro={erro}
        aoEntrar={(email, senha) => void entrar(email, senha)}
      />
    );
  }

  if (estado === 'falha-ao-carregar') {
    // A busca dos vínculos falhou, e isso não diz nada sobre o cadastro da pessoa. A tela
    // antiga dizia, e mandava quem só perdeu a rede por um segundo procurar quem
    // provisiona. A ação certa aqui é repetir a busca, e ela fica ao lado de sair porque
    // rede que não volta precisa de uma saída também.
    return (
      <main className="sessao-aviso">
        <h1>Não deu para carregar suas marcas</h1>
        {/* O `role` fica no parágrafo e não no `<main>`: `role="alert"` na raiz trocaria o
            marco de conteúdo principal por um aviso, e quem navega por marcos perderia a
            única região da página. */}
        <p role="alert">{erro ?? 'Não foi possível carregar seus tenants.'}</p>
        <div className="sessao-aviso__acoes">
          <button type="button" onClick={() => void tentarDeNovo()}>
            Tentar de novo
          </button>
          <button type="button" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </main>
    );
  }

  if (estado === 'sem-tenant') {
    // Estado vazio com saída, não beco sem saída: na Fase 1 o vínculo é criado por
    // script (venda manual), então a ação certa é falar com quem provisiona.
    return (
      <main className="sessao-aviso">
        <h1>Sua conta ainda não está vinculada a uma marca</h1>
        <p>Peça a quem cuida do cadastro para vincular seu e-mail a um tenant.</p>
        <button type="button" onClick={() => void sair()}>
          Sair
        </button>
      </main>
    );
  }

  if (estado === 'escolhendo-tenant' || !tenantAtivo) {
    return <SeletorDeTenant tenants={tenants} aoEscolher={escolherTenant} aoSair={() => void sair()} />;
  }

  return <>{children(tenantAtivo)}</>;
}
