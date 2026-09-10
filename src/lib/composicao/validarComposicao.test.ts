import { describe, expect, it } from 'vitest';

import { ErroDeVariante } from '../render/erros';
import { FORMA_CHINELO, FORMA_TENIS, acervoDeTeste, peca } from './fixtures/acervoDeTeste';
import { validarComposicao } from './validarComposicao';

/** Uma composição mínima válida da forma de tênis, para as variações partirem daqui. */
const valida = () => ({
  forma_id: FORMA_TENIS,
  pecas: [{ peca_id: 'sola-lisa' }, { peca_id: 'cabedal-mesh' }],
});

/** O código do erro lançado, ou `null` se não lançou — deixa a asserção ler como frase. */
function codigoAoValidar(composicao: unknown, catalogo = acervoDeTeste()): string | null {
  try {
    validarComposicao(composicao, catalogo);
    return null;
  } catch (erro) {
    if (erro instanceof ErroDeVariante) return erro.codigo;
    throw erro;
  }
}

function mensagemAoValidar(composicao: unknown, catalogo = acervoDeTeste()): string {
  try {
    validarComposicao(composicao, catalogo);
    return '';
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro);
  }
}

describe('validarComposicao — o caminho feliz', () => {
  it('aceita a composição mínima da forma, com só as categorias obrigatórias', () => {
    const resultado = validarComposicao(valida(), acervoDeTeste());

    expect(resultado.forma.id).toBe(FORMA_TENIS);
    expect(resultado.pecas.map(({ categoria }) => categoria)).toEqual(['sola', 'cabedal']);
  });

  it('categoria opcional pode entrar, e entra como zona igual às outras', () => {
    const resultado = validarComposicao(
      { forma_id: FORMA_TENIS, pecas: [...valida().pecas, { peca_id: 'cadarco-chato' }] },
      acervoDeTeste(),
    );

    expect(resultado.pecas.map(({ categoria }) => categoria)).toEqual([
      'sola',
      'cabedal',
      'cadarco',
    ]);
  });

  it('a lista de categorias vem da FORMA, não de uma lista fixa no código', () => {
    // Se houvesse uma lista fixa de categorias de calçado, o chinelo sem cadarço seria recusa
    // permanente e a forma nova nasceria quebrada.
    const chinelo = { forma_id: FORMA_CHINELO, pecas: [{ peca_id: 'sola-chinelo' }] };

    expect(validarComposicao(chinelo, acervoDeTeste()).pecas).toHaveLength(1);
  });
});

describe('validarComposicao — a peça vem do catálogo, e é isso que faz dele um guarda', () => {
  it('a saída carrega O MESMO objeto do catálogo, nunca o id que veio na entrada', () => {
    // O critério de segurança do ADR-008 D1: quem consome não tem em mãos a string que o
    // modelo de linguagem escreveu, então não tem como transformá-la em caminho de arquivo.
    const catalogo = acervoDeTeste();
    const resultado = validarComposicao(valida(), catalogo);
    const doCatalogo = catalogo.pecas.find(({ id }) => id === 'sola-lisa');

    expect(resultado.pecas[0]?.peca).toBe(doCatalogo);
  });

  it('id inexistente é recusa, e a mensagem diz o id', () => {
    const composicao = { forma_id: FORMA_TENIS, pecas: [{ peca_id: 'sola-inventada' }] };

    expect(codigoAoValidar(composicao)).toBe('PECA_NAO_ENCONTRADA');
    expect(mensagemAoValidar(composicao)).toContain('sola-inventada');
  });

  it('id sintaticamente impecável e ausente do catálogo é recusado igual', () => {
    // A validação é por PERTENCIMENTO, nunca por formato. Uma checagem de regex aceitaria
    // este id, que segue exatamente o padrão dos que existem, e o modelo de linguagem produz
    // ids plausíveis o tempo todo — é justamente o modo de falha esperado dele.
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-corrida-04' }, { peca_id: 'cabedal-mesh' }],
    };

    expect(codigoAoValidar(composicao)).toBe('PECA_NAO_ENCONTRADA');
  });

  it('catálogo vazio recusa toda peça, sem virar caso especial', () => {
    expect(codigoAoValidar(valida(), { formas: acervoDeTeste().formas, pecas: [] })).toBe(
      'PECA_NAO_ENCONTRADA',
    );
  });

  it('id repetido no catálogo não quebra o pedido: o primeiro vence', () => {
    // Acervo malformado é defeito nosso. Recusar aqui deixaria o designer sem saída por causa
    // de uma linha duplicada no nosso banco.
    const catalogo = acervoDeTeste();
    const impostora = peca('sola-lisa', 'cabedal', FORMA_TENIS);
    catalogo.pecas.push(impostora);

    const resultado = validarComposicao(valida(), catalogo);

    expect(resultado.pecas[0]?.categoria).toBe('sola');
    expect(resultado.pecas[0]?.peca).not.toBe(impostora);
  });
});

