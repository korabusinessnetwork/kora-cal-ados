// O elo que faltava: a zona que o EDITOR gravou é a zona que a API pinta.
//
// POR QUE ESTE ARQUIVO NÃO É REDUNDANTE COM `apiDeVariante.test.ts`: lá o teste monta os
// próprios `svg_selector` chamando `montarSeletorDeZona` direto, e grava com `service_role`.
// Aquilo prova que a API **consome** o formato. Não prova que o que o editor **produz** é
// aquele formato, nem que a linha que a RLS deixa o dono gravar é a linha que a
// `service_role` lê depois. São dois caminhos de privilégio diferentes sobre a mesma linha,
// e até aqui nenhum teste atravessava os dois.
//
// Aqui a zona nasce pelo caminho de verdade — `marcarZona` (que chama `montarSeletorDeZona`)
// seguido de `gravarZonaNoBanco`, com o **cliente autenticado do dono**, atravessando a RLS
// exatamente como o navegador atravessa. Só depois a API é chamada. É o princípio nº1 do
// `CLAUDE.md` escrito como asserção: "cor no editor = cor na API".
//
// O QUE ELE NÃO ALCANÇA, e está registrado em `api/_local/roteiroDePassada.md`: que o Chrome
// resolva `#a, #b` nos mesmos elementos que o jsdom resolve. O risco é pequeno — o seletor é
// lista de ids exatos, a forma mais simples que existe, e o editor **não cunha id** (ADR-005:
// ele é somente-leitura sobre o canônico, e os ids nascem em `normalizarSvg` no
// provisionamento) — mas não é zero, e não é código que o feche.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import '../../src/lib/render/domNode';
import handlerDaVariante from '../../api/v1/products/[productId]/variants';
import { marcarZona } from '../../src/features/zonas/marcarZona';
import { gravarZonaNoBanco } from '../../src/features/zonas/gravarZonaNoBanco';
import type { ZonaDoProduto } from '../../src/features/zonas/tiposDeZona';
import { BUCKET_DO_ASSET_BASE } from '../scripts/caminhoDoAssetBase';
import {
  limpar,
  montarCenario,
  semearChavesDaApi,
  temAmbiente,
  type Cenario,
  type ChavesDoCenario,
} from './ambiente';

const HOST = 'https://kora.test';

/** Ids que existem no canônico do demo. Conferidos contra `src/esboco/tenis-demo-cru.svg`. */
const BIQUEIRA = 'zona-biqueira';
const CADARCOS = ['zona-cadarco', 'zona-cadarco-2', 'zona-cadarco-3', 'zona-cadarco-4'];
const CABEDAL = 'zona-cabedal';
const COLARINHO = 'zona-colarinho';

describe.skipIf(!temAmbiente)('elo editor → API — a zona gravada é a zona pintada', () => {
  let cenario: Cenario;
  let chaves: ChavesDoCenario;
  let canonico: string;

  beforeAll(async () => {
    cenario = await montarCenario();
    chaves = await semearChavesDaApi(cenario);
    // Baixado pelo cliente do DONO, não por `admin()`: é o arquivo que o editor enxerga,
    // pela mesma policy de Storage. Se a RLS do bucket mudasse, o editor pararia de abrir o
    // modelo e este teste pararia junto — que é o alarme certo.
    canonico = await baixarCanonicoComoODono(cenario);
  }, 120_000);

  afterAll(async () => {
    if (cenario) await limpar(cenario);
  }, 120_000);

  it('zona nova de um elemento: a API pinta aquele elemento, e só ele', async () => {
    const gravada = await marcarEGravar(cenario, canonico, {
      zoneKey: 'bico',
      ids: [BIQUEIRA],
      label: 'Biqueira',
    });

    // A `zone_key` do pedido vem DO BANCO, não do literal acima. É o que pega normalização
    // divergente entre o que o editor grava e o que a API espera receber.
    const svg = await pedirVariante(cenario, chaves, { [gravada.zone_key]: '#C0392B' });

    expect(fillDoElemento(svg, BIQUEIRA)).toBe('#C0392B');
    expect(idsQueMudaram(canonico, svg)).toEqual([BIQUEIRA]);
  }, 60_000);

  it('zona de vários elementos: a API pinta os quatro cadarços, não um', async () => {
    // O defeito que este caso existe para pegar é o seletor que resolve só o primeiro id.
    // Ele passaria em qualquer asserção de status, e o cliente receberia um calçado com um
    // cadarço de cada cor.
    const gravada = await marcarEGravar(cenario, canonico, {
      zoneKey: 'cadarco',
      ids: CADARCOS,
      label: 'Cadarços',
    });

    const svg = await pedirVariante(cenario, chaves, { [gravada.zone_key]: '#1F6F5C' });

    for (const id of CADARCOS) expect(fillDoElemento(svg, id)).toBe('#1F6F5C');
    expect(idsQueMudaram(canonico, svg)).toEqual([...CADARCOS].sort());
  }, 60_000);

  it('acrescentar elemento a uma zona já gravada pinta os dois e preserva o `label`', async () => {
    // BUG-014: acrescentar um elemento apagava o `label` gravado por um colega. A metade da
    // regra que `marcarZona` protege (campo ausente preserva) é testada sem rede; o que só o
    // banco prova é que o UPDATE gravou o conjunto novo SEM perder a coluna antiga.
    const primeira = await marcarEGravar(cenario, canonico, {
      zoneKey: 'flanco',
      ids: [CABEDAL],
      label: 'Flanco do cabedal',
    });

    const segunda = await marcarEGravar(cenario, canonico, {
      zoneKey: 'flanco',
      ids: [COLARINHO],
      // `label` AUSENTE de propósito: é assim que o editor manda quando o campo não foi
      // tocado, e é exatamente o caminho do BUG-014.
      zonasAtuais: [primeira],
    });

    expect(segunda.id).toBe(primeira.id);
    expect(segunda.label).toBe('Flanco do cabedal');

    const svg = await pedirVariante(cenario, chaves, { [segunda.zone_key]: '#7D3C98' });

    expect(fillDoElemento(svg, CABEDAL)).toBe('#7D3C98');
    expect(fillDoElemento(svg, COLARINHO)).toBe('#7D3C98');
    expect(idsQueMudaram(canonico, svg)).toEqual([CABEDAL, COLARINHO].sort());
  }, 60_000);
});

