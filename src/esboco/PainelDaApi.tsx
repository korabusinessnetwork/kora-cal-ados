// A metade direita do esboço: a chamada de API que produz EXATAMENTE o preview da
// esquerda, e o relatório do que a normalização fez com o arquivo no upload.
//
// O painel existe para tornar visível o princípio nº1: as duas colunas saem da mesma
// chamada de `gerarVarianteDeCor`, então o hex daqui é o hex de lá, por construção.
//
// ⚠️ O contrato HTTP ainda NÃO está decidido (docs/07_APIS/ está vazio). O envelope segue
// `memory/patterns.md`; a rota é proposta, não decisão.

import type { RelatorioDeNormalizacao } from '../lib/render/normalizarSvg';
import type { ErroDeVariante } from '../lib/render/erros';
import { produtoDemo } from './produtoDemo';

interface Props {
  cores: Record<string, string>;
  relatorio: RelatorioDeNormalizacao;
  erro: ErroDeVariante | null;
}

export function PainelDaApi({ cores, relatorio, erro }: Props) {
  const requisicao = [
    `POST /api/produtos/${produtoDemo.id}/variantes`,
    '',
    JSON.stringify({ zone_colors: cores, format: 'svg' }, null, 2),
  ].join('\n');

  const resposta = erro
    ? JSON.stringify(
        {
          data: null,
          error: { code: erro.codigo, message: erro.message },
          meta: { timestamp: '…', version: '1' },
        },
        null,
        2,
      )
    : JSON.stringify(
        {
          data: { variante_id: '…', svg_url: '…', zone_colors: cores },
          error: null,
          meta: { timestamp: '…', version: '1' },
        },
        null,
        2,
      );

  return (
    <section className="painel">
      <h2 className="painel__titulo">Chamada equivalente</h2>
      <p className="painel__ajuda">
        Mesmo motor dos dois lados: o preview ao lado é a saída desta chamada, não uma
        aproximação dela.
      </p>

      <pre className="codigo codigo--requisicao">{requisicao}</pre>
      <pre className={`codigo ${erro ? 'codigo--erro' : 'codigo--ok'}`}>
        <span className="codigo__status">{erro ? '422 Unprocessable Entity' : '200 OK'}</span>
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
