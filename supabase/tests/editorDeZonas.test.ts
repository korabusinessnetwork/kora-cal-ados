// O caminho completo de "marcar zona" contra o Supabase REAL: asset baixado do Storage →
// `marcarZona` → `product_zones` → releitura → o seletor gravado resolvido de volta no SVG.
//
// Por que este teste existe separado dos testes de `src/`: lá o SVG é fixture e o banco é
// dublê, então nada prova que o `svg_selector` que saiu do editor endereça o asset que a
// API vai ler daqui a seis meses. Aqui prova — e é essa distância entre editor e geração
// que o princípio nº1 do CLAUDE.md proíbe existir.
//
// Os casos rodam EM ORDEM e compartilham a mesma zona de propósito: "marcar", "acrescentar
// elemento", "dois marcando a mesma chave" e "apagar" são a mesma história, e quebrá-los em
// cenários independentes esconderia justamente o que a `unique (product_id, zone_key)` faz.
//
// Sem ambiente Supabase configurado, PULA — nunca finge que passou.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { montarCenario, limpar, admin, temAmbiente, type Cenario } from './ambiente';
import { BUCKET_DO_ASSET_BASE } from '../scripts/caminhoDoAssetBase';
import { analisarSvg } from '../../src/lib/render/dom';
import { ErroDeVariante } from '../../src/lib/render/erros';
import { marcarZona, idsDoSeletor } from '../../src/features/zonas/marcarZona';
import { gravarZonaNoBanco } from '../../src/features/zonas/gravarZonaNoBanco';
import { listarZonasDoProduto } from '../../src/features/zonas/listarZonasDoProduto';

const ZONA = 'cabedal';
const OUTRA_ZONA = 'sola';
const LABEL = 'Cabedal';
const COR = '#C0392B';