describe('validarComposicao — encaixe entre peças (ADR-008 D4)', () => {
  it('peça de outra forma é FORMAS_MISTURADAS, não PECA_NAO_ENCONTRADA', () => {
    // O id existe e está certo. O conserto é outro — "escolha peças que encaixam" manda
    // procurar num lugar diferente de "corrija o id".
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-chinelo' }, { peca_id: 'cabedal-mesh' }],
    };

    expect(codigoAoValidar(composicao)).toBe('FORMAS_MISTURADAS');
  });

  it('a mensagem de formas misturadas nomeia as DUAS formas', () => {
    const composicao = { forma_id: FORMA_TENIS, pecas: [{ peca_id: 'sola-chinelo' }] };
    const mensagem = mensagemAoValidar(composicao);

    expect(mensagem).toContain(FORMA_CHINELO);
    expect(mensagem).toContain(FORMA_TENIS);
  });

  it('forma que não existe no acervo é COMPOSICAO_INVALIDA, não PECA_NAO_ENCONTRADA', () => {
    // Nenhuma peça foi consultada ainda: mandar procurar um id de peça mandaria procurar a
    // coisa errada.
    expect(codigoAoValidar({ forma_id: 'bota-cano-alto', pecas: [] })).toBe('COMPOSICAO_INVALIDA');
  });
});

describe('validarComposicao — uma peça por categoria', () => {
  it('categoria repetida é recusa, e é por isso que "pecas" é lista e não objeto', () => {
    // Num `Record<categoria, escolha>` esta composição seria indetectável: `JSON.parse`
    // descarta a chave duplicada e fica com a última, em silêncio. Seria o BUG-013 outra vez,
    // com a última chave do JSON decidindo o calçado.
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa' }, { peca_id: 'sola-tratorada' }, { peca_id: 'cabedal-mesh' }],
    };

    expect(codigoAoValidar(composicao)).toBe('COMPOSICAO_INVALIDA');
    expect(mensagemAoValidar(composicao)).toContain('sola-tratorada');
  });

  it('categoria repetida é reclamada ANTES da obrigatória que falta', () => {
    // Duas solas e nenhum cabedal: as duas coisas estão erradas. Reclamar da falta esconderia
    // a duplicata, e o designer consertaria o cabedal para bater na duplicata em seguida.
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa' }, { peca_id: 'sola-tratorada' }],
    };

    expect(mensagemAoValidar(composicao)).toContain('mais de uma vez');
  });

  it('categoria obrigatória ausente é recusa e a mensagem diz qual falta', () => {
    const composicao = { forma_id: FORMA_TENIS, pecas: [{ peca_id: 'sola-lisa' }] };

    expect(codigoAoValidar(composicao)).toBe('COMPOSICAO_INVALIDA');
    expect(mensagemAoValidar(composicao)).toContain('cabedal');
  });

  it('lista vazia lista TODAS as obrigatórias que faltam, não só a primeira', () => {
    const mensagem = mensagemAoValidar({ forma_id: FORMA_TENIS, pecas: [] });

    expect(mensagem).toContain('sola');
    expect(mensagem).toContain('cabedal');
  });

  it('peça de categoria que a forma não prevê é recusada, como a que falta', () => {
    // Peça sobrando é tão inválido quanto peça faltando: um cadarço num chinelo não tem onde
    // ser amarrado.
    const catalogo = acervoDeTeste();
    catalogo.pecas.push(peca('cadarco-chinelo', 'cadarco', FORMA_CHINELO));

    const composicao = {
      forma_id: FORMA_CHINELO,
      pecas: [{ peca_id: 'sola-chinelo' }, { peca_id: 'cadarco-chinelo' }],
    };

    expect(codigoAoValidar(composicao, catalogo)).toBe('COMPOSICAO_INVALIDA');
  });
});

