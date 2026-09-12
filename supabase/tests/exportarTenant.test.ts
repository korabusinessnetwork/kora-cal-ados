// A saída do cliente contra o banco de verdade (ADR-009).
//
// O ADR escreve em letra qual é o teste que importa aqui, e não é "o zip foi gerado": é **o zip
// contém uma zona que foi marcada**. Semear, exportar, e conferir que a `zone_key` está lá dentro.
// A razão é que a marcação de zona é, segundo o próprio ADR, "a parte cara de refazer", e uma
// exportação que gera um arquivo bonito sem ela não serve para nada.
//
// O segundo teste é o que só o banco real prova, e num sistema onde marcas concorrentes coabitam
// ele vale tanto quanto o primeiro: **o pacote do tenant A não pode ter nada do tenant B**. Um
// vazamento aqui não é bug de tela, é um arquivo saindo da empresa para a mão do cliente errado.
//
// O que é decisão de política (o que sai, o que não sai, o que o LEIA-ME diz) tem teste puro em
// `supabase/scripts/montarPacoteDeSaida.test.ts`, que roda todo dia sem banco. Aqui ficam só as
// perguntas que exigem Postgres e Storage de verdade.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  admin,
  limpar,
  montarCenario,
  semearZonasDoProdutoA,
  temAmbiente,
  ZONAS_DO_TESTE_DA_API,
  type Cenario,
} from './ambiente';
import { lerSaidaDoTenant, TenantNaoEncontrado } from '../scripts/lerSaidaDoTenant';
import { montarPacoteDeSaida, pastaDoProduto } from '../scripts/montarPacoteDeSaida';
import { lerZip, montarZip, textoDoZip } from '../scripts/zip';

/** O nome do produto que `montarCenario` cria no tenant A. */
const PRODUTO_DE_A = 'Tênis coleção não lançada';

/** O produto do concorrente. Inconfundível de propósito: é o que a busca do vazamento caça. */
const PRODUTO_DE_B = 'SEGREDO-DA-MARCA-B';

