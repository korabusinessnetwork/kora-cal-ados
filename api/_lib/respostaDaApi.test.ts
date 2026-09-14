// O que estes testes protegem: que o corpo do 200 seja o SVG **intocado**, e que o corpo do
// erro seja exatamente o envelope do contrato.
//
// O primeiro é o teste mais importante do arquivo, e não é sobre HTTP: qualquer
// transformação entre a saída do motor e o byte que o cliente grava em disco é mudança
// silenciosa do desenho, que vira calçado errado fabricado (princípio nº1). Um envelope
// acrescentado "por consistência" seis meses depois quebra aqui, alto, em vez de quebrar na
// linha de produção do cliente.

import { describe, expect, it } from 'vitest';
import { VERSAO_DO_ENVELOPE, respostaDeErro, respostaDeSucesso } from './respostaDaApi';
import { FalhaDaApi } from './tiposDaApi';

// De propósito cheio do que um round-trip por JSON estragaria: acento, caractere fora do
// BMP latino, aspas, entidade XML, quebra de linha e um `<text>` com conteúdo.
const SVG_DIFICIL =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">\n' +
  '  <path id="sola" fill="#C0392B" d="M0 0 L10 10"/>\n' +
  '  <text x="1" y="2">Coleção, cabedal &amp; solado ção 中文 "aspas"</text>\n' +
  '</svg>\n';

describe('respostaDeSucesso, o SVG sai cru, e é o princípio nº1 que está em jogo', () => {
  it('devolve 200 com o SVG byte a byte igual ao que entrou', async () => {
    const resposta = respostaDeSucesso(SVG_DIFICIL);

    expect(resposta.status).toBe(200);
    expect(await resposta.text()).toBe(SVG_DIFICIL);
  });

  it('os bytes do corpo são o UTF-8 do SVG, sem BOM e sem reencode', async () => {
    const bytes = new Uint8Array(await respostaDeSucesso(SVG_DIFICIL).arrayBuffer());
    expect(bytes).toEqual(new TextEncoder().encode(SVG_DIFICIL));
  });

  it('não envelopa: o corpo não começa com `{` nem contém `"data"`', async () => {
    const corpo = await respostaDeSucesso(SVG_DIFICIL).text();
    expect(corpo.startsWith('<svg')).toBe(true);
    expect(corpo).not.toContain('"data"');
  });

  it('declara image/svg+xml e no-store', () => {
    const resposta = respostaDeSucesso(SVG_DIFICIL);
    expect(resposta.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    // Sem isto, um CDN no meio do caminho serve variante velha depois de a zona ser
    // remarcada, o mesmo calçado errado, num lugar onde ninguém olha.
    expect(resposta.headers.get('cache-control')).toBe('no-store');
  });
});

describe('respostaDeErro, o envelope do contrato, e só ele', () => {
  const RELOGIO_FIXO = () => new Date('2026-09-08T10:30:00.000Z');

  it('usa o status da falha e devolve JSON parseável', async () => {
    const resposta = respostaDeErro(
      new FalhaDaApi('CHAVE_AUSENTE', 401, 'Envie a chave de API em Authorization: Bearer.'),
      RELOGIO_FIXO,
    );

    expect(resposta.status).toBe(401);
    expect(resposta.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(resposta.headers.get('cache-control')).toBe('no-store');
    // Se o corpo não for parseável, o cliente não tem como descobrir o que fazer.
    expect(JSON.parse(await resposta.text())).toBeTypeOf('object');
  });

  it('tem exatamente as chaves do contrato, e `data` é null', async () => {
    const resposta = respostaDeErro(
      new FalhaDaApi('COR_INVALIDA', 422, 'Cor "vermelho" da zona "sola" não é um hex válido.'),
      RELOGIO_FIXO,
    );
    const corpo = JSON.parse(await resposta.text());

    expect(Object.keys(corpo).sort()).toEqual(['data', 'error', 'meta']);
    expect(Object.keys(corpo.error).sort()).toEqual(['code', 'message']);
    expect(Object.keys(corpo.meta).sort()).toEqual(['timestamp', 'version']);
    expect(corpo.data).toBeNull();
    expect(corpo.error.code).toBe('COR_INVALIDA');
    expect(corpo.error.message).toBe('Cor "vermelho" da zona "sola" não é um hex válido.');
    expect(corpo.meta.version).toBe(VERSAO_DO_ENVELOPE);
    // `erro` plano foi a forma antiga; duas formas de erro na mesma API é o cliente
    // parseando uma das duas errado.
    expect(corpo).not.toHaveProperty('erro');
  });

  it('o timestamp é o ISO-8601 do relógio recebido, não o do host', async () => {
    const resposta = respostaDeErro(
      new FalhaDaApi('FALHA_INTERNA', 500, 'Falha interna.'),
      RELOGIO_FIXO,
    );
    expect(JSON.parse(await resposta.text()).meta.timestamp).toBe('2026-09-08T10:30:00.000Z');
  });

  it('os cabeçalhos que a falha carrega chegam na resposta (Allow: POST no 405)', () => {
    const resposta = respostaDeErro(
      new FalhaDaApi('METODO_NAO_PERMITIDO', 405, 'Use POST.', { Allow: 'POST' }),
      RELOGIO_FIXO,
    );

    expect(resposta.status).toBe(405);
    // 405 sem `Allow` é o detalhe de que nenhum teste sente falta e que cliente HTTP bem
    // escrito usa para se corrigir sozinho.
    expect(resposta.headers.get('allow')).toBe('POST');
  });

  it('cabeçalho da falha não sobrescreve o Content-Type do envelope', () => {
    const resposta = respostaDeErro(
      new FalhaDaApi('FALHA_INTERNA', 500, 'Falha interna.', { 'Content-Type': 'text/html' }),
      RELOGIO_FIXO,
    );
    expect(resposta.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  it('sem relógio explícito, o timestamp continua ISO-8601 válido', async () => {
    const corpo = JSON.parse(
      await respostaDeErro(new FalhaDaApi('CORPO_INVALIDO', 400, 'Corpo inválido.')).text(),
    );
    expect(corpo.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