describe('validarComposicao — a cor passa pelo validador que já existe', () => {
  it('cor ausente é válida: a peça mantém a cor própria', () => {
    expect(validarComposicao(valida(), acervoDeTeste()).pecas[0]?.cor).toBeUndefined();
  });

  it('a forma curta é expandida num lugar só, por validarCor', () => {
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa', cor: '#f00' }, { peca_id: 'cabedal-mesh' }],
    };

    expect(validarComposicao(composicao, acervoDeTeste()).pecas[0]?.cor).toBe('#FF0000');
  });

  it('cor inválida sai como COR_INVALIDA, o código que já é contrato', () => {
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa', cor: 'vermelho' }, { peca_id: 'cabedal-mesh' }],
    };

    expect(codigoAoValidar(composicao)).toBe('COR_INVALIDA');
  });

  it('a mensagem de cor nomeia a CATEGORIA, porque ela é a zone_key da zona gerada', () => {
    // `validarCor(valor, zoneKey)` recebe a categoria, e no produto gerado as duas são o
    // mesmo texto (ADR-008 D3). A mensagem sai correta por construção, não por coincidência.
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa', cor: 'vermelho' }, { peca_id: 'cabedal-mesh' }],
    };

    expect(mensagemAoValidar(composicao)).toContain('sola');
  });

  it('categoria que não serve como zone_key é recusada antes de virar contrato público', () => {
    const catalogo = acervoDeTeste();
    catalogo.pecas.push(peca('cadarco-acentuado', 'cadarço', FORMA_TENIS));

    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [...valida().pecas, { peca_id: 'cadarco-acentuado' }],
    };

    expect(codigoAoValidar(composicao, catalogo)).toBe('ZONE_KEY_INVALIDA');
  });
});

