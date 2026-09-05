// A tela de produtos: lista, ou o produto aberto com o editor de zonas.
// Único lugar desta feature com estado — os componentes abaixo dela são burros (mesmo
// padrão de `EsbocoDoEditor`).

import { useCallback, useMemo, useState } from 'react';
import { PINTAVEIS, alvosPintaveis, expandirPintaveis } from '../../lib/render/alvosPintaveis';
import { analisarSvg } from '../../lib/render/dom';
import { ErroDeVariante } from '../../lib/render/erros';
import { sugerirZoneKey } from '../../lib/render/validarZoneKey';
import { FormularioDeNovaZona } from '../zonas/FormularioDeNovaZona';
import { PalcoDeMarcacao } from '../zonas/PalcoDeMarcacao';
import { marcarZona } from '../zonas/marcarZona';
import { useMarcacaoDeZona } from '../zonas/hooks/useMarcacaoDeZona';
import { useZonasDoProduto } from '../zonas/hooks/useZonasDoProduto';
import { ListaDeProdutos } from './ListaDeProdutos';
import { VisualizacaoDoProduto } from './VisualizacaoDoProduto';
import { useAssetBase } from './hooks/useAssetBase';
import { useProdutos } from './hooks/useProdutos';
import type { Produto } from './listarProdutos';

export function TelaDeProdutos({ tenantId }: { tenantId: string }) {
  const [aberto, setAberto] = useState<Produto | null>(null);
  const lista = useProdutos(tenantId);

  if (!aberto) {
    return (
      <ListaDeProdutos
        estado={lista.estado}
        produtos={lista.produtos}
        erro={lista.erro}
        aoAbrir={setAberto}
        aoRecarregar={lista.recarregar}
      />
    );
  }

  return (
    <ProdutoAberto
      produto={aberto}
      tenantId={tenantId}
      aoVoltar={() => setAberto(null)}
    />
  );
}

/**
 * Componente à parte porque os hooks do produto só podem ser chamados quando há produto
 * aberto — hook não pode ficar atrás de um `if`.
 */
