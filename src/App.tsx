// Composição do app: sessão → tenant → catálogo.
//
// O nome que aparece no cabeçalho vem do tenant, nunca de constante — o produto é
// white-label e não tem marca própria na tela do cliente (ADR-002).

import { AutenticacaoProvider, useAutenticacao } from './features/autenticacao/AutenticacaoContext';
import { RotaProtegida } from './features/autenticacao/components/RotaProtegida';
import { TenantProvider, useTenant } from './features/tenant/TenantContext';
import { ListaDeProdutos } from './features/produtos/components/ListaDeProdutos';
import { FormularioDeProduto } from './features/produtos/components/FormularioDeProduto';
import { useProdutos } from './features/produtos/hooks/useProdutos';
import './App.css';

function Catalogo() {
  const { tenant, estado } = useTenant();
  const { produtos, estado: estadoDaLista, buscar, criarProduto, analisarArquivo } = useProdutos(
    tenant?.id ?? null,
  );

  if (estado === 'carregando') {
    return (
      <p className="app__estado" role="status">
        Carregando…
      </p>
    );
  }

  if (estado === 'erro') {
    return (
      <p className="app__estado app__estado--erro" role="alert">
        Não foi possível carregar os dados da sua marca. Recarregue a página.
      </p>
    );
  }

  // Conta existe mas ninguém a vinculou a um tenant. Estado de verdade, não erro: na
  // Fase 1 o acesso é provisionado por script (venda manual/contrato).
  if (estado === 'sem-tenant' || !tenant) {
    return (
      <p className="app__estado">
        Sua conta ainda não está vinculada a uma marca. Fale com quem cuida do contrato para
        liberar o acesso.
      </p>
    );
  }

  return (
    <>
      <header className="app__cabecalho">
        <h1 className="app__titulo">{tenant.nome}</h1>
        <BotaoDeSair />
      </header>

      <div className="app__conteudo">
        <section className="app__coluna">
          <h2 className="app__subtitulo">Modelos</h2>
          <ListaDeProdutos produtos={produtos} estado={estadoDaLista} aoTentarDeNovo={buscar} />
        </section>

        <aside className="app__coluna">
          <FormularioDeProduto
            tenantId={tenant.id}
            analisarArquivo={analisarArquivo}
            criarProduto={criarProduto}
          />
        </aside>
      </div>
    </>
  );
}

function BotaoDeSair() {
  const { sair } = useAutenticacao();

  return (
    <button type="button" className="app__sair" onClick={() => void sair()}>
      Sair
    </button>
  );
}

export function App() {
  return (
    <AutenticacaoProvider>
      <RotaProtegida>
        <TenantProvider>
          <main className="app">
            <Catalogo />
          </main>
        </TenantProvider>
      </RotaProtegida>
    </AutenticacaoProvider>
  );
}
