// O que estes testes protegem: que a chave de API nunca chegue ao log.
//
// É o defeito mais caro possível neste módulo, credencial em texto puro, num arquivo que
// muita gente lê e que fica guardado por meses, e é também o mais fácil de introduzir sem
// perceber, porque nada quebra quando acontece. Por isso os testes não se limitam ao uso
// correto: eles exercitam o **uso errado** (a chave inteira passada no campo do prefixo, a
// chave em query string na rota) e exigem que mesmo assim nada vaze.

import { describe, expect, it } from 'vitest';
import { gerarChaveDeApi } from './formatoDaChaveDeApi';
import { logDaRequisicao } from './logDaRequisicao';

/** Coletor no lugar do console: o teste lê a linha sem espionar global nenhum. */
function coletor() {
  const linhas: Array<{ linha: string; ehErro: boolean }> = [];
  return {
    linhas,
    escrever: (linha: string, ehErro: boolean) => linhas.push({ linha, ehErro }),
    ultima: () => linhas[linhas.length - 1]?.linha ?? '',
  };
}

const ROTA = '/api/v1/products/a3f1c2d4-5e6b-4a7c-8d9e-0f1a2b3c4d5e/variants';

describe('logDaRequisicao, o que a linha precisa dizer para servir a quem depura', () => {
  it('traz método, rota, status, duração e prefixo em pares chave=valor', () => {
    const saida = coletor();

    logDaRequisicao(
      { metodo: 'POST', rota: ROTA, status: 200, duracaoMs: 42, prefixoDaChave: '7f3ab902' },
      saida.escrever,
    );

    expect(saida.linhas).toHaveLength(1);
    expect(saida.ultima()).toBe(
      `metodo=POST rota=${ROTA} status=200 duracao_ms=42 prefixo=7f3ab902`,
    );
    // 200 não é erro: não pode poluir o canal de erro, ou o alarme perde valor.
    expect(saida.linhas[0]?.ehErro).toBe(false);
  });

  it('o erro aparece com o código, e vai para o canal de erro', () => {
    const saida = coletor();

    logDaRequisicao(
      {
        metodo: 'POST',
        rota: ROTA,
        status: 401,
        duracaoMs: 3,
        prefixoDaChave: '7f3ab902',
        codigoDeErro: 'CHAVE_INVALIDA',
      },
      saida.escrever,
    );

    expect(saida.ultima()).toContain('codigo=CHAVE_INVALIDA');
    expect(saida.ultima()).toContain('status=401');
    expect(saida.linhas[0]?.ehErro).toBe(true);
  });

  it('sem código de erro, o campo `codigo` não aparece vazio', () => {
    const saida = coletor();
    logDaRequisicao({ metodo: 'POST', rota: ROTA, status: 200, duracaoMs: 1 }, saida.escrever);
    expect(saida.ultima()).not.toContain('codigo=');
  });

  it('escreve uma linha só, log multilinha faz grep devolver fragmento sem contexto', () => {
    const saida = coletor();
    logDaRequisicao({ metodo: 'POST', rota: ROTA, status: 500, duracaoMs: 9 }, saida.escrever);
    expect(saida.ultima()).not.toContain('\n');
  });
});

