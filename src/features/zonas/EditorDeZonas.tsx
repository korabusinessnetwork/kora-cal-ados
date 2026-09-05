// O editor de zonas inteiro: palco, relatório e formulário. **Único lugar desta feature com
// estado** — todos os componentes abaixo dele são burros e testáveis como função de props
// (mesmo padrão de `EsbocoDoEditor`).
//
// Ele recebe o SVG canônico e os ids por props e não conhece nem sessão nem produto: é o que
// mantém a seta de dependência entre features em uma direção só (`produtos/` → `zonas/`,
// ver `src/features/README.md`) e o que permite testá-lo sem montar a árvore inteira.
//
// O editor é somente-leitura sobre o asset-base (ADR-005): marcar zona escreve uma linha em
// `product_zones` e nada mais. Nenhum caminho daqui regrava o SVG.

import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { alvosPintaveis } from '../../lib/render/alvosPintaveis';
import { analisarSvg } from '../../lib/render/dom';
import { ErroDeVariante } from '../../lib/render/erros';
import { relatorioDeZonas } from '../../lib/render/gerarVarianteDeCor';
import { sugerirZoneKey } from '../../lib/render/validarZoneKey';
import { zonasSobrepostas } from '../../lib/render/zonasSobrepostas';
import { FormularioDeNovaZona } from './FormularioDeNovaZona';
import { PainelDeZonas } from './PainelDeZonas';
import type { ZonaNoPainel } from './PainelDeZonas';
import { PalcoDeMarcacao } from './PalcoDeMarcacao';
import { idsDoSeletor, marcarZona } from './marcarZona';
import { useMarcacaoDeZona } from './hooks/useMarcacaoDeZona';
import { usePreviewDeCor } from './hooks/usePreviewDeCor';
import { useZonasDoProduto } from './hooks/useZonasDoProduto';

export interface PropsDoEditorDeZonas {
  productId: string;
  tenantId: string;
  /** O asset-base canônico, já baixado. Somente leitura. */
  svgCanonico: string;
}

