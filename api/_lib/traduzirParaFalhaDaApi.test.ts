// O que estes testes protegem: que nenhum erro chegue ao cliente com o status errado, e que
// nenhuma mensagem interna vaze na resposta.
//
// O teste mais importante do arquivo é o primeiro, e ele NÃO lista os códigos do motor à mão:
// itera a própria tabela do módulo. Um código novo em `src/lib/render/erros.ts` quebra o
// `npm run typecheck` (o `Record<CodigoDeErro, ...>` da tabela passa a exigir a chave) e, no
// instante em que a entrada é criada para o typecheck voltar ao verde, este teste passa a
// exercê-la sozinho — sem ninguém lembrar de vir aqui. Uma lista de 7 strings escrita aqui
// faria o contrário: seguiria verde testando 7 códigos enquanto a API responderia 500 para o
// oitavo, e o silêncio duraria até um cliente reclamar.

import { describe, expect, it } from 'vitest';
import { ErroDeVariante, type CodigoDeErro } from '../../src/lib/render/erros';
import { FalhaDaApi, type CodigoDeTransporte } from './tiposDaApi';
import {
  MENSAGEM_DE_FALHA_INTERNA,
  STATUS_POR_CODIGO_DO_MOTOR,
  TRANSPORTE_POR_CODIGO,
  criarFalhaDeTransporte,
  criarFalhaDeZonaDesconhecida,
  traduzirParaFalhaDaApi,
} from './traduzirParaFalhaDaApi';

const CODIGOS_DO_MOTOR = Object.keys(STATUS_POR_CODIGO_DO_MOTOR) as CodigoDeErro[];
const CODIGOS_DE_TRANSPORTE = Object.keys(TRANSPORTE_POR_CODIGO) as CodigoDeTransporte[];

describe('cobertura: todo código do motor tem status', () => {
  it('a tabela não está vazia', () => {
    // Canário do laço abaixo: com tabela vazia todo `for` deste arquivo passaria sem testar
    // nada, e o arquivo ficaria verde sem exercer uma linha do módulo.
    expect(CODIGOS_DO_MOTOR.length).toBeGreaterThan(0);
  });

  it('nenhum código do motor cai no 500 genérico', () => {
    for (const codigo of CODIGOS_DO_MOTOR) {
      const falha = traduzirParaFalhaDaApi(new ErroDeVariante(codigo, 'detalhe do motor.'));

      expect(falha).toBeInstanceOf(FalhaDaApi);
      expect(falha.codigo).toBe(codigo);
      // 500 aqui significaria "defeito nosso" para um erro que é do pedido ou do dado do
      // tenant — e 500 convida cliente com retry automático a reprocessar em laço algo que
      // não conserta sozinho.
      expect(falha.status).not.toBe(500);
      expect([409, 422]).toContain(falha.status);
      expect(falha.message.length).toBeGreaterThan(0);
    }
  });

  it('a mensagem do motor é sempre repassada — ela nomeia a zona, a cor e o seletor', () => {
    for (const codigo of CODIGOS_DO_MOTOR) {
      const falha = traduzirParaFalhaDaApi(
        new ErroDeVariante(codigo, 'A zona "sola" tem algum problema.'),
      );

      expect(falha.message).toContain('A zona "sola" tem algum problema.');
    }
  });
});

describe('a mensagem muda com a família', () => {
  it('409 (dado do tenant) manda corrigir no editor, nunca corrigir o pedido', () => {
    for (const codigo of CODIGOS_DO_MOTOR) {
      if (STATUS_POR_CODIGO_DO_MOTOR[codigo].familia !== 'dado do tenant') continue;

      const falha = traduzirParaFalhaDaApi(new ErroDeVariante(codigo, 'detalhe do motor.'));

      expect(falha.status).toBe(409);
      // O integrador não tem o que corrigir no pedido dele; quem corrige é o time da marca.
      expect(falha.message).toContain('editor de zonas');
      expect(falha.message).toContain('O pedido está correto');
    }
  });

  it('422 (pedido) fica com a mensagem do motor, que já diz o que mudar', () => {
    for (const codigo of CODIGOS_DO_MOTOR) {
      if (STATUS_POR_CODIGO_DO_MOTOR[codigo].familia !== 'pedido') continue;

      const falha = traduzirParaFalhaDaApi(new ErroDeVariante(codigo, 'Cor "x" não é hex.'));

      expect(falha.status).toBe(422);
      expect(falha.message).toBe('Cor "x" não é hex.');
      // Emendar orientação de tenant num 422 mandaria o integrador procurar defeito no dado
      // da marca quando o defeito é o valor que ele mesmo enviou.
      expect(falha.message).not.toContain('editor de zonas');
    }
  });
});

