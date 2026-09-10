// Motor de cor do calçado 3D (ADR-007). Recebe o **modelo 3D canônico** (já passado por
// `normalizarModelo3d`) e aplica as cores pedidas nas zonas.
//
// É o gêmeo de `gerarVarianteDeCor`, e o paralelo é linha a linha de propósito: mesmo formato de
// entrada (canônico + zonas + `{zone_key: cor}`), mesmos códigos de erro para os mesmos
// conceitos, mesma regra de "valida tudo antes de pintar qualquer coisa". Um agente que conhece
// um dos dois arquivos consegue ler o outro sem aprender vocabulário novo, que é o que o ADR-003
// pede.
//
// A única diferença estrutural: em SVG a cor vai crua no atributo `fill`, aqui ela passa por
// `hexParaLinear` antes de encostar no documento. Esse é o ponto do ADR-007 D3, e é o motivo de
// este ser o único arquivo de produção autorizado a escrever em `baseColorFactor` com valor
// calculado. `soUmLugarEscreveCorNoGltf.test.ts` mantém a regra de pé.
//
// Este módulo NÃO desenha nada e não conhece three.js: glTF é JSON, pintar é escrever num campo.

import { hexParaLinear } from './corSrgbLinear';
import { ErroDeVariante } from './erros';
import { analisarGltf, escreverGltf } from './lerGltf';
import type { DocumentoGltf, MaterialDoGltf, PbrDoGltf } from './tiposDoGltf';
import { validarCor } from './validarCor';

/**
 * Uma zona de produto 3D: a `zone_key` pública e a lista de **nomes de malha exatos** que ela
 * cobre (ADR-007 D4).
 *
 * Nomes exatos, e nunca prefixo, pela mesma razão que `svg_selector` proíbe prefixo: `sola` como
 * prefixo capturaria uma peça futura `sola-lateral` e pintaria o lugar errado em silêncio.
 */
export interface Zona3d {
  zone_key: string;
  malhas: string[];
}

/** `{ "sola": "#C0392B" }` — a mesma forma do caminho SVG, e o mesmo nome de propósito. */
export type CoresPorZona = Record<string, string>;

/** O trabalho de uma zona, resolvido e conferido, antes de qualquer escrita. */
interface TrabalhoDeZona {
  zoneKey: string;
  cor: string;
  /** Índices de material que esta zona vai pintar. É por eles que a sobreposição é medida. */
  materiais: number[];
}

/**
 * Devolve o glTF com as zonas pedidas recoloridas.
 *
 * Lança em vez de devolver "quase certo": zona ausente, malha que sumiu, cor inválida, malha com
 * textura ou duas zonas caindo no mesmo material viram erro com código, nunca 200 silencioso.
 */
export function recolorirModelo3d(
  modeloCanonico: string,
  zonas: Zona3d[],
  coresPorZona: CoresPorZona,
): string {
  const documento = analisarGltf(modeloCanonico);
  const materiais = documento.materials ?? [];

  // Resolve e valida tudo antes de pintar: a variante sai inteira ou não sai. Sem isto, um erro
  // na terceira de quatro zonas devolveria um modelo com duas cores novas e uma velha, e o
  // cliente não teria como saber qual é qual.
  const trabalho = Object.entries(coresPorZona).map(([zoneKey, cor]) => ({
    zoneKey,
    cor: validarCor(cor, zoneKey),
    materiais: materiaisDaZona(documento, zonas, zoneKey),
  }));

  recusarSobreposicao(trabalho);

  for (const { cor, materiais: indices } of trabalho) {
    const linear = hexParaLinear(cor);

    for (const indice of indices) {
      const material = materiais[indice];
      if (material === undefined) continue;

      pintar(material, linear);
    }
  }

  return escreverGltf(documento);
}

/**
 * Quantas malhas cada zona resolve **hoje**, no modelo que está gravado.
 *
 * O gêmeo de `relatorioDeZonas`: o editor mostra isso no cadastro do produto para o time conferir
 * o mapeamento ANTES de existir variante, porque prevenção de erro vale mais que mensagem de erro
 * (CLAUDE.md). Zero é mapeamento quebrado, e precisa **aparecer como zero**, não lançar: quem
 * está conferindo a lista quer ver todas as linhas, inclusive a que está errada.
 */
export function relatorioDeZonas3d(
  modeloCanonico: string,
  zonas: Zona3d[],
): Array<{ zone_key: string; malhas: number }> {
  const documento = analisarGltf(modeloCanonico);
  const nosPorNome = indexarNosPorNome(documento);

  return zonas.map((zona) => ({
    zone_key: zona.zone_key,
    malhas: zona.malhas.filter((nome) => nosPorNome.has(nome)).length,
  }));
}