describe('a chave nunca chega ao log, nem quando quem chama erra', () => {
  it('a chave inteira passada no campo do prefixo não vaza nada dela', () => {
    const saida = coletor();
    const gerada = gerarChaveDeApi('live');

    // O erro que este módulo existe para tornar impossível: alguém depurando um 401 passa a
    // chave inteira onde só cabia o prefixo.
    logDaRequisicao(
      { metodo: 'POST', rota: ROTA, status: 401, duracaoMs: 2, prefixoDaChave: gerada.chave },
      saida.escrever,
    );

    const linha = saida.ultima();
    expect(linha).not.toContain(gerada.chave);
    // O segredo é a parte que autentica: nem ele, nem o hash dele, podem aparecer.
    expect(linha).not.toContain(gerada.chave.split('_').slice(3).join('_'));
    expect(linha).not.toContain(gerada.hash);
    expect(linha).toContain('prefixo=invalido');
  });

  it('valor recusado nunca é ecoado na linha, nem em pedaço', () => {
    const saida = coletor();
    logDaRequisicao(
      {
        metodo: 'POST',
        rota: ROTA,
        status: 401,
        duracaoMs: 2,
        prefixoDaChave: 'SEGREDOemCLARO',
      },
      saida.escrever,
    );
    expect(saida.ultima()).not.toContain('SEGREDO');
  });

  it('chave em query string não entra na linha, a URL é o vazamento clássico', () => {
    const saida = coletor();
    const gerada = gerarChaveDeApi('live');

    // O contrato recusa chave em query string (401 CHAVE_AUSENTE) justamente porque URL vai
    // parar em log. Logar a URL inteira desfaria a proteção pela porta dos fundos.
    logDaRequisicao(
      { metodo: 'POST', rota: `${ROTA}?api_key=${gerada.chave}`, status: 401, duracaoMs: 1 },
      saida.escrever,
    );

    expect(saida.ultima()).not.toContain(gerada.chave);
    expect(saida.ultima()).not.toContain('api_key');
    expect(saida.ultima()).toContain(`rota=${ROTA} `);
  });

  it('requisição sem chave nenhuma loga normalmente, com prefixo=ausente', () => {
    const saida = coletor();

    for (const semChave of [undefined, null, '']) {
      logDaRequisicao(
        { metodo: 'GET', rota: ROTA, status: 405, duracaoMs: 0, prefixoDaChave: semChave },
        saida.escrever,
      );
      expect(saida.ultima()).toContain('prefixo=ausente');
    }

    expect(saida.linhas).toHaveLength(3);
  });

  it('canário: o prefixo de uma chave real passa pelo filtro', () => {
    // Sem isto, uma mudança no formato do prefixo faria o log dizer `invalido` para toda
    // requisição, silenciosamente, e justo no campo que existe para achar a chave no
    // suporte. O canário quebra em vez de deixar o log emudecer.
    const saida = coletor();
    const gerada = gerarChaveDeApi('test');

    logDaRequisicao(
      { metodo: 'POST', rota: ROTA, status: 200, duracaoMs: 5, prefixoDaChave: gerada.prefixo },
      saida.escrever,
    );

    expect(saida.ultima()).toContain(`prefixo=${gerada.prefixo}`);
  });
});

describe('a linha não pode ser forjada por quem chama', () => {
  /** Os campos reais da linha são os pedaços separados por espaço, nada mais é campo. */
  const campos = (linha: string, nome: string) =>
    linha.split(' ').filter((campo) => campo.startsWith(`${nome}=`));

  it('quebra de linha na rota não vira uma segunda linha nem um status falso', () => {
    const saida = coletor();

    // Sem higiene, um caminho com `\n` deixaria o chamador inventar um `status=200` logo
    // abaixo do 401 dele, e o log deixaria de ser prova de qualquer coisa.
    logDaRequisicao(
      {
        metodo: 'POST',
        rota: '/api/v1/products/x/variants\nmetodo=POST status=200 prefixo=7f3ab902',
        status: 401,
        duracaoMs: 1,
      },
      saida.escrever,
    );

    expect(saida.linhas).toHaveLength(1);
    expect(saida.ultima()).not.toContain('\n');
    // Um único `status`, e é o nosso. O texto injetado sobra colado dentro de `rota=`.
    expect(campos(saida.ultima(), 'status')).toEqual(['status=401']);
    expect(campos(saida.ultima(), 'prefixo')).toEqual(['prefixo=ausente']);
  });

  it('espaço na rota não cria par chave=valor falso', () => {
    const saida = coletor();
    logDaRequisicao(
      { metodo: 'POST', rota: '/api/v1 status=200', status: 500, duracaoMs: 1 },
      saida.escrever,
    );
    expect(campos(saida.ultima(), 'status')).toEqual(['status=500']);
    expect(campos(saida.ultima(), 'rota')).toEqual(['rota=/api/v1status=200']);
  });
});
