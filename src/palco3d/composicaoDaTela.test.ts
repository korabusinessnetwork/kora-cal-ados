// O que estes testes protegem: que a tela do calçado montado nunca fique sem nada para mostrar.
//
// Toda recusa desta tela precisa virar texto legível, e nunca um calçado pela metade nem uma
// exceção que apaga a tela. É a regra de "estados sempre visíveis" do CLAUDE.md no lugar onde ela
// é mais fácil de quebrar: dentro de um componente que nenhum teste alcança, porque jsdom não tem
// WebGL. Por isso a decisão mora aqui fora, e por isso este arquivo existe.

import { describe, expect, it } from 'vitest';

import {
  escolhasDaComposicao,
  montarDaTela,
  mudarEscolhaDaTela,
  type EscolhaDaTela,
} from './composicaoDaTela';
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

describe('mudarEscolhaDaTela', () => {
  // BUG-019, encontrado pela conferência a olho do dono e não pela suíte: trocar o cabedal baixo
  // pelo cano alto pintava a tela inteira de vermelho com `PARAMETRO_INVALIDO`. As duas peças têm
  // um parâmetro com o mesmo nome, `altura-do-cano`, e faixas que mal se encostam, então o valor
  // da peça velha chegava na peça nova já fora de faixa.

  it('trocar o cabedal baixo pelo cano alto não carrega a altura da peça anterior', () => {
    // O caso exato do relato: 0,075 é o padrão do cabedal baixo e está fora dos 0,1 a 0,22 do cano
    // alto. Sem descartar, a tela monta nada e mostra só a linha de erro.
    const antes = escolhasDaComposicao(DEMO);
    expect(antes.get('cabedal')?.parametros).toEqual({ 'altura-do-cano': 0.075 });

    const depois = mudarEscolhaDaTela(antes, 'cabedal', { pecaId: 'prova-cabedal-cano-alto' });

    expect(depois.get('cabedal')?.parametros).toBeUndefined();
    expect(montar(depois).erro).toBeNull();
    expect(montar(depois).modelo).toContain('prova-cabedal-cano-alto');
  });

  it('o caminho de volta também não carrega, porque a faixa é apertada nos dois sentidos', () => {
    // 0,14 é o padrão do cano alto e está fora dos 0,05 a 0,12 do baixo. Um conserto que só
    // olhasse o sentido do relato deixaria metade do defeito em pé.
    const comCanoAlto = mudarEscolhaDaTela(escolhasDaComposicao(DEMO), 'cabedal', {
      pecaId: 'prova-cabedal-cano-alto',
    });
    const montado = montar(comCanoAlto);
    expect(montado.erro).toBeNull();

    const deVolta = mudarEscolhaDaTela(
      escolhasDaComposicao(validarComposicao(
        {
          forma_id: FORMA.id,
          pecas: [
            { peca_id: 'prova-sola-plana' },
            { peca_id: 'prova-cabedal-cano-alto' },
            { peca_id: 'prova-cadarco-reto' },
          ],
        },
        CATALOGO,
      )),
      'cabedal',
      { pecaId: 'prova-cabedal-baixo' },
    );

    expect(deVolta.get('cabedal')?.parametros).toBeUndefined();
    expect(montar(deVolta).erro).toBeNull();
  });

  it('a cor sobrevive à troca de peça, porque cor é escolha da marca sobre a zona', () => {
    // Descartar a cor junto seria trocar um defeito por outro: quem pintou o cabedal de azul e
    // trocou o modelo continua querendo azul, e ver a cor sumir sozinha é a surpresa que o
    // princípio nº1 proíbe.
    const depois = mudarEscolhaDaTela(escolhasDaComposicao(DEMO), 'cabedal', {
      pecaId: 'prova-cabedal-cano-alto',
    });

    expect(depois.get('cabedal')?.cor).toBe(DEMO.pecas[1]?.cor);
  });

  it('mexer só na cor preserva o parâmetro já escolhido', () => {
    // O descarte é da troca de peça, não de qualquer mudança. Se pintar a zona zerasse a altura,
    // a pessoa perderia o ajuste sem ter tocado nele.
    const comAltura = mudarEscolhaDaTela(escolhasDaComposicao(DEMO), 'cabedal', {
      parametros: { 'altura-do-cano': 0.11 },
    });
    const pintado = mudarEscolhaDaTela(comAltura, 'cabedal', { cor: '#C0392B' });

    expect(pintado.get('cabedal')).toMatchObject({
      pecaId: 'prova-cabedal-baixo',
      cor: '#C0392B',
      parametros: { 'altura-do-cano': 0.11 },
    });
  });

  it('reescolher a mesma peça não é troca, e não apaga o ajuste', () => {
    // Clicar de novo no botão que já está ligado é gesto comum. Zerar a altura ali seria perda de
    // trabalho sem nenhuma mudança na tela para explicá-la.
    const comAltura = mudarEscolhaDaTela(escolhasDaComposicao(DEMO), 'cabedal', {
      parametros: { 'altura-do-cano': 0.11 },
    });
    const denovo = mudarEscolhaDaTela(comAltura, 'cabedal', { pecaId: 'prova-cabedal-baixo' });

    expect(denovo.get('cabedal')?.parametros).toEqual({ 'altura-do-cano': 0.11 });
  });

  it('tirar a categoria opcional descarta o parâmetro dela junto', () => {
    // Sair para `null` é troca de peça como qualquer outra. Guardar o parâmetro de uma peça que
    // não está mais em cena é estado fantasma esperando para reaparecer errado.
    const semCadarco = mudarEscolhaDaTela(escolhasDaComposicao(DEMO), 'cadarco', { pecaId: null });

    expect(semCadarco.get('cadarco')).toEqual({ pecaId: null, cor: DEMO.pecas[2]?.cor });
    expect(montar(semCadarco).erro).toBeNull();
  });

  it('categoria que a tela ainda não tinha entra com a peça escolhida', () => {
    const vazio = new Map<string, EscolhaDaTela>();
    const depois = mudarEscolhaDaTela(vazio, 'sola', { pecaId: 'prova-sola-tratorada' });

    expect(depois.get('sola')).toEqual({ pecaId: 'prova-sola-tratorada' });
  });

  it('devolve um mapa novo e não mexe no que recebeu', () => {
    // O estado da tela é substituído, nunca editado por dentro: o React não redesenha um mapa
    // mutado no lugar, e a tela ficaria mostrando o calçado antigo.
    const antes = escolhasDaComposicao(DEMO);
    const depois = mudarEscolhaDaTela(antes, 'cabedal', { pecaId: 'prova-cabedal-cano-alto' });

    expect(depois).not.toBe(antes);
    expect(antes.get('cabedal')).toMatchObject({
      pecaId: 'prova-cabedal-baixo',
      parametros: { 'altura-do-cano': 0.075 },
    });
  });
});
