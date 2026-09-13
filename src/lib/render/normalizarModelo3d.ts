// Normalizador de modelo 3D (ADR-007, decisões 4 e 5). Roda UMA vez, no provisionamento, e
// produz o **modelo 3D canônico** — a única versão que o editor e a API leem.
//
// É o gêmeo de `normalizarSvg.ts`, e o paralelo é literal: lá a cor precisa morar em atributo
// de apresentação para que todo renderizador a interprete igual; aqui cada malha endereçável
// precisa ter **nome próprio** e **material próprio** para que pintar uma zona pinte aquela
// zona e só ela.
//
// A parte que não tem paralelo no SVG, e que é a razão de este arquivo existir: em glTF é
// idiomático várias malhas apontarem para o MESMO material. Duas malhas de zonas diferentes
// compartilhando material significa que pintar a `sola` pinta também o `cabedal` — sem erro,
// sem aviso, com 200 na resposta. É o análogo tridimensional de `ZONAS_SOBREPOSTAS`, e a
// decisão do ADR-007 D5 é resolvê-lo aqui, no provisionamento, nunca na geração.
//
// Este módulo NÃO desenha nada e não conhece three.js: glTF é JSON, e separar material é
// manipulação de objeto. three.js entra só no navegador (ADR-007, Notas de Implementação).

import { ErroDeVariante } from './erros';
import { analisarGltf, escreverGltf } from './lerGltf';
import { aplicarPoliticaDeNome } from './nomeDeMalha';
import type { DocumentoGltf, MaterialDoGltf, NoDoGltf } from './tiposDoGltf';

export interface RelatorioDeNormalizacao3d {
  nomesRenomeados: Array<{ de: string; para: string }>;
  /** Nomes cunhados em nó que veio anônimo — é o que torna a zona endereçável (ADR-007 D4). */
  nomesAtribuidos: string[];
  /** Malhas clonadas porque dois nós referenciavam a mesma — ver `separarMalhasCompartilhadas`. */
  malhasDuplicadas: number;
  /** Materiais clonados porque duas primitivas referenciavam o mesmo (ADR-007 D5). */
  materiaisDuplicados: number;
  /** Materiais criados para primitiva que não tinha nenhum — sem material não há o que pintar. */
  materiaisCriados: number;
  /**
   * OBSERVAÇÃO, não mudança: nomes das malhas cuja cor base vem de textura.
   *
   * Por que observar em vez de recusar o arquivo: é o gêmeo exato do gradiente no SVG, e lá o
   * projeto já respondeu. `normalizarSvg` **não** recusa gradiente; quem recusa é o motor, na
   * hora de pintar, com `ZONA_NAO_RECOLORIVEL` (ADR-004, decisão 1). Recusar aqui rejeitaria o
   * modelo inteiro por causa de uma textura num logo que talvez ninguém vá pintar — e o
   * princípio é prevenção de erro, não proibição preventiva. O que não pode acontecer é a
   * textura passar em silêncio: por isso ela sai nomeada no relatório, e o provisionamento a
   * imprime para quem sobe a peça.
   *
   * Este campo é a única parte do relatório que continua preenchida numa segunda passada — ele
   * descreve o modelo, não o que a normalização fez. A idempotência é dos campos de mudança.
   */
  malhasNaoRecoloriveis: string[];
}

export interface ResultadoDeNormalizacao3d {
  modelo: string;
  relatorio: RelatorioDeNormalizacao3d;
}

/** O material padrão do glTF 2.0, escrito por extenso — ver `criarMaterialProprio`. */
const MATERIAL_PADRAO_DO_GLTF: MaterialDoGltf = {
  pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 1, roughnessFactor: 1 },
};

/**
 * Recebe o glTF cru e devolve o modelo 3D canônico + relatório do que mudou.
 *
 * Lança `MODELO_3D_INVALIDO` / `MODELO_3D_NAO_NORMALIZAVEL` quando não dá para garantir que
 * cada zona seja pintável isoladamente — recusar com explicação é preferível a aceitar um
 * modelo meio-quebrado, que é a mesma regra do ADR-004 para o SVG. Nunca devolve um documento
 * parcialmente normalizado: ou sai canônico, ou levanta.
 */
export function normalizarModelo3d(gltfTexto: string): ResultadoDeNormalizacao3d {
  const documento = analisarGltf(gltfTexto);
  recusarOQueNaoDaParaNormalizar(documento);

  const nos = documento.nodes ?? [];
  const enderecaveis = acharEnderecaveis(documento, nos);

  const relatorio: RelatorioDeNormalizacao3d = {
    nomesRenomeados: [],
    nomesAtribuidos: [],
    malhasDuplicadas: 0,
    materiaisDuplicados: 0,
    materiaisCriados: 0,
    malhasNaoRecoloriveis: [],
  };

  // Nome primeiro: o relatório de textura fala em nome de malha, e separar material não muda
  // nome nenhum. A ordem inversa daria um relatório que nomeia malhas com nome provisório.
  aplicarPoliticaDeNome(nos, enderecaveis, relatorio);
  separarMalhasCompartilhadas(documento, nos, enderecaveis, relatorio);
  darMaterialProprioACadaPrimitiva(documento, nos, enderecaveis, relatorio);
  anotarMalhasNaoRecoloriveis(documento, nos, enderecaveis, relatorio);

  return { modelo: escreverGltf(documento), relatorio };
}

