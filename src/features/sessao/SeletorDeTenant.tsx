// Quem pertence a duas marcas escolhe em qual está trabalhando. Sem atalho.
//
// "Pega o primeiro tenant da lista" é o pecado capital de multi-tenant: o time abriria o
// produto da marca errada sem perceber e publicaria variante no catálogo de um
// concorrente. Escolher é uma decisão do usuário, e o app espera por ela.
//
// Um tenant só? O contexto já entra direto — esta tela não aparece.

import type { TenantDoUsuario } from './carregarTenantsDoUsuario';

export interface PropsDoSeletorDeTenant {
  tenants: TenantDoUsuario[];
  aoEscolher: (tenantId: string) => void;
  aoSair: () => void;
}

export function SeletorDeTenant({ tenants, aoEscolher, aoSair }: PropsDoSeletorDeTenant) {
  return (
    <main className="sessao-escolha">
      <div className="sessao-escolha__cartao">
        <h1 className="sessao-escolha__titulo">Em qual marca você vai trabalhar?</h1>
        <p className="sessao-escolha__ajuda">
          Você tem acesso a mais de uma. Tudo o que abrir a seguir pertence à marca
          escolhida aqui.
        </p>

        <ul className="sessao-escolha__lista">
          {tenants.map((tenant) => (
            <li key={tenant.id}>
              <button
                type="button"
                className="sessao-escolha__opcao"
                onClick={() => aoEscolher(tenant.id)}
              >
                <span className="sessao-escolha__nome">{tenant.nome}</span>
                <span className="sessao-escolha__papel">
                  {tenant.papel === 'owner' ? 'Owner' : 'Membro'}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button type="button" className="sessao-escolha__sair" onClick={aoSair}>
          Sair
        </button>
      </div>
    </main>
  );
}
