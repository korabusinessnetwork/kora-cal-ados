// A FORMA do pedido é o que este arquivo protege. Uma gravação de zona errada não dá
// erro na tela: ela sobrescreve em silêncio o mapeamento de um colega, e ninguém
// descobre até a API gerar a variante com a cor no lugar errado. Por isso os testes
// afirmam qual operação foi enviada, com quais campos e com quais filtros — não só o
// valor de retorno.
//
// Sem rede: cliente Supabase falso montado à mão, como em
// `src/features/produtos/listarProdutos.test.ts`.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { gravarZonaNoBanco } from './gravarZonaNoBanco';
import type { ZonaParaGravar } from './tiposDeZona';

interface PedidoObservado {
  tabela: string;
  operacao: 'insert' | 'update' | 'nenhuma';
  valores: Record<string, unknown> | null;
  filtros: Array<[string, string]>;
  campos: string;
}

function clienteFalso(resposta: { data?: unknown; error?: unknown }) {
  const pedido: PedidoObservado = {
    tabela: '',
    operacao: 'nenhuma',
    valores: null,
    filtros: [],
    campos: '',
  };
  const resultado = { data: resposta.data ?? null, error: resposta.error ?? null };

  const encadeador = {
    eq(coluna: string, valor: string) {
      pedido.filtros.push([coluna, valor]);
      return encadeador;
    },
    select(campos: string) {
      pedido.campos = campos;
      return { single: () => Promise.resolve(resultado) };
    },
  };

  const cliente = {
    from(tabela: string) {
      pedido.tabela = tabela;
      return {
        insert(valores: Record<string, unknown>) {
          pedido.operacao = 'insert';
          pedido.valores = valores;
          return encadeador;
        },
        update(valores: Record<string, unknown>) {
          pedido.operacao = 'update';
          pedido.valores = valores;
          return encadeador;
        },
      };
    },
  } as unknown as SupabaseClient;

  return { cliente, pedido };
}

const ZONA_NOVA: ZonaParaGravar = {
  zone_key: 'sola',
  svg_selector: '#sola-1, #sola-2',
  label: 'Sola',
  cor_default: '#C0392B',
  idExistente: null,
};

const ZONA_EXISTENTE: ZonaParaGravar = { ...ZONA_NOVA, idExistente: 'zona-1' };

const LINHA_GRAVADA = {
  id: 'zona-1',
  product_id: 'prod-1',
  tenant_id: 'tenant-1',
  zone_key: 'sola',
  svg_selector: '#sola-1, #sola-2',
  label: 'Sola',
  cor_default: '#C0392B',
};

async function capturarFalha(acao: () => Promise<unknown>): Promise<Error> {
  try {
    await acao();
  } catch (falha: unknown) {
    return falha instanceof Error ? falha : new Error(String(falha));
  }
  throw new Error('A chamada deveria ter falhado e não falhou.');
}

describe('gravar zona nova', () => {
  it('é INSERT, com tenant_id explícito', async () => {
    // `tenant_id` é `not null` e a RLS só decide se o INSERT passa — ela não preenche a
    // coluna. Sem este campo a gravação falha, ou pior, grava linha órfã.
    const { cliente, pedido } = clienteFalso({ data: LINHA_GRAVADA });
    await gravarZonaNoBanco(cliente, {
      tenantId: 'tenant-1',
      productId: 'prod-1',
      zona: ZONA_NOVA,
    });

    expect(pedido.tabela).toBe('product_zones');
    expect(pedido.operacao).toBe('insert');
    expect(pedido.valores).toEqual({
      product_id: 'prod-1',
      tenant_id: 'tenant-1',
      zone_key: 'sola',
      svg_selector: '#sola-1, #sola-2',
      label: 'Sola',
      cor_default: '#C0392B',
    });
  });

  it('pede campos explícitos de volta, nunca `*`', async () => {
    const { cliente, pedido } = clienteFalso({ data: LINHA_GRAVADA });
    await gravarZonaNoBanco(cliente, {
      tenantId: 'tenant-1',
      productId: 'prod-1',
      zona: ZONA_NOVA,
    });

    expect(pedido.campos).toBe(
      'id, product_id, tenant_id, zone_key, svg_selector, label, cor_default',
    );
    expect(pedido.campos).not.toContain('*');
  });

  it('devolve a linha gravada, com o id que o banco gerou', async () => {
    // Sem o id de volta, a próxima edição da mesma zona seria outro INSERT e bateria na
    // unique — a tela precisa saber que aquela zona agora existe.
    const { cliente } = clienteFalso({ data: LINHA_GRAVADA });
    const gravada = await gravarZonaNoBanco(cliente, {
      tenantId: 'tenant-1',
      productId: 'prod-1',
      zona: ZONA_NOVA,
    });

    expect(gravada.id).toBe('zona-1');
  });
});

