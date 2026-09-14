// A FORMA do pedido ao Storage é o que este arquivo protege, e por dois motivos que não são
// o de sempre. Primeiro: aqui não há RLS. Com `service_role`, um `path` alterado, por
// prefixo, sufixo ou "normalização" bem-intencionada, não dá erro; entrega outro objeto,
// possivelmente de outra marca. Segundo: o refactor que reintroduziria URL assinada parece
// uma unificação com `src/features/produtos/baixarAssetBase.ts` e é o contrário disso, então
// a proibição é lida do próprio fonte em vez de confiada a um comentário.
//
// Sem rede: cliente Supabase falso montado à mão, no molde de
// `src/features/zonas/gravarZonaNoBanco.test.ts`.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { baixarAssetBaseComServiceRole } from './baixarAssetBaseComServiceRole';
import { traduzirParaFalhaDaApi } from './traduzirParaFalhaDaApi';

/** O `tenant_id` está DENTRO do caminho, é por isso que o caminho não pode ir na resposta. */
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const CAMINHO = `tenants/${TENANT_ID}/products/p-1/base.svg`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><path id="sola" fill="#000"/></svg>';

interface PedidoObservado {
  bucket: string;
  path: string;
  chamadas: number;
}

function clienteFalso(resposta: { data?: unknown; error?: unknown }) {
  const pedido: PedidoObservado = { bucket: '', path: '', chamadas: 0 };

  const cliente = {
    storage: {
      from(bucket: string) {
        pedido.bucket = bucket;
        return {
          download(path: string) {
            pedido.chamadas += 1;
            pedido.path = path;
            return Promise.resolve({
              data: resposta.data ?? null,
              error: resposta.error ?? null,
            });
          },
        };
      },
    },
  } as unknown as SupabaseClient;

  return { cliente, pedido };
}

function blobDe(texto: string): Blob {
  return new Blob([texto], { type: 'image/svg+xml' });
}

async function capturarFalha(acao: () => Promise<unknown>): Promise<Error> {
  try {
    await acao();
  } catch (falha: unknown) {
    return falha instanceof Error ? falha : new Error(String(falha));
  }
  throw new Error('A chamada deveria ter falhado e não falhou.');
}

describe('a forma do pedido ao Storage', () => {
  it('baixa do bucket `assets-base`, com o path exatamente como veio do banco', async () => {
    const { cliente, pedido } = clienteFalso({ data: blobDe(SVG) });
    await baixarAssetBaseComServiceRole(cliente, CAMINHO);

    expect(pedido.bucket).toBe('assets-base');
    expect(pedido.path).toBe(CAMINHO);
    expect(pedido.chamadas).toBe(1);
  });

  it('não prefixa, não sufixa e não normaliza o path', async () => {
    // Uma barra dupla no meio é outro objeto para o Storage. "Arrumar" o caminho aqui faria
    // a API baixar um arquivo que não é o que `products.base_asset_path` aponta, e sem RLS
    // não existe segunda barreira para reclamar disso.
    const torto = `tenants/${TENANT_ID}/products/p-1//base.svg`;
    const { cliente, pedido } = clienteFalso({ data: blobDe(SVG) });
    await baixarAssetBaseComServiceRole(cliente, torto);

    expect(pedido.path).toBe(torto);
  });

  it('devolve o texto do Blob, igualzinho', async () => {
    const { cliente } = clienteFalso({ data: blobDe(SVG) });
    expect(await baixarAssetBaseComServiceRole(cliente, CAMINHO)).toBe(SVG);
  });
});

describe('guarda de fonte: a URL assinada não pode voltar', () => {
  it('o fonte baixa direto, não assina nem publica URL', async () => {
    // Assinar é um passo de rede que só existe para entregar o arquivo a um navegador sem
    // chave. Aqui geraria um link temporário para o asset de um cliente e o mandaria para
    // fora do processo, e é o refactor plausível, porque o módulo do front faz assim.
    const fonte = readFileSync(
      new URL('./baixarAssetBaseComServiceRole.ts', import.meta.url),
      'utf8',
    );

    expect(fonte).toContain('.download(');
    expect(fonte).not.toContain('createSignedUrl');
    expect(fonte).not.toContain('getPublicUrl');
  });
});