export function EditorDeZonas({
  productId,
  tenantId,
  svgCanonico,
}: PropsDoEditorDeZonas): ReactElement {
  const zonas = useZonasDoProduto(productId, tenantId);
  const marcacao = useMarcacaoDeZona(productId);
  const preview = usePreviewDeCor(productId);

  const [rotulo, setRotulo] = useState('');
  const [zoneKey, setZoneKey] = useState('');
  const [corDefault, setCorDefault] = useState('');
  const [zoneKeyEmFoco, setZoneKeyEmFoco] = useState<string | null>(null);
  // Recusa vinda do motor (sobreposição, `fill="none"`, chave inválida): é diferente do erro
  // do banco e precisa aparecer com o motivo real, não como "não deu certo".
  const [recusa, setRecusa] = useState<string | null>(null);

  // Índice id → elemento. `getElementById` não é confiável num documento XML vindo do
  // `DOMParser` (o `id` só é ID de verdade quando um DTD o declara, e o canônico não tem
  // DTD), e montar um seletor a partir do id seria reintroduzir a string de seletor fora de
  // `montarSeletorDeZona`.
  const elementosPorId = useMemo(() => {
    const indice = new Map<string, Element>();
    for (const elemento of analisarSvg(svgCanonico).querySelectorAll('[id]')) {
      const id = elemento.getAttribute('id');
      if (id) indice.set(id, elemento);
    }
    return indice;
  }, [svgCanonico]);

  // A contagem por zona e o aviso de sobreposição saem do MOTOR, não de uma conta local:
  // um número na tela que não é o que a geração vai resolver é pior que número nenhum.
  const contagens = useMemo(
    () => relatorioDeZonas(svgCanonico, zonas.zonas),
    [svgCanonico, zonas.zonas],
  );
  const sobreposicoes = useMemo(
    () => zonasSobrepostas(svgCanonico, zonas.zonas),
    [svgCanonico, zonas.zonas],
  );

  const chave = zoneKey.trim();
  const zonaExistente = zonas.zonas.some((zona) => zona.zone_key === chave);

  const paraOPainel: ZonaNoPainel[] = zonas.zonas.map((zona, indice) => ({
    zone_key: zona.zone_key,
    label: zona.label,
    elementos: contagens[indice]?.elementos ?? 0,
    corEmEdicao: preview.emEdicao[zona.zone_key] ?? '',
    erroDaCor: preview.erros[zona.zone_key] ?? null,
  }));

  // Os ids da zona destacada, para o palco contorná-los. Vêm do seletor gravado, lido pela
  // mesma função que o acréscimo de elemento usa — o palco nunca recebe uma lista montada
  // por outro caminho.
  const idsEmFoco = useMemo(() => {
    if (zoneKeyEmFoco === null) return [];
    const zona = zonas.zonas.find((candidata) => candidata.zone_key === zoneKeyEmFoco);
    if (!zona) return [];

    try {
      return idsDoSeletor(zona.svg_selector);
    } catch {
      // Seletor legado (prefixo) não é uma lista de ids: sem realce, e sem derrubar a tela.
      // Quem reclama de mapeamento assim é a contagem do painel, que mostra o que ele pega.
      return [];
    }
  }, [zoneKeyEmFoco, zonas.zonas]);

  const aoClicarElemento = useCallback(
    (id: string, zoneKeyExistente: string | null) => {
      // Prevenção de erro > mensagem de erro: elemento de outra zona nem chega a entrar na
      // marcação. `marcarZona` recusaria depois, mas só na hora de salvar — e o time teria
      // marcado meia dúzia de elementos antes de descobrir.
      if (zoneKeyExistente !== null && zoneKeyExistente !== chave) {
        setRecusa(
          `Esse elemento já pertence à zona "${zoneKeyExistente}". Para acrescentar elementos a ela, use essa mesma chave.`,
        );
        return;
      }

      // Elemento que não aceita cor é recusado no CLIQUE, com o motivo real. A regra de
      // "aceita cor" continua vindo do motor: aqui só perguntamos a ele.
      const elemento = elementosPorId.get(id);

      if (elemento) {
        try {
          if (alvosPintaveis([elemento], chave === '' ? 'esta zona' : chave).length === 0) {
            setRecusa(
              'Esse traço é um contorno sem preenchimento (`fill="none"`): pintá-lo mudaria o desenho, então ele não pode virar zona.',
            );
            return;
          }
        } catch (falha: unknown) {
          setRecusa(
            falha instanceof ErroDeVariante ? falha.message : 'Esse elemento não aceita cor.',
          );
          return;
        }
      }

      setRecusa(null);
      marcacao.alternar(id);
    },
    [chave, elementosPorId, marcacao],
  );

  const aoSalvar = useCallback(async () => {
    let linha;
    try {
      linha = marcarZona({
        svgCanonico,
        zonasAtuais: zonas.zonas,
        zoneKey: chave,
        idsMarcados: marcacao.idsMarcados,
        // Campo vazio numa zona que JÁ EXISTE significa "não mexi nisso", não "apague"
        // (BUG-014): `null` apagaria em silêncio o rótulo que um colega definiu.
        label: preservarOuLimpar(rotulo, zonaExistente),
        corDefault: preservarOuLimpar(corDefault, zonaExistente),
      });
    } catch (falha: unknown) {
      setRecusa(
        falha instanceof ErroDeVariante ? falha.message : 'Não foi possível montar a zona.',
      );
      return;
    }

    setRecusa(null);
    if (!(await zonas.gravar(linha))) return;

    marcacao.limpar();
    setRotulo('');
    setZoneKey('');
    setCorDefault('');
  }, [chave, corDefault, marcacao, rotulo, svgCanonico, zonaExistente, zonas]);

  return (
    <div className="editor-zonas">
      <div className="editor-zonas__palco">
        <PalcoDeMarcacao
          svgCanonico={svgCanonico}
          zonas={zonas.zonas}
          coresPorZona={preview.cores}
          idsMarcados={marcacao.idsMarcados}
          idsEmFoco={idsEmFoco}
          aoClicarElemento={aoClicarElemento}
          desabilitado={zonas.estado !== 'pronta' || zonas.salvando}
        />
      </div>

      <aside className="editor-zonas__lateral">
        {zonas.estado === 'carregando' && (
          <p className="zonas__aviso" aria-busy="true">
            Carregando as zonas deste modelo…
          </p>
        )}

        {zonas.estado === 'erro' && (
          <div className="zonas__erro" role="alert">
            <p>{zonas.erro}</p>
            <button type="button" onClick={zonas.recarregar}>
              Tentar de novo
            </button>
          </div>
        )}

        <PainelDeZonas
          zonas={paraOPainel}
          sobreposicoes={sobreposicoes}
          zoneKeyEmFoco={zoneKeyEmFoco}
          aoFocarZona={setZoneKeyEmFoco}
          aoMudarCor={preview.definir}
          aoLimparCores={preview.limpar}
        />

        <FormularioDeNovaZona
          rotulo={rotulo}
          zoneKey={zoneKey}
          corDefault={corDefault}
          quantidadeMarcada={marcacao.idsMarcados.length}
          zonaExistente={zonaExistente}
          salvando={zonas.salvando}
          erro={recusa ?? zonas.erroAoGravar}
          aoMudarRotulo={(valor) => {
            setRotulo(valor);
            // Sugere a chave enquanto ninguém a editou à mão: `zone_key` vira contrato com o
            // cliente da API, então quem confirma é o time — mas redigitar o slug a cada zona
            // é o atrito que faz gente inventar chave ruim.
            setZoneKey((atual) =>
              atual === '' || atual === sugerirZoneKey(rotulo) ? sugerirZoneKey(valor) : atual,
            );
          }}
          aoMudarZoneKey={setZoneKey}
          aoMudarCorDefault={setCorDefault}
          aoSalvar={() => void aoSalvar()}
          aoCancelar={() => {
            marcacao.limpar();
            setRecusa(null);
          }}
        />
      </aside>
    </div>
  );
}

/**
 * Campo de texto do formulário → o que `marcarZona` deve fazer com a coluna.
 * `undefined` = não mexe (preserva o gravado); `null` = apaga; texto = grava. A distinção
 * existe por causa do BUG-014, e o teste dela mora em `EditorDeZonas.test.ts`.
 */
export function preservarOuLimpar(
  valor: string,
  zonaExistente: boolean,
): string | null | undefined {
  const limpo = valor.trim();
  if (limpo !== '') return limpo;
  return zonaExistente ? undefined : null;
}
