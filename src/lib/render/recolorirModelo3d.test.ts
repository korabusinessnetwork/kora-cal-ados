// O teste que carrega o peso deste arquivo é o primeiro do bloco "ida e volta do hex": pinta
// `#C0392B`, lê a cor de volta do documento e exige `#C0392B`. É o princípio nº1 (cor no editor =
// cor na API) verificável no nível do artefato, sem GPU, sem navegador e sem palco 3D.
//
// Os modelos aqui nascem do próprio `normalizarModelo3d`, e não escritos à mão: o motor promete
// operar sobre o canônico, então testá-lo contra um canônico de verdade é o que torna a promessa
// verificável, e de quebra prova que as duas metades se encaixam.

import { describe, expect, it } from 'vitest';
import { linearParaHex, type CorLinear } from './corSrgbLinear';
import { ErroDeVariante } from './erros';
import { gltfDeTeste, type DescricaoDeGltf } from './fixtures/gltfDeTeste';
import { normalizarModelo3d } from './normalizarModelo3d';
import { recolorirModelo3d, relatorioDeZonas3d, type Zona3d } from './recolorirModelo3d';

function canonico(descricao: DescricaoDeGltf): string {
  return normalizarModelo3d(gltfDeTeste(descricao)).modelo;
}

interface DocumentoLido {
  nodes?: Array<{ name?: string; mesh?: number }>;
  meshes?: Array<{ primitives?: Array<{ material?: number }> }>;
  materials?: Array<{ pbrMetallicRoughness?: { baseColorFactor?: number[] } }>;
}

function lerDocumento(modelo: string): DocumentoLido {
  return JSON.parse(modelo) as DocumentoLido;
}

/** A cor da malha, de volta em hex. É a volta completa: hex → linear → documento → hex. */
function corDaMalha(modelo: string, nome: string): string {
  const documento = lerDocumento(modelo);
  const no = (documento.nodes ?? []).find((candidato) => candidato.name === nome);
  if (no?.mesh === undefined) throw new Error(`malha "${nome}" não existe no modelo`);

  const indice = documento.meshes?.[no.mesh]?.primitives?.[0]?.material;
  const fator = documento.materials?.[indice ?? -1]?.pbrMetallicRoughness?.baseColorFactor;
  if (fator === undefined) throw new Error(`malha "${nome}" está sem baseColorFactor`);

  return linearParaHex(fator.slice(0, 3) as unknown as CorLinear);
}

function alfaDaMalha(modelo: string, nome: string): number | undefined {
  const documento = lerDocumento(modelo);
  const no = (documento.nodes ?? []).find((candidato) => candidato.name === nome);
  const indice = documento.meshes?.[no?.mesh ?? -1]?.primitives?.[0]?.material;

  return documento.materials?.[indice ?? -1]?.pbrMetallicRoughness?.baseColorFactor?.[3];
}

/** O documento inteiro menos as cores, para provar que nada além delas mudou. */
function semCores(modelo: string): unknown {
  const documento = JSON.parse(modelo) as {
    materials?: Array<{ pbrMetallicRoughness?: { baseColorFactor?: number[] } }>;
  };

  for (const material of documento.materials ?? []) {
    delete material.pbrMetallicRoughness?.baseColorFactor;
  }

  return documento;
}

function codigoRecusado(executar: () => unknown): string {
  try {
    executar();
  } catch (erro) {
    if (erro instanceof ErroDeVariante) return erro.codigo;
    throw erro;
  }
  throw new Error('esperava uma recusa, mas o recolor passou');
}

function mensagemRecusada(executar: () => unknown): string {
  try {
    executar();
  } catch (erro) {
    if (erro instanceof ErroDeVariante) return erro.message;
    throw erro;
  }
  throw new Error('esperava uma recusa, mas o recolor passou');
}

/** Um tênis mínimo com três peças, cada uma sua zona. */
const TENIS: DescricaoDeGltf = {
  nos: [
    { nome: 'sola', malha: 0 },
    { nome: 'cabedal', malha: 1 },
    { nome: 'cadarco', malha: 2 },
  ],
  malhas: [{ materiais: [0] }, { materiais: [1] }, { materiais: [2] }],
  materiais: [{ cor: [1, 1, 1, 1] }, { cor: [1, 1, 1, 1] }, { cor: [1, 1, 1, 1] }],
};

