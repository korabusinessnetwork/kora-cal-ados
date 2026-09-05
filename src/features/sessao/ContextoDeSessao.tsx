// Sessão = usuário autenticado + tenant ativo (glossário). Os dois, sempre: um usuário
// logado sem tenant escolhido não pode ver tela nenhuma, porque toda linha do banco
// pertence a um tenant e mostrar "o primeiro que veio" é o pecado capital de multi-tenant.
//
// Context API e não constante no componente: o tenant carrega o tema (white-label), e
// tema hardcodado em componente é exatamente o que o produto proíbe.

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clienteSupabase } from '../../lib/supabase/cliente';
import { carregarTenantsDoUsuario, type TenantDoUsuario } from './carregarTenantsDoUsuario';
import { lembrarTenantAtivo, tenantLembrado } from './tenantLembrado';

export interface UsuarioDaSessao {
  id: string;
  email: string;
}

/**
 * Estados possíveis da sessão. São exaustivos de propósito: a tela decide o que desenhar
 * por este campo, então "carregando" nunca vira ausência de estado (CLAUDE.md exige
 * carregando/erro/vazio/sucesso visíveis).
 */
export type EstadoDaSessao =
  | 'carregando'
  | 'anonimo'
  // `entrando` é separado de `carregando` porque a tela desenhada é outra: mantém o
  // formulário montado. Sem isso, um login recusado apagaria o e-mail já digitado —
  // React desmonta o componente quando o estado troca o tipo do elemento raiz.
  | 'entrando'
  | 'escolhendo-tenant'
  | 'sem-tenant'
  | 'pronta';

export interface Sessao {
  estado: EstadoDaSessao;
  usuario: UsuarioDaSessao | null;
  tenants: TenantDoUsuario[];
  tenantAtivo: TenantDoUsuario | null;
  /** Mensagem em português já pronta para a tela. Nunca o objeto de erro cru. */
  erro: string | null;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  escolherTenant: (tenantId: string) => void;
  /** Volta para a escolha de marca sem deslogar. Só faz sentido com 2+ tenants. */
  trocarDeTenant: () => void;
}

export const ContextoDeSessao = createContext<Sessao | null>(null);

export function ProvedorDeSessao({
  children,
  cliente = clienteSupabase(),
}: {
  children: ReactNode;
  /** Injetável para teste — em produção é sempre o cliente único. */
  cliente?: SupabaseClient;
}) {
  const [estado, setEstado] = useState<EstadoDaSessao>('carregando');
  const [usuario, setUsuario] = useState<UsuarioDaSessao | null>(null);
  const [tenants, setTenants] = useState<TenantDoUsuario[]>([]);
  const [tenantAtivoId, setTenantAtivoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const aplicarUsuario = useCallback(
    async (proximo: UsuarioDaSessao | null) => {
      if (!proximo) {
        setUsuario(null);
        setTenants([]);
        setTenantAtivoId(null);
        setEstado('anonimo');
        return;
      }

      setUsuario(proximo);

      try {
        const encontrados = await carregarTenantsDoUsuario(cliente, proximo.id);
        setTenants(encontrados);

        if (encontrados.length === 0) {
          // Não é erro: é um usuário criado sem vínculo. A tela explica em vez de mostrar
          // um app vazio que parece quebrado.
          setEstado('sem-tenant');
          return;
        }

        const lembrado = tenantLembrado(proximo.id);
        const escolhido =
          encontrados.find((t) => t.id === lembrado) ??
          (encontrados.length === 1 ? encontrados[0] : undefined);

        setTenantAtivoId(escolhido?.id ?? null);
        setEstado(escolhido ? 'pronta' : 'escolhendo-tenant');
      } catch (falha) {
        setErro(mensagemDe(falha));
        setEstado('sem-tenant');
      }
    },
    [cliente],
  );

  useEffect(() => {
    let vivo = true;

    void cliente.auth.getSession().then(({ data }) => {
      if (vivo) void aplicarUsuario(daSessao(data.session));
    });

    // Cobre logout em outra aba e expiração do token: sem isso a tela continuaria
    // desenhada depois de a sessão morrer.
    const { data: assinatura } = cliente.auth.onAuthStateChange((_evento, sessao) => {
      if (vivo) void aplicarUsuario(daSessao(sessao));
    });

    return () => {
      vivo = false;
      assinatura.subscription.unsubscribe();
    };
  }, [cliente, aplicarUsuario]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      setErro(null);
      setEstado('entrando');

      const { error } = await cliente.auth.signInWithPassword({ email, password: senha });

      if (error) {
        // Mensagem genérica de propósito: dizer "esse e-mail não existe" conta a um
        // estranho quem tem conta aqui. O usuário legítimo sabe qual dos dois errou.
        setErro('E-mail ou senha inválidos.');
        setEstado('anonimo');
      }
      // O sucesso chega pelo onAuthStateChange — um caminho só para montar a sessão.
    },
    [cliente],
  );

  const sair = useCallback(async () => {
    setErro(null);
    await cliente.auth.signOut();
    await aplicarUsuario(null);
  }, [cliente, aplicarUsuario]);

  const escolherTenant = useCallback(
    (tenantId: string) => {
      if (!tenants.some((t) => t.id === tenantId)) return;

      setTenantAtivoId(tenantId);
      setEstado('pronta');
      if (usuario) lembrarTenantAtivo(usuario.id, tenantId);
    },
    [tenants, usuario],
  );

  const trocarDeTenant = useCallback(() => {
    // Não limpa o tenant lembrado: se a pessoa desistir e recarregar, volta para onde
    // estava. A preferência só muda quando ela escolhe de fato.
    if (tenants.length > 1) setEstado('escolhendo-tenant');
  }, [tenants]);

  const valor = useMemo<Sessao>(
    () => ({
      estado,
      usuario,
      tenants,
      tenantAtivo: tenants.find((t) => t.id === tenantAtivoId) ?? null,
      erro,
      entrar,
      sair,
      escolherTenant,
      trocarDeTenant,
    }),
    [estado, usuario, tenants, tenantAtivoId, erro, entrar, sair, escolherTenant, trocarDeTenant],
  );

  return <ContextoDeSessao.Provider value={valor}>{children}</ContextoDeSessao.Provider>;
}

function daSessao(sessao: { user?: { id: string; email?: string } } | null): UsuarioDaSessao | null {
  if (!sessao?.user) return null;
  return { id: sessao.user.id, email: sessao.user.email ?? '' };
}

function mensagemDe(falha: unknown): string {
  return falha instanceof Error
    ? `Não foi possível carregar seus tenants: ${falha.message}`
    : 'Não foi possível carregar seus tenants.';
}