function ProdutoAberto({
  produto,
  tenantId,
  aoVoltar,
}: {
  produto: Produto;
  tenantId: string;
  aoVoltar: () => void;
}) {
  const asset = useAssetBase(produto.base_asset_path);
  // O tenant vem por parâmetro, não de um `useSessao` dentro da feature de zonas: `zonas/`
  // não conhece sessão nem produto, e por isso continua testável sem montar a árvore toda.
  const zonas = useZonasDoProduto(produto.id, tenantId);
  const marcacao = useMarcacaoDeZona(produto.id);

  const [rotulo, setRotulo] = useState('');
  const [zoneKey, setZoneKey] = useState('');
  const [corDefault, setCorDefault] = useState('');
  // Recusa vinda do motor (sobreposição, `fill="none"`, chave inválida): é diferente do erro
  // do banco e precisa aparecer com o motivo real, não como "não deu certo".
  const [recusa, setRecusa] = useState<string | null>(null);

  // O canônico analisado uma vez só: a contagem e a checagem de cada clique consultam o
  // mesmo documento. Reanalisar por clique seria correto e desperdiçaria o parse inteiro do
  // arquivo do cliente a cada toque.
  const documento = useMemo(() => (asset.svg ? analisarSvg(asset.svg) : null), [asset.svg]);

  // Índice id → elemento. `getElementById` não é confiável num documento XML vindo do
  // `DOMParser` (o `id` só é ID de verdade quando um DTD o declara, e o canônico não tem
  // DTD), e montar seletor a partir de um id para procurar seria reintroduzir a string de
  // seletor fora de `montarSeletorDeZona`.
  const elementosPorId = useMemo(() => {
    const indice = new Map<string, Element>();
    if (documento) {
      for (const elemento of documento.querySelectorAll('[id]')) {
        const id = elemento.getAttribute('id');
        if (id) indice.set(id, elemento);
      }
    }
    return indice;
  }, [documento]);

  // Conta pela MESMA regra que o motor usa para decidir o que recebe cor. Contar `[id]`
  // seria mais simples e mentiria: incluiria o `<linearGradient>` e as costuras
  // `fill="none"`, que o editor nunca vai conseguir marcar. Número na tela que não bate
  // com o que dá para fazer é pior que número nenhum.
  const elementosMarcaveis = useMemo(() => {
    if (!documento) return null;
    return expandirPintaveis([...documento.querySelectorAll(PINTAVEIS)]).length;
  }, [documento]);

  const chave = zoneKey.trim();
  const zonaExistente = zonas.zonas.some((zona) => zona.zone_key === chave);

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

      // Elemento que não aceita cor é recusado no CLIQUE, não ao salvar. `marcarZona`
      // recusaria de qualquer jeito, mas só depois de o time ter marcado meia dúzia de
      // peças — prevenção de erro vale mais que mensagem de erro (CLAUDE.md). A regra de
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
    if (!asset.svg) return;

    let linha;
    try {
      linha = marcarZona({
        svgCanonico: asset.svg,
        zonasAtuais: zonas.zonas,
        zoneKey: chave,
        idsMarcados: marcacao.idsMarcados,
        // Campo vazio numa zona que JÁ EXISTE significa "não mexi nisso", não "apague".
        // `marcarZona` distingue ausente (preserva) de `null` (limpa), e mandar `null` aqui
        // apagaria em silêncio o rótulo e a cor que um colega definiu, só porque quem
        // acrescentou um ilhós não redigitou os dois campos. Em zona nova, vazio é null
        // mesmo — não há nada a preservar.
        label: preservarOuLimpar(rotulo, zonaExistente),
        corDefault: preservarOuLimpar(corDefault, zonaExistente),
      });
    } catch (falha: unknown) {
      // O motor recusa com motivo; repassar o motivo é o que separa "falhou" de "falhou
      // porque essa costura não tem preenchimento".
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
  }, [asset.svg, chave, corDefault, marcacao, rotulo, zonaExistente, zonas]);

  const aoCancelar = useCallback(() => {
    marcacao.limpar();
    setRecusa(null);
  }, [marcacao]);

  return (
    <VisualizacaoDoProduto
      nome={produto.nome}
      estado={asset.estado}
      erro={asset.erro}
      elementosMarcaveis={elementosMarcaveis}
      zonasMarcadas={zonas.estado === 'pronta' ? zonas.zonas.length : null}
      aoVoltar={aoVoltar}
      palco={
        asset.svg && (
          <PalcoDeMarcacao
            svgCanonico={asset.svg}
            zonas={zonas.zonas}
            idsMarcados={marcacao.idsMarcados}
            aoClicarElemento={aoClicarElemento}
            desabilitado={zonas.estado !== 'pronta' || zonas.salvando}
          />
        )
      }
      lateral={
        <>
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
              // Sugere a chave enquanto ninguém a editou à mão: `zone_key` vira contrato com
              // o cliente da API, então quem confirma é o time — mas digitar o slug de novo
              // a cada zona é o tipo de atrito que faz gente inventar chave ruim.
              setZoneKey((atual) =>
                atual === '' || atual === sugerirZoneKey(rotulo) ? sugerirZoneKey(valor) : atual,
              );
            }}
            aoMudarZoneKey={setZoneKey}
            aoMudarCorDefault={setCorDefault}
            aoSalvar={() => void aoSalvar()}
            aoCancelar={aoCancelar}
          />
        </>
      }
    />
  );
}

/**
 * Campo de texto do formulário → o que `marcarZona` deve fazer com a coluna.
 * `undefined` = não mexe (preserva o que está gravado); `null` = apaga; texto = grava.
 */
export function preservarOuLimpar(valor: string, zonaExistente: boolean): string | null | undefined {
  const limpo = valor.trim();
  if (limpo !== '') return limpo;
  return zonaExistente ? undefined : null;
}
