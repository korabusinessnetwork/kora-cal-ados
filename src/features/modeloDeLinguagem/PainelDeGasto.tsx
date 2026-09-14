// O painel de gasto do mês. Apresentacional: recebe o resumo pronto, não busca nada.
//
// Duas frases ficam sempre na tela, porque sem elas o número engana:
// - o custo é ESTIMADO, pelos tokens que o fornecedor contou e pelo preço que o owner informou. A
//   fatura de verdade é a do fornecedor;
// - o mês é contado em UTC, o mesmo corte do teto mensal. Sem isso, quem olha às 22h do último dia
//   em Brasília vê o mês "seguinte" já começado e acha que o painel perdeu dados.

import type {
  ChamadaRecente,
  UsoPorDia,
  UsoPorModelo,
} from '../../lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import { formatarCustoEmDolar } from '../../lib/modeloDeLinguagem/calcularCustoEstimado';
import { fornecedorPorId } from '../../lib/modeloDeLinguagem/fornecedoresDeModeloDeLinguagem';
import type { EstadoDoUso, ResumoRecebido } from './hooks/useUsoDoMes';

export interface PropsDoPainelDeGasto {
  estado: EstadoDoUso;
  resumo: ResumoRecebido | null;
  erro: string | null;
  mes: string;
  aoTrocarMes: (mes: string) => void;
  aoRecarregar: () => void;
}

const inteiro = new Intl.NumberFormat('pt-BR');

