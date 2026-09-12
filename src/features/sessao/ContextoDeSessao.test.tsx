// @vitest-environment jsdom
//
// A máquina de estados da sessão. É ela que decide quem entra e com que tenant, e até aqui era a
// única peça do caminho crítico de multi-tenant sem teste nenhum: `RotaProtegida.test.tsx` monta o
// contexto com uma `Sessao` de mentira, então prova a TELA e não a decisão.
//
// Monta o provedor de verdade, com `react-dom/client` em jsdom, porque o que interessa está nos
// efeitos: a primeira leitura da sessão, a reação ao `onAuthStateChange`, e a escolha do tenant.
// Renderizar no servidor, como o teste da rota faz, não roda efeito nenhum e não veria nada disso.
// jsdom já é dependência do projeto (o motor de SVG usa), então isto não custa pacote novo.
//
// O cliente é falso no mesmo formato de `carregarTenantsDoUsuario.test.ts`. O isolamento de
// verdade continua sendo provado contra o banco real, em `supabase/tests/isolamento.test.ts`.

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ProvedorDeSessao, type Sessao } from './ContextoDeSessao';
import { useSessao } from './useSessao';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const USUARIO = { id: 'user-1', email: 'quem@marca.com' };

const vinculo = (nome: string, papel = 'owner', id = nome.toLowerCase()) => ({
  papel,
  tenants: { id, nome, slug: nome.toLowerCase(), tema: { cor_primaria: '#101010' } },
});

interface ConfiguracaoDoFalso {
  /** A sessão que `getSession` devolve na montagem. `null` é visitante. */
  sessao?: { user: { id: string; email?: string } } | null;
  vinculos?: unknown[];
  erroDaConsulta?: unknown;
  erroDeLogin?: unknown;
  /**
   * Quantas consultas ainda falham antes de a rede voltar. É o que permite provar o
   * "tentar de novo": sem isso a segunda tentativa erraria igual à primeira e o teste não
   * distinguiria um botão que refaz a busca de um botão que não faz nada.
   */
  falhasAteVoltar?: number;
}

function clienteFalso(configuracao: ConfiguracaoDoFalso = {}) {
  const chamadas = {
    signOut: 0,
    login: null as { email: string; password: string } | null,
    assinaturaCancelada: false,
    consultas: 0,
  };

  let aoMudarAuth: ((evento: string, sessao: unknown) => void) | null = null;
  let falhasRestantes = configuracao.falhasAteVoltar ?? 0;

  const cliente = {
    auth: {
      getSession: async () => ({ data: { session: configuracao.sessao ?? null } }),

      onAuthStateChange(retorno: (evento: string, sessao: unknown) => void) {
        aoMudarAuth = retorno;
        return {
          data: {
            subscription: {
              unsubscribe() {
                chamadas.assinaturaCancelada = true;
              },
            },
          },
        };
      },

      async signInWithPassword(credenciais: { email: string; password: string }) {
        chamadas.login = credenciais;
        return { error: configuracao.erroDeLogin ?? null };
      },

      async signOut() {
        chamadas.signOut += 1;
        return { error: null };
      },
    },

    from: () => ({
      select: () => ({
        eq: async () => {
          chamadas.consultas += 1;

          if (falhasRestantes > 0) {
            falhasRestantes -= 1;
            return { data: null, error: { message: 'conexão recusada' } };
          }

          return {
            data: configuracao.vinculos ?? [],
            error: configuracao.erroDaConsulta ?? null,
          };
        },
      }),
    }),
  } as unknown as SupabaseClient;

  return {
    cliente,
    chamadas,
    /** Dispara o `onAuthStateChange`, que é como o login de verdade chega ao provedor. */
    async emitir(sessao: unknown) {
      await act(async () => {
        aoMudarAuth?.('SIGNED_IN', sessao);
      });
    },
  };
}

/** O que a árvore enxerga. Guardado num objeto para o TypeScript não estreitar para `null`. */
const visto: { sessao: Sessao | null } = { sessao: null };

