// Qual tenant o usuário logado está operando, e o tema white-label dele.
//
// O `tenant_id` daqui serve para montar o path do Storage e nada mais — quem garante que
// um tenant não lê dado de outro é a RLS (supabase/tests/isolamento.test.ts). Tratar este
// valor como se fosse a barreira de segurança seria trocar uma prova por uma convenção.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase/cliente';
import { useAutenticacao } from '../autenticacao/AutenticacaoContext';
import { aplicarTemaDoTenant } from './aplicarTemaDoTenant';

export interface Tenant {
  id: string;
  nome: string;
  tema: Record<string, unknown> | null;
}

type EstadoDoTenant = 'carregando' | 'sem-tenant' | 'erro' | 'pronto';

interface ValorDoTenant {
  tenant: Tenant | null;
  estado: EstadoDoTenant;
}

const TenantContext = createContext<ValorDoTenant | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAutenticacao();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [estado, setEstado] = useState<EstadoDoTenant>('carregando');

  useEffect(() => {
    if (!sessao) {
      setTenant(null);
      setEstado('carregando');
      return;
    }

    let ativo = true;

    const carregar = async () => {
      setEstado('carregando');

      // Ordenado por created_at para o "primeiro tenant" ser estável entre recargas.
      // Usuário em mais de um tenant é possível no modelo; o seletor fica para depois.
      const { data, error } = await supabase
        .from('tenants')
        .select('id, nome, tema')
        .order('created_at', { ascending: true })
        .limit(1);

      if (!ativo) return;

      if (error) {
        setEstado('erro');
        return;
      }

      const encontrado = data?.[0];

      if (!encontrado) {
        setTenant(null);
        setEstado('sem-tenant');
        return;
      }

      setTenant(encontrado as Tenant);
      setEstado('pronto');
    };

    void carregar();

    return () => {
      ativo = false;
    };
  }, [sessao]);

  useEffect(() => {
    if (tenant) aplicarTemaDoTenant(tenant.tema, document.documentElement);
  }, [tenant]);

  return <TenantContext.Provider value={{ tenant, estado }}>{children}</TenantContext.Provider>;
}

export function useTenant(): ValorDoTenant {
  const valor = useContext(TenantContext);
  if (!valor) throw new Error('useTenant precisa estar dentro de TenantProvider.');
  return valor;
}
