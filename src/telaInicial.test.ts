// O que estes testes protegem: que a URL só consiga escolher a tela SEM banco, e que
// qualquer outra coisa caia na área protegida. Se um dia alguém acrescentar uma tela
// aqui, o teste do valor desconhecido é o que obriga a pensar em que lado ela cai.

import { describe, expect, it } from 'vitest';
import { lerTelaDaUrl, urlDaTela } from './telaInicial';

describe('lerTelaDaUrl', () => {
  it('abre o esboço com ?tela=esboco, que é a tela sem banco', () => {
    expect(lerTelaDaUrl('?tela=esboco')).toBe('esboco');
  });

  it('abre a área protegida quando a URL não pede nada', () => {
    expect(lerTelaDaUrl('')).toBe('app');
    expect(lerTelaDaUrl('?')).toBe('app');
  });

  it('aceita caixa e espaço, porque este endereço é digitado à mão', () => {
    expect(lerTelaDaUrl('?tela=Esboco')).toBe('esboco');
    expect(lerTelaDaUrl('?tela=ESBOCO')).toBe('esboco');
    expect(lerTelaDaUrl('?tela=%20esboco%20')).toBe('esboco');
  });

  it('cai na área protegida diante de valor desconhecido — o padrão é o lado seguro', () => {
    expect(lerTelaDaUrl('?tela=admin')).toBe('app');
    expect(lerTelaDaUrl('?tela=')).toBe('app');
    expect(lerTelaDaUrl('?tenant=outro&tela=produtos')).toBe('app');
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

  it('limpa a query ao voltar para o app, em vez de escrever ?tela=app', () => {
    expect(urlDaTela('app', '/')).toBe('/');
    expect(urlDaTela('app', '/qualquer')).not.toContain('tela=');
  });
});