const ZONAS: Zona3d[] = [
  { zone_key: 'sola', malhas: ['sola'] },
  { zone_key: 'cabedal', malhas: ['cabedal'] },
  { zone_key: 'cadarco', malhas: ['cadarco'] },
];

describe('ida e volta do hex: o princípio nº1 no nível do artefato', () => {
  it('a cor que entra é exatamente a cor que sai do documento', () => {
    const variante = recolorirModelo3d(canonico(TENIS), ZONAS, { sola: '#C0392B' });

    expect(corDaMalha(variante, 'sola')).toBe('#C0392B');
  });

  it.each(['#000000', '#FFFFFF', '#0A0A0A', '#C0392B', '#2ECC71', '#123456'])(
    '%s atravessa o motor inteiro sem deslocar um byte',
    (cor) => {
      const variante = recolorirModelo3d(canonico(TENIS), ZONAS, { sola: cor });

      expect(corDaMalha(variante, 'sola')).toBe(cor);
    },
  );

  it('hex curto é expandido por validarCor e chega inteiro do outro lado', () => {
    const variante = recolorirModelo3d(canonico(TENIS), ZONAS, { sola: '#f00' });

    expect(corDaMalha(variante, 'sola')).toBe('#FF0000');
  });
});

describe('pinta a zona pedida, e só ela', () => {
  it('a malha pedida muda e as outras ficam como estavam', () => {
    const modelo = canonico(TENIS);
    const variante = recolorirModelo3d(modelo, ZONAS, { sola: '#C0392B' });

    expect(corDaMalha(variante, 'sola')).toBe('#C0392B');
    expect(corDaMalha(variante, 'cabedal')).toBe(corDaMalha(modelo, 'cabedal'));
    expect(corDaMalha(variante, 'cadarco')).toBe(corDaMalha(modelo, 'cadarco'));
  });

  it('zona com várias malhas pinta todas com a mesma cor', () => {
    const zonas: Zona3d[] = [{ zone_key: 'solado', malhas: ['sola', 'cabedal'] }];
    const variante = recolorirModelo3d(canonico(TENIS), zonas, { solado: '#2ECC71' });

    expect(corDaMalha(variante, 'sola')).toBe('#2ECC71');
    expect(corDaMalha(variante, 'cabedal')).toBe('#2ECC71');
  });

  it('malha com duas primitivas tem as duas pintadas', () => {
    const modelo = canonico({
      nos: [{ nome: 'cabedal', malha: 0 }],
      malhas: [{ materiais: [0, 0] }],
      materiais: [{ cor: [1, 1, 1, 1] }],
    });
    const zonas: Zona3d[] = [{ zone_key: 'cabedal', malhas: ['cabedal'] }];

    const documento = lerDocumento(
      recolorirModelo3d(modelo, zonas, { cabedal: '#3498DB' }),
    );

    const fatores = (documento.meshes?.[0]?.primitives ?? []).map(
      (primitiva) =>
        documento.materials?.[primitiva.material ?? -1]?.pbrMetallicRoughness?.baseColorFactor,
    );

    expect(fatores).toHaveLength(2);
    for (const fator of fatores) {
      expect(linearParaHex(fator?.slice(0, 3) as unknown as CorLinear)).toBe('#3498DB');
    }
  });

  it('pedido vazio devolve o modelo inalterado, sem erro', () => {
    // "Nada a pintar" não é falha. Recusar aqui quebraria o preview do editor no instante em
    // que o time apaga a última cor do formulário.
    const modelo = canonico(TENIS);

    expect(recolorirModelo3d(modelo, ZONAS, {})).toBe(modelo);
  });
});

describe('só baseColorFactor muda', () => {
  it('o resto do documento sai idêntico, incluindo o que o motor não entende', () => {
    const modelo = canonico(TENIS);
    const variante = recolorirModelo3d(modelo, ZONAS, { sola: '#C0392B', cadarco: '#000000' });

    expect(semCores(variante)).toEqual(semCores(modelo));
  });

  it('o motor não mexe no texto que recebeu', () => {
    // Garantia de que a entrada é tratada como imutável: o canônico do Storage é lido por várias
    // requisições, e um motor que mutasse o objeto recebido contaminaria a próxima.
    const modelo = canonico(TENIS);
    const copia = `${modelo}`;

    recolorirModelo3d(modelo, ZONAS, { sola: '#C0392B' });

    expect(modelo).toBe(copia);
  });
});