/**
 * As recusas, todas antes de qualquer escrita no documento.
 *
 * `MODELO_3D_INVALIDO` é "isto não é um glTF 2.0"; `MODELO_3D_NAO_NORMALIZAVEL` é "é um glTF
 * 2.0 e mesmo assim não consigo torná-lo canônico". A separação importa porque a segunda
 * mensagem tem que dizer o que fazer — quem exporta consegue agir sobre ela.
 */
function recusarOQueNaoDaParaNormalizar(documento: DocumentoGltf): void {
  const versao = documento.asset?.version;
  if (typeof versao !== 'string' || !versao.startsWith('2.')) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      'Arquivo não é um glTF 2.0: falta "asset.version" começando em 2.',
    );
  }

  if (!Array.isArray(documento.nodes) || documento.nodes.length === 0) {
    throw new ErroDeVariante('MODELO_3D_INVALIDO', 'O glTF não tem nós ("nodes"), então não há malha para endereçar.');
  }

  // Extensão exigida é o exportador dizendo "sem entender isto, o arquivo renderiza errado".
  // Normalizar mesmo assim entregaria um modelo que parece certo aqui e sai errado no cliente.
  const exigidas = documento.extensionsRequired;
  if (Array.isArray(exigidas) && exigidas.length > 0) {
    throw new ErroDeVariante(
      'MODELO_3D_NAO_NORMALIZAVEL',
      `O glTF exige as extensões ${exigidas.join(', ')}, que não são suportadas. Exporte sem extensões obrigatórias (glTF 2.0 puro, sem Draco nem compressão de malha).`,
    );
  }

  // Mesmo raciocínio da referência externa em `normalizarSvg`: o arquivo de um cliente não faz
  // requisição para fora, e uma URI que some depois quebraria o produto em silêncio. Aqui é
  // recusa e não remoção — tirar o `uri` de um buffer deixaria o modelo sem geometria.
  for (const [rotulo, recursos] of [
    ['buffers', documento.buffers],
    ['images', documento.images],
  ] as const) {
    for (const recurso of recursos ?? []) {
      const uri = recurso?.uri;
      if (typeof uri === 'string' && uri !== '' && !uri.startsWith('data:')) {
        throw new ErroDeVariante(
          'MODELO_3D_NAO_NORMALIZAVEL',
          `O glTF aponta para um arquivo externo em "${rotulo}" (${uri}). Exporte com os dados embutidos (.gltf com buffers em data: URI, ou .glb desempacotado antes).`,
        );
      }
    }
  }
}

/**
 * Endereçável é o nó que tem malha. Índice inválido é arquivo quebrado, não nó sem malha.
 *
 * **Hierarquia**: a busca é plana de propósito. Em glTF a árvore de `children` é livre, e um nó
 * com malha pode ser filho de outro nó com malha — e mesmo assim os dois são zonas
 * **independentes**. É o oposto da resposta que o projeto deu para o SVG (lá a zona pinta o
 * elemento marcado *e seus descendentes pintáveis*), e a diferença não é inconsistência: em SVG
 * `fill` é herdado pela árvore, então o descendente já ficaria da cor do pai de qualquer jeito;
 * em glTF o material mora na primitive do mesh e a cena não o herda, então fazer o pai "absorver"
 * o filho criaria uma zona que pinta pedaço do modelo que ela não mostra na lista. Nó de
 * transformação, junta e câmera continuam de fora: não têm malha, não são pintáveis.
 */
function acharEnderecaveis(documento: DocumentoGltf, nos: NoDoGltf[]): Set<number> {
  const malhas = documento.meshes ?? [];
  const enderecaveis = new Set<number>();

  for (let indice = 0; indice < nos.length; indice += 1) {
    const no = nos[indice];
    if (no === undefined || no.mesh === undefined) continue;

    if (!Number.isInteger(no.mesh) || no.mesh < 0 || no.mesh >= malhas.length) {
      throw new ErroDeVariante(
        'MODELO_3D_INVALIDO',
        `O nó ${indice} aponta para a malha ${String(no.mesh)}, que não existe.`,
      );
    }

    enderecaveis.add(indice);
  }

  if (enderecaveis.size === 0) {
    throw new ErroDeVariante(
      'MODELO_3D_INVALIDO',
      'Nenhum nó do glTF tem malha, então não há nada endereçável para virar zona.',
    );
  }

  return enderecaveis;
}

/**
 * Garante que cada nó endereçável tenha a SUA malha.
 *
 * Por que isto existe, e por que duplicar só o material não bastaria: em glTF o material mora
 * na *primitive do mesh*, não no nó. Dois nós que referenciam o mesmo `mesh` continuam
 * compartilhando cor depois de qualquer conserto feito no nível do material — o conserto teria
 * que ser feito no mesh, que é justamente o objeto compartilhado.
 *
 * A duplicação **não copia geometria**: o mesh clonado guarda os mesmos índices de `accessors`,
 * então `buffers`, `bufferViews` e `accessors` não crescem em um byte. O que é clonado é o
 * pedaço de JSON que diz "esta geometria usa este material".
 */
