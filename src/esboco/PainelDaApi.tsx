// A metade direita do esboço: a chamada de API que produz EXATAMENTE o preview da
// esquerda, e o relatório do que a normalização fez com o arquivo no upload.
//
// O painel existe para tornar visível o princípio nº1: as duas colunas saem da mesma
// chamada de `gerarVarianteDeCor`, então o hex daqui é o hex de lá, por construção.
//
// DE ONDE VEM O CONTRATO MOSTRADO AQUI: `docs/07_APIS/endpoints.md` — rota, corpo,
// cabeçalhos, envelope de erro e a tabela de status. Ele está fechado desde a Etapa 1, e
// nada nesta tela decide contrato; quem editar este arquivo confere cada string contra
// aquele doc. A forma do envelope de erro espelha `api/_lib/respostaDaApi.ts`, que é quem
// monta a `Response` de verdade — espelha e não importa, porque `src/` vai inteiro para o
// bundle do navegador e `api/` carrega a `service_role`.
//
// Este painel já exibiu, por semanas, um contrato que nunca existiu (rota em português,
// `zone_colors`/`format` no corpo, sucesso envelopado com `variante_id` e `svg_url`).
// `PainelDaApi.test.tsx` existe para que isso volte como teste vermelho, e não como
// descoberta de leitor.

import type { RelatorioDeNormalizacao } from '../lib/render/normalizarSvg';
import type { CodigoDeErro, ErroDeVariante } from '../lib/render/erros';
import { produtoDemo } from './produtoDemo';

interface Props {
  cores: Record<string, string>;
  relatorio: RelatorioDeNormalizacao;
  erro: ErroDeVariante | null;
}

/** Chave de exemplo, nunca uma chave real. O prefixo é o do exemplo do contrato. */
const CHAVE_DE_EXEMPLO = 'kora_live_7f3ab902_SEGREDO_DE_EXEMPLO';

/** `meta.version` do envelope — o `VERSAO_DO_ENVELOPE` de `api/_lib/respostaDaApi.ts`. */
const VERSAO_DO_ENVELOPE = '1';

/**
 * Timestamp de exemplo, fixo. Na resposta real ele sai de `relogio().toISOString()` em
 * `respostaDaApi.ts`; aqui um relógio de verdade só faria o painel piscar um número que
 * ninguém lê, e tiraria a tela da comparação direta com o exemplo do doc.
 */
const TIMESTAMP_DE_EXEMPLO = '2026-09-08T10:30:00.000Z';

interface RespostaDeErroMostrada {
  status: number;
  texto: string;
  familia: string;
}

/**
 * Status e família por código do motor — cópia da tabela de `docs/07_APIS/endpoints.md`, e
 * não um import de `api/_lib/traduzirParaFalhaDaApi.ts`: `src/` não pode importar de `api/`.
 * `Record<CodigoDeErro, ...>` de propósito — código novo no motor vira erro de compilação
 * aqui, e não status inventado na tela.
 *
 * `ZONA_NAO_ENCONTRADA` é 409 e não 422 porque, vindo do MOTOR, ele só acontece com seletor
 * gravado quebrado — dado do tenant. O 422 de mesmo código é o da pré-checagem do handler,
 * que o esboço não tem (não há banco aqui).
 */
const RESPOSTA_DE_ERRO_POR_CODIGO: Readonly<Record<CodigoDeErro, RespostaDeErroMostrada>> = {
  COR_INVALIDA: { status: 422, texto: 'Unprocessable Entity', familia: 'pedido' },
  ZONE_KEY_INVALIDA: { status: 422, texto: 'Unprocessable Entity', familia: 'pedido' },
  ZONA_NAO_ENCONTRADA: { status: 409, texto: 'Conflict', familia: 'dado do tenant' },
  ZONA_NAO_RECOLORIVEL: { status: 409, texto: 'Conflict', familia: 'dado do tenant' },
  ZONAS_SOBREPOSTAS: { status: 409, texto: 'Conflict', familia: 'dado do tenant' },
  SVG_INVALIDO: { status: 409, texto: 'Conflict', familia: 'dado do tenant' },
  SVG_NAO_NORMALIZAVEL: { status: 409, texto: 'Conflict', familia: 'dado do tenant' },
  // Gêmeos 3D (ADR-007). O esboço nunca os produz — ele pinta SVG —, mas o
  // `Record<CodigoDeErro, ...>` acima obriga a linha, e é assim que ele funciona: foi
  // este erro de compilação que avisou que a tela existia, quando os códigos entraram.
  MODELO_3D_INVALIDO: { status: 409, texto: 'Conflict', familia: 'dado do tenant' },
  MODELO_3D_NAO_NORMALIZAVEL: { status: 409, texto: 'Conflict', familia: 'dado do tenant' },
  // Composição (ADR-008), e aconteceu de novo exatamente como o comentário acima descreve:
  // os quatro códigos entraram no motor e o erro de compilação apontou para esta tela. 422 e
  // não 409 porque a composição vem no corpo do pedido — quem corrige é quem enviou.
  PECA_NAO_ENCONTRADA: { status: 422, texto: 'Unprocessable Entity', familia: 'pedido' },
  COMPOSICAO_INVALIDA: { status: 422, texto: 'Unprocessable Entity', familia: 'pedido' },
  FORMAS_MISTURADAS: { status: 422, texto: 'Unprocessable Entity', familia: 'pedido' },
  PARAMETRO_INVALIDO: { status: 422, texto: 'Unprocessable Entity', familia: 'pedido' },
};