export function PainelDeGasto({ estado, resumo, erro, mes, aoTrocarMes, aoRecarregar }: PropsDoPainelDeGasto) {
  return (
    <section className="gasto" aria-labelledby="gasto-titulo">
      <div className="gasto__cabecalho">
        <h2 id="gasto-titulo" className="fornecedor__subtitulo">
          Gasto do mês
        </h2>
        <label className="gasto__mes">
          <span>Mês (UTC)</span>
          <input
            type="month"
            value={mes}
            onChange={(evento) => {
              if (/^\d{4}-\d{2}$/.test(evento.target.value)) aoTrocarMes(evento.target.value);
            }}
          />
        </label>
      </div>

      {estado === 'carregando' && (
        <p className="fornecedor__vazio" aria-busy="true">
          Carregando o gasto do mês…
        </p>
      )}

      {estado === 'erro' && (
        <div className="fornecedor__erro" role="alert">
          <p>{erro ?? 'Não foi possível carregar o gasto do mês.'}</p>
          <button type="button" onClick={aoRecarregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {estado === 'vazio' && (
        <p className="fornecedor__vazio">
          Nenhuma chamada ao fornecedor neste mês. O gasto aparece aqui assim que alguém da marca compuser um calçado ou
          testar a conexão.
        </p>
      )}

      {estado === 'pronto' && resumo && <ResumoDoMes resumo={resumo} />}

      <p className="fornecedor__nota">
        Custo estimado a partir dos tokens contados pelo fornecedor e do preço informado. Fornecedores grátis aparecem com
        custo zero. A cobrança de verdade é a do fornecedor.
      </p>
    </section>
  );
}

function ResumoDoMes({ resumo }: { resumo: ResumoRecebido }) {
  const { totais, teto_mensal_usd: teto } = resumo;

  return (
    <>
      <div className="gasto__cartoes">
        <Cartao rotulo="Custo estimado" valor={formatarCustoEmDolar(totais.custo_estimado_usd)} />
        <Cartao
          rotulo="Chamadas"
          valor={inteiro.format(totais.chamadas)}
          detalhe={totais.falhas > 0 ? `${inteiro.format(totais.falhas)} com falha` : 'nenhuma falha'}
        />
        <Cartao rotulo="Tokens de entrada" valor={inteiro.format(totais.tokens_de_entrada)} />
        <Cartao rotulo="Tokens de saída" valor={inteiro.format(totais.tokens_de_saida)} />
      </div>

      {teto !== null && <BarraDoTeto gasto={totais.custo_estimado_usd} teto={teto} />}

      {!resumo.completo && (
        <p className="fornecedor__aviso fornecedor__aviso--erro" role="status">
          Este mês tem mais chamadas do que o painel lê de uma vez. Os números mostram as mais recentes.
        </p>
      )}

      <PorDia dias={resumo.por_dia} />
      <PorModelo modelos={resumo.por_modelo} />
      <Recentes chamadas={resumo.recentes} />
    </>
  );
}

function Cartao({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="gasto__cartao">
      <span className="gasto__rotulo">{rotulo}</span>
      <strong className="gasto__valor">{valor}</strong>
      {detalhe && <span className="gasto__detalhe">{detalhe}</span>}
    </div>
  );
}

function BarraDoTeto({ gasto, teto }: { gasto: number; teto: number }) {
  const fracao = teto > 0 ? gasto / teto : 0;
  const percentual = Math.min(100, Math.round(fracao * 100));
  const atingido = fracao >= 1;

  return (
    <div className="gasto__teto">
      <div className="gasto__teto-texto">
        <span>
          Teto mensal: {formatarCustoEmDolar(gasto)} de {formatarCustoEmDolar(teto)}
        </span>
        <span>{atingido ? 'atingido, as gerações estão pausadas até o próximo mês' : `${percentual}%`}</span>
      </div>
      <div
        className={`gasto__teto-trilho${atingido ? ' gasto__teto-trilho--atingido' : ''}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentual}
        aria-label="Uso do teto mensal"
      >
        <div className="gasto__teto-preenchido" style={{ width: `${percentual}%` }} />
      </div>
    </div>
  );
}

function PorDia({ dias }: { dias: UsoPorDia[] }) {
  // A barra é proporcional às CHAMADAS e não ao custo: nos fornecedores grátis o custo é zero todos
  // os dias, e um gráfico de custo seria uma linha reta que não conta nada.
  const maior = Math.max(1, ...dias.map((dia) => dia.chamadas));

  return (
    <div className="gasto__bloco">
      <h3 className="gasto__bloco-titulo">Por dia</h3>
      <ul className="gasto__dias">
        {dias.map((dia) => (
          <li key={dia.dia} className="gasto__dia">
            <span className="gasto__dia-data">{dia.dia.slice(8, 10)}/{dia.dia.slice(5, 7)}</span>
            <span className="gasto__dia-trilho">
              <span className="gasto__dia-barra" style={{ width: `${(dia.chamadas / maior) * 100}%` }} />
            </span>
            <span className="gasto__dia-numeros">
              {inteiro.format(dia.chamadas)} {dia.chamadas === 1 ? 'chamada' : 'chamadas'},{' '}
              {formatarCustoEmDolar(dia.custo_estimado_usd)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PorModelo({ modelos }: { modelos: UsoPorModelo[] }) {
  return (
    <div className="gasto__bloco">
      <h3 className="gasto__bloco-titulo">Por modelo</h3>
      <div className="gasto__tabela-rolagem">
        <table className="gasto__tabela">
          <thead>
            <tr>
              <th scope="col">Fornecedor e modelo</th>
              <th scope="col">Chamadas</th>
              <th scope="col">Falhas</th>
              <th scope="col">Tokens (entrada / saída)</th>
              <th scope="col">Custo estimado</th>
            </tr>
          </thead>
          <tbody>
            {modelos.map((linha) => (
              <tr key={`${linha.fornecedor}/${linha.modelo}`}>
                <td>
                  {nomeDoFornecedor(linha.fornecedor)}, <code>{linha.modelo}</code>
                </td>
                <td>{inteiro.format(linha.chamadas)}</td>
                <td>{inteiro.format(linha.falhas)}</td>
                <td>
                  {inteiro.format(linha.tokens_de_entrada)} / {inteiro.format(linha.tokens_de_saida)}
                </td>
                <td>{formatarCustoEmDolar(linha.custo_estimado_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Recentes({ chamadas }: { chamadas: ChamadaRecente[] }) {
  const hora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="gasto__bloco">
      <h3 className="gasto__bloco-titulo">Chamadas recentes</h3>
      <div className="gasto__tabela-rolagem">
        <table className="gasto__tabela">
          <thead>
            <tr>
              <th scope="col">Quando</th>
              <th scope="col">Origem</th>
              <th scope="col">Modelo</th>
              <th scope="col">Resultado</th>
              <th scope="col">Tokens</th>
              <th scope="col">Custo</th>
            </tr>
          </thead>
          <tbody>
            {chamadas.map((chamada, indice) => (
              <tr key={`${chamada.created_at}-${indice}`}>
                <td>{hora.format(new Date(chamada.created_at))}</td>
                <td>{chamada.origem === 'teste' ? 'Teste de conexão' : 'Compor calçado'}</td>
                <td>
                  <code>{chamada.modelo}</code>
                </td>
                <td className={chamada.sucesso ? 'gasto__ok' : 'gasto__falha'}>{chamada.sucesso ? 'ok' : 'falhou'}</td>
                <td>{inteiro.format(chamada.tokens_de_entrada + chamada.tokens_de_saida)}</td>
                <td>{formatarCustoEmDolar(chamada.custo_estimado_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function nomeDoFornecedor(id: string): string {
  return fornecedorPorId(id)?.nome ?? id;
}