/** Do `zone_key` até os índices de material que ela pinta, falhando alto em cada etapa. */
function materiaisDaZona(documento: DocumentoGltf, zonas: Zona3d[], zoneKey: string): number[] {
  const zona = zonas.find((candidata) => candidata.zone_key === zoneKey);

  if (zona === undefined) {
    throw new ErroDeVariante(
      'ZONA_NAO_ENCONTRADA',
      `A zona "${zoneKey}" não existe neste produto.`,
    );
  }

  const nosPorNome = indexarNosPorNome(documento);
  const malhas = documento.meshes ?? [];
  const materiais = documento.materials ?? [];
  const indices: number[] = [];

  for (const nome of zona.malhas) {
    const no = nosPorNome.get(nome);

    // O gêmeo de "o seletor resolveu zero elementos": mapeamento quebrado, não zona vazia.
    // Acontece de verdade quando o modelo é renormalizado e um nome muda, por isso a mensagem
    // precisa dizer QUAL nome faltou, senão sobra caçar num arquivo de milhares de linhas.
    if (no?.mesh === undefined) {
      throw new ErroDeVariante(
        'ZONA_NAO_ENCONTRADA',
        `A malha "${nome}" da zona "${zoneKey}" não existe neste modelo 3D. O modelo foi trocado ou renormalizado depois de a zona ser marcada.`,
      );
    }

    for (const primitiva of malhas[no.mesh]?.primitives ?? []) {
      const indice = primitiva?.material;

      // Canônico sempre tem material em toda primitiva, porque a normalização cria um quando
      // falta. Chegar aqui sem material significa que o arquivo NÃO passou pela normalização,
      // e criar um material agora seria o motor normalizando por baixo do pano: o mesmo erro
      // que o ADR-005 proíbe no editor. Recusa, e a mensagem diz o caminho.
      if (indice === undefined || materiais[indice] === undefined) {
        throw new ErroDeVariante(
          'MODELO_3D_NAO_NORMALIZAVEL',
          `A malha "${nome}" não tem material próprio. Este modelo não passou pela normalização, e sem material não há o que pintar.`,
        );
      }

      // Gêmeo exato do gradiente no SVG (ADR-004 D1): a normalização apenas ANOTA a textura em
      // `malhasNaoRecoloriveis`, e é aqui, na hora de pintar, que ela vira recusa. Escrever cor
      // chapa por cima apagaria o desenho da textura sem ninguém pedir.
      if (materiais[indice]?.pbrMetallicRoughness?.baseColorTexture !== undefined) {
        throw new ErroDeVariante(
          'ZONA_NAO_RECOLORIVEL',
          `A malha "${nome}" da zona "${zoneKey}" tem a cor vinda de uma textura e não aceita cor chapa.`,
        );
      }

      indices.push(indice);
    }
  }

  if (indices.length === 0) {
    throw new ErroDeVariante(
      'ZONA_NAO_ENCONTRADA',
      `A zona "${zoneKey}" não cobre nenhuma malha deste modelo 3D.`,
    );
  }

  return indices;
}

/**
 * Duas zonas que caem no mesmo material fariam a ÚLTIMA chave do JSON decidir a cor das duas,
 * sem erro. É o BUG-013 outra vez, por outro caminho.
 *
 * A comparação é por **índice de material**, e não por nome de malha, e a diferença importa: num
 * canônico cada malha tem material próprio, então os dois critérios dariam o mesmo resultado. Num
 * modelo que não passou pela normalização, duas malhas de nomes diferentes podem dividir material,
 * e aí comparar nomes não veria nada. Comparar o que de fato recebe a cor vê sempre.
 */
function recusarSobreposicao(trabalho: TrabalhoDeZona[]): void {
  for (let a = 0; a < trabalho.length; a += 1) {
    for (let b = a + 1; b < trabalho.length; b += 1) {
      const esquerda = trabalho[a] as TrabalhoDeZona;
      const direita = trabalho[b] as TrabalhoDeZona;
      const comuns = esquerda.materiais.filter((indice) => direita.materiais.includes(indice));

      if (comuns.length > 0) {
        throw new ErroDeVariante(
          'ZONAS_SOBREPOSTAS',
          `As zonas "${esquerda.zoneKey}" e "${direita.zoneKey}" dividem ${comuns.length} material(is) do modelo 3D. Qual cor vale seria decidido pela ordem do pedido — corrija o mapeamento das zonas.`,
        );
      }
    }
  }
}

/**
 * Escreve a cor no material, preservando o alfa.
 *
 * O alfa é o quarto componente de `baseColorFactor`, e trocá-lo aqui tornaria opaca uma peça
 * translúcida sem ninguém pedir. Quando o campo não existe, o padrão do glTF 2.0 é `[1,1,1,1]`,
 * então o alfa a preservar é `1`, nunca `undefined`.
 */
function pintar(material: MaterialDoGltf, linear: readonly [number, number, number]): void {
  const pbr: PbrDoGltf = material.pbrMetallicRoughness ?? {};
  const alfa = pbr.baseColorFactor?.[3] ?? 1;

  pbr.baseColorFactor = [...linear, alfa];
  material.pbrMetallicRoughness = pbr;
}

/**
 * Nome de malha para o nó que a carrega.
 *
 * Vale lembrar por que o índice é sobre `nodes` e não sobre `meshes`: o nome que a zona guarda é
 * o do **nó** (ADR-007 D4), porque é o nó que a normalização batiza e é ele a unidade
 * endereçável. `mesh.name` existe no formato e é ignorado aqui de propósito.
 */
function indexarNosPorNome(documento: DocumentoGltf) {
  const porNome = new Map<string, { mesh?: number }>();

  for (const no of documento.nodes ?? []) {
    if (no?.name === undefined || no.name === '') continue;
    if (!porNome.has(no.name)) porNome.set(no.name, no);
  }

  return porNome;
}