describe('ZONA_NAO_ENCONTRADA, o único código com dois status', () => {
  it('vinda do motor é 409 — depois da pré-checagem, só sobra seletor gravado quebrado', () => {
    const falha = traduzirParaFalhaDaApi(
      new ErroDeVariante('ZONA_NAO_ENCONTRADA', 'O seletor "#p1" da zona "sola" não encontrou.'),
    );

    expect(falha.status).toBe(409);
    expect(falha.codigo).toBe('ZONA_NAO_ENCONTRADA');
  });

  it('o 422 da pré-checagem do handler atravessa intacto', () => {
    // Se este módulo retraduzisse uma `FalhaDaApi`, este 422 viraria 409 e o integrador seria
    // mandado ao editor de zonas por uma zone_key que ele mesmo digitou errado.
    const preChecado = new FalhaDaApi(
      'ZONA_NAO_ENCONTRADA',
      422,
      'Este produto não tem a zona "solla". Zonas: sola, cabedal.',
    );

    const falha = traduzirParaFalhaDaApi(preChecado);

    expect(falha).toBe(preChecado);
    expect(falha.status).toBe(422);
  });
});

describe('FalhaDaApi entra e sai igual', () => {
  it('preserva código, status, mensagem e cabeçalhos', () => {
    const original = new FalhaDaApi('METODO_NAO_PERMITIDO', 405, 'Método não permitido.', {
      Allow: 'POST',
    });

    const falha = traduzirParaFalhaDaApi(original);

    expect(falha).toBe(original);
    expect(falha.status).toBe(405);
    expect(falha.cabecalhos).toEqual({ Allow: 'POST' });
  });
});

describe('erro desconhecido vira 500 sem vazar nada', () => {
  it('a mensagem interna do Error não aparece na resposta', () => {
    const interno = new Error(
      'connect ECONNREFUSED em C:/app/api/_lib/clienteDeServico.ts: SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi',
    );

    const falha = traduzirParaFalhaDaApi(interno);

    expect(falha.codigo).toBe('FALHA_INTERNA');
    expect(falha.status).toBe(500);
    expect(falha.message).toBe(MENSAGEM_DE_FALHA_INTERNA);
    // Explícito porque é o ponto: quem lê esta resposta é o sistema de outra marca. Caminho
    // de arquivo, nome de coluna e trecho de credencial não podem sair daqui.
    expect(falha.message).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(falha.message).not.toContain('eyJhbGciOi');
    expect(falha.message).not.toContain('clienteDeServico');
    expect(falha.message).not.toContain(interno.message);
  });

  it('string lançada, undefined, null e objeto qualquer não quebram a função', () => {
    for (const lancado of ['deu ruim', undefined, null, 42, { erro: 'algo' }, new TypeError('x')]) {
      const falha = traduzirParaFalhaDaApi(lancado);

      expect(falha).toBeInstanceOf(FalhaDaApi);
      expect(falha.status).toBe(500);
      expect(falha.message).toBe(MENSAGEM_DE_FALHA_INTERNA);
    }
  });

  it('ErroDeVariante com código fora da tabela cai em 500, não em status indefinido', () => {
    // Só acontece com um erro montado fora do tipo, mas `status: undefined` chegando na
    // resposta seria pior que um 500 honesto.
    const forjado = new ErroDeVariante(
      'CODIGO_QUE_NAO_EXISTE' as unknown as CodigoDeErro,
      'detalhe.',
    );

    expect(traduzirParaFalhaDaApi(forjado).status).toBe(500);
  });
});

