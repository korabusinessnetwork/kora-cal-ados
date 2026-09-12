// O que a linha de estado do palco diz, em cada estado.
//
// Existe por causa de um defeito concreto: as duas telas escolhiam a frase com dois `if` e um
// `return` de fim que servia de coringa. O coringa dizia "Peça na cena. Arraste para girar", e
// qualquer estado que não fosse `carregando` nem `recusado` caía nele. Quando o contexto WebGL
// cai, a peça não está na cena, não dá para girar nada, e a tela afirmava as duas coisas.
//
// É o princípio nº1 pelo avesso na sua forma mais direta: o editor afirmando sobre a própria tela
// algo que a tela não mostra. Uma tela que mente sobre estar funcionando é pior que uma tela
// quebrada, porque a quebrada manda procurar o problema e a mentirosa manda confiar.
//
// Teste de texto, e não de componente, porque montar qualquer uma das duas telas exige WebGL, que
// jsdom não tem. O que dá para prender sem GPU é a escolha da frase, e é ela que estava errada.

import { describe, expect, it } from 'vitest';

import { ehFalha, type EstadoDoPalco } from './PalcoDeModelo3d';
import { textoDoEstadoDaComposicao } from './TelaDaComposicao';
import { textoDoEstadoDaPeca } from './TelaDoPalco3d';

const TODOS: EstadoDoPalco[] = [
  'carregando',
  'pronto',
  'recusado',
  'contexto-perdido',
  'contexto-negado',
];

describe('quando o que está na moldura não vale', () => {
  it('recusado e contexto perdido são falha, os outros dois não', () => {
    expect(TODOS.map((estado) => [estado, ehFalha(estado)])).toEqual([
      ['carregando', false],
      ['pronto', false],
      ['recusado', true],
      ['contexto-perdido', true],
      ['contexto-negado', true],
    ]);
  });

  it('carregando não é falha, é espera', () => {
    // Pintar de vermelho quem só está carregando ensina o time a ignorar vermelho.
    expect(ehFalha('carregando')).toBe(false);
  });
});

describe('a frase de cada estado', () => {
  it('cada estado tem a sua, sem duas iguais', () => {
    // A afirmação que pega o coringa de volta se alguém o trouxer: com um `return` de fim, dois
    // estados diferentes passariam a devolver a mesma frase.
    const frases = TODOS.map((estado) => textoDoEstadoDaPeca(estado));

    expect(new Set(frases).size).toBe(TODOS.length);
    expect(new Set(TODOS.map((estado) => textoDoEstadoDaComposicao(estado, 3))).size).toBe(
      TODOS.length,
    );
  });

  it('contexto perdido diz que caiu, que nada está sendo desenhado, e o que fazer', () => {
    // As três partes são necessárias e cada uma responde a uma pergunta de quem está olhando uma
    // tela em branco: o que houve, se o que sobrou na tela vale, e o que fazer agora.
    for (const frase of [
      textoDoEstadoDaPeca('contexto-perdido'),
      textoDoEstadoDaComposicao('contexto-perdido', 3),
    ]) {
      expect(frase).toContain('O 3D caiu');
      expect(frase).toContain('não está sendo desenhad');
      expect(frase).toContain('recarregue a página');
    }
  });

  it('não manda recarregar de cara, porque o contexto costuma voltar sozinho', () => {
    // Conferido no navegador: `restoreContext()` devolve a cena e a tela volta ao normal sem
    // recarregar nada. Mandar recarregar direto faria a pessoa jogar fora o trabalho dela por um
    // problema que ia se resolver sozinho, e é um trabalho que esta tela não grava em lugar
    // nenhum, não existe tabela para ela, ou seja, recarregar perde a composição inteira.
    for (const frase of [
      textoDoEstadoDaPeca('contexto-perdido'),
      textoDoEstadoDaComposicao('contexto-perdido', 3),
    ]) {
      expect(frase).toContain('não voltar sozinh');
    }
  });

  it('contexto perdido NÃO usa a frase de pronto nem a de recusado', () => {
    // O defeito exato que este arquivo existe para impedir.
    expect(textoDoEstadoDaPeca('contexto-perdido')).not.toBe(textoDoEstadoDaPeca('pronto'));
    expect(textoDoEstadoDaPeca('contexto-perdido')).not.toBe(textoDoEstadoDaPeca('recusado'));
    expect(textoDoEstadoDaPeca('contexto-perdido')).not.toContain('Peça na cena');
    expect(textoDoEstadoDaComposicao('contexto-perdido', 3)).not.toContain('Arraste para girar');
  });

  it('contexto negado diz que não vai abrir, e para onde ir (A46)', () => {
    // O negado e o perdido são notícias opostas, e dar a errada custa caro nos dois sentidos.
    // Aqui nada caiu: o contexto nunca existiu, porque a máquina não tem GPU utilizável, o driver
    // está na lista de bloqueio ou a aceleração está desligada. Mandar esperar deixa a pessoa
    // olhando uma tela que não vai mudar, e mandar recarregar faz ela perder a composição, que
    // não é gravada em lugar nenhum, por um problema que recarregar não resolve.
    for (const frase of [
      textoDoEstadoDaPeca('contexto-negado'),
      textoDoEstadoDaComposicao('contexto-negado', 3),
    ]) {
      expect(frase).toContain('não pôde ser iniciado');
      expect(frase).toContain('WebGL');
      expect(frase).toContain('esboço');
      expect(frase).not.toContain('recarregue a página');
      expect(frase).not.toContain('não voltar sozinh');
    }
  });

  it('contexto negado NÃO é a frase de contexto perdido', () => {
    // Os dois estados existem separados só por causa das frases. Se elas convergirem, o estado
    // novo vira peso morto e o defeito volta sem que nada fique vermelho.
    expect(textoDoEstadoDaPeca('contexto-negado')).not.toContain('O 3D caiu');
    expect(textoDoEstadoDaComposicao('contexto-negado', 3)).not.toContain('O 3D caiu');
  });

  it('recusado continua falando do glTF, e não do contexto', () => {
    // As duas notícias são diferentes: "o arquivo não pôde ser lido" manda procurar defeito no
    // modelo, e dizer isso quando a GPU caiu manda procurar defeito num arquivo que está perfeito.
    expect(textoDoEstadoDaPeca('recusado')).toContain('glTF');
    expect(textoDoEstadoDaPeca('recusado')).not.toContain('3D caiu');
  });

  it('a composição conta as zonas, no singular e no plural', () => {
    expect(textoDoEstadoDaComposicao('pronto', 1)).toContain('1 zona.');
    expect(textoDoEstadoDaComposicao('pronto', 3)).toContain('3 zonas.');
  });
});