describe.skipIf(!temAmbiente)('editor de zonas contra o Supabase real', () => {
  let cenario: Cenario;
  let svgCanonico: string;
  let idPrimeiro: string;
  let idSegundo: string;

  beforeAll(async () => {
    cenario = await montarCenario();
    svgCanonico = await baixarAssetBase(cenario);

    // Os ids saem do asset BAIXADO, não de uma lista fixa aqui: id fixo no teste viraria
    // uma segunda fonte de verdade sobre a cunhagem do ADR-005 e passaria a esconder
    // justamente a divergência que o caso 2 existe para pegar.
    const marcaveis = idsMarcaveis(svgCanonico, 2);
    [idPrimeiro = '', idSegundo = ''] = marcaveis;
  }, 60_000);

  afterAll(async () => {
    if (!cenario) return;

    // `limpar` apaga os tenants e o cascade de `product_zones` levaria as zonas junto.
    // A remoção explícita existe para o afterAll não depender de o cascade continuar no
    // schema: teste que deixa lixo no projeto do dono é teste que ninguém roda duas vezes.
    await admin().from('product_zones').delete().eq('product_id', cenario.produtoA);
    await limpar(cenario);
  }, 60_000);

  it('grava a zona marcada e relê exatamente o que gravou', async () => {
    const zonasAtuais = await listarZonasDoProduto(cenario.clienteA, cenario.produtoA);
    expect(zonasAtuais).toEqual([]);

    const paraGravar = marcarZona({
      svgCanonico,
      zonasAtuais,
      zoneKey: ZONA,
      idsMarcados: [idPrimeiro],
      label: LABEL,
      corDefault: COR,
    });

    await gravarZonaNoBanco(cenario.clienteA, {
      tenantId: cenario.tenantA,
      productId: cenario.produtoA,
      zona: paraGravar,
    });

    const relida = await zonaGravada(cenario, ZONA);

    // Campo a campo: zona que volta diferente do que foi gravada é cor no lugar errado.
    expect({
      zone_key: relida?.zone_key,
      svg_selector: relida?.svg_selector,
      label: relida?.label,
      cor_default: relida?.cor_default,
    }).toEqual({
      zone_key: paraGravar.zone_key,
      svg_selector: paraGravar.svg_selector,
      label: paraGravar.label,
      cor_default: paraGravar.cor_default,
    });
  }, 30_000);

  it('o svg_selector gravado captura no asset exatamente os elementos marcados', async () => {
    // O canário de `isolamento.test.ts` prova que o normalizador de hoje não mexeria mais
    // no asset. Este prova o outro lado: que a LINHA já gravada continua endereçando o
    // elemento certo. Se a cunhagem de id do ADR-005 mudar, o seletor aponta para o nada
    // (ou, pior, para outro elemento) e a variante sai com a cor no lugar errado.
    const relida = await zonaGravada(cenario, ZONA);
    const documento = analisarSvg(svgCanonico);
    const capturados = [...documento.querySelectorAll(relida?.svg_selector ?? '')];

    expect(capturados.map((elemento) => elemento.getAttribute('id'))).toEqual([idPrimeiro]);
  }, 30_000);

  it('acrescentar elemento à zona é UPDATE da linha, nunca uma segunda', async () => {
    const zonasAtuais = await listarZonasDoProduto(cenario.clienteA, cenario.produtoA);
    const idDaLinha = zonasAtuais[0]?.id;

    const paraGravar = marcarZona({
      svgCanonico,
      zonasAtuais,
      zoneKey: ZONA,
      idsMarcados: [idSegundo],
    });

    // Quem decide INSERT × UPDATE é `marcarZona`, a partir das zonas já lidas.
    expect(paraGravar.idExistente).toBe(idDaLinha);

    await gravarZonaNoBanco(cenario.clienteA, {
      tenantId: cenario.tenantA,
      productId: cenario.produtoA,
      zona: paraGravar,
    });

    const depois = await listarZonasDoProduto(cenario.clienteA, cenario.produtoA);

    expect(depois).toHaveLength(1);
    expect(depois[0]?.id).toBe(idDaLinha);
    // Cresceu SEM perder o id anterior: é o mapeamento do colega que sumiria aqui.
    expect(idsDoSeletor(depois[0]?.svg_selector ?? '')).toEqual([idPrimeiro, idSegundo]);
    // E o que não foi mandado de novo continua valendo.
    expect(depois[0]?.label).toBe(LABEL);
    expect(depois[0]?.cor_default).toBe(COR);
  }, 30_000);

  it('INSERT direto da mesma zone_key volta 23505 e não sobrescreve o que já está gravado', async () => {
    const antes = await zonaGravada(cenario, ZONA);

    // O cenário real: duas pessoas marcam "cabedal" ao mesmo tempo e a segunda grava
    // achando que a zona é nova. A unique é quem impede a segunda de apagar a primeira.
    const { error } = await cenario.clienteA.from('product_zones').insert({
      product_id: cenario.produtoA,
      tenant_id: cenario.tenantA,
      zone_key: ZONA,
      svg_selector: `#${idSegundo}`,
    });

    expect(error?.code).toBe('23505');

    const depois = await listarZonasDoProduto(cenario.clienteA, cenario.produtoA);
    expect(depois).toHaveLength(1);
    expect(depois[0]?.svg_selector).toBe(antes?.svg_selector);
  }, 30_000);

  it('marca concorrente não insere, não lê e não atualiza zona do tenant alheio', async () => {
    const antes = await zonaGravada(cenario, ZONA);

    const inserida = await cenario.clienteB.from('product_zones').insert({
      product_id: cenario.produtoA,
      tenant_id: cenario.tenantA,
      zone_key: 'zona-do-concorrente',
      svg_selector: `#${idPrimeiro}`,
    });
    expect(inserida.error).not.toBeNull();

    // RLS filtra, não acusa: lista vazia e erro nulo é o comportamento certo — um erro
    // aqui já contaria ao concorrente que existe algo para ver.
    const lida = await cenario.clienteB
      .from('product_zones')
      .select('id, zone_key, svg_selector')
      .eq('product_id', cenario.produtoA);
    expect(lida.error).toBeNull();
    expect(lida.data).toEqual([]);

    await cenario.clienteB
      .from('product_zones')
      .update({ svg_selector: '#nao-existe' })
      .eq('product_id', cenario.produtoA);

    const depois = await listarZonasDoProduto(cenario.clienteA, cenario.produtoA);
    expect(depois).toHaveLength(1);
    expect(depois[0]?.svg_selector).toBe(antes?.svg_selector);
  }, 30_000);

  it('BUG-013: elemento de outra zona é recusado em marcarZona, antes de o banco ver algo', async () => {
    const zonasAtuais = await listarZonasDoProduto(cenario.clienteA, cenario.produtoA);

    let capturado: unknown;
    try {
      marcarZona({
        svgCanonico,
        zonasAtuais,
        zoneKey: OUTRA_ZONA,
        idsMarcados: [idPrimeiro],
      });
    } catch (erro) {
      capturado = erro;
    }

    expect(capturado).toBeInstanceOf(ErroDeVariante);
    expect((capturado as ErroDeVariante).codigo).toBe('ZONAS_SOBREPOSTAS');

    // A recusa tem de ser ANTES do banco: uma linha nova aqui já faria a ordem das chaves
    // do JSON decidir a cor do elemento na geração, sem erro e sem aviso.
    const depois = await listarZonasDoProduto(cenario.clienteA, cenario.produtoA);
    expect(depois).toHaveLength(1);
  }, 30_000);

  it('membro não-owner não apaga a zona; o owner apaga', async () => {
    await cenario.clienteMembroA.from('product_zones').delete().eq('product_id', cenario.produtoA);

    const aindaLa = await listarZonasDoProduto(cenario.clienteA, cenario.produtoA);
    expect(aindaLa).toHaveLength(1);

    const { error } = await cenario.clienteA
      .from('product_zones')
      .delete()
      .eq('product_id', cenario.produtoA);
    expect(error).toBeNull();

    const depois = await listarZonasDoProduto(cenario.clienteA, cenario.produtoA);
    expect(depois).toEqual([]);
  }, 30_000);
});

