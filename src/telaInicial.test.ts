// O que estes testes protegem: que a URL só consiga escolher telas SEM banco, e que
// qualquer outra coisa caia na área protegida. Se um dia alguém acrescentar uma tela
// aqui, o teste do valor desconhecido é o que obriga a pensar em que lado ela cai.

import { describe, expect, it } from 'vitest';
import { lerTelaDaUrl, tituloDaTela, urlDaTela } from './telaInicial';

describe('lerTelaDaUrl', () => {
  it('abre o esboço com ?tela=esboco, que é a tela sem banco', () => {
    expect(lerTelaDaUrl('?tela=esboco')).toBe('esboco');
  });

  it('abre o palco 3D com ?tela=palco3d, que também não fala com o banco', () => {
    // A peça do palco é montada por código (`src/lib/acervo/`), não baixada. A tela abre
    // num clone recém-clonado, sem conta e sem `.env.local`, igual ao esboço.
    expect(lerTelaDaUrl('?tela=palco3d')).toBe('palco3d');
  });

  it('abre o calçado montado com ?tela=composicao, que monta o acervo por código', () => {
    // A terceira tela sem banco. Ela monta as peças do acervo de prova numa cena só, e o
    // acervo é código: não há requisição para fazer nem sessão para pedir.
    expect(lerTelaDaUrl('?tela=composicao')).toBe('composicao');
    expect(lerTelaDaUrl('?tela=COMPOSICAO')).toBe('composicao');
  });

  it('abre a área protegida quando a URL não pede nada', () => {
    expect(lerTelaDaUrl('')).toBe('app');
    expect(lerTelaDaUrl('?')).toBe('app');
  });

  it('aceita caixa e espaço, porque este endereço é digitado à mão', () => {
    expect(lerTelaDaUrl('?tela=Esboco')).toBe('esboco');
    expect(lerTelaDaUrl('?tela=ESBOCO')).toBe('esboco');
    expect(lerTelaDaUrl('?tela=%20esboco%20')).toBe('esboco');
    expect(lerTelaDaUrl('?tela=Palco3D')).toBe('palco3d');
    expect(lerTelaDaUrl('?tela=%20PALCO3D%20')).toBe('palco3d');
  });

  it('cai na área protegida diante de valor desconhecido — o padrão é o lado seguro', () => {
    expect(lerTelaDaUrl('?tela=admin')).toBe('app');
    expect(lerTelaDaUrl('?tela=')).toBe('app');
    expect(lerTelaDaUrl('?tenant=outro&tela=produtos')).toBe('app');
    // Quase acertar não conta: a comparação é com a lista inteira, nunca por prefixo.
    expect(lerTelaDaUrl('?tela=palco')).toBe('app');
    expect(lerTelaDaUrl('?tela=palco3d2')).toBe('app');
    expect(lerTelaDaUrl('?tela=composicoes')).toBe('app');
  });

  it('não deixa a URL escolher a área protegida por atalho: "app" também passa pelo portão', () => {
    // Assertion de contraprova: `?tela=app` devolve exatamente o mesmo que URL vazia.
    // Não existe valor de query que pule login — o que a query escolhe é só o esboço.
    expect(lerTelaDaUrl('?tela=app')).toBe(lerTelaDaUrl(''));
  });
});

describe('urlDaTela', () => {
  it('devolve a query do esboço, para o F5 não cair de volta no login', () => {
    expect(urlDaTela('esboco', '/')).toBe('?tela=esboco');
  });

  it('devolve a query do palco 3D, pelo mesmo motivo', () => {
    expect(urlDaTela('palco3d', '/')).toBe('?tela=palco3d');
    expect(urlDaTela('composicao', '/')).toBe('?tela=composicao');
  });

  it('toda tela sem banco volta por onde saiu: a ida e a volta são a mesma lista', () => {
    // Ida e volta casadas. Um endereço que `urlDaTela` escreve e `lerTelaDaUrl` não
    // reconhece manda o F5 para o login, e é um defeito que só aparece recarregando.
    for (const tela of ['esboco', 'palco3d', 'composicao'] as const) {
      expect(lerTelaDaUrl(urlDaTela(tela, '/'))).toBe(tela);
    }
  });

  it('limpa a query ao voltar para o app, em vez de escrever ?tela=app', () => {
    expect(urlDaTela('app', '/')).toBe('/');
    expect(urlDaTela('app', '/qualquer')).not.toContain('tela=');
  });
});

describe('tituloDaTela', () => {
  it('cada tela tem o próprio título, e nenhum se repete', () => {
    // O defeito que criou esta função: as quatro telas herdavam o mesmo título fixo do
    // `index.html`, então duas abas abertas lado a lado eram indistinguíveis.
    const titulos = (['app', 'esboco', 'palco3d', 'composicao'] as const).map(tituloDaTela);

    expect(new Set(titulos).size).toBe(titulos.length);
  });

  it('o título nomeia a tela antes do produto', () => {
    // Aba estreita corta o fim: o que sobra tem que ser o que distingue uma aba da outra.
    expect(tituloDaTela('composicao')).toBe('Calçado montado · Kora Calçados');
    expect(tituloDaTela('app')).toMatch(/^Editor de zonas/);
  });

  it('nenhum título ainda chama a tela de "esboço" quando ela não é o esboço', () => {
    // O título antigo, "Esboço · editor de zonas", nomeava duas telas ao mesmo tempo e
    // aparecia nas quatro.
    expect(tituloDaTela('palco3d')).not.toMatch(/esboço/i);
    expect(tituloDaTela('composicao')).not.toMatch(/esboço/i);
    expect(tituloDaTela('app')).not.toMatch(/esboço/i);
  });
});
