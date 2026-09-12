// O que estes testes protegem: que a tela do calçado montado nunca fique sem nada para mostrar.
//
// Toda recusa desta tela precisa virar texto legível, e nunca um calçado pela metade nem uma
// exceção que apaga a tela. É a regra de "estados sempre visíveis" do CLAUDE.md no lugar onde ela
// é mais fácil de quebrar: dentro de um componente que nenhum teste alcança, porque jsdom não tem
// WebGL. Por isso a decisão mora aqui fora, e por isso este arquivo existe.

import { describe, expect, it } from 'vitest';

import {
  composicaoDasEscolhas,
  escolhasDaComposicao,
  escolhasDoTextoColado,
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

describe('composicaoDasEscolhas', () => {
  it('devolve a composição do ADR-008, e nada além dela', () => {
    // É o objeto que a API recebe e que o modelo de linguagem vai escrever. Campo a mais aqui
    // vira campo a mais no contrato público, então a forma é conferida por inteiro.
    const composicao = composicaoDasEscolhas(FORMA, escolhasDaComposicao(DEMO));

    expect(Object.keys(composicao).sort()).toEqual(['forma_id', 'pecas']);
    expect(composicao.forma_id).toBe(FORMA.id);
    expect(composicao.pecas.map(({ peca_id }) => peca_id)).toEqual([
      'prova-sola-plana',
      'prova-cabedal-baixo',
      'prova-cadarco-reto',
    ]);
  });

  it('sai na ordem das categorias da forma, e não na ordem em que a pessoa mexeu', () => {
    // Duas montagens iguais precisam produzir o mesmo texto, senão comparar dois JSON desta tela
    // vira adivinhação. Aqui as escolhas entram ao contrário de propósito.
    const inicial = escolhasDaComposicao(DEMO);
    const trocada = new Map(
      [...inicial.entries()].reverse() as [string, EscolhaDaTela][],
    );

    expect(composicaoDasEscolhas(FORMA, trocada)).toEqual(composicaoDasEscolhas(FORMA, inicial));
  });

  it('categoria dispensada não vira peça nenhuma', () => {
    // `null` na lista seria uma peça chamada "nenhuma", que o validador teria de saber ignorar.
    const escolhas = mudarEscolhaDaTela(escolhasDaComposicao(DEMO), 'cadarco', { pecaId: null });
    const composicao = composicaoDasEscolhas(FORMA, escolhas);

    expect(composicao.pecas).toHaveLength(2);
    expect(JSON.stringify(composicao)).not.toContain('null');
  });

  it('é a MESMA composição que a montagem valida', () => {
    // A garantia que faz o botão de copiar valer alguma coisa: o texto copiado é o que a tela
    // montou, não uma segunda leitura das escolhas que poderia divergir dela.
    const escolhas = mudarEscolhaDaTela(escolhasDaComposicao(DEMO), 'cabedal', {
      pecaId: 'prova-cabedal-cano-alto',
    });

    expect(montar(escolhas).modelo).not.toBeNull();
    expect(composicaoDasEscolhas(FORMA, escolhas).pecas[1]).toMatchObject({
      peca_id: 'prova-cabedal-cano-alto',
    });
  });
});


describe('colar uma composição de volta na tela (A47)', () => {
  // O ciclo fechado: o texto que a tela produz é o texto que a tela lê. Sem isto, o botão de
  // copiar resolvia metade do problema, porque o JSON saía e nunca mais voltava.
  const TEXTO_DA_DEMO = JSON.stringify(composicaoDasEscolhas(FORMA, escolhasDaComposicao(DEMO)));

  it('o que a tela copia é o que a tela cola, e dá o mesmo calçado', () => {
    // A afirmação que vale o item. Ida e volta pela MESMA tela têm que fechar; se não fecharem,
    // o botão de copiar entrega um texto que só serve para outro lugar.
    const colagem = escolhasDoTextoColado(TEXTO_DA_DEMO, FORMA, CATALOGO);

    expect(colagem.erro).toBeNull();
    expect(colagem.escolhas).not.toBeNull();
    expect(composicaoDasEscolhas(FORMA, colagem.escolhas ?? new Map())).toEqual(
      composicaoDasEscolhas(FORMA, escolhasDaComposicao(DEMO)),
    );
  });

  it('uma composição diferente da que está na tela monta o calçado DELA', () => {
    // Sem esta, "colar funciona" poderia ser verdade só porque colei o que já estava na tela.
    const outra = JSON.stringify({
      forma_id: FORMA.id,
      pecas: [
        { peca_id: 'prova-sola-tratorada', cor: '#C0392B' },
        { peca_id: 'prova-cabedal-cano-alto', cor: '#101010' },
      ],
    });
    const colagem = escolhasDoTextoColado(outra, FORMA, CATALOGO);

    expect(colagem.erro).toBeNull();
    expect(colagem.escolhas?.get('sola')).toMatchObject({ pecaId: 'prova-sola-tratorada' });
    expect(colagem.escolhas?.get('cabedal')).toMatchObject({ pecaId: 'prova-cabedal-cano-alto' });
    // O cadarço é opcional e não foi colado, então some da tela em vez de ficar o de antes.
    expect(colagem.escolhas?.has('cadarco')).toBe(false);
    expect(montar(colagem.escolhas ?? new Map()).modelo).not.toBeNull();
  });

  it('peça que não existe é recusada, com o código do contrato de API', () => {
    // O mesmo código que a integração recebe, e não uma frase inventada só para esta tela: ver os
    // dois lados com o mesmo nome é o que impede "o editor disse uma coisa e a API disse outra".
    const colagem = escolhasDoTextoColado(
      JSON.stringify({ forma_id: FORMA.id, pecas: [{ peca_id: 'nao-existe' }] }),
      FORMA,
      CATALOGO,
    );

    expect(colagem.escolhas).toBeNull();
    expect(colagem.erro).toContain('PECA_NAO_ENCONTRADA');
  });

  it('recusa NÃO devolve escolhas, nem pela metade', () => {
    // O caminho que protege a montagem que está na tela. Se a recusa devolvesse um mapa vazio ou
    // parcial, quem colou errado perderia o calçado bom, que é o oposto do que o campo veio fazer.
    for (const texto of [
      '',
      '   ',
      'não é json',
      '{"forma_id": "' + FORMA.id + '", "pecas": [{"peca_id": "prova-sola-plana", "cor": "vermelho"}]}',
      '{"forma_id": "forma-que-nao-existe", "pecas": []}',
    ]) {
      const colagem = escolhasDoTextoColado(texto, FORMA, CATALOGO);

      expect(colagem.escolhas).toBeNull();
      expect(colagem.erro).not.toBeNull();
      expect(colagem.erro).not.toBe('');
    }
  });

  it('texto que não é JSON não fala de posição de caractere', () => {
    // A mensagem do `JSON.parse` é "Unexpected token ... at position 3", que não ensina nada a
    // quem colou metade do bloco. A frase da tela ensina: copie das chaves de abrir às de fechar.
    const colagem = escolhasDoTextoColado('{"forma_id":', FORMA, CATALOGO);

    expect(colagem.erro).toContain('chaves');
    expect(colagem.erro).not.toContain('position');
  });

  it('composição de OUTRA forma é recusada, em vez de montar sem as peças que não encaixam', () => {
    // O princípio nº1 na forma mais literal: zona errada falha alto, nunca aplica no lugar errado.
    // Para `validarComposicao` uma composição de outra forma é perfeitamente válida; quem está
    // presa a uma forma só é a TELA, então a recusa é daqui. Sem ela, as categorias da outra forma
    // virariam chaves que nenhum controle desta tela lê, e a montagem sairia sem elas, em silêncio.
    const colagem = escolhasDoTextoColado(
      JSON.stringify({ forma_id: 'bota-de-cano-longo', pecas: [] }),
      FORMA,
      CATALOGO,
    );

    expect(colagem.escolhas).toBeNull();
    expect(colagem.erro).toContain('bota-de-cano-longo');
    expect(colagem.erro).toContain(FORMA.id);
  });

  it('passa pelo MESMO guarda que a API usa, e não por uma conferência própria', () => {
    // Contraprova de que não nasceu um segundo validador. Se a tela tivesse o dela, ela passaria a
    // aceitar ou recusar coisas diferentes do que a API aceita ou recusa, e colar aqui deixaria de
    // ser ensaio da chamada de verdade. Cor inválida é recusa lá; tem que ser recusa aqui.
    const comCorInvalida = JSON.stringify({
      forma_id: FORMA.id,
      pecas: [{ peca_id: 'prova-sola-plana', cor: '#GGG' }],
    });

    expect(() => validarComposicao(JSON.parse(comCorInvalida), CATALOGO)).toThrow();
    expect(escolhasDoTextoColado(comCorInvalida, FORMA, CATALOGO).escolhas).toBeNull();
  });
});
