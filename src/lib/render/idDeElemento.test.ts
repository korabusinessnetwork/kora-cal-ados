// A política de id existe para que TODO elemento pintável tenha um endereço estável.
// Sem ela o editor não marca zona em arquivo de cliente: export padrão de Illustrator
// manda path sem id, e sem id não existe seletor (ADR-005).
//
// Testa pela porta pública (`normalizarSvg`), que é o único caminho por onde a política
// roda de verdade.

import { describe, expect, it } from 'vitest';
import { analisarSvg } from './dom';
import { normalizarSvg } from './normalizarSvg';

const svg = (miolo: string) => `<svg xmlns="http://www.w3.org/2000/svg">${miolo}</svg>`;
const ids = (texto: string) =>
  [...analisarSvg(texto).querySelectorAll('[id]')].map((elemento) => elemento.getAttribute('id'));

describe('elemento anônimo vira endereçável (ADR-005)', () => {
  it('path sem id ganha id cunhado', () => {
    const { svg: canonico, relatorio } = normalizarSvg(svg('<path fill="#111111" d="M0 0"/>'));

    expect(relatorio.idsAtribuidos).toEqual(['elemento-1']);
    expect(ids(canonico)).toEqual(['elemento-1']);
  });

  it('id que o designer escreveu é preservado — só o anônimo é cunhado', () => {
    const { svg: canonico, relatorio } = normalizarSvg(
      svg('<path id="zona-sola" fill="#111111"/><path fill="#222222"/>'),
    );

    expect(ids(canonico)).toEqual(['zona-sola', 'elemento-1']);
    expect(relatorio.idsRenomeados).toEqual([]);
  });

  it('elemento com fill="none" também ganha id', () => {
    // Numeração presa à estrutura, não ao fill: se dependesse do fill, mudar a cor de um
    // elemento deslocaria o id de todos os seguintes e repointaria svg_selector já gravado.
    const { svg: canonico } = normalizarSvg(
      svg('<path fill="none" stroke="#000000"/><path fill="#111111"/>'),
    );

    expect(ids(canonico)).toEqual(['elemento-1', 'elemento-2']);
  });

  it('grupo <g> não é cunhado — zona endereça elemento pintável', () => {
    const { svg: canonico } = normalizarSvg(svg('<g><path fill="#111111"/></g>'));

    expect(ids(canonico)).toEqual(['elemento-1']);
  });

  it('não reusa um nome que o arquivo já tinha', () => {
    const { svg: canonico } = normalizarSvg(
      svg('<path id="elemento-1" fill="#111111"/><path fill="#222222"/>'),
    );

    expect(ids(canonico)).toEqual(['elemento-1', 'elemento-2']);
  });
});

describe('id sempre endereçável por seletor', () => {
  it('id com caractere que quebra "#id" é renomeado e reportado', () => {
    // `#zona.sola` seria lido como "id zona, classe sola" — endereço errado, calado.
    const { svg: canonico, relatorio } = normalizarSvg(svg('<path id="zona.sola" fill="#111111"/>'));

    expect(ids(canonico)).toEqual(['zona-sola']);
    expect(relatorio.idsRenomeados).toEqual([{ de: 'zona.sola', para: 'zona-sola' }]);
  });

  it('id começando com número ganha prefixo', () => {
    const { svg: canonico } = normalizarSvg(svg('<path id="2-sola" fill="#111111"/>'));

    expect(ids(canonico)).toEqual(['id-2-sola']);
  });

  it('id duplicado continua sendo desambiguado (BUG-002)', () => {
    const { svg: canonico, relatorio } = normalizarSvg(
      svg('<path id="zona-cadarco" fill="#111111"/><path id="zona-cadarco" fill="#111111"/>'),
    );

    expect(ids(canonico)).toEqual(['zona-cadarco', 'zona-cadarco-2']);
    expect(relatorio.idsRenomeados).toEqual([{ de: 'zona-cadarco', para: 'zona-cadarco-2' }]);
  });
});

// A idempotência COM elemento anônimo mora em `normalizarSvg.test.ts`, junto da
// idempotência geral — é a mesma afirmação, e duplicá-la aqui criaria dois lugares para
// consertar quando ela mudar.
