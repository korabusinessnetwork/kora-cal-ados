// Os quatro estados obrigatórios da tela (CLAUDE.md) e o que cada um afirma ao usuário.
// A diferença entre "vazia" e "erro" é a mais cara aqui: uma fala do catálogo do cliente,
// a outra do sistema.

import { readFileSync } from 'node:fs';
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
        erro={null}
        elementosMarcaveis={21}
        editor={<p>editor</p>}
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

  it('não repete a contagem de zonas — quem conta zona é o painel', () => {
    // O painel do editor lista as zonas com a contagem de elementos de cada uma. Um segundo
    // número aqui seria outra fonte da mesma verdade, e as duas divergem no dia em que uma
    // delas deixar de ser atualizada.
    expect(ver({})).not.toContain('zona marcada');
  });

  it('mostra o editor que recebeu, sem saber o que ele é', () => {
    expect(ver({ editor: <p>o editor</p> })).toContain('o editor');
  });

  it('erro no download aparece como alerta, não como palco vazio', () => {
    const html = ver({ estado: 'erro', erro: 'Não foi possível baixar (403).' });

    expect(html).toContain('role="alert"');
    expect(html).toContain('403');
  });

  it('a área do editor fica oculta até o asset-base chegar', () => {
    // Palco vazio visível seria lido como "modelo sem desenho"; oculto até o arquivo chegar,
    // o único estado visível é o "Baixando…".
    expect(ver({ estado: 'carregando' })).toMatch(/produto__area[^>]*hidden/);
  });

  it('e o CSS não pode desfazer esse `hidden` (BUG-015)', () => {
    // O teste acima olha a marcacao, e a marcação estáva certa o tempo todo: o defeito
    // morava na folha. Qualquer `display` de autor em `.produto__area` vence o
    // `[hidden] { display: none }` do navegador, e a área continuava na tela durante o
    // carregando e o erro. Sem esta guarda, o estado nomeado volta a sumir no dia em que
    // alguém mexer no layout — e nenhum teste de markup percebe.
    const folha = readFileSync(new URL('./produtos.css', import.meta.url), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      ' ',
    );

    expect(folha).toMatch(/\.produto__area\[hidden\]\s*\{[^}]*display:\s*none/);
  });

  it('não desenha o SVG por conta própria — quem desenha é o palco', () => {
    // Regressão do princípio nº1: enquanto esta tela injetava o canônico com `innerHTML`,
    // havia dois lugares desenhando o calçado, e só um deles passava por
    // `gerarVarianteDeCor`. O componente agora recebe o palco pronto e não conhece SVG.
    // Tira os comentários antes de olhar: o cabeçalho do arquivo cita `innerHTML` justamente
    // para contar por que ele saiu daqui. Isentar o arquivo inteiro seria mais fácil e
    // esvaziaria a guarda — o que interessa é o código, não a explicação.
    const fonte = readFileSync(new URL('./VisualizacaoDoProduto.tsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*$/gm, ' ');

    expect(fonte).not.toContain('innerHTML');
  });

  it('sempre oferece a volta para a lista', () => {
    expect(ver({ estado: 'erro', erro: 'x' })).toContain('Modelos');
  });
});
