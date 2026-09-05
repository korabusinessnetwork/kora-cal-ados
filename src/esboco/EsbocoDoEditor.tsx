// Tela única do esboço. Junta as três colunas e é a ÚNICA que guarda estado — os painéis
// são burros de propósito, para ninguém ser tentado a recalcular cor por fora do motor.
//
// Não é o editor de zonas de verdade: aqui as zonas já vêm marcadas. Marcar zona com
// Fabric.js é a próxima peça (ver README desta pasta).

import { useMemo, useRef, useState } from 'react';
import { normalizarSvg } from '../lib/render/normalizarSvg';
import { gerarVarianteDeCor, relatorioDeZonas } from '../lib/render/gerarVarianteDeCor';
import { ErroDeVariante } from '../lib/render/erros';
import { PainelDeZonas } from './PainelDeZonas';
import { PainelDaApi } from './PainelDaApi';
import { PreviewDaVariante } from './PreviewDaVariante';
import { ComparativoDeNormalizacao } from './ComparativoDeNormalizacao';
import { assetBaseCru, coresIniciais, produtoDemo, zonasDoProduto } from './produtoDemo';

export function EsbocoDoEditor() {
  // Normalização roda uma vez, como rodaria no upload.
  const upload = useMemo(() => {
    try {
      return { resultado: normalizarSvg(assetBaseCru), erro: null };
    } catch (erro) {
      return { resultado: null, erro: erro as ErroDeVariante };
    }
  }, []);

  const [cores, setCores] = useState<Record<string, string>>(coresIniciais);
  const [zonaSelecionada, setZonaSelecionada] = useState<string | null>('cabedal');
  const anteriores = useRef<Record<string, string>>(coresIniciais());
  const ultimoBom = useRef<string>('');

  const canonico = upload.resultado?.svg ?? '';

  const elementosPorZona = useMemo(() => {
    if (!canonico) return {};
    return Object.fromEntries(
      relatorioDeZonas(canonico, zonasDoProduto).map((linha) => [linha.zone_key, linha.elementos]),
    );
  }, [canonico]);

  const variante = useMemo(() => {
    if (!canonico) return { svg: null, erro: null };
    try {
      return { svg: gerarVarianteDeCor(canonico, zonasDoProduto, cores), erro: null };
    } catch (erro) {
      return { svg: null, erro: erro as ErroDeVariante };
    }
  }, [canonico, cores]);

  if (variante.svg) ultimoBom.current = variante.svg;

  if (upload.erro) {
    return (
      <main className="tela tela--recusada">
        <h1>Upload recusado</h1>
        <p className="erro__codigo">{upload.erro.codigo}</p>
        <p>{upload.erro.message}</p>
      </main>
    );
  }

  function trocarCor(zoneKey: string, cor: string) {
    setCores((atual) => {
      anteriores.current = atual;
      return { ...atual, [zoneKey]: cor };
    });
  }

  return (
    <main className="tela">
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">{produtoDemo.nome}</h1>
          <p className="cabecalho__meta">
            <code>{produtoDemo.arquivo}</code> · {zonasDoProduto.length} zonas ·{' '}
            {Object.values(elementosPorZona).reduce((soma, n) => soma + n, 0)} elementos mapeados
          </p>
        </div>
        <span className="selo">esboço · Fase 1 · sem banco</span>
      </header>

      {variante.erro && (
        <div className="erro" role="alert">
          <div>
            <p className="erro__codigo">{variante.erro.codigo}</p>
            <p className="erro__mensagem">{variante.erro.message}</p>
            <p className="erro__nota">
              Nenhuma cor foi aplicada: a variante sai inteira ou não sai. O preview abaixo é
              a última variante válida.
            </p>
          </div>
          <button type="button" className="erro__acao" onClick={() => setCores(anteriores.current)}>
            Desfazer
          </button>
        </div>
      )}

      <div className="colunas">
        <PainelDeZonas
          zonas={zonasDoProduto}
          elementosPorZona={elementosPorZona}
          cores={cores}
          zonaSelecionada={zonaSelecionada}
          aoSelecionar={setZonaSelecionada}
          aoTrocarCor={trocarCor}
        />

        <div className="coluna-central">
          <PreviewDaVariante
            svg={ultimoBom.current}
            zonas={zonasDoProduto}
            zonaSelecionada={zonaSelecionada}
            aoSelecionarZona={setZonaSelecionada}
            congelado={variante.erro !== null}
          />
          <ComparativoDeNormalizacao cores={cores} svgCanonico={canonico} />
        </div>

        <PainelDaApi
          cores={cores}
          relatorio={upload.resultado?.relatorio ?? vazio}
          erro={variante.erro}
        />
      </div>
    </main>
  );
}

const vazio = {
  idsRenomeados: [],
  declaracoesAchatadas: 0,
  scriptsRemovidos: 0,
  handlersRemovidos: 0,
  referenciasExternasRemovidas: 0,
};
