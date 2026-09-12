// O teste do CONTEÚDO do pacote de saída. Puro, sem banco.
//
// O teste que o ADR-009 pede em letra, "o zip contém uma zona que foi marcada", vive em
// `supabase/tests/exportarTenant.test.ts` e precisa de banco. Este aqui é o que roda todo dia e
// guarda a parte que é decisão de política, não de infraestrutura: o que sai, o que não sai, e o
// que o cliente lê quando abre o pacote.

import { describe, expect, it } from 'vitest';

import {
  montarPacoteDeSaida,
  pastaDoProduto,
  type ProdutoParaSaida,
  type SaidaDoTenant,
} from './montarPacoteDeSaida';
import { lerZip, montarZip, textoDoZip } from './zip';

const TENANT = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Calçados Aurora',
  slug: 'aurora',
  tema: { primaria: '#C0392B' },
  plano: 'contrato',
  created_at: '2026-01-10T12:00:00.000Z',
};

function produto(parcial: Partial<ProdutoParaSaida> = {}): ProdutoParaSaida {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    nome: 'Runner 2026',
    created_at: '2026-02-01T12:00:00.000Z',
    assetBase: { nomeDoArquivo: 'base.svg', conteudo: Buffer.from('<svg id="sola"/>') },
    zonas: [
      {
        zone_key: 'cabedal-lateral',
        label: 'Cabedal lateral',
        svg_selector: '#cabedal path',
        cor_default: '#1F4FA8',
        created_at: '2026-02-02T12:00:00.000Z',
      },
    ],
    variantes: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        zone_colors: { 'cabedal-lateral': '#C0392B' },
        created_at: '2026-02-03T12:00:00.000Z',
      },
    ],
    ...parcial,
  };
}

const SAIDA: SaidaDoTenant = { tenant: TENANT, produtos: [produto()] };

function nomes(saida: SaidaDoTenant): string[] {
  return montarPacoteDeSaida(saida).map(({ nome }) => nome);
}

describe('pastaDoProduto', () => {
  it('junta o nome legível com um pedaço do id', () => {
    expect(pastaDoProduto({ id: 'abcdef12-3456', nome: 'Runner 2026' })).toBe(
      'produtos/runner-2026-abcdef12',
    );
  });

  it('dois produtos de mesmo nome não caem na mesma pasta', () => {
    // É o caso que o id resolve, e a razão de ele estar ali. Duas pastas iguais dentro de um ZIP
    // fazem uma sobrescrever a outra na extração, e o cliente perderia um produto inteiro sem
    // nenhum aviso, exatamente o tipo de falha silenciosa que este projeto persegue.
    const um = pastaDoProduto({ id: 'aaaaaaaa-1', nome: 'Runner' });
    const outro = pastaDoProduto({ id: 'bbbbbbbb-2', nome: 'Runner' });

    expect(um).not.toBe(outro);
  });

  it('tira acento e caractere que sistema de arquivos não gosta', () => {
    expect(pastaDoProduto({ id: 'abcdef12', nome: 'Cadarço / Edição "Nº 3"' })).toBe(
      'produtos/cadarco-edicao-n-3-abcdef12',
    );
  });

  it('nome que vira vazio ainda produz uma pasta utilizável', () => {
    // Um produto chamado só "???" existiria como pasta sem nome nenhum, e `produtos/-abcdef12`
    // é um caminho esquisito que alguns extratores recusam.
    expect(pastaDoProduto({ id: 'abcdef12', nome: '???' })).toBe('produtos/produto-abcdef12');
  });
});

