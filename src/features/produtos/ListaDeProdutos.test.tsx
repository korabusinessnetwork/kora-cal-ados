// Os quatro estados obrigatórios da tela (CLAUDE.md) e o que cada um afirma ao usuário.
// A diferença entre "vazia" e "erro" é a mais cara aqui: uma fala do catálogo do cliente,
// a outra do sistema.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListaDeProdutos } from './ListaDeProdutos';
import { VisualizacaoDoProduto } from './VisualizacaoDoProduto';
import type { Produto } from './listarProdutos';

const produto = (nome: string, id = nome): Produto => ({
  id,
  nome,
  base_asset_path: `tenants/t/products/${id}/base.svg`,
  created_at: '2026-09-05T12:00:00Z',
});

const lista = (props: Partial<Parameters<typeof ListaDeProdutos>[0]>) =>
  renderToStaticMarkup(
    <ListaDeProdutos
      estado="pronta"
      produtos={[]}
      erro={null}
      aoAbrir={() => {}}
      aoRecarregar={() => {}}
      {...props}
    />,
  );

describe('lista de produtos', () => {
  it('carregando anuncia que está buscando', () => {
    const html = lista({ estado: 'carregando' });

    expect(html).toContain('Carregando');
    expect(html).toContain('aria-busy="true"');
  });

  it('vazia fala do catálogo, não de falha', () => {
    const html = lista({ estado: 'vazia' });

    expect(html).toContain('Nenhum modelo cadastrado');
    expect(html).not.toContain('role="alert"');
  });

  it('erro fala de falha e oferece ação — nunca finge catálogo vazio', () => {
    const html = lista({ estado: 'erro', erro: 'timeout' });

    expect(html).toContain('role="alert"');
    expect(html).toContain('timeout');
    expect(html).toContain('Tentar de novo');
    expect(html).not.toContain('Nenhum modelo cadastrado');
  });

  it('pronta lista os modelos na ordem recebida', () => {
    // A ordem vem da consulta (`created_at`); o componente não reordena, senão haveria
    // duas regras de ordenação divergindo.
    const html = lista({ estado: 'pronta', produtos: [produto('Runner'), produto('Trail')] });
    expect(html.indexOf('Runner')).toBeLessThan(html.indexOf('Trail'));
  });

  it('não vaza o caminho do Storage no HTML', () => {
    // O path expõe tenant_id e product_id; não há motivo para ele ir para a tela.
    expect(lista({ estado: 'pronta', produtos: [produto('Runner')] })).not.toContain('base.svg');
  });
});

describe('visualização do produto', () => {
  const ver = (props: Partial<Parameters<typeof VisualizacaoDoProduto>[0]>) =>
    renderToStaticMarkup(
      <VisualizacaoDoProduto
        nome="Runner"
        estado="pronto"
        svg="<svg xmlns='http://www.w3.org/2000/svg'></svg>"
        erro={null}
        elementosMarcaveis={21}
        aoVoltar={() => {}}
        {...props}
      />,
    );

  it('mostra quantos elementos o editor vai poder marcar', () => {
    // O número sai da regra do motor (`expandirPintaveis`), não de `[id]`: contar ids
    // incluiria o `<linearGradient>` e as costuras `fill="none"`, que ninguém consegue
    // marcar — a tela prometeria mais do que o editor entrega.
    expect(ver({})).toContain('21 elementos marcáveis');
  });

  it('diz explicitamente que ainda não há zona marcada', () => {
    // Estado vazio nomeado: sem isso, o palco desenhado parece um editor que não responde.
    expect(ver({})).toContain('nenhuma zona marcada');
  });

  it('erro no download aparece como alerta, não como palco vazio', () => {
    const html = ver({ estado: 'erro', svg: null, erro: 'Não foi possível baixar (403).' });

    expect(html).toContain('role="alert"');
    expect(html).toContain('403');
  });

  it('o palco fica oculto até o SVG chegar', () => {
    expect(ver({ estado: 'carregando', svg: null })).toMatch(/produto__palco[^>]*hidden/);
  });

  it('sempre oferece a volta para a lista', () => {
    expect(ver({ estado: 'erro', svg: null, erro: 'x' })).toContain('Modelos');
  });
});