describe('caminho impossível é recusado antes de tocar o Storage', () => {
  // Decisão do ponto 3 do contrato: SIM, o path é conferido mesmo vindo do banco. A coluna é
  // `text not null` sem CHECK, e sob `service_role` a policy do bucket não é consultada,
  // este é o último ponto que olha o valor. Só o que não depende da convenção de caminho é
  // recusado; exigir o prefixo `tenants/` seria remontar a convenção aqui.
  const impossiveis: Array<[string, string, RegExp]> = [
    ['string em branco', '   ', /base_asset_path/],
    ['barra inicial', `/tenants/${TENANT_ID}/products/p-1/base.svg`, /começa com/],
    ['segmento ..', `tenants/${TENANT_ID}/products/../../outra/base.svg`, /segmento/],
  ];

  for (const [nome, caminho, esperado] of impossiveis) {
    it(`${nome} não vira download`, async () => {
      const { cliente, pedido } = clienteFalso({ data: blobDe(SVG) });
      const falha = await capturarFalha(() => baixarAssetBaseComServiceRole(cliente, caminho));

      expect(falha.message).toMatch(esperado);
      expect(pedido.chamadas).toBe(0);
    });
  }
});

describe('falhas do Storage', () => {
  it('erro do Storage falha alto, nunca devolve string vazia', async () => {
    // SVG vazio seguiria adiante e o motor culparia o mapeamento de zonas, que está certo:
    // o que houve foi o arquivo não ter descido.
    const { cliente } = clienteFalso({ error: { message: 'Object not found', status: 404 } });
    const falha = await capturarFalha(() => baixarAssetBaseComServiceRole(cliente, CAMINHO));

    expect(falha.message).toContain('404');
    expect(falha.message).toContain('Object not found');
    expect(falha.message).not.toBe('');
  });

  it('`data` nulo com `error` nulo não estoura TypeError', async () => {
    const { cliente } = clienteFalso({});
    const falha = await capturarFalha(() => baixarAssetBaseComServiceRole(cliente, CAMINHO));

    expect(falha).not.toBeInstanceOf(TypeError);
    expect(falha.message).toMatch(/não devolveu conteúdo nem erro/);
  });

  it('arquivo de 0 byte tem mensagem própria, não vira SVG_INVALIDO lá na frente', async () => {
    // Decisão do ponto 6: 0 byte é escrita quebrada, não conteúdo quebrado. Deixado passar,
    // viraria `SVG_INVALIDO` 409, cuja mensagem manda a marca corrigir o arquivo base "no
    // editor de zonas", e o editor não sobe asset. Este é o único ponto do fluxo que sabe
    // que o arquivo estava vazio.
    const { cliente } = clienteFalso({ data: blobDe('') });
    const falha = await capturarFalha(() => baixarAssetBaseComServiceRole(cliente, CAMINHO));

    expect(falha.message).toMatch(/vazio/);
    expect(falha.message).toMatch(/Reprovisione/);
  });
});

describe('o caminho vai para o log e nunca para a resposta do integrador', () => {
  // Decisão do ponto 7: o `path` é caminho interno e ajuda quem depura, então entra na
  // mensagem do `Error`. Só que ele contém o `tenant_id`, e a resposta é lida pelo sistema de
  // OUTRA marca, então nenhuma destas falhas vira `FalhaDaApi` aqui: quem traduz é
  // `traduzirParaFalhaDaApi`, cuja mensagem de `FALHA_INTERNA` é fixa. É a tradução AUSENTE
  // que impede o vazamento, e por isso ela é testada em vez de só comentada.
  const falhasPossiveis: Array<[string, { data?: unknown; error?: unknown }]> = [
    ['erro do Storage', { error: { message: 'Object not found', status: 404 } }],
    ['data e error nulos', {}],
    ['arquivo vazio', { data: blobDe('') }],
  ];

  for (const [nome, resposta] of falhasPossiveis) {
    it(`${nome}: a mensagem nomeia o path para nós, e o 500 não o repassa`, async () => {
      const { cliente } = clienteFalso(resposta);
      const falha = await capturarFalha(() => baixarAssetBaseComServiceRole(cliente, CAMINHO));

      expect(falha.message).toContain(CAMINHO);

      const resposta500 = traduzirParaFalhaDaApi(falha);
      expect(resposta500.codigo).toBe('FALHA_INTERNA');
      expect(resposta500.status).toBe(500);
      expect(resposta500.message).not.toContain(TENANT_ID);
      expect(resposta500.message).not.toContain(CAMINHO);
    });
  }

  it('nenhuma falha sai daqui já traduzida, o status tem um dono só', async () => {
    // Traduzir aqui exigiria mensagem própria no 500, e a mensagem própria é justamente por
    // onde o `tenant_id` sairia no envelope JSON.
    const { cliente } = clienteFalso({ error: { message: 'Object not found', status: 404 } });
    const falha = await capturarFalha(() => baixarAssetBaseComServiceRole(cliente, CAMINHO));

    expect(falha.name).toBe('Error');
    expect(falha.message).not.toContain('service_role');
  });
});