describe('validarComposicao — parâmetros (ADR-008 D7)', () => {
  it('parâmetro ausente recebe o padrão declarado pela peça, e ele aparece na saída', () => {
    const resultado = validarComposicao(valida(), acervoDeTeste());

    expect(resultado.pecas[0]?.parametros).toEqual({ espessura: 22 });
  });

  it('peça sem parâmetro nenhum é válida e sai com o mapa vazio', () => {
    expect(validarComposicao(valida(), acervoDeTeste()).pecas[1]?.parametros).toEqual({});
  });

  it('parâmetros vazio é igual a ausente: todos recebem o padrão', () => {
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-tratorada', parametros: {} }, { peca_id: 'cabedal-mesh' }],
    };

    expect(validarComposicao(composicao, acervoDeTeste()).pecas[0]?.parametros).toEqual({
      espessura: 30,
      'altura-entressola': 12,
    });
  });

  it('valor dentro da faixa vence o padrão, e os não mencionados continuam no padrão', () => {
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [
        { peca_id: 'sola-tratorada', parametros: { espessura: 35 } },
        { peca_id: 'cabedal-mesh' },
      ],
    };

    expect(validarComposicao(composicao, acervoDeTeste()).pecas[0]?.parametros).toEqual({
      espessura: 35,
      'altura-entressola': 12,
    });
  });

  it.each([
    ['acima do máximo', 41],
    ['abaixo do mínimo', 9],
  ])('valor %s é recusado', (_caso, espessura) => {
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa', parametros: { espessura } }, { peca_id: 'cabedal-mesh' }],
    };

    expect(codigoAoValidar(composicao)).toBe('PARAMETRO_INVALIDO');
  });

  it.each([
    ['mínimo', 10],
    ['máximo', 40],
  ])('o %s da faixa é aceito — a faixa é fechada nas duas pontas', (_ponta, espessura) => {
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa', parametros: { espessura } }, { peca_id: 'cabedal-mesh' }],
    };

    expect(codigoAoValidar(composicao)).toBeNull();
  });

  it('a mensagem de fora da faixa traz o valor, o nome e a faixa', () => {
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa', parametros: { espessura: 99 } }, { peca_id: 'cabedal-mesh' }],
    };
    const mensagem = mensagemAoValidar(composicao);

    expect(mensagem).toContain('99');
    expect(mensagem).toContain('espessura');
    expect(mensagem).toContain('40');
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['texto', '30'],
    ['null', null],
    ['booleano', true],
  ])('%s é recusado como valor de parâmetro', (_caso, espessura) => {
    // O nome do bloco não promete POR ONDE cada um é barrado, e isso é deliberado: a mutação
    // mostrou que só o `NaN` depende da checagem de número. `Infinity` é pego pela faixa
    // (`Infinity > 40`), e um nome dizendo "não passa por número" afirmaria dele uma proteção
    // que ele não tem — o caso sumiria junto se a faixa saísse, sem ninguém notar.
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa', parametros: { espessura } }, { peca_id: 'cabedal-mesh' }],
    };

    expect(codigoAoValidar(composicao)).toBe('PARAMETRO_INVALIDO');
  });

  it('NaN só é barrado pela checagem de número: nenhuma comparação de faixa o pega', () => {
    // Este é o caso que a checagem de número existe para pegar, e o único. `NaN < 10` e
    // `NaN > 40` são os DOIS falsos, então sem ela o valor entraria na composição e viraria
    // uma transformação NaN no palco — peça invisível, sem erro nenhum.
    const semFaixaUtil = acervoDeTeste();
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [
        { peca_id: 'sola-lisa', parametros: { espessura: Number.NaN } },
        { peca_id: 'cabedal-mesh' },
      ],
    };

    expect(codigoAoValidar(composicao, semFaixaUtil)).toBe('PARAMETRO_INVALIDO');
    expect(mensagemAoValidar(composicao, semFaixaUtil)).toContain('número');
  });

  it('null é PARAMETRO_INVALIDO, e não vira o padrão em silêncio', () => {
    // Ausente e `null` não são a mesma coisa: `null` é alguém tendo mandado algo, e cair no
    // padrão seria conserto calado.
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [
        { peca_id: 'sola-lisa', parametros: { espessura: null } },
        { peca_id: 'cabedal-mesh' },
      ],
    };

    expect(codigoAoValidar(composicao)).toBe('PARAMETRO_INVALIDO');
  });

  it('parâmetro que a peça não declara é recusado, nunca ignorado', () => {
    // Ignorar em silêncio faria "sola mais robusta" não ter efeito nenhum sem ninguém saber —
    // o defeito mais caro possível num produto cujo princípio nº1 é o que se vê ser o que sai.
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa', parametros: { curvatura: 3 } }, { peca_id: 'cabedal-mesh' }],
    };

    expect(codigoAoValidar(composicao)).toBe('PARAMETRO_INVALIDO');
    expect(mensagemAoValidar(composicao)).toContain('espessura');
  });

  it('faixa invertida no acervo recusa dizendo que o defeito é NOSSO, não do pedido', () => {
    const catalogo = acervoDeTeste();
    catalogo.pecas.push({
      id: 'sola-torta',
      categoria: 'sola',
      forma_id: FORMA_TENIS,
      rotulo: 'sola-torta',
      parametros: [{ nome: 'espessura', minimo: 40, maximo: 10, padrao: 20 }],
    });

    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-torta' }, { peca_id: 'cabedal-mesh' }],
    };

    expect(codigoAoValidar(composicao, catalogo)).toBe('PARAMETRO_INVALIDO');
    expect(mensagemAoValidar(composicao, catalogo)).toContain('acervo');
  });

  it('parametros que não é objeto é recusado', () => {
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa', parametros: [30] }, { peca_id: 'cabedal-mesh' }],
    };

    expect(codigoAoValidar(composicao)).toBe('COMPOSICAO_INVALIDA');
  });
});