describe('gravar zona que já existe', () => {
  it('é UPDATE filtrado por id E por product_id', async () => {
    // O filtro por produto impede que um id vindo de estado velho ou de outra tela
    // reescreva a zona de OUTRO produto: a RLS deixaria passar, porque os dois produtos
    // podem pertencer ao mesmo tenant.
    const { cliente, pedido } = clienteFalso({ data: LINHA_GRAVADA });
    await gravarZonaNoBanco(cliente, {
      tenantId: 'tenant-1',
      productId: 'prod-1',
      zona: ZONA_EXISTENTE,
    });

    expect(pedido.operacao).toBe('update');
    expect(pedido.filtros).toEqual([
      ['id', 'zona-1'],
      ['product_id', 'prod-1'],
    ]);
  });

  it('não manda zone_key nem product_id no UPDATE', async () => {
    // `zone_key` é a chave pública da API. Deixá-la no UPDATE permitiria renomeá-la por
    // baixo de um cliente que já integra com ela; e mover a linha de produto seria pior.
    const { cliente, pedido } = clienteFalso({ data: LINHA_GRAVADA });
    await gravarZonaNoBanco(cliente, {
      tenantId: 'tenant-1',
      productId: 'prod-1',
      zona: ZONA_EXISTENTE,
    });

    expect(pedido.valores).toEqual({
      svg_selector: '#sola-1, #sola-2',
      label: 'Sola',
      cor_default: '#C0392B',
    });
    expect(Object.keys(pedido.valores ?? {})).not.toContain('zone_key');
    expect(Object.keys(pedido.valores ?? {})).not.toContain('product_id');
  });

  it('UPDATE sem linha afetada falha alto, não finge sucesso', async () => {
    // Zero linha = a zona foi apagada, ou o id é de outro produto. Devolver "gravado"
    // deixaria a marcação existindo só na tela de quem gravou.
    const { cliente } = clienteFalso({ data: null });
    const falha = await capturarFalha(() =>
      gravarZonaNoBanco(cliente, {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        zona: ZONA_EXISTENTE,
      }),
    );

    expect(falha.message).toMatch(/não existe mais/);
    expect(falha.message).toMatch(/recarregue a página/);
  });

  it('PGRST116 (nenhuma linha no `.single()`) vira o mesmo aviso de recarregar', async () => {
    const { cliente } = clienteFalso({
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    });
    const falha = await capturarFalha(() =>
      gravarZonaNoBanco(cliente, {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        zona: ZONA_EXISTENTE,
      }),
    );

    expect(falha.message).toMatch(/não existe mais/);
    expect(falha.message).not.toContain('JSON object requested');
  });
});

describe('erros do banco viram frase acionável', () => {
  it('23505 é o comportamento certo de duas pessoas marcando a mesma zona', async () => {
    // Não é bug a contornar: a unique impediu a segunda gravação de apagar a primeira.
    const { cliente } = clienteFalso({
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "product_zones_product_id_zone_key_key"',
      },
    });
    const falha = await capturarFalha(() =>
      gravarZonaNoBanco(cliente, {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        zona: ZONA_NOVA,
      }),
    );

    expect(falha.message).toMatch(/já foi marcada/);
    expect(falha.message).toMatch(/recarregue a página/);
    // Detalhe de schema na tela não ajuda ninguém a decidir o que fazer.
    expect(falha.message).not.toContain('duplicate key');
    expect(falha.message).not.toContain('unique constraint');
  });

  it('erro genérico não vaza o objeto cru do Supabase', async () => {
    const { cliente } = clienteFalso({
      error: { code: '42501', message: 'new row violates row-level security policy' },
    });
    const falha = await capturarFalha(() =>
      gravarZonaNoBanco(cliente, {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        zona: ZONA_NOVA,
      }),
    );

    expect(falha.message).toMatch(/Não foi possível gravar a zona/);
    expect(falha.message).toMatch(/Tente de novo/);
    expect(falha.message).not.toContain('row-level security');
  });
});

describe('recusa antes de tocar o banco', () => {
  it('sem tenant ativo não grava linha órfã', async () => {
    const { cliente, pedido } = clienteFalso({ data: LINHA_GRAVADA });

    await expect(
      gravarZonaNoBanco(cliente, { tenantId: '  ', productId: 'prod-1', zona: ZONA_NOVA }),
    ).rejects.toThrow(/tenant/);
    expect(pedido.operacao).toBe('nenhuma');
  });

  it('zona sem elemento marcado não vira linha vazia', async () => {
    // `svg_selector` vazio geraria variante sem recolorir nada — falha silenciosa na API.
    const { cliente, pedido } = clienteFalso({ data: LINHA_GRAVADA });

    await expect(
      gravarZonaNoBanco(cliente, {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        zona: { ...ZONA_NOVA, svg_selector: '' },
      }),
    ).rejects.toThrow(/elemento marcado/);
    expect(pedido.operacao).toBe('nenhuma');
  });
});

describe('guarda de fonte', () => {
  it('a gravação cega de uma chamada só continua fora deste arquivo', async () => {
    // A proibição é o tipo de coisa que volta em silêncio numa refatoração ("dá para
    // trocar esses dois caminhos por uma chamada só"), e um comentário não segura isso.
    // A operação que insere-ou-sobrescreve pela chave apagaria o `svg_selector` que um
    // colega acabou de gravar, sem aviso nenhum.
    const fonte = readFileSync(new URL('./gravarZonaNoBanco.ts', import.meta.url), 'utf8');

    expect(fonte).not.toContain('upsert');
    expect(fonte).toContain('.insert(');
    expect(fonte).toContain('.update(');
  });
});
