// O palco do editor: o calçado na tela, clicável. Apresentacional, recebe o canônico, a
// marcação em curso e a zona em foco já resolvidos, não busca nada e não guarda estado.
//
// Quatro decisões moram aqui, cada uma barrando um modo de falha específico:
//
// 1. O desenho sai SEMPRE de `gerarVarianteDeCor`, nunca de CSS, mesmo sem cor pedida.
//    Se o palco pintasse por `fill` de classe, o editor mostraria uma cor que a API não
//    produz, e a divergência só apareceria com o calçado já fabricado (princípio nº1).
// 2. O clique sobe por `closest('[id]')` porque em SVG o alvo do evento é sempre a folha
//    (o `<path>` de dentro do `<g>`), e o endereçável é o ancestral com id.
// 3. O contorno dos ids marcados vive numa CAMADA separada: regra 6 do design system,
//    o palco não recebe filtro, sombra nem overlay sobre o desenho, porque o que aparece
//    ali é o pixel que a API devolve. Realçar não pode alterar um byte do desenho.
// 4. Marcação em curso e zona em foco são DUAS camadas, não uma com duas classes: elas
//    respondem a perguntas diferentes ("o que estou marcando agora" × "onde já está
//    mapeado") e mudam em momentos diferentes. Quem abria um modelo já mapeado via o
//    painel listar as zonas e o calçado ficar mudo; a camada de foco fecha esse buraco.

import { useMemo } from 'react';
import type { MouseEvent, ReactElement } from 'react';
import { analisarSvg } from '../../lib/render/dom';
import { ErroDeVariante } from '../../lib/render/erros';
import { gerarVarianteDeCor } from '../../lib/render/gerarVarianteDeCor';
import type { CoresPorZona } from '../../lib/render/gerarVarianteDeCor';
import { resolverZonaDoElemento } from './resolverZonaDoElemento';
import type { ZonaDoProduto } from './tiposDeZona';

export interface PropsDoPalcoDeMarcacao {
  svgCanonico: string;
  zonas: ZonaDoProduto[];
  /** Preview de cor. Vazio = o canônico como está. */
  coresPorZona?: CoresPorZona;
  /** Ids da marcação em curso, ainda não salva. */
  idsMarcados: string[];
  /** Ids dos elementos da zona destacada no painel. Realce discreto, distinto da marcação
   *  em curso: um é "o que estou marcando agora", o outro é "onde já está mapeado". */
  idsEmFoco?: string[];
  /** `zoneKeyExistente` é null quando o elemento ainda não pertence a nenhuma zona. */
  aoClicarElemento(id: string, zoneKeyExistente: string | null): void;
  desabilitado?: boolean;
}

