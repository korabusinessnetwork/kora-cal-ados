// Palco do esboço: mostra a variante e deixa clicar direto no calçado para escolher zona.
//
// Duas regras do design system valem aqui (docs/02_DESIGN_SYSTEM/README.md, itens 6 e 7):
// o preview da cor não pode sofrer filtro, overlay ou sombra do tema, o que aparece é o
// pixel que a API devolve. Por isso o contorno de seleção é desenhado num <svg> separado
// por cima, com `fill="none"`, em vez de alterar o elemento da zona.

import { useEffect, useRef } from 'react';
import type { ZonaDoProduto } from './produtoDemo';

interface Props {
  svg: string;
  zonas: ZonaDoProduto[];
  zonaSelecionada: string | null;
  aoSelecionarZona: (zoneKey: string) => void;
  congelado: boolean;
}

export function PreviewDaVariante({
  svg,
  zonas,
  zonaSelecionada,
  aoSelecionarZona,
  congelado,
}: Props) {
  const alvo = useRef<HTMLDivElement>(null);
  const contorno = useRef<SVGSVGElement>(null);

  // O SVG vai para o DOM como markup porque o clique precisa chegar no elemento da zona.
  // É seguro porque `normalizarSvg` já rodou: sem <script>, sem on*, sem href externo.
  useEffect(() => {
    const palco = alvo.current;
    const camada = contorno.current;
    if (!palco || !camada) return;

    camada.replaceChildren();

    const zona = zonas.find((candidata) => candidata.zone_key === zonaSelecionada);
    if (!zona) return;

    const original = palco.querySelector('svg');
    if (original) {
      camada.setAttribute('viewBox', original.getAttribute('viewBox') ?? '0 0 420 260');
    }

    for (const elemento of palco.querySelectorAll(zona.svg_selector)) {
      const copia = elemento.cloneNode(true) as SVGElement;

      copia.removeAttribute('id');
      copia.removeAttribute('class');
      copia.setAttribute('fill', 'none');
      copia.setAttribute('stroke', '#4C8DFF');
      copia.setAttribute('stroke-width', '2');
      copia.setAttribute('stroke-dasharray', '5 3');
      copia.setAttribute('vector-effect', 'non-scaling-stroke');

      camada.appendChild(copia);
    }
  }, [svg, zonas, zonaSelecionada]);

  function aoClicar(evento: React.MouseEvent<HTMLDivElement>) {
    const clicado = evento.target as Element;

    // `closest` com o mesmo seletor da zona: o editor resolve a zona exatamente como o
    // motor resolve, se divergisse, clicar numa parte pintaria outra (princípio nº1).
    for (const zona of zonas) {
      if (clicado.closest(zona.svg_selector)) {
        aoSelecionarZona(zona.zone_key);
        return;
      }
    }
  }

  return (
    <div className={`palco ${congelado ? 'palco--congelado' : ''}`}>
      <div className="palco__area">
        <div className="palco__svg" ref={alvo} onClick={aoClicar} dangerouslySetInnerHTML={{ __html: svg }} />
        <svg className="palco__contorno" ref={contorno} viewBox="0 0 420 260" aria-hidden="true" />
      </div>
    </div>
  );
}
