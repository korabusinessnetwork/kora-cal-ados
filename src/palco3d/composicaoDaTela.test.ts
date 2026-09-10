// O que estes testes protegem: que a tela do calçado montado nunca fique sem nada para mostrar.
//
// Toda recusa desta tela precisa virar texto legível, e nunca um calçado pela metade nem uma
// exceção que apaga a tela. É a regra de "estados sempre visíveis" do CLAUDE.md no lugar onde ela
// é mais fácil de quebrar: dentro de um componente que nenhum teste alcança, porque jsdom não tem
// WebGL. Por isso a decisão mora aqui fora, e por isso este arquivo existe.

import { describe, expect, it } from 'vitest';

import { escolhasDaComposicao, montarDaTela, type EscolhaDaTela } from './composicaoDaTela';
import { catalogoDeProva, composicaoDeProva, gltfDaPecaDeProva } from '../lib/acervo/acervoDeProva';
import { validarComposicao } from '../lib/composicao/validarComposicao';
import type { ProvedorDeGltfDaPeca } from '../lib/composicao/montarComposicao';
import type { Forma } from '../lib/composicao/tiposDaComposicao';

const CATALOGO = catalogoDeProva();
const FORMA = CATALOGO.formas[0] as Forma;
const DEMO = validarComposicao(composicaoDeProva(), CATALOGO);

const DO_ACERVO: ProvedorDeGltfDaPeca = (peca, parametros) =>
  gltfDaPecaDeProva(peca.id, parametros);

function montar(escolhas: ReadonlyMap<string, EscolhaDaTela>) {
  return montarDaTela(FORMA, CATALOGO, escolhas, DO_ACERVO);
}

describe('escolhasDaComposicao', () => {
  it('traz uma entrada por peça, com o id e a cor que a composição já tinha', () => {
    // O estado inicial da tela sai da composição demo, e não de uma segunda lista digitada no
    // componente. Duas listas do mesmo calçado poderiam discordar, e a tela abriria mostrando
    // algo que a composição não diz.
    const escolhas = escolhasDaComposicao(DEMO);

    expect([...escolhas.keys()]).toEqual(['sola', 'cabedal', 'cadarco']);
    expect(escolhas.get('sola')).toMatchObject({ pecaId: 'prova-sola-plana', cor: '#F2F2F2' });
    expect(escolhas.get('cadarco')?.cor).toBe('#E8B33C');
  });
});

describe('montarDaTela', () => {
  it('as escolhas da demo viram um calçado montado, sem erro', () => {
    const { modelo, zonas, erro } = montar(escolhasDaComposicao(DEMO));

    expect(erro).toBeNull();
    expect(modelo).toContain('prova-cabedal-baixo');
    expect(zonas.map(({ zone_key }) => zone_key)).toEqual(['sola', 'cabedal', 'cadarco']);
  });

  it('categoria opcional deixada de fora é escolha legítima, e o calçado monta sem ela', () => {
    // `null` na categoria opcional não é estado vazio esperando ser preenchido: é o tênis sem
    // cadarço. Tratar isso como falta faria a tela recusar uma composição que o produto aceita.
    const escolhas = new Map(escolhasDaComposicao(DEMO)).set('cadarco', { pecaId: null });
    const { modelo, zonas, erro } = montar(escolhas);

    expect(erro).toBeNull();
    expect(zonas.map(({ zone_key }) => zone_key)).toEqual(['sola', 'cabedal']);
    expect(modelo).not.toContain('prova-cadarco-reto');
  });

  it('categoria obrigatória vazia devolve erro legível, e nenhum calçado pela metade', () => {
    // O caso que decide o desenho do módulo: sem a sola, o certo não é montar um cabedal
    // flutuando, é dizer o que falta. Meio calçado na tela seria o defeito mais caro possível,
    // porque parece ter funcionado.
    const escolhas = new Map(escolhasDaComposicao(DEMO)).set('sola', { pecaId: null });
    const { modelo, zonas, erro } = montar(escolhas);

    expect(modelo).toBeNull();
    expect(zonas).toEqual([]);
    expect(erro).toMatch(/sola/);
  });

  it('a mensagem de erro carrega o código, que é o mesmo que a API devolve', () => {
    // Quem monta um calçado aqui é quem vai integrar a API depois. Ver o mesmo código nos dois
    // lados é o que impede "o editor disse uma coisa e a API disse outra".
    const escolhas = new Map(escolhasDaComposicao(DEMO)).set('sola', { pecaId: 'inventada' });

    expect(montar(escolhas).erro).toMatch(/^PECA_NAO_ENCONTRADA: /);
  });

  it('cor inválida vira mensagem, e não exceção que apaga a tela', () => {
    const escolhas = new Map(escolhasDaComposicao(DEMO)).set('sola', {
      pecaId: 'prova-sola-plana',
      cor: 'vermelho',
    });

    expect(() => montar(escolhas)).not.toThrow();
    expect(montar(escolhas).erro).toMatch(/^COR_INVALIDA: /);
  });

  it('peça sem cor escolhida monta com a cor própria dela', () => {
    // Cor ausente é diferente de cor branca, e a diferença precisa sobreviver à tela: quem não
    // escolheu ainda continua vendo a peça como ela foi modelada.
    const escolhas = new Map(escolhasDaComposicao(DEMO)).set('sola', {
      pecaId: 'prova-sola-plana',
    });
    const materiais = JSON.parse(montar(escolhas).modelo ?? '{}') as {
      materials: Array<{ pbrMetallicRoughness?: { baseColorFactor?: number[] } }>;
    };

    expect(materiais.materials[0]?.pbrMetallicRoughness?.baseColorFactor).toBeUndefined();
    expect(materiais.materials[1]?.pbrMetallicRoughness?.baseColorFactor).toBeDefined();
  });

  it('a ordem das peças segue a forma, não a ordem em que a tela guardou as escolhas', () => {
    // A anatomia é da forma. Se a ordem viesse do mapa da tela, clicar nos controles em ordem
    // diferente escreveria uma composição diferente para o mesmo calçado.
    const embaralhadas = new Map(
      [...escolhasDaComposicao(DEMO)].reverse() as Array<[string, EscolhaDaTela]>,
    );

    expect(montar(embaralhadas).zonas.map(({ zone_key }) => zone_key)).toEqual([
      'sola',
      'cabedal',
      'cadarco',
    ]);
  });

  it('categoria que a forma tem e a tela nunca tocou não quebra a montagem', () => {
    // Acontece na primeira renderização de uma forma cujo estado inicial não cobre tudo. Ausente
    // é o mesmo que não escolhida, e a recusa por categoria obrigatória faltando vem do guarda,
    // com a mensagem dele, em vez de um `undefined` estourando aqui.
    const soASola = new Map<string, EscolhaDaTela>([['sola', { pecaId: 'prova-sola-plana' }]]);

    expect(montar(soASola).erro).toMatch(/cabedal/);
  });
});
