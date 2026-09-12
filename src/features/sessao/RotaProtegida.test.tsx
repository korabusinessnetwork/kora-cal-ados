// O portão é a única coisa entre um visitante e os dados de um tenant. Este arquivo
// prende o que ele NÃO pode deixar passar.
//
// `renderToStaticMarkup` em vez de testing-library: a pergunta é "esse HTML saiu?", e
// isso não justifica uma dependência nova (mesma escolha de ComparativoDeNormalizacao).

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContextoDeSessao, type EstadoDaSessao, type Sessao } from './ContextoDeSessao';
import { RotaProtegida } from './RotaProtegida';
import { TelaDeLogin } from './TelaDeLogin';
import type { TenantDoUsuario } from './carregarTenantsDoUsuario';

const SEGREDO = 'catalogo-secreto-do-tenant';

const tenant = (nome: string, id = nome): TenantDoUsuario => ({
  id,
  nome,
  slug: nome.toLowerCase(),
  tema: {},
  papel: 'membro',
});

function montar(parcial: Partial<Sessao> & { estado: EstadoDaSessao }): string {
  const sessao: Sessao = {
    usuario: null,
    tenants: [],
    tenantAtivo: null,
    erro: null,
    entrar: async () => {},
    sair: async () => {},
    escolherTenant: () => {},
    trocarDeTenant: () => {},
    tentarDeNovo: async () => {},
    ...parcial,
  };

  return renderToStaticMarkup(
    <ContextoDeSessao.Provider value={sessao}>
      <RotaProtegida>{(t) => <p>{`${SEGREDO} de ${t.nome}`}</p>}</RotaProtegida>
    </ContextoDeSessao.Provider>,
  );
}

describe('nada protegido renderiza sem sessão completa', () => {
  it.each<EstadoDaSessao>([
    'carregando',
    'anonimo',
    'entrando',
    'sem-tenant',
    'falha-ao-carregar',
    'escolhendo-tenant',
  ])(
    'estado %s não deixa o conteúdo protegido sair no HTML',
    (estado) => {
      // Esconder por CSS não serve: o conteúdo estaria no HTML, e é isso que um
      // "view-source" entrega.
      expect(montar({ estado, tenants: [tenant('Alfa'), tenant('Beta')] })).not.toContain(SEGREDO);
    },
  );

  it('com usuário mas SEM tenant ativo também não passa', () => {
    // Os dois, sempre: consulta sem tenant não sabe a que marca pertence.
    expect(
      montar({ estado: 'pronta', usuario: { id: 'u', email: 'a@b.c' }, tenantAtivo: null }),
    ).not.toContain(SEGREDO);
  });

  it('só com usuário E tenant ativo o conteúdo aparece, e recebe o tenant', () => {
    const html = montar({
      estado: 'pronta',
      usuario: { id: 'u', email: 'a@b.c' },
      tenants: [tenant('Alfa')],
      tenantAtivo: tenant('Alfa'),
    });

    expect(html).toContain(`${SEGREDO} de Alfa`);
  });
});

describe('cada estado tem tela própria (CLAUDE.md: carregando/erro/vazio/sucesso)', () => {
  it('carregando avisa que está verificando', () => {
    expect(montar({ estado: 'carregando' })).toContain('Verificando sua sessão');
  });

  it('anônimo cai no login', () => {
    expect(montar({ estado: 'anonimo' })).toContain('E-mail');
  });

  it('sem tenant explica o que fazer em vez de mostrar app vazio', () => {
    const html = montar({ estado: 'sem-tenant', usuario: { id: 'u', email: 'a@b.c' } });

    expect(html).toContain('não está vinculada a uma marca');
    expect(html).toContain('Sair'); // estado vazio com saída, não beco sem saída
  });

  it('com 2 tenants pergunta em qual marca, sem escolher sozinho', () => {
    // "Pega o primeiro" abriria o catálogo da marca errada sem ninguém perceber.
    const html = montar({ estado: 'escolhendo-tenant', tenants: [tenant('Alfa'), tenant('Beta')] });

    expect(html).toContain('Em qual marca');
    expect(html).toContain('Alfa');
    expect(html).toContain('Beta');
  });

  it('o erro de sessão chega na tela, não só no console', () => {
    expect(
      montar({ estado: 'falha-ao-carregar', erro: 'Não foi possível carregar seus tenants: 500' }),
    ).toContain('Não foi possível carregar seus tenants: 500');
  });

  it('falha ao carregar fala de rede, não de cadastro, e oferece repetir (A10)', () => {
    // A tela é escolhida pelo estado, então este teste é o que impede a frase errada de voltar:
    // mandar quem perdeu a rede procurar quem provisiona é uma resposta que não resolve nada.
    const html = montar({
      estado: 'falha-ao-carregar',
      usuario: { id: 'u', email: 'a@b.c' },
      erro: 'Não foi possível carregar seus tenants.',
    });

    expect(html).toContain('Não deu para carregar suas marcas');
    expect(html).not.toContain('não está vinculada a uma marca');
    expect(html).toContain('Tentar de novo');
    expect(html).toContain('Sair'); // repetir é o caminho comum, sair é a saída de quem não volta
  });

  it('a falha é anunciada, e o anúncio não rouba o marco principal', () => {
    const html = montar({ estado: 'falha-ao-carregar', erro: 'rede fora' });

    expect(html).toContain('role="alert"');
    // `role="alert"` no `<main>` trocaria o único marco da página por um aviso.
    expect(html).not.toMatch(/<main[^>]*role="alert"/);
  });

  it('sem tenant não vira tela de erro por causa do A10', () => {
    // O caso legítimo de conta recém-criada continua sendo estado vazio, sem alerta e sem botão
    // de repetir: não há o que repetir quando a resposta do banco foi "nenhum vínculo".
    const html = montar({ estado: 'sem-tenant', usuario: { id: 'u', email: 'a@b.c' } });

    expect(html).toContain('não está vinculada a uma marca');
    expect(html).not.toContain('Tentar de novo');
    expect(html).not.toContain('role="alert"');
  });
});

describe('tela de login nos quatro estados', () => {
  const render = (props: Parameters<typeof TelaDeLogin>[0]) =>
    renderToStaticMarkup(<TelaDeLogin {...props} />);

  it('vazia: botão desabilitado antes de digitar', () => {
    // Prevenção de erro > mensagem de erro: nada de submeter para ouvir "preencha".
    const html = render({ estado: 'pronta', erro: null, aoEntrar: () => {} });

    expect(html).toContain('Entrar');
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it('enviando: campos travados e rótulo muda', () => {
    const html = render({ estado: 'enviando', erro: null, aoEntrar: () => {} });

    expect(html).toContain('Entrando');
    expect(html.match(/disabled/g) ?? []).toHaveLength(3); // e-mail, senha e o botão
  });

  it('erro: banner anunciado por leitor de tela', () => {
    const html = render({ estado: 'pronta', erro: 'E-mail ou senha inválidos.', aoEntrar: () => {} });

    expect(html).toContain('role="alert"');
    expect(html).toContain('E-mail ou senha inválidos.');
  });

  it('a senha nunca sai no HTML como texto', () => {
    // `type="password"` é o que impede a senha de aparecer em print e em gravação de tela.
    expect(render({ estado: 'pronta', erro: null, aoEntrar: () => {} })).toContain('type="password"');
  });
});
