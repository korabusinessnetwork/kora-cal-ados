// Antes/depois do ADR-004, lado a lado: a MESMA chamada de `gerarVarianteDeCor`, uma
// sobre o arquivo cru e outra sobre o asset-base canônico.
//
// No cru, sola, cabedal, cadarço e logo não mudam de cor, a regra `.st-*` do bloco
// <style> vence o atributo `fill` que o motor escreve. É o BUG-001 visível, e é o motivo
// de a normalização existir. Sem ele o esboço parece "só uma tela bonita".
//
// Os dois lados precisam receber o MESMO pedido de cor: mostrar o canônico sem cor
// aplicada faria as duas imagens ficarem iguais e o comparativo não provaria nada.
//
// O cru vai num <img> com data URL de propósito: ali dentro o SVG não executa script nem
// busca referência externa. Arquivo cru não vai inline no DOM do editor, nunca.

import { useMemo } from 'react';
import { gerarVarianteDeCor } from '../lib/render/gerarVarianteDeCor';
import { assetBaseCru, zonasDoProduto } from './produtoDemo';

interface Props {
  cores: Record<string, string>;
  svgCanonico: string;
}

export function ComparativoDeNormalizacao({ cores, svgCanonico }: Props) {
  const semNormalizar = useMemo(() => tentarVariante(assetBaseCru, cores), [cores]);
  const canonico = useMemo(() => tentarVariante(svgCanonico, cores), [svgCanonico, cores]);

  return (
    <div className="comparativo">
      <LadoDoComparativo
        svg={semNormalizar}
        titulo="Sem normalizar"
        nota="o CSS do arquivo vence o motor, BUG-001"
      />
      <LadoDoComparativo
        svg={canonico}
        titulo="Asset-base canônico"
        nota="é o que o editor e a API leem"
      />
    </div>
  );
}

function LadoDoComparativo({
  svg,
  titulo,
  nota,
}: {
  svg: string | null;
  titulo: string;
  nota: string;
}) {
  return (
    <figure className="comparativo__item">
      {/* Sem variante NÃO renderiza <img>: `src=""` faz o navegador rebaixar o pedido
          para a própria página (404 + download inteiro de novo), e um quadro em branco
          mentiria dizendo que a variante saiu vazia em vez de ter sido recusada. */}
      {svg ? (
        <img className="comparativo__img" src={paraDataUrl(svg)} alt="" />
      ) : (
        <div className="comparativo__vazio">pedido recusado, nenhuma variante</div>
      )}
      <figcaption>
        <strong>{titulo}</strong>
        <span>{nota}</span>
      </figcaption>
    </figure>
  );
}

/** Recusa do motor aqui não derruba a tela: o erro já é mostrado no banner e no painel da API. */
function tentarVariante(svg: string, cores: Record<string, string>): string | null {
  if (!svg) return null;

  try {
    return gerarVarianteDeCor(svg, zonasDoProduto, cores);
  } catch {
    return null;
  }
}

function paraDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