// ── o caminho do editor ──────────────────────────────────────────────────────

interface Marcacao {
  readonly zoneKey: string;
  readonly ids: readonly string[];
  readonly label?: string;
  readonly zonasAtuais?: readonly ZonaDoProduto[];
}

/**
 * Marca e grava **pelo caminho do editor**. Nenhum `svg_selector` é montado neste arquivo e
 * nenhum `insert` direto em `product_zones` acontece: quem decide a forma do seletor é
 * `marcarZona`, e quem escolhe entre INSERT e UPDATE é `gravarZonaNoBanco`.
 */
async function marcarEGravar(
  cenario: Cenario,
  canonico: string,
  marcacao: Marcacao,
): Promise<ZonaDoProduto> {
  const zona = marcarZona({
    svgCanonico: canonico,
    zonasAtuais: [...(marcacao.zonasAtuais ?? [])],
    zoneKey: marcacao.zoneKey,
    idsMarcados: [...marcacao.ids],
    ...(marcacao.label === undefined ? {} : { label: marcacao.label }),
  });

  return gravarZonaNoBanco(cenario.clienteA, {
    tenantId: cenario.tenantA,
    productId: cenario.produtoA,
    zona,
  });
}

/** O canônico como o EDITOR o vê: pelo cliente do dono, sob a policy do bucket. */
async function baixarCanonicoComoODono(cenario: Cenario): Promise<string> {
  const { data, error } = await cenario.clienteA.storage
    .from(BUCKET_DO_ASSET_BASE)
    .download(cenario.assetDoProdutoA);
  if (error || !data) throw error ?? new Error('o dono não conseguiu baixar o asset-base');
  return data.text();
}

// ── o caminho da API ─────────────────────────────────────────────────────────

/** Chama o handler como a Vercel chamaria: `Request` montado à mão, sem cliente injetado. */
async function pedirVariante(
  cenario: Cenario,
  chaves: ChavesDoCenario,
  cores: Record<string, string>,
): Promise<string> {
  const resposta = await handlerDaVariante.fetch(
    new Request(`${HOST}/api/v1/products/${cenario.produtoA}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${chaves.ativaDeA.chave}`,
      },
      body: JSON.stringify(cores),
    }),
  );

  const corpo = await resposta.text();
  // A mensagem de erro entra na falha do teste de propósito: sem ela, um 409 por seletor
  // quebrado apareceria como "esperava 200, recebeu 409" e mandaria procurar no lugar errado.
  if (resposta.status !== 200) {
    throw new Error(`A API recusou o pedido (${resposta.status}): ${corpo}`);
  }
  return corpo;
}

// ── as asserções sobre o desenho ─────────────────────────────────────────────

/**
 * O `fill` do elemento com aquele `id`, lido do SVG devolvido.
 *
 * Por que por elemento e não por contagem de cor: contar `#C0392B` no documento inteiro
 * passaria mesmo se a cor tivesse ido parar no elemento errado — que é precisamente o modo
 * de falha que o princípio nº1 proíbe.
 */
function fillDoElemento(svg: string, id: string): string | null {
  const elemento = new RegExp(`<[^>]*\\sid="${id}"[^>]*>`).exec(svg)?.[0];
  if (elemento === undefined) return null;
  return /\sfill="([^"]*)"/.exec(elemento)?.[1] ?? null;
}

/**
 * Os ids dos elementos cuja linha mudou entre o canônico e a variante, ordenados.
 *
 * É a metade de "mudou a zona pedida e **nada mais**" que nenhuma asserção de status alcança:
 * um `svg_selector` que capturasse o calçado inteiro devolveria 200 com o desenho destruído.
 */
function idsQueMudaram(antes: string, depois: string): string[] {
  const linhasAntes = antes.split('\n');
  const linhasDepois = depois.split('\n');

  if (linhasAntes.length !== linhasDepois.length) {
    throw new Error(
      `A variante tem ${linhasDepois.length} linhas e o canônico tem ${linhasAntes.length}: ` +
        'o motor mexeu na estrutura do documento, não só na cor.',
    );
  }

  const mudaram: string[] = [];
  for (let i = 0; i < linhasAntes.length; i += 1) {
    if (linhasAntes[i] === linhasDepois[i]) continue;
    const id = /\sid="([^"]*)"/.exec(linhasDepois[i] ?? '')?.[1];
    // Linha diferente sem id é mudança que ninguém consegue atribuir a uma zona — falha alto
    // em vez de sumir da lista.
    if (id === undefined) {
      throw new Error(`A linha ${i + 1} mudou e não tem id: ${linhasDepois[i]}`);
    }
    mudaram.push(id);
  }
  return mudaram.sort();
}