function separarMalhasCompartilhadas(
  documento: DocumentoGltf,
  nos: NoDoGltf[],
  enderecaveis: ReadonlySet<number>,
  relatorio: RelatorioDeNormalizacao3d,
): void {
  const malhas = documento.meshes ?? [];
  const tomadas = new Set<number>();

  for (let indice = 0; indice < nos.length; indice += 1) {
    if (!enderecaveis.has(indice)) continue;

    const no = nos[indice];
    if (no === undefined || no.mesh === undefined) continue;

    if (!tomadas.has(no.mesh)) {
      tomadas.add(no.mesh);
      continue;
    }

    const original = malhas[no.mesh];
    if (original === undefined) continue;

    malhas.push(clonar(original));
    no.mesh = malhas.length - 1;
    relatorio.malhasDuplicadas += 1;
  }

  // Só reatribui se houver conteúdo: glTF 2.0 proíbe array vazio, e escrever `"meshes": []`
  // num documento que não tinha a chave produziria um canônico que o validador recusa.
  if (malhas.length > 0) documento.meshes = malhas;
}

/**
 * Garante que cada primitiva de cada nó endereçável tenha o SEU material (ADR-007 D5).
 *
 * A regra é "índice de material nunca aparece duas vezes", e ela é mais forte do que o
 * estritamente necessário: duas primitivas do MESMO nó pertencem à mesma zona, então
 * compartilhar material entre elas seria inofensivo hoje. Ficou assim mesmo por dois motivos.
 * O invariante vira uma asserção de uma linha ("nenhum índice repetido"), que um teste
 * verifica sem conhecer a topologia do modelo; e a exceção "pode compartilhar dentro do mesmo
 * nó" é exatamente o tipo de regra que alguém depois generaliza errado. Material é algumas
 * dezenas de bytes de JSON — o custo de ser rígido aqui é irrelevante perto do custo de a
 * cor vazar entre zonas.
 */
function darMaterialProprioACadaPrimitiva(
  documento: DocumentoGltf,
  nos: NoDoGltf[],
  enderecaveis: ReadonlySet<number>,
  relatorio: RelatorioDeNormalizacao3d,
): void {
  const malhas = documento.meshes ?? [];
  const materiais = documento.materials ?? [];
  const tomados = new Set<number>();

  for (let indice = 0; indice < nos.length; indice += 1) {
    if (!enderecaveis.has(indice)) continue;

    const no = nos[indice];
    if (no === undefined || no.mesh === undefined) continue;

    const malha = malhas[no.mesh];
    if (malha === undefined) continue;

    for (const primitiva of malha.primitives ?? []) {
      if (primitiva === undefined) continue;

      const atual = primitiva.material;

      if (atual === undefined) {
        materiais.push(clonar(MATERIAL_PADRAO_DO_GLTF));
        primitiva.material = materiais.length - 1;
        relatorio.materiaisCriados += 1;
        tomados.add(primitiva.material);
        continue;
      }

      if (!Number.isInteger(atual) || atual < 0 || atual >= materiais.length) {
        throw new ErroDeVariante(
          'MODELO_3D_INVALIDO',
          `A malha "${no.name ?? indice}" aponta para o material ${String(atual)}, que não existe.`,
        );
      }

      if (!tomados.has(atual)) {
        tomados.add(atual);
        continue;
      }

      const original = materiais[atual];
      if (original === undefined) continue;

      materiais.push(clonar(original));
      primitiva.material = materiais.length - 1;
      tomados.add(primitiva.material);
      relatorio.materiaisDuplicados += 1;
    }
  }

  if (materiais.length > 0) documento.materials = materiais;
}

/** Cor base vinda de textura não vira cor chapa — ver `malhasNaoRecoloriveis` no relatório. */
function anotarMalhasNaoRecoloriveis(
  documento: DocumentoGltf,
  nos: NoDoGltf[],
  enderecaveis: ReadonlySet<number>,
  relatorio: RelatorioDeNormalizacao3d,
): void {
  const malhas = documento.meshes ?? [];
  const materiais = documento.materials ?? [];

  for (let indice = 0; indice < nos.length; indice += 1) {
    if (!enderecaveis.has(indice)) continue;

    const no = nos[indice];
    if (no === undefined || no.mesh === undefined) continue;

    const malha = malhas[no.mesh];
    if (malha === undefined) continue;

    const temTextura = (malha.primitives ?? []).some((primitiva) => {
      const indiceDoMaterial = primitiva?.material;
      if (indiceDoMaterial === undefined) return false;
      return materiais[indiceDoMaterial]?.pbrMetallicRoughness?.baseColorTexture !== undefined;
    });

    if (temTextura && no.name !== undefined) relatorio.malhasNaoRecoloriveis.push(no.name);
  }
}

/** Cópia profunda por JSON: o documento inteiro já é JSON, então não há o que ela não cubra. */
function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}