export function PalcoDeMarcacao({
  svgCanonico,
  zonas,
  coresPorZona,
  idsMarcados,
  idsEmFoco,
  aoClicarElemento,
  desabilitado = false,
}: PropsDoPalcoDeMarcacao): ReactElement {
  const desenho = useMemo(
    () => desenharPeloMotor(svgCanonico, zonas, coresPorZona ?? {}),
    [svgCanonico, zonas, coresPorZona],
  );
  const viewBox = useMemo(() => lerViewBox(svgCanonico), [svgCanonico]);

  function aoClicarNoPalco(evento: MouseEvent<HTMLDivElement>): void {
    if (desabilitado) return;

    // Sem id o elemento não é endereçável e o clique morre aqui: id nasce na normalização,
    // nunca no editor (ADR-005), então inventar um aqui criaria um seletor que o motor não
    // reencontra na geração.
    const alvo = (evento.target as Element).closest('[id]');
    const id = alvo?.getAttribute('id');
    if (!alvo || !id) return;

    aoClicarElemento(id, resolverZonaDoElemento(alvo, zonas));
  }

  return (
    <div
      className={`palco${desabilitado ? ' palco--desabilitado' : ''}`}
      role="group"
      aria-label="Palco de marcação: clique numa parte do calçado para marcá-la"
      aria-disabled={desabilitado || undefined}
    >
      {desenho.erro && (
        // Falhar visível é o requisito: com o motor recusando o pedido, o palco mostra o
        // canônico CRU. Pintar "quase certo" é o modo de falha proibido (princípio nº1).
        <p className="zonas__erro" role="alert">
          {desenho.erro.mensagem} (código {desenho.erro.codigo})
        </p>
      )}

      {/* `dangerouslySetInnerHTML` por dois motivos: é seguro porque o arquivo é o
          CANÔNICO, `normalizarSvg` já removeu <script>, handlers `on*` e referência
          externa antes de ele subir ao Storage; e é ele, não `useEffect` + `innerHTML`,
          porque o markup precisa existir no HTML renderizado para o teste conseguir
          compará-lo byte a byte com a saída de `gerarVarianteDeCor`. */}
      <div
        className="palco__desenho"
        onClick={aoClicarNoPalco}
        dangerouslySetInnerHTML={{ __html: desenho.markup }}
      />

      {/* O foco vem ANTES da marcação em curso porque em SVG/HTML quem é declarado depois
          pinta por cima: "onde já está mapeado" é pano de fundo, "o que estou marcando
          agora" é o que a pessoa está manipulando. Um id que esteja nas DUAS listas
          aparece nas duas camadas, a sobreposição é intencional, não um bug a esconder:
          o elemento está sendo acrescentado à zona que está em foco, e as duas leituras
          são verdadeiras ao mesmo tempo. Quem decide como isso fica (qual traço vence, se
          um é tracejado, se há transparência) é o `zonas.css`, nunca este arquivo. */}
      {camadaDeContorno(viewBox, idsEmFoco ?? [], 'palco__contorno palco__contorno--foco')}
      {camadaDeContorno(viewBox, idsMarcados, 'palco__contorno')}
    </div>
  );
}

/**
 * Uma camada de realce. As duas camadas compartilham as mesmas garantias porque a regra
 * que as sustenta é a mesma: nada aqui pode tocar o desenho que veio do motor.
 *
 * Sem `viewBox` no canônico a camada é OMITIDA: chutar um alinharia o contorno com o
 * desenho por acaso, e contorno no lugar errado é marcação no lugar errado. Lista vazia
 * também não vira `<svg>` nenhum, um elemento vazio na árvore só serve para atrapalhar
 * quem inspeciona o palco procurando o que está realçado.
 */
function camadaDeContorno(
  viewBox: string | null,
  ids: string[],
  className: string,
): ReactElement | null {
  if (viewBox === null || ids.length === 0) return null;

  return (
    <svg className={className} viewBox={viewBox} aria-hidden="true" focusable="false">
      {/* `<use>` referencia o elemento do SVG inline no mesmo documento: o contorno é
          desenhado por `stroke` na camada, sem tocar o elemento original. */}
      {ids.map((id) => (
        <use key={id} href={`#${id}`} />
      ))}
    </svg>
  );
}

interface DesenhoDoPalco {
  markup: string;
  erro: { mensagem: string; codigo: string } | null;
}

/** O mesmo motor da API, sempre, inclusive quando não há cor pedida. */
function desenharPeloMotor(
  svgCanonico: string,
  zonas: ZonaDoProduto[],
  coresPorZona: CoresPorZona,
): DesenhoDoPalco {
  try {
    return { markup: gerarVarianteDeCor(svgCanonico, zonas, coresPorZona), erro: null };
  } catch (erro) {
    // Só erro de domínio vira alerta na tela. Qualquer outro (motor sem DOM, por exemplo)
    // sobe: engolir uma falha desconhecida aqui a transformaria em palco silenciosamente
    // desatualizado.
    if (!(erro instanceof ErroDeVariante)) throw erro;

    return { markup: svgCanonico, erro: { mensagem: erro.message, codigo: erro.codigo } };
  }
}

/** O `viewBox` do canônico, ou null quando ele não tem um. */
function lerViewBox(svgCanonico: string): string | null {
  return analisarSvg(svgCanonico).documentElement.getAttribute('viewBox');
}