export function PainelDaApi({ cores, relatorio, erro }: Props) {
  // As cores vão no TOPO do corpo, uma chave por `zone_key`. Nada que não seja cor entra
  // aqui: o topo é espaço de nomes do tenant, e um campo nosso colidiria com uma zona de
  // mesmo nome como cor não aplicada — não como erro (endpoints.md, "O corpo do pedido").
  const requisicao = [
    `POST /api/v1/products/${produtoDemo.id}/variants`,
    `Authorization: Bearer ${CHAVE_DE_EXEMPLO}`,
    'Content-Type: application/json',
    '',
    JSON.stringify(cores, null, 2),
  ].join('\n');

  const respostaDeErro = erro ? RESPOSTA_DE_ERRO_POR_CODIGO[erro.codigo] : null;

  const resposta = erro
    ? [
        'Content-Type: application/json; charset=utf-8',
        '',
        JSON.stringify(
          {
            data: null,
            error: { code: erro.codigo, message: erro.message },
            meta: { timestamp: TIMESTAMP_DE_EXEMPLO, version: VERSAO_DO_ENVELOPE },
          },
          null,
          2,
        ),
      ].join('\n')
    : [
        'Content-Type: image/svg+xml; charset=utf-8',
        'Cache-Control: no-store',
        '',
        '<svg xmlns="http://www.w3.org/2000/svg" …>…</svg>',
      ].join('\n');

  return (
    <section className="painel">
      <h2 className="painel__titulo">Chamada equivalente</h2>
      <p className="painel__ajuda">
        Mesmo motor dos dois lados: o corpo do <code>200</code> é, byte a byte, o SVG que o
        preview ao lado mostra — não uma aproximação dele. Campo que não é cor vai na query
        string (<code>?format=svg</code>), nunca no topo do corpo, que é o espaço de nomes das{' '}
        <code>zone_key</code> do tenant.
      </p>

      <pre className="codigo codigo--requisicao">{requisicao}</pre>

      {/* A assimetria é o ponto pedagógico: sucesso é o artefato, erro é o envelope. Mostrar
          o 200 envelopado — como este painel mostrou por semanas — ensina um round-trip de
          escape/unescape que o contrato proíbe justamente porque ele muda o desenho em
          silêncio (endpoints.md, "A resposta"). */}
      <pre className={`codigo ${erro ? 'codigo--erro' : 'codigo--ok'}`}>
        <span className="codigo__status">
          {respostaDeErro
            ? `${respostaDeErro.status} ${respostaDeErro.texto} · família "${respostaDeErro.familia}"`
            : '200 OK · sem envelope, o corpo é o artefato'}
        </span>
        {'\n'}
        {resposta}
      </pre>

      <h2 className="painel__titulo painel__titulo--espacado">Normalização do upload</h2>
      <p className="painel__ajuda">
        O que <code>normalizarSvg</code> mudou no arquivo cru antes de ele virar asset-base
        canônico. Roda uma vez, no upload.
      </p>

      <dl className="relatorio">
        <Linha rotulo="Declarações CSS achatadas em atributo" valor={relatorio.declaracoesAchatadas} />
        <Linha rotulo="Blocos <script> removidos" valor={relatorio.scriptsRemovidos} />
        <Linha rotulo="Handlers on* removidos" valor={relatorio.handlersRemovidos} />
        <Linha rotulo="Referências externas removidas" valor={relatorio.referenciasExternasRemovidas} />
        <Linha rotulo="Ids duplicados renomeados" valor={relatorio.idsRenomeados.length} />
        {/* A cunhagem é o que torna um elemento marcável no editor: sem id, não há seletor.
            Omitir esta linha faria o painel afirmar "o que a normalização mudou" escondendo
            justamente a mudança que habilita a próxima tela (ADR-005). */}
        <Linha rotulo="Ids atribuídos a elemento sem id" valor={relatorio.idsAtribuidos.length} />
      </dl>

      {relatorio.idsRenomeados.length > 0 && (
        <ul className="renomeados">
          {relatorio.idsRenomeados.map((troca) => (
            <li key={troca.para}>
              <code>{troca.de}</code> → <code>{troca.para}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className={`relatorio__linha ${valor > 0 ? 'relatorio__linha--ativa' : ''}`}>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
