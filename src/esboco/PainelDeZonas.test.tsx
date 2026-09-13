// O esboço é a tela que funciona num clone recém-baixado, sem conta e sem `.env.local`, então é a
// primeira que alguém abre e a primeira que alguém copia. O que estava atrás do editor de verdade
// aqui não estava: a zona escolhida existia só na cor da borda, os dois campos de cor não tinham
// nome, e hex incompleto mudava só a classe CSS, sem uma palavra dizendo o que ela quer (R2-A20).

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PainelDeZonas } from './PainelDeZonas';
import { paletaDeAtalho } from './produtoDemo';
import type { ZonaDoProduto } from './produtoDemo';

const ZONAS: ZonaDoProduto[] = [
  { zone_key: 'sola', rotulo: 'Sola', svg_selector: '#sola' } as ZonaDoProduto,
  { zone_key: 'cabedal', rotulo: 'Cabedal', svg_selector: '#cabedal' } as ZonaDoProduto,
];

function painel(props: Partial<Parameters<typeof PainelDeZonas>[0]> = {}) {
  return renderToStaticMarkup(
    <PainelDeZonas
      zonas={ZONAS}
      elementosPorZona={{ sola: 1, cabedal: 4 }}
      cores={{ sola: '#AABBCC', cabedal: '#112233' }}
      zonaSelecionada={null}
      aoSelecionar={() => {}}
      aoTrocarCor={() => {}}
      {...props}
    />,
  );
}

/** O botão de uma zona isolado, para afirmar sobre ele sem depender do resto do HTML. */
function botaoDaZona(html: string, zoneKey: string): string {
  const trecho = new RegExp(`<button[^>]*>(?:(?!</button>).)*${zoneKey}(?:(?!</button>).)*`, 's');
  const achado = trecho.exec(html)?.[0];

  if (achado === undefined) throw new Error(`botão da zona ${zoneKey} não encontrado`);

  return achado;
}

describe('painel de zonas do esboço', () => {
  it('a zona escolhida é anunciada, não só colorida', () => {
    const html = painel({ zonaSelecionada: 'cabedal' });

    expect(botaoDaZona(html, 'Cabedal')).toContain('aria-pressed="true"');
    expect(botaoDaZona(html, 'Sola')).toContain('aria-pressed="false"');
  });

  it('os dois campos de cor dizem de qual zona são', () => {
    // Sem rótulo, a árvore de acessibilidade mostrava dois campos cujo nome era o próprio valor
    // ("#AABBCC"), e com nove zonas na tela nada distinguia um do outro.
    const html = painel({ zonaSelecionada: 'sola' });

    expect(html).toContain('aria-label="cor da zona sola"');
    expect(html).toContain('aria-label="hex da zona sola"');
  });

  it('hex completo não acusa nada', () => {
    const html = painel({ zonaSelecionada: 'sola', cores: { sola: '#AABBCC' } });

    expect(html).toContain('aria-invalid="false"');
    expect(html).not.toContain('Cor incompleta');
  });

  it('hex incompleto é dito em palavras, e não só numa borda vermelha', () => {
    const html = painel({ zonaSelecionada: 'sola', cores: { sola: '#AAB' + 'B' } });

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Cor incompleta');
    // Ligado ao campo: é o que faz o texto ser lido quando o foco chega nele.
    expect(html).toContain('aria-describedby="esboco-hex-erro-sola"');
    expect(html).toContain('id="esboco-hex-erro-sola"');
  });

  it('o erro do hex não interrompe quem está digitando', () => {
    // Mesma decisão do editor de verdade: alerta a cada tecla ensina o time a ignorar alerta
    // justo onde ele custa caro.
    const html = painel({ zonaSelecionada: 'sola', cores: { sola: '#AABB' } });

    expect(html).toContain('Cor incompleta');
    expect(html).not.toContain('role="alert"');
  });
  it('o que nunca vira cor não é chamado de incompleto (R9-A70)', () => {
    // Antes o esboço tinha uma frase só, "Cor incompleta", para qualquer recusa. A tela da
    // composição já separava as duas notícias; agora as duas telas usam a mesma frase.
    const html = painel({ zonaSelecionada: 'sola', cores: { sola: 'vermelho' } });

    expect(html).toContain('Isso não é um hex.');
    expect(html).not.toContain('Cor incompleta');
  });

  it('hex sem # diz que falta o #, com a cor já escrita do jeito certo (R9-A70)', () => {
    const html = painel({ zonaSelecionada: 'sola', cores: { sola: '22aa44' } });

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Falta o # no começo. Escreva #22aa44.');
    expect(html).not.toContain('Cor incompleta');
  });

  it('o rascunho do esboço fala do preview, e não da peça', () => {
    expect(painel({ zonaSelecionada: 'sola', cores: { sola: '#AABB' } })).toContain(
      'e o preview só muda quando ela fecha',
    );
  });

  it('cada atalho de cor diz que cor é, e não só o hex', () => {
    // Antes o único texto do botão era `title="#B23A2E"`, que vira nome acessível de último
    // recurso: o leitor de tela soletrava o hex e o mouse não via legenda nenhuma. O hex fica,
    // porque é o que a marca tem no manual dela e o que vai no corpo do POST, mas acompanhado.
    const html = painel({ zonaSelecionada: 'sola' });

    for (const atalho of paletaDeAtalho) {
      expect(html).toContain(`aria-label="${atalho.nome} (${atalho.hex})"`);
      expect(html).toContain(`title="${atalho.nome} (${atalho.hex})"`);
    }
  });

  it('nenhum atalho fica sem nome, e não há dois com o mesmo', () => {
    // Dois atalhos com o mesmo nome são dois botões que ninguém consegue distinguir de ouvido.
    const nomes = paletaDeAtalho.map((atalho) => atalho.nome);

    expect(nomes.every((nome) => nome.length > 0)).toBe(true);
    expect(new Set(nomes).size).toBe(paletaDeAtalho.length);
  });
});