/** O asset-base como o editor o recebe: baixado do Storage pelo dono, já canônico. */
async function baixarAssetBase(cenario: Cenario): Promise<string> {
  const { data, error } = await cenario.clienteA.storage
    .from(BUCKET_DO_ASSET_BASE)
    .createSignedUrl(cenario.assetDoProdutoA, 300);

  if (error || !data) throw error ?? new Error('asset-base sem URL assinada');

  return await (await fetch(data.signedUrl)).text();
}

/**
 * Ids de elementos do asset que aceitam cor chapa — `path` com `fill` hex.
 *
 * Fica de fora o que não serve para o teste do caminho feliz e falharia por outro motivo:
 * `fill="none"` (contorno, recusado com `ZONA_NAO_RECOLORIVEL`) e `fill="url(...)"`
 * (gradiente, mesma recusa). `path` não tem descendente pintável, então cada id marcado
 * corresponde a exatamente um alvo — é o que torna o caso 2 uma igualdade exata.
 */
function idsMarcaveis(svgCanonico: string, quantos: number): string[] {
  const documento = analisarSvg(svgCanonico);
  const ids: string[] = [];

  for (const elemento of documento.querySelectorAll('path')) {
    const id = elemento.getAttribute('id');
    if (!id || !(elemento.getAttribute('fill') ?? '').trim().startsWith('#')) continue;

    ids.push(id);
    if (ids.length === quantos) break;
  }

  if (ids.length < quantos) {
    throw new Error(`O asset-base do cenário tem menos de ${quantos} elementos marcáveis.`);
  }

  return ids;
}

/** A linha como ela está no banco AGORA — relida a cada caso, nunca guardada entre eles. */
async function zonaGravada(cenario: Cenario, zoneKey: string) {
  const zonas = await listarZonasDoProduto(cenario.clienteA, cenario.produtoA);

  return zonas.find((zona) => zona.zone_key === zoneKey);
}