describe('montarPacoteDeSaida', () => {
  it('tem o LEIA-ME, o tenant e os quatro arquivos do produto', () => {
    expect(nomes(SAIDA)).toEqual([
      'LEIA-ME.md',
      'tenant.json',
      'produtos/runner-2026-22222222/produto.json',
      'produtos/runner-2026-22222222/zonas.json',
      'produtos/runner-2026-22222222/variantes.json',
      'produtos/runner-2026-22222222/base.svg',
    ]);
  });

  it('a zona marcada está no pacote, com chave, rótulo e seletor', () => {
    // A marcação de zona é, segundo o próprio ADR-009, "a parte cara de refazer". Se alguma coisa
    // tem que sair inteira, é esta.
    const zonas = JSON.parse(
      textoDoZip(montarZip(montarPacoteDeSaida(SAIDA)), 'produtos/runner-2026-22222222/zonas.json'),
    );

    expect(zonas).toEqual([
      {
        zone_key: 'cabedal-lateral',
        label: 'Cabedal lateral',
        svg_selector: '#cabedal path',
        cor_default: '#1F4FA8',
        created_at: '2026-02-02T12:00:00.000Z',
      },
    ]);
  });

  it('a variante sai como receita de cor, e sem o caminho do arquivo renderizado', () => {
    // ADR-009 D3. `rendered_path` aponta para o Storage da Kora e não significa nada fora daqui;
    // exportá-lo daria ao cliente um endereço que ele não consegue abrir, o que é pior que omitir.
    const texto = textoDoZip(
      montarZip(montarPacoteDeSaida(SAIDA)),
      'produtos/runner-2026-22222222/variantes.json',
    );

    expect(JSON.parse(texto)[0].zone_colors).toEqual({ 'cabedal-lateral': '#C0392B' });
    expect(texto).not.toMatch(/rendered_path/);
  });

  it('o asset-base sai byte a byte, sem passar por texto', () => {
    const pacote = montarZip(montarPacoteDeSaida(SAIDA));
    const achado = lerZip(pacote).find(({ nome }) => nome.endsWith('base.svg'));

    expect(achado?.conteudo).toEqual(Buffer.from('<svg id="sola"/>'));
  });

  it('produto sem asset-base não quebra a exportação', () => {
    // Produto cadastrado e ainda sem arquivo é estado real do sistema. A saída de um tenant não
    // pode falhar por causa dele: quem está cancelando precisa do pacote, não de um erro.
    const nomesSemAsset = nomes({ tenant: TENANT, produtos: [produto({ assetBase: null })] });

    expect(nomesSemAsset).not.toContain('produtos/runner-2026-22222222/base.svg');
    expect(nomesSemAsset).toContain('produtos/runner-2026-22222222/zonas.json');
  });

  it('produto sem zona e sem variante ainda leva os arquivos, vazios', () => {
    // Arquivo `[]` responde "não havia nenhuma". Arquivo ausente deixa a pessoa se perguntando se
    // a exportação falhou no meio, e ela não tem como saber a diferença.
    const vazio = { tenant: TENANT, produtos: [produto({ zonas: [], variantes: [] })] };
    const pacote = montarZip(montarPacoteDeSaida(vazio));

    expect(JSON.parse(textoDoZip(pacote, 'produtos/runner-2026-22222222/zonas.json'))).toEqual([]);
    expect(JSON.parse(textoDoZip(pacote, 'produtos/runner-2026-22222222/variantes.json'))).toEqual([]);
  });

  it('tenant sem produto nenhum produz um pacote que abre', () => {
    // Alguém que assinou, não subiu nada e cancelou. A saída dele precisa ser uma resposta, não
    // um erro.
    expect(nomes({ tenant: TENANT, produtos: [] })).toEqual(['LEIA-ME.md', 'tenant.json']);
  });

  it('o tenant sai com os campos declarados, e só com eles', () => {
    const conteudo = JSON.parse(textoDoZip(montarZip(montarPacoteDeSaida(SAIDA)), 'tenant.json'));

    expect(Object.keys(conteudo).sort()).toEqual([
      'created_at',
      'id',
      'nome',
      'plano',
      'slug',
      'tema',
    ]);
  });
});

describe('o LEIA-ME diz o que NÃO está no pacote (ADR-009 D2)', () => {
  const leiaMe = () => textoDoZip(montarZip(montarPacoteDeSaida(SAIDA)), 'LEIA-ME.md');

  it('avisa que o acervo base da Kora não vai junto', () => {
    // Esta frase é o ADR-009 D2 virando produto. Uma saída que entrega a receita e guarda os
    // ingredientes, sem avisar, é promessa falsa que o cliente descobre no pior momento.
    expect(leiaMe()).toMatch(/acervo base da Kora não vêm/);
    expect(leiaMe()).toMatch(/não monta fora daqui/);
  });

  it('avisa que a variante não vem renderizada, e que gerar tem hora certa', () => {
    expect(leiaMe()).toMatch(/não vêm renderizadas/);
    expect(leiaMe()).toMatch(/antes de encerrar o contrato/);
  });

  it('avisa que dado pessoal fica fora', () => {
    expect(leiaMe()).toMatch(/Dados de pessoas não vêm/);
  });

  it('diz que exportar e excluir são operações separadas', () => {
    expect(leiaMe()).toMatch(/duas operações separadas/);
  });

  it('conta quantos produtos, zonas e variantes vieram', () => {
    // O número no papel é o que deixa alguém conferir o pacote sem abrir arquivo por arquivo, e
    // perceber na hora se veio menos do que devia.
    expect(leiaMe()).toMatch(/1 produto, 1 zona e 1 variante/);
  });

  it('concorda no plural quando há mais de um', () => {
    const dois = {
      tenant: TENANT,
      produtos: [produto(), produto({ id: '44444444-4444-4444-8444-444444444444' })],
    };

    expect(textoDoZip(montarZip(montarPacoteDeSaida(dois)), 'LEIA-ME.md')).toMatch(
      /2 produtos, 2 zonas e 2 variantes/,
    );
  });
});
