// Barra fixa de toda tela protegida: em que marca você está e como sair.
//
// O nome do tenant fica sempre visível de propósito. Quem trabalha para duas marcas
// precisa saber, sem clicar em nada, de quem é o catálogo aberto — a alternativa é
// descobrir depois de salvar no lugar errado.

import { useSessao } from './useSessao';

export function BarraDaSessao() {
  const { usuario, tenantAtivo, tenants, sair, trocarDeTenant } = useSessao();

  if (!tenantAtivo) return null;

  return (
    <header className="barra-sessao">
      <div className="barra-sessao__marca">
        <strong className="barra-sessao__tenant">{tenantAtivo.nome}</strong>
        <span className="barra-sessao__papel">
          {tenantAtivo.papel === 'owner' ? 'Owner' : 'Membro'}
        </span>
      </div>

      <div className="barra-sessao__acoes">
        {usuario && <span className="barra-sessao__email">{usuario.email}</span>}
        {tenants.length > 1 && (
          <button
            type="button"
            className="barra-sessao__botao"
            onClick={trocarDeTenant}
            title="Trocar de marca"
          >
            Trocar de marca
          </button>
        )}
        <button type="button" className="barra-sessao__botao" onClick={() => void sair()}>
          Sair
        </button>
      </div>
    </header>
  );
}