describe('alfa', () => {
  it('é preservado: pintar não torna opaca uma peça translúcida', () => {
    const modelo = canonico({
      nos: [{ nome: 'sola', malha: 0 }],
      malhas: [{ materiais: [0] }],
      materiais: [{ cor: [1, 1, 1, 0.35] }],
    });
    const zonas: Zona3d[] = [{ zone_key: 'sola', malhas: ['sola'] }];

    const variante = recolorirModelo3d(modelo, zonas, { sola: '#C0392B' });

    expect(alfaDaMalha(variante, 'sola')).toBe(0.35);
    expect(corDaMalha(variante, 'sola')).toBe('#C0392B');
  });

  it('quando baseColorFactor não existe, o alfa criado é 1, o padrão do glTF', () => {
    const modelo = JSON.stringify({
      asset: { version: '2.0' },
      nodes: [{ name: 'sola', mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      materials: [{ pbrMetallicRoughness: { metallicFactor: 0 } }],
    });
    const zonas: Zona3d[] = [{ zone_key: 'sola', malhas: ['sola'] }];

    const variante = recolorirModelo3d(modelo, zonas, { sola: '#FF0000' });

    expect(alfaDaMalha(variante, 'sola')).toBe(1);
    expect(corDaMalha(variante, 'sola')).toBe('#FF0000');
  });
});

describe('recusas', () => {
  it('zone_key que o produto não tem é ZONA_NAO_ENCONTRADA', () => {
    expect(
      codigoRecusado(() => recolorirModelo3d(canonico(TENIS), ZONAS, { palmilha: '#FF0000' })),
    ).toBe('ZONA_NAO_ENCONTRADA');
  });

  it('nome de malha que sumiu do modelo é recusado, e a mensagem diz QUAL nome', () => {
    // O caso real: o modelo foi renormalizado, um nome mudou, e a zona gravada aponta para o
    // vazio. Sem o nome na mensagem, sobra caçar num arquivo de milhares de linhas.
    const zonas: Zona3d[] = [{ zone_key: 'sola', malhas: ['sola-antiga'] }];
    const executar = () => recolorirModelo3d(canonico(TENIS), zonas, { sola: '#FF0000' });

    expect(codigoRecusado(executar)).toBe('ZONA_NAO_ENCONTRADA');
    expect(mensagemRecusada(executar)).toContain('sola-antiga');
  });

  it('zona sem nenhuma malha é ZONA_NAO_ENCONTRADA, não um 200 que não pinta nada', () => {
    const zonas: Zona3d[] = [{ zone_key: 'sola', malhas: [] }];

    expect(
      codigoRecusado(() => recolorirModelo3d(canonico(TENIS), zonas, { sola: '#FF0000' })),
    ).toBe('ZONA_NAO_ENCONTRADA');
  });

  it('cor inválida é COR_INVALIDA, delegada a validarCor', () => {
    expect(
      codigoRecusado(() => recolorirModelo3d(canonico(TENIS), ZONAS, { sola: 'vermelho' })),
    ).toBe('COR_INVALIDA');
  });

  it('malha com textura é ZONA_NAO_RECOLORIVEL, o gêmeo do gradiente', () => {
    // A normalização apenas ANOTA a textura; é aqui que ela vira recusa. Cor chapa por cima de
    // textura apagaria o desenho sem ninguém pedir.
    const modelo = canonico({
      nos: [{ nome: 'logo', malha: 0 }],
      malhas: [{ materiais: [0] }],
      materiais: [{ textura: true }],
    });
    const zonas: Zona3d[] = [{ zone_key: 'logo', malhas: ['logo'] }];

    expect(codigoRecusado(() => recolorirModelo3d(modelo, zonas, { logo: '#FF0000' }))).toBe(
      'ZONA_NAO_RECOLORIVEL',
    );
  });

  it('modelo que não passou pela normalização, com primitiva sem material, é recusado', () => {
    // Criar o material aqui seria o motor normalizando por baixo do pano, que é o que o ADR-005
    // proíbe. Recusa, e a mensagem manda normalizar.
    const modelo = JSON.stringify({
      asset: { version: '2.0' },
      nodes: [{ name: 'sola', mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    });
    const zonas: Zona3d[] = [{ zone_key: 'sola', malhas: ['sola'] }];

    expect(codigoRecusado(() => recolorirModelo3d(modelo, zonas, { sola: '#FF0000' }))).toBe(
      'MODELO_3D_NAO_NORMALIZAVEL',
    );
  });

  it('JSON malformado é MODELO_3D_INVALIDO', () => {
    expect(codigoRecusado(() => recolorirModelo3d('{ nao e json', ZONAS, {}))).toBe(
      'MODELO_3D_INVALIDO',
    );
  });
});

describe('sobreposição, medida por material e não por nome', () => {
  it('duas zonas de nomes diferentes que caem no mesmo material são recusadas', () => {
    // O modelo NÃO é normalizado de propósito: é exatamente o caso em que comparar nomes de
    // malha não veria nada, e a última chave do JSON decidiria a cor das duas (BUG-013).
    const modelo = JSON.stringify({
      asset: { version: '2.0' },
      nodes: [
        { name: 'sola', mesh: 0 },
        { name: 'cabedal', mesh: 1 },
      ],
      meshes: [
        { primitives: [{ attributes: { POSITION: 0 }, material: 0 }] },
        { primitives: [{ attributes: { POSITION: 0 }, material: 0 }] },
      ],
      materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } }],
    });
    const zonas: Zona3d[] = [
      { zone_key: 'sola', malhas: ['sola'] },
      { zone_key: 'cabedal', malhas: ['cabedal'] },
    ];

    const executar = () =>
      recolorirModelo3d(modelo, zonas, { sola: '#FF0000', cabedal: '#00FF00' });

    expect(codigoRecusado(executar)).toBe('ZONAS_SOBREPOSTAS');
    expect(mensagemRecusada(executar)).toContain('sola');
    expect(mensagemRecusada(executar)).toContain('cabedal');
  });

  it('duas zonas pedindo a mesma malha são recusadas', () => {
    const zonas: Zona3d[] = [
      { zone_key: 'sola', malhas: ['sola'] },
      { zone_key: 'solado', malhas: ['sola'] },
    ];

    expect(
      codigoRecusado(() =>
        recolorirModelo3d(canonico(TENIS), zonas, { sola: '#FF0000', solado: '#00FF00' }),
      ),
    ).toBe('ZONAS_SOBREPOSTAS');
  });

  it('num canônico, zonas distintas nunca se sobrepõem: cada malha tem material próprio', () => {
    expect(() =>
      recolorirModelo3d(canonico(TENIS), ZONAS, {
        sola: '#FF0000',
        cabedal: '#00FF00',
        cadarco: '#0000FF',
      }),
    ).not.toThrow();
  });
});

describe('relatorioDeZonas3d', () => {
  it('conta as malhas que cada zona resolve hoje', () => {
    const zonas: Zona3d[] = [
      { zone_key: 'solado', malhas: ['sola', 'cabedal'] },
      { zone_key: 'cadarco', malhas: ['cadarco'] },
    ];

    expect(relatorioDeZonas3d(canonico(TENIS), zonas)).toEqual([
      { zone_key: 'solado', malhas: 2 },
      { zone_key: 'cadarco', malhas: 1 },
    ]);
  });

  it('mapeamento quebrado aparece como zero e NÃO lança', () => {
    // Quem está conferindo a lista quer ver todas as linhas, inclusive a errada. Lançar aqui
    // esconderia as zonas certas por causa de uma quebrada.
    const zonas: Zona3d[] = [
      { zone_key: 'sola', malhas: ['sola'] },
      { zone_key: 'fantasma', malhas: ['peca-que-sumiu'] },
    ];

    expect(relatorioDeZonas3d(canonico(TENIS), zonas)).toEqual([
      { zone_key: 'sola', malhas: 1 },
      { zone_key: 'fantasma', malhas: 0 },
    ]);
  });
});