describe('criarFalhaDeTransporte', () => {
  it('todo código de transporte tem status e mensagem', () => {
    expect(CODIGOS_DE_TRANSPORTE.length).toBeGreaterThan(0);

    for (const codigo of CODIGOS_DE_TRANSPORTE) {
      const falha = criarFalhaDeTransporte(codigo);

      expect(falha.codigo).toBe(codigo);
      expect(falha.status).toBeGreaterThanOrEqual(400);
      expect(falha.message.length).toBeGreaterThan(0);
    }
  });

  it('405 acompanha o header Allow: POST', () => {
    const falha = criarFalhaDeTransporte('METODO_NAO_PERMITIDO');

    expect(falha.status).toBe(405);
    expect(falha.cabecalhos).toEqual({ Allow: 'POST' });
  });

  it('os demais códigos não ganham cabeçalho nenhum', () => {
    for (const codigo of CODIGOS_DE_TRANSPORTE) {
      if (codigo === 'METODO_NAO_PERMITIDO') continue;
      expect(criarFalhaDeTransporte(codigo).cabecalhos).toEqual({});
    }
  });

  it('os status são os do contrato', () => {
    expect(criarFalhaDeTransporte('CHAVE_AUSENTE').status).toBe(401);
    expect(criarFalhaDeTransporte('CHAVE_INVALIDA').status).toBe(401);
    expect(criarFalhaDeTransporte('PRODUTO_NAO_ENCONTRADO').status).toBe(404);
    expect(criarFalhaDeTransporte('CORPO_INVALIDO').status).toBe(400);
    expect(criarFalhaDeTransporte('FORMATO_NAO_SUPORTADO').status).toBe(400);
    expect(criarFalhaDeTransporte('FALHA_INTERNA').status).toBe(500);
  });

  it('a mensagem das duas falhas de chave é idêntica entre as causas, e não diz qual foi', () => {
    // Distinguir "malformada" de "revogada" contaria a quem sonda chaves qual delas existiu.
    const invalida = criarFalhaDeTransporte('CHAVE_INVALIDA');

    expect(invalida.message).toBe('Chave de API inválida.');
    expect(invalida.message).not.toContain('revogada');
  });

  it('a mensagem pode ser sobrescrita com detalhe acionável, mas o status não muda', () => {
    const falha = criarFalhaDeTransporte(
      'FORMATO_NAO_SUPORTADO',
      'Formato "png" não é suportado. Use format=svg.',
    );

    expect(falha.status).toBe(400);
    expect(falha.message).toBe('Formato "png" não é suportado. Use format=svg.');
  });
});


describe('criarFalhaDeZonaDesconhecida — o mesmo código com dois status, e os dois certos', () => {
  it('a pré-checagem do handler dá 422, e não o 409 da tabela do motor', () => {
    // Este é o par mais fácil de contradizer do projeto: `ZONA_NAO_ENCONTRADA` vale 422 quando
    // é o integrador pedindo uma zona que o produto não tem, e 409 quando é o `svg_selector`
    // gravado que não resolve. As duas linhas moram neste módulo justamente para que ninguém
    // mude uma sem ver a outra.
    const falha = criarFalhaDeZonaDesconhecida('A zona "bico" não existe neste produto.');

    expect(falha.codigo).toBe('ZONA_NAO_ENCONTRADA');
    expect(falha.status).toBe(422);
    expect(STATUS_POR_CODIGO_DO_MOTOR.ZONA_NAO_ENCONTRADA.status).toBe(409);
  });

  it('e a mensagem é a de quem chamou — só o handler sabe quais zonas o produto tem', () => {
    const falha = criarFalhaDeZonaDesconhecida('Zonas deste produto: "sola", "cabedal".');

    expect(falha.message).toBe('Zonas deste produto: "sola", "cabedal".');
  });

  it('e o tradutor devolve a falha INTACTA, sem rebaixá-la para o 409 do motor', () => {
    // Sem este comportamento a pré-checagem seria inútil: a falha passaria pelo `catch` do
    // handler, seria retraduzida pela tabela do motor e o integrador receberia 409 mandando
    // corrigir o mapeamento de zonas — quando o que ele precisa é corrigir a `zone_key` que
    // digitou. O 422 existe exatamente para não mandá-lo ao lugar errado.
    const falha = criarFalhaDeZonaDesconhecida('A zona "bico" não existe neste produto.');

    expect(traduzirParaFalhaDaApi(falha)).toBe(falha);
    expect(traduzirParaFalhaDaApi(falha).status).toBe(422);
  });

  it('não é `ErroDeVariante`: é falha de resposta, já com status', () => {
    // Se fosse `ErroDeVariante`, o `catch` do handler a traduziria pela tabela do motor — 409
    // de novo. O tipo é o que garante o caminho.
    const falha = criarFalhaDeZonaDesconhecida('qualquer');

    expect(falha).toBeInstanceOf(FalhaDaApi);
    expect(falha).not.toBeInstanceOf(ErroDeVariante);
  });
});