describe('validarComposicao — a estrutura da entrada é não confiável', () => {
  it.each([
    ['null', null],
    ['texto', '{"forma_id":"x"}'],
    ['número', 7],
    ['lista', []],
    ['sem forma_id', { pecas: [] }],
    ['forma_id vazio', { forma_id: '   ', pecas: [] }],
    ['sem pecas', { forma_id: FORMA_TENIS }],
    ['pecas como objeto', { forma_id: FORMA_TENIS, pecas: { sola: 'sola-lisa' } }],
    ['escolha que não é objeto', { forma_id: FORMA_TENIS, pecas: ['sola-lisa'] }],
    ['escolha sem peca_id', { forma_id: FORMA_TENIS, pecas: [{ cor: '#FF0000' }] }],
  ])('%s é COMPOSICAO_INVALIDA, nunca uma exceção crua', (_caso, entrada) => {
    expect(codigoAoValidar(entrada)).toBe('COMPOSICAO_INVALIDA');
  });

  it('a recusa de "pecas" como objeto explica POR QUE não pode ser objeto', () => {
    // A razão é a única que importa no desenho deste módulo, e ela precisa sobreviver a quem
    // achar depois que um Record seria mais prático.
    const mensagem = mensagemAoValidar({ forma_id: FORMA_TENIS, pecas: { sola: 'sola-lisa' } });

    expect(mensagem).toContain('lista');
  });

  it('a escolha na posição errada é nomeada pela posição', () => {
    const composicao = { forma_id: FORMA_TENIS, pecas: [{ peca_id: 'sola-lisa' }, 'cabedal-mesh'] };

    expect(mensagemAoValidar(composicao)).toContain('1');
  });

  it('toda recusa é ErroDeVariante, para a API traduzir por uma tabela só', () => {
    expect(() => validarComposicao(null, acervoDeTeste())).toThrow(ErroDeVariante);
  });
});

describe('validarComposicao — pureza e não destruição', () => {
  it('não modifica o catálogo recebido', () => {
    const catalogo = acervoDeTeste();
    const antes = JSON.stringify(catalogo);

    validarComposicao(valida(), catalogo);

    expect(JSON.stringify(catalogo)).toBe(antes);
  });

  it('não modifica a composição recebida', () => {
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [{ peca_id: 'sola-lisa', parametros: {} }, { peca_id: 'cabedal-mesh' }],
    };
    const antes = JSON.stringify(composicao);

    validarComposicao(composicao, acervoDeTeste());

    expect(JSON.stringify(composicao)).toBe(antes);
  });

  it('a composição sai inteira ou não sai: erro na terceira peça não devolve as duas', () => {
    // O mesmo compromisso de `recolorirModelo3d`. Meia composição seria um calçado montado
    // pela metade sem ninguém ter como saber qual metade.
    const composicao = {
      forma_id: FORMA_TENIS,
      pecas: [...valida().pecas, { peca_id: 'cadarco-inexistente' }],
    };

    expect(() => validarComposicao(composicao, acervoDeTeste())).toThrow(ErroDeVariante);
  });
});
