// Prende o CONTRATO que este painel mostra, e não a sua aparência.
//
// Por que ele existe: `PainelDaApi.tsx` exibiu por semanas um contrato que nunca foi
// decidido, rota `POST /api/produtos/:id/variantes`, corpo `{zone_colors, format}` e um
// sucesso envelopado com `variante_id` e `svg_url`. Nada reclamou: a suíte estava verde, o
// esboço abria, e a única forma de descobrir era alguém comparar a tela com
// `docs/07_APIS/endpoints.md` linha a linha. Este arquivo é essa comparação, automatizada.
// Se o contrato do doc mudar, é aqui que a divergência aparece primeiro.
//
// `renderToStaticMarkup` em vez de testing-library, como em `ComparativoDeNormalizacao.test.tsx`:
// o que precisa ser verificado é texto que sai no HTML, e isso não paga uma dependência nova.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PainelDaApi } from './PainelDaApi';
import { ErroDeVariante } from '../lib/render/erros';
import type { RelatorioDeNormalizacao } from '../lib/render/normalizarSvg';

const relatorioVazio: RelatorioDeNormalizacao = {
  idsRenomeados: [],
  idsAtribuidos: [],
  declaracoesAchatadas: 0,
  scriptsRemovidos: 0,
  handlersRemovidos: 0,
  referenciasExternasRemovidas: 0,
};

const cores = { sola: '#2E2E33', cabedal: '#2B4C7E' };

/**
 * Devolve o texto de um dos blocos `<pre>` do painel, já sem tags e com as entidades
 * desfeitas, `renderToStaticMarkup` escapa as aspas do JSON como `&quot;`, e asserção
 * sobre `&quot;error&quot;` não se parece com o contrato que a pessoa quer conferir.
 *
 * Tag some antes das entidades: assim `&lt;svg` vira `<svg` sem ser confundido com marcação.
 */
function blocoDe(markup: string, classe: string): string {
  const achado = markup.match(new RegExp(`<pre class="[^"]*${classe}[^"]*">([\\s\\S]*?)</pre>`));
  if (!achado) throw new Error(`Bloco <pre> com a classe "${classe}" não está na tela.`);
  return (achado[1] as string)
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function renderizar(erro: ErroDeVariante | null): string {
  return renderToStaticMarkup(
    <PainelDaApi cores={cores} relatorio={relatorioVazio} erro={erro} />,
  );
}

describe('painel da API, a requisição mostrada', () => {
  const requisicao = () => blocoDe(renderizar(null), 'codigo--requisicao');

  it('mostra a rota do contrato: POST /api/v1/products/:productId/variants', () => {
    expect(requisicao()).toContain('POST /api/v1/products/');
    expect(requisicao()).toContain('/variants');
  });

  it('não ressuscita a rota em português que nunca foi decidida', () => {
    // `produtos`/`variantes` é a rota do esboço antigo. O path é em inglês porque o corpo
    // já é em inglês sob `zone_key` (endpoints.md, "A rota").
    expect(requisicao()).not.toContain('produtos');
    expect(requisicao()).not.toContain('variantes');
  });

  it('manda a chave no header Authorization: Bearer, nunca na query string', () => {
    // Chave em query string é 401 CHAVE_AUSENTE antes mesmo de o header ser olhado.
    expect(requisicao()).toContain('Authorization: Bearer kora_live_');
    expect(requisicao()).not.toContain('api_key=');
  });

  it('põe as cores no TOPO do corpo, sem zone_colors nem format', () => {
    // O topo do corpo é o espaço de nomes das `zone_key` do tenant: campo nosso ali
    // colidiria com uma zona de mesmo nome, e a colisão sairia como cor não aplicada.
    expect(requisicao()).toContain('"sola": "#2E2E33"');
    expect(requisicao()).toContain('"cabedal": "#2B4C7E"');
    expect(requisicao()).not.toContain('zone_colors');
    expect(requisicao()).not.toContain('format');
  });
});

describe('painel da API, sucesso é o artefato, não o envelope', () => {
  const sucesso = () => blocoDe(renderizar(null), 'codigo--ok');

  it('mostra o corpo do 200 como SVG cru, com o Content-Type de SVG', () => {
    expect(sucesso()).toContain('200 OK');
    expect(sucesso()).toContain('Content-Type: image/svg+xml');
    expect(sucesso()).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
  });

  it('não envelopa o sucesso nem inventa variante_id / svg_url', () => {
    // O envelope no 200 é a forma morta: ele exigiria escapar um documento inteiro para
    // dentro de uma string JSON, e o round-trip muda o desenho em silêncio.
    expect(sucesso()).not.toContain('variante_id');
    expect(sucesso()).not.toContain('svg_url');
    expect(sucesso()).not.toContain('"data"');
  });
});

describe('painel da API, erro é o envelope de respostaDaApi.ts', () => {
  const envelope = (erro: ErroDeVariante) => blocoDe(renderizar(erro), 'codigo--erro');

  it('usa "error" aninhado com code e message, nunca a chave plana "erro"', () => {
    const texto = envelope(new ErroDeVariante('COR_INVALIDA', 'Cor inválida na zona "sola".'));

    expect(texto).toContain('"data": null');
    expect(texto).toContain('"error": {');
    expect(texto).toContain('"code": "COR_INVALIDA"');
    expect(texto).toContain('"message"');
    expect(texto).toContain('"version": "1"');
    // `erro` plano era a forma antiga de `autenticacao.md`. Duas formas de erro na mesma
    // API é o cliente parseando uma das duas errado.
    expect(texto).not.toContain('"erro"');
  });

  it('o status vem da família do código, não de um 422 fixo', () => {
    // 422 é "corrija o pedido"; 409 é "o pedido está certo, o dado do tenant é que não".
    // O painel mostrava 422 para tudo, inclusive para a zona de gradiente do produto demo.
    const pedido = envelope(new ErroDeVariante('COR_INVALIDA', 'Cor inválida.'));
    expect(pedido).toContain('422 Unprocessable Entity');

    const doTenant = envelope(new ErroDeVariante('ZONA_NAO_RECOLORIVEL', 'Gradiente.'));
    expect(doTenant).toContain('409 Conflict');
    expect(doTenant).toContain('dado do tenant');
  });
});

describe('painel da API, o que já funcionava continua', () => {
  it('mostra o relatório de normalização, inclusive os ids cunhados', () => {
    const markup = renderToStaticMarkup(
      <PainelDaApi
        cores={cores}
        relatorio={{ ...relatorioVazio, scriptsRemovidos: 1, idsAtribuidos: ['elemento-1'] }}
        erro={null}
      />,
    );

    expect(markup).toContain('Blocos &lt;script&gt; removidos');
    expect(markup).toContain('Ids atribuídos a elemento sem id');
  });
});