describe.skipIf(!temAmbiente)('exportação de tenant contra o banco real', () => {
  let cenario: Cenario;
  let slugDeA: string;
  let slugDeB: string;
  let pacoteDeA: Buffer;
  let pastaDeA: string;

  beforeAll(async () => {
    cenario = await montarCenario();
    await semearZonasDoProdutoA(cenario);

    // Uma variante no A, para o histórico não sair vazio. A chave de `zone_colors` é a `zone_key`,
    // como a API grava, e não o id do elemento no SVG.
    const variante = await admin().from('variants').insert({
      product_id: cenario.produtoA,
      tenant_id: cenario.tenantA,
      zone_colors: { sola: '#ABCDEF' },
      rendered_path: 'tenants/qualquer/renders/nao-deve-sair.png',
    });

    if (variante.error) throw variante.error;

    // O produto do concorrente aponta para um asset que NÃO existe no Storage. Isso cobre de
    // graça um caso que o teste puro não alcança: caminho gravado no banco e objeto sumido do
    // bucket. `assetBase: null` é outra coisa, e é o único que o teste sem banco consegue montar.
    const produtoDeB = await admin()
      .from('products')
      .insert({
        tenant_id: cenario.tenantB,
        nome: PRODUTO_DE_B,
        base_asset_path: `tenants/${cenario.tenantB}/products/sumido/base.svg`,
      });

    if (produtoDeB.error) throw produtoDeB.error;

    slugDeA = await slugDoTenant(cenario.tenantA);
    slugDeB = await slugDoTenant(cenario.tenantB);

    pastaDeA = pastaDoProduto({ id: cenario.produtoA, nome: PRODUTO_DE_A });
    pacoteDeA = montarZip(montarPacoteDeSaida(await lerSaidaDoTenant(admin(), slugDeA)));
  }, 120_000);

  afterAll(async () => {
    if (cenario) await limpar(cenario);
    // O mesmo teto do `beforeAll`, e o mesmo dos outros cinco arquivos de banco. Sem ele vale o
    // padrão de 10 s do vitest, e `limpar` não cabe nele: são uma remoção no Storage, dois
    // `deleteUser` e um delete de tenants, cada um uma ida à rede. O arquivo reprovava inteiro com
    // os 58 testes VERDES, porque quem estourava era a limpeza, depois do último `expect`.
  }, 120_000);

  it('a zona marcada está dentro do zip, com a chave e o seletor', () => {
    // **O teste que o ADR-009 pede em letra.** Semeou, exportou, e a `zone_key` está no pacote.
    const zonas = JSON.parse(textoDoZip(pacoteDeA, `${pastaDeA}/zonas.json`)) as {
      zone_key: string;
      svg_selector: string;
    }[];

    expect(zonas.map(({ zone_key }) => zone_key).sort()).toEqual(
      Object.keys(ZONAS_DO_TESTE_DA_API).sort(),
    );

    const sola = zonas.find(({ zone_key }) => zone_key === 'sola');

    expect(sola?.svg_selector).toBe(`#${ZONAS_DO_TESTE_DA_API.sola}`);
  });

  it('NADA do tenant concorrente aparece no pacote', () => {
    // Procura o produto, o slug e o id do B em TODOS os bytes do pacote, nomes de arquivo
    // inclusive, e não só nos JSONs que o teste sabe abrir.
    const tudo = bytesDoPacote(pacoteDeA);

    expect(tudo).not.toContain(PRODUTO_DE_B);
    expect(tudo).not.toContain(slugDeB);
    expect(tudo).not.toContain(cenario.tenantB);
  });

  it('o asset-base sai byte a byte igual ao objeto do Storage', async () => {
    // É o arquivo da marca, e a única coisa do pacote que ela não consegue reconstruir a partir
    // do resto. Conferir contra o bucket é o que prova que o download aconteceu de verdade.
    const doBucket = await admin().storage.from('assets-base').download(cenario.assetDoProdutoA);

    if (doBucket.error || doBucket.data === null) throw doBucket.error ?? new Error('sem asset');

    const doPacote = lerZip(pacoteDeA).find(({ nome }) => nome === `${pastaDeA}/base.svg`);

    expect(doPacote?.conteudo).toEqual(Buffer.from(await doBucket.data.arrayBuffer()));
  });

  it('a variante sai como receita de cor, e o rendered_path fica no banco', () => {
    // ADR-009 D3. A linha no banco TEM `rendered_path` preenchido (o beforeAll põe um), e mesmo
    // assim ele não pode aparecer no pacote: é endereço do Storage da Kora, que o cliente não
    // consegue abrir. Este teste só vale porque o valor existe do lado de lá.
    const texto = textoDoZip(pacoteDeA, `${pastaDeA}/variantes.json`);
    const variantes = JSON.parse(texto) as { zone_colors: Record<string, string> }[];

    expect(variantes).toHaveLength(1);
    expect(variantes[0]?.zone_colors).toEqual({ sola: '#ABCDEF' });
    expect(texto).not.toMatch(/rendered_path/);
    expect(bytesDoPacote(pacoteDeA)).not.toContain('nao-deve-sair.png');
  });

  it('o LEIA-ME sai com o nome da marca, a contagem e o aviso do acervo', () => {
    const leiaMe = textoDoZip(pacoteDeA, 'LEIA-ME.md');

    expect(leiaMe).toContain(slugDeA);
    expect(leiaMe).toMatch(/1 produto, 5 zonas e 1 variante/);
    expect(leiaMe).toMatch(/acervo base da Kora não vêm/);
  });

  it('a leitura devolve só os campos declarados, em toda tabela', async () => {
    // A mutação que criou este teste: devolver `rendered_path` no `select` de variantes passava
    // por tudo, porque `montarPacoteDeSaida` reescolhe os campos na saída e o valor morria lá.
    // A defesa em profundidade é boa, mas deixava o `select` deste módulo sem ninguém olhando, e
    // era justamente ele que o comentário do arquivo promete que é explícito. Agora um `select *`
    // aqui falha aqui, que é onde ele foi escrito.
    const { tenant, produtos } = await lerSaidaDoTenant(admin(), slugDeA);
    const [produto] = produtos;

    expect(Object.keys(tenant).sort()).toEqual(['created_at', 'id', 'nome', 'plano', 'slug', 'tema']);
    expect(Object.keys(produto ?? {}).sort()).toEqual([
      'assetBase',
      'created_at',
      'id',
      'nome',
      'variantes',
      'zonas',
    ]);
    expect(Object.keys(produto?.zonas[0] ?? {}).sort()).toEqual([
      'cor_default',
      'created_at',
      'label',
      'svg_selector',
      'zone_key',
    ]);
    expect(Object.keys(produto?.variantes[0] ?? {}).sort()).toEqual([
      'created_at',
      'id',
      'zone_colors',
    ]);
  });

  it('exportar NÃO apaga nada (ADR-009 D5)', async () => {
    // Exportar e excluir são operações separadas de propósito, para não existir o caso em que o
    // pacote saiu incompleto e o original já não existe. Depois de exportar, tudo continua lá.
    const tenant = await admin().from('tenants').select('id').eq('id', cenario.tenantA).maybeSingle();
    const zonas = await admin()
      .from('product_zones')
      .select('zone_key')
      .eq('product_id', cenario.produtoA);
    const asset = await admin().storage.from('assets-base').download(cenario.assetDoProdutoA);

    expect(tenant.data).not.toBeNull();
    expect(zonas.data).toHaveLength(Object.keys(ZONAS_DO_TESTE_DA_API).length);
    expect(asset.error).toBeNull();
  });

  it('slug que não existe recusa com erro próprio, e não devolve pacote vazio', async () => {
    // Um erro de digitação no slug produziria um pacote com zero produtos, que é indistinguível
    // de um tenant que nunca subiu nada. Entregar isso a quem está cancelando um contrato seria o
    // pior desfecho possível desta operação.
    await expect(lerSaidaDoTenant(admin(), 'nao-existe-este-slug-aqui')).rejects.toThrow(
      TenantNaoEncontrado,
    );
  });

  it('o pacote do concorrente leva o que é dele, e nada do A', async () => {
    // O espelho do teste de vazamento. Sem ele, uma leitura que devolvesse sempre o mesmo tenant
    // passaria no teste de cima sem ninguém notar.
    const pacoteDeB = montarZip(montarPacoteDeSaida(await lerSaidaDoTenant(admin(), slugDeB)));
    const tudo = bytesDoPacote(pacoteDeB);

    expect(JSON.parse(textoDoZip(pacoteDeB, 'tenant.json')).slug).toBe(slugDeB);
    expect(tudo).toContain(PRODUTO_DE_B);
    expect(tudo).not.toContain(PRODUTO_DE_A);
    expect(tudo).not.toContain(slugDeA);
    expect(tudo).not.toContain(cenario.produtoA);
  });

  it('asset que sumiu do Storage não derruba a exportação do tenant', async () => {
    // O produto do B aponta para um objeto que não existe. Quem está exportando está cancelando
    // um contrato: entregar o pacote sem um arquivo, com o aviso no console, vale mais do que não
    // entregar pacote nenhum.
    const doB = await lerSaidaDoTenant(admin(), slugDeB);
    const nomes = montarPacoteDeSaida(doB).map(({ nome }) => nome);

    expect(doB.produtos).toHaveLength(1);
    expect(doB.produtos[0]?.assetBase).toBeNull();
    expect(nomes.some((nome) => nome.endsWith('/zonas.json'))).toBe(true);
    expect(nomes.some((nome) => nome.endsWith('/base.svg'))).toBe(false);
  });
});

/** Todo o pacote como um texto só, nomes de arquivo inclusive, para caçar vazamento. */
function bytesDoPacote(pacote: Buffer): string {
  return lerZip(pacote)
    .map(({ nome, conteudo }) => `${nome}\n${Buffer.from(conteudo).toString('utf8')}`)
    .join('\n');
}

async function slugDoTenant(id: string): Promise<string> {
  const { data, error } = await admin().from('tenants').select('slug').eq('id', id).single();

  if (error) throw error;

  return data['slug'] as string;
}