function Sonda() {
  visto.sessao = useSessao();
  return null;
}

let raiz: Root | null = null;

async function montar(cliente: SupabaseClient, filhos: ReactNode = <Sonda />): Promise<Sessao> {
  const area = document.createElement('div');
  document.body.appendChild(area);
  raiz = createRoot(area);

  await act(async () => {
    raiz?.render(<ProvedorDeSessao cliente={cliente}>{filhos}</ProvedorDeSessao>);
  });

  return sessao();
}

/** A última sessão renderizada. Falha com nome em vez de `null` se a sonda não tiver rodado. */
function sessao(): Sessao {
  if (!visto.sessao) throw new Error('a sonda não renderizou: o provedor não montou');

  return visto.sessao;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  visto.sessao = null;
  window.localStorage.clear();
});

afterEach(async () => {
  const atual = raiz;
  raiz = null;
  if (atual) await act(async () => atual.unmount());
  document.body.innerHTML = '';
});

describe('provedor de sessão', () => {
  it('sem sessão no Supabase, a sessão fica anônima e sem tenant', async () => {
    const { cliente, chamadas } = clienteFalso({ sessao: null });
    const sessao = await montar(cliente);

    expect(sessao.estado).toBe('anonimo');
    expect(sessao.usuario).toBeNull();
    expect(sessao.tenantAtivo).toBeNull();
    // Visitante não custa consulta ao banco: não há usuário para consultar por.
    expect(chamadas.consultas).toBe(0);
  });

  it('usuário sem nenhum vínculo para em sem-tenant, não em pronta', async () => {
    // O estado vazio existe para a tela poder explicar. Cair em `pronta` aqui abriria o app com
    // `tenantAtivo` nulo, que é o caminho por onde um app multi-tenant mostra dado do vizinho.
    const { cliente } = clienteFalso({ sessao: { user: USUARIO }, vinculos: [] });
    const sessao = await montar(cliente);

    expect(sessao.estado).toBe('sem-tenant');
    expect(sessao.usuario).toEqual({ id: 'user-1', email: 'quem@marca.com' });
    expect(sessao.tenants).toEqual([]);
  });

  it('com um vínculo só, entra direto, sem perguntar qual marca', async () => {
    const { cliente } = clienteFalso({ sessao: { user: USUARIO }, vinculos: [vinculo('Alfa')] });
    const sessao = await montar(cliente);

    expect(sessao.estado).toBe('pronta');
    expect(sessao.tenantAtivo?.id).toBe('alfa');
    expect(sessao.tenantAtivo?.tema).toEqual({ cor_primaria: '#101010' });
  });

  it('com dois vínculos, pergunta qual marca e não escolhe sozinho', async () => {
    // Escolher "a primeira que veio" é o pecado capital deste produto: as duas podem ser
    // concorrentes, e abrir a errada é vazamento na tela de quem confiou.
    const { cliente } = clienteFalso({
      sessao: { user: USUARIO },
      vinculos: [vinculo('Alfa'), vinculo('Beta')],
    });
    const sessao = await montar(cliente);

    expect(sessao.estado).toBe('escolhendo-tenant');
    expect(sessao.tenantAtivo).toBeNull();
    expect(sessao.tenants.map(({ nome }) => nome)).toEqual(['Alfa', 'Beta']);
  });

  it('com dois vínculos e um lembrado, abre o lembrado', async () => {
    window.localStorage.setItem('kora.tenant-ativo.user-1', 'beta');
    const { cliente } = clienteFalso({
      sessao: { user: USUARIO },
      vinculos: [vinculo('Alfa'), vinculo('Beta')],
    });
    const sessao = await montar(cliente);

    expect(sessao.estado).toBe('pronta');
    expect(sessao.tenantAtivo?.id).toBe('beta');
  });

  it('lembrado que saiu da lista é ignorado, e volta a perguntar', async () => {
    // Quem perdeu o acesso a uma marca não pode entrar nela por causa do localStorage. A lista
    // que manda é a que o banco devolveu agora.
    window.localStorage.setItem('kora.tenant-ativo.user-1', 'marca-que-nao-e-mais-minha');
    const { cliente } = clienteFalso({
      sessao: { user: USUARIO },
      vinculos: [vinculo('Alfa'), vinculo('Beta')],
    });
    const sessao = await montar(cliente);

    expect(sessao.estado).toBe('escolhendo-tenant');
    expect(sessao.tenantAtivo).toBeNull();
  });

  it('escolher um tenant de fora da lista não faz nada', async () => {
    const { cliente } = clienteFalso({
      sessao: { user: USUARIO },
      vinculos: [vinculo('Alfa'), vinculo('Beta')],
    });
    await montar(cliente);

    await act(async () => sessao().escolherTenant('tenant-do-concorrente'));

    expect(sessao().estado).toBe('escolhendo-tenant');
    expect(sessao().tenantAtivo).toBeNull();
    expect(window.localStorage.getItem('kora.tenant-ativo.user-1')).toBeNull();
  });

  it('escolher um tenant da lista abre o app e guarda a preferência', async () => {
    const { cliente } = clienteFalso({
      sessao: { user: USUARIO },
      vinculos: [vinculo('Alfa'), vinculo('Beta')],
    });
    await montar(cliente);

    await act(async () => sessao().escolherTenant('beta'));

    expect(sessao().estado).toBe('pronta');
    expect(sessao().tenantAtivo?.nome).toBe('Beta');
    expect(window.localStorage.getItem('kora.tenant-ativo.user-1')).toBe('beta');
  });

  it('trocar de marca só existe com duas ou mais', async () => {
    const { cliente } = clienteFalso({ sessao: { user: USUARIO }, vinculos: [vinculo('Alfa')] });
    await montar(cliente);

    await act(async () => sessao().trocarDeTenant());

    expect(sessao().estado).toBe('pronta');
  });

  it('login recusado não conta se o e-mail existe, e devolve o formulário', async () => {
    const { cliente, chamadas } = clienteFalso({
      sessao: null,
      erroDeLogin: { message: 'Invalid login credentials' },
    });
    await montar(cliente);

    await act(async () => sessao().entrar('quem@marca.com', 'errada'));

    expect(chamadas.login).toEqual({ email: 'quem@marca.com', password: 'errada' });
    expect(sessao().estado).toBe('anonimo');
    expect(sessao().erro).toBe('E-mail ou senha inválidos.');
    // A mensagem não pode distinguir "e-mail não existe" de "senha errada": isso contaria a um
    // estranho quem tem conta aqui. Ela nomeia os dois campos justamente para não apontar um.
    expect(sessao().erro).not.toMatch(/não existe|não encontrad|não cadastrad|sem conta/i);
  });

  it('o login bem-sucedido chega pelo onAuthStateChange, num caminho só', async () => {
    const { cliente, emitir } = clienteFalso({ sessao: null, vinculos: [vinculo('Alfa')] });
    await montar(cliente);

    expect(sessao().estado).toBe('anonimo');

    await emitir({ user: USUARIO });

    expect(sessao().estado).toBe('pronta');
    expect(sessao().tenantAtivo?.nome).toBe('Alfa');
  });

  it('logout em outra aba derruba a sessão desta', async () => {
    // É para isso que a assinatura existe: sem ela a tela continuaria desenhada depois de a
    // sessão morrer do outro lado.
    const { cliente, emitir } = clienteFalso({
      sessao: { user: USUARIO },
      vinculos: [vinculo('Alfa')],
    });
    await montar(cliente);

    await emitir(null);

    expect(sessao().estado).toBe('anonimo');
    expect(sessao().usuario).toBeNull();
    expect(sessao().tenantAtivo).toBeNull();
  });

  it('sair desloga e volta ao anônimo', async () => {
    const { cliente, chamadas } = clienteFalso({
      sessao: { user: USUARIO },
      vinculos: [vinculo('Alfa')],
    });
    await montar(cliente);

    await act(async () => sessao().sair());

    expect(chamadas.signOut).toBe(1);
    expect(sessao().estado).toBe('anonimo');
  });

  it('a consulta que falha não deixa a tela carregando para sempre', async () => {
    const { cliente } = clienteFalso({
      sessao: { user: USUARIO },
      erroDaConsulta: { message: 'conexão recusada' },
    });
    const sessao = await montar(cliente);

    expect(sessao.estado).not.toBe('carregando');
    expect(sessao.estado).not.toBe('pronta');
    // A mensagem sai genérica, e não com o texto do erro: `carregarTenantsDoUsuario` relança o
    // objeto de erro do supabase-js, que é um objeto simples e não um `Error`, então o detalhe
    // não entra.
    expect(sessao.erro).toBe('Não foi possível carregar seus tenants.');
    expect(sessao.tenantAtivo).toBeNull();
  });

  it('falha de rede NÃO se confunde com conta sem vínculo (A10)', async () => {
    // Os dois caíam no mesmo estado, e o estado escolhe a frase da tela: quem só perdeu a rede
    // lia "sua conta não está vinculada a uma marca" e ia procurar quem provisiona por um
    // problema que se resolve clicando de novo. São estados diferentes porque são verdades
    // diferentes.
    const { cliente } = clienteFalso({
      sessao: { user: USUARIO },
      erroDaConsulta: { message: 'conexão recusada' },
    });
    const sessao = await montar(cliente);

    expect(sessao.estado).toBe('falha-ao-carregar');
    expect(sessao.estado).not.toBe('sem-tenant');
  });

  it('tentar de novo refaz a busca, e a rede que voltou abre o app', async () => {
    const { cliente, chamadas } = clienteFalso({
      sessao: { user: USUARIO },
      vinculos: [vinculo('Alfa')],
      falhasAteVoltar: 1,
    });
    await montar(cliente);

    expect(sessao().estado).toBe('falha-ao-carregar');

    await act(async () => sessao().tentarDeNovo());

    expect(chamadas.consultas).toBe(2);
    expect(sessao().estado).toBe('pronta');
    expect(sessao().tenantAtivo?.nome).toBe('Alfa');
    // O aviso da primeira tentativa não pode sobreviver à tentativa que deu certo.
    expect(sessao().erro).toBeNull();
  });

  it('tentar de novo com a rede ainda fora volta à mesma tela, sem virar sem-tenant', async () => {
    const { cliente, chamadas } = clienteFalso({
      sessao: { user: USUARIO },
      erroDaConsulta: { message: 'conexão recusada' },
    });
    await montar(cliente);

    await act(async () => sessao().tentarDeNovo());

    expect(chamadas.consultas).toBe(2);
    expect(sessao().estado).toBe('falha-ao-carregar');
    expect(sessao().erro).toBe('Não foi possível carregar seus tenants.');
  });

  it('tentar de novo sem usuário não consulta nada', async () => {
    // O botão só existe na tela de falha, que só existe com usuário. Chamar sem ele é engano de
    // programação, e engano de programação não vira consulta ao banco.
    const { cliente, chamadas } = clienteFalso({ sessao: null });
    await montar(cliente);

    await act(async () => sessao().tentarDeNovo());

    expect(chamadas.consultas).toBe(0);
    expect(sessao().estado).toBe('anonimo');
  });

  it('zero vínculos continua em sem-tenant, e sem erro nenhum', async () => {
    // O outro lado do A10: separar a falha não pode ter transformado o caso legítimo de conta
    // recém-criada num aviso de erro.
    const { cliente } = clienteFalso({ sessao: { user: USUARIO }, vinculos: [] });
    const sessao = await montar(cliente);

    expect(sessao.estado).toBe('sem-tenant');
    expect(sessao.erro).toBeNull();
  });

  it('desmontar cancela a assinatura de auth', async () => {
    const { cliente, chamadas } = clienteFalso({ sessao: null });
    await montar(cliente);

    const atual = raiz;
    raiz = null;
    await act(async () => atual?.unmount());

    expect(chamadas.assinaturaCancelada).toBe(true);
  });
});
