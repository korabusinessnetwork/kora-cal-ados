// Antes/depois do ADR-004, lado a lado: a MESMA chamada de `gerarVarianteDeCor`, uma
// sobre o arquivo cru e outra sobre o asset-base canônico.
//
// No cru, sola, cabedal, cadarço e logo não mudam de cor — a regra `.st-*` do bloco
// <style> vence o atributo `fill` que o motor escreve. É o BUG-001 visível, e é o motivo
// de a normalização existir. Sem ele o esboço parece "só uma tela bonita".
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
  const semNormalizar = useMemo(() => {
    try {
      return gerarVarianteDeCor(assetBaseCru, zonasDoProduto, cores);
    } catch {
      return null;
    }
  }, [cores]);

  return (
    <div className="comparativo">
      <figure className="comparativo__item">
        <img className="comparativo__img" src={paraDataUrl(semNormalizar)} alt="" />
        <figcaption>
          <strong>Sem normalizar</strong>
          <span>o CSS do arquivo vence o motor — BUG-001</span>
        </figcaption>
      </figure>

      <figure className="comparativo__item">
        <img className="comparativo__img" src={paraDataUrl(svgCanonico)} alt="" />
        <figcaption>
          <strong>Asset-base canônico</strong>
          <span>é o que o editor e a API leem</span>
        </figcaption>
      </figure>
    </div>
  );
}

function paraDataUrl(svg: string | null): string {
  if (!svg) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
