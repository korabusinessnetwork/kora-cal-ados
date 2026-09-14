// Defeito achado na passada de navegador da Etapa 6 (BUG-016): com a rede indisponível, a
// tela de quem marca zona mostrava `Failed to fetch`, texto do navegador, em inglês, sem
// dizer o que fazer.
//
// O arquivo já tratava `!resposta.ok` com uma frase humana, e o comentário de lá dizia
// exatamente por quê. Só que `fetch` não devolve `!ok` quando a rede cai: ele **rejeita**.
// O caminho tratado era o menos provável dos dois.
//
// A regra que estes testes prendem: nada que o servidor ou o navegador escreveu chega à
// tela como frase principal. Detalhe técnico pode ir entre parênteses, depois de uma frase
// nossa que diga o que falhou, é o que separa "erro visível" de "erro acionável"
// (CLAUDE.md, princípio nº1: estados sempre visíveis, com feedback humano).

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { baixarAssetBase } from './baixarAssetBase';

const CAMINHO = 'tenants/t/products/p/base.svg';

/** Um cliente Supabase com só o que este módulo usa, sem rede, sem projeto. */
function clienteFalso(assinatura: {
  data?: { signedUrl: string };
  /** `status` só existe na recusa do SERVIDOR; a falha de rede vem sem ele. */
  error?: { message: string; status?: number };
}) {
  return {
    storage: {
      from: () => ({ createSignedUrl: async () => assinatura }),
    },
  } as unknown as SupabaseClient;
}

const assinaturaOk = { data: { signedUrl: 'https://exemplo.invalido/assinada' } };

async function mensagemDe(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa;
  } catch (falha) {
    return falha instanceof Error ? falha.message : String(falha);
  }
  throw new Error('esperava que falhasse, e não falhou');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('falha ao baixar o asset-base', () => {
  it('rede caída não mostra "Failed to fetch" na tela (BUG-016)', async () => {
    // É assim que o navegador reage a rede fora, DNS quebrado ou pedido bloqueado:
    // `fetch` rejeita com `TypeError`, e o `!resposta.ok` abaixo nunca roda.
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });

    const mensagem = await mensagemDe(baixarAssetBase(clienteFalso(assinaturaOk), CAMINHO));

    expect(mensagem).not.toContain('Failed to fetch');
    expect(mensagem).toContain('asset-base');
    // Erro sem próximo passo faz a pessoa recarregar a página inteira e perder o que marcou.
    expect(mensagem).toMatch(/tente de novo/i);
  });

  it('resposta com status de erro nomeia o status, sem inventar causa', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 403 }));

    expect(await mensagemDe(baixarAssetBase(clienteFalso(assinaturaOk), CAMINHO))).toContain('403');
  });

  it('recusa do servidor nomeia o status, e o texto em inglês fica no parêntese', async () => {
    // "Object not found" é escrito pelo servidor, no vocabulário dele: ajuda quem depura e
    // não serve como frase de tela. Sai da frase principal e vira detalhe.
    const mensagem = await mensagemDe(
      baixarAssetBase(clienteFalso({ error: { message: 'Object not found', status: 404 } }), CAMINHO),
    );

    expect(mensagem).toMatch(/^Não foi possível/);
    expect(mensagem).toContain('404');
    expect(mensagem).toContain('Object not found');
  });

  it('rede caída ANTES do fetch deste arquivo também não vaza inglês (BUG-016)', async () => {
    // A primeira correção do BUG-016 cobriu o `fetch` daqui, e no navegador a rede caiu
    // um passo antes, dentro do supabase-js, que devolveu `{ error }` com a mensagem do
    // navegador. Erro de rede não tem `status`; é assim que ele se distingue do servidor,
    // sem depender de comparar texto em inglês.
    const mensagem = await mensagemDe(
      baixarAssetBase(clienteFalso({ error: { message: 'Failed to fetch' } }), CAMINHO),
    );

    expect(mensagem).not.toContain('Failed to fetch');
    expect(mensagem).toMatch(/tente de novo/i);
  });

  it('produto sem asset-base gravado falha antes de pedir rede', async () => {
    // Sem este atalho, o caminho vazio viraria uma assinatura inútil e um erro de rede
    // genérico, culpando a rede por um dado que falta no banco.
    vi.stubGlobal('fetch', async () => {
      throw new Error('a rede não devia ter sido chamada');
    });

    expect(await mensagemDe(baixarAssetBase(clienteFalso(assinaturaOk), '   '))).toContain(
      'não tem asset-base gravado',
    );
  });

  it('arquivo vazio no bucket vira erro nomeado, nunca painel em branco', async () => {
    // O caso que este teste existe para prender: 200 com corpo vazio passava reto, o hook ia
    // para `pronto` com `svg` vazio, a tela revelava a área e o editor se recusava a montar.
    // Resultado: painel branco, sem erro e sem o botão de tentar de novo.
    vi.stubGlobal('fetch', async () => new Response(' \n \t ', { status: 200 }));

    const mensagem = await mensagemDe(baixarAssetBase(clienteFalso(assinaturaOk), CAMINHO));

    expect(mensagem).toContain('vazio');
    // Erro de dado, não de rede: mandar "tente de novo" aqui faria a pessoa insistir num arquivo
    // que não vai mudar sozinho.
    expect(mensagem).toMatch(/administra a marca/i);
  });

  it('arquivo que não é SVG vira erro nomeado', async () => {
    // Uma página de erro HTML guardada no lugar do desenho baixa com 200 e tem tamanho. Sem
    // olhar o conteúdo, ela chegaria ao editor como se fosse o calçado.
    vi.stubGlobal('fetch', async () => new Response('<html><body>404</body></html>', { status: 200 }));

    expect(await mensagemDe(baixarAssetBase(clienteFalso(assinaturaOk), CAMINHO))).toContain(
      'não é um SVG',
    );
  });

  it('SVG de verdade passa inteiro, byte a byte', async () => {
    // A outra metade da guarda: ela não pode apertar a ponto de recusar desenho bom, nem mexer
    // no texto. O editor é somente-leitura sobre o canônico (ADR-005).
    const desenho =
      '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"><path id="sola"/></svg>';
    vi.stubGlobal('fetch', async () => new Response(desenho, { status: 200 }));

    expect(await baixarAssetBase(clienteFalso(assinaturaOk), CAMINHO)).toBe(desenho);
  });
});
