// O relatório do mapeamento: que zonas existem neste modelo, quantos elementos cada uma captura
// HOJE no canônico, que cor está sendo testada, e o aviso quando duas dividem elemento. A
// contagem fica em primeiro plano porque é a única chance de o time descobrir que marcou o lugar
// errado ANTES de existir variante — depois disso o erro já virou calçado fabricado.
//
// Só duas coisas aqui são `role="alert"`, e as duas quebram a GERAÇÃO, não a tela: zona que
// captura 0 elementos (seletor gravado que não acha nada no canônico) e sobreposição, em que a
// ordem das chaves do pedido decidiria a cor do elemento dividido (BUG-013). Modelo sem zona
// nenhuma não é alerta — é catálogo vazio; hex pela metade também não, porque anunciar cada
// tecla ensina o time a ignorar alerta justo onde ele custa caro.
//
// Burro e controlado, irmão de `FormularioDeNovaZona` e `ListaDeProdutos`: não busca nada, não
// guarda estado, não conserta o que a pessoa digitou. Quem calcula `elementos`
// (`relatorioDeZonas`) e `sobreposicoes` (`zonasSobrepostas`) é o `EditorDeZonas`.

import type { ReactElement } from 'react';
import { contarElementos } from '../../lib/texto/contarElementos';
import type { Sobreposicao } from '../../lib/render/zonasSobrepostas';

export interface ZonaNoPainel {
  zone_key: string;
  label: string | null;
  /** Quantos elementos o seletor captura no canônico (vem de `relatorioDeZonas`). */
  elementos: number;
  /** O texto que a pessoa digitou no campo de cor desta zona ('' = sem preview). */
  corEmEdicao: string;
  /** Mensagem do motor quando o texto digitado não é hex válido, ou null. */
  erroDaCor: string | null;
}

export interface PropsDoPainelDeZonas {
  zonas: ZonaNoPainel[];
  sobreposicoes: Sobreposicao[];
  /** Zona destacada no palco, ou null. */
  zoneKeyEmFoco: string | null;
  /** Clicar na zona alterna o foco; o pai passa null para desfocar. */
  aoFocarZona(zoneKey: string | null): void;
  aoMudarCor(zoneKey: string, valor: string): void;
  aoLimparCores(): void;
}

export function PainelDeZonas(props: PropsDoPainelDeZonas): ReactElement {
  const { zonas, sobreposicoes, zoneKeyEmFoco } = props;
  const temCorEmEdicao = zonas.some((zona) => zona.corEmEdicao.trim() !== '');

  return (
    <section className="painel-zonas">
      <h2 className="painel-zonas__titulo">Zonas mapeadas</h2>

      {/* Antes da lista: ler isso depois de já ter escolhido as cores seria tarde. */}
      {sobreposicoes.map((sobreposicao) => (
        <p
          className="painel-zonas__sobreposicao"
          role="alert"
          key={`${sobreposicao.zone_key_a}|${sobreposicao.zone_key_b}`}
        >
          As zonas <code>{sobreposicao.zone_key_a}</code> e{' '}
          <code>{sobreposicao.zone_key_b}</code> dividem {contarElementos(sobreposicao.elementos)}. Enquanto
          isso existir, gerar variante pedindo cor para as duas falha: a ordem das chaves no pedido
          é que decidiria a cor do que elas dividem. Remarque uma das duas.
        </p>
      ))}

      {/* Vazio é estado nomeado, com a próxima ação escrita — nunca silêncio. */}
      {zonas.length === 0 ? (
        <p className="painel-zonas__vazio">
          Este modelo ainda não tem nenhuma zona mapeada. Clique numa parte do calçado para marcar
          a primeira.
        </p>
      ) : (
        <ul className="painel-zonas__lista">
          {zonas.map((zona) => (
            <ItemDeZona
              key={zona.zone_key}
              zona={zona}
              emFoco={zona.zone_key === zoneKeyEmFoco}
              aoFocar={props.aoFocarZona}
              aoMudarCor={props.aoMudarCor}
            />
          ))}
        </ul>
      )}

      {/* Apagar zona não existe nesta entrega: botão ambíguo aqui destruiria mapeamento. */}
      {temCorEmEdicao && (
        <div className="painel-zonas__acoes">
          <button type="button" onClick={props.aoLimparCores}>
            Limpar as cores de teste
          </button>
          <p>Apaga só o preview desta tela. As zonas mapeadas continuam exatamente como estão.</p>
        </div>
      )}
    </section>
  );
}

interface PropsDoItemDeZona {
  zona: ZonaNoPainel;
  emFoco: boolean;
  aoFocar(zoneKey: string | null): void;
  aoMudarCor(zoneKey: string, valor: string): void;
}

function ItemDeZona({ zona, emFoco, aoFocar, aoMudarCor }: PropsDoItemDeZona): ReactElement {
  const idDoCampo = `painel-zonas-cor-${zona.zone_key}`;
  const idDoErro = `${idDoCampo}-erro`;

  return (
    <li className={emFoco ? 'painel-zonas__item painel-zonas__item--foco' : 'painel-zonas__item'}>
      {/* Foco alternado: reclicar a zona em foco devolve null e desfaz o destaque no palco. */}
      <button
        type="button"
        aria-current={emFoco ? 'true' : undefined}
        onClick={() => aoFocar(emFoco ? null : zona.zone_key)}
      >
        <code className="painel-zonas__chave">{zona.zone_key}</code>
        {/* Sem `label`, só a chave: "sem nome" faria procurar um texto que ninguém escreveu. */}
        {zona.label !== null && <span className="painel-zonas__rotulo">{zona.label}</span>}
        <span className="painel-zonas__contagem">{contarElementos(zona.elementos)}</span>
      </button>

      {zona.elementos === 0 && (
        <p className="painel-zonas__erro" role="alert">
          O seletor desta zona não encontra nenhum elemento no calçado. Gerar variante com ela vai
          falhar — remarque a zona.
        </p>
      )}

      <label htmlFor={idDoCampo}>Cor de teste</label>
      <input
        id={idDoCampo}
        className="painel-zonas__cor"
        type="text"
        placeholder="#RRGGBB"
        value={zona.corEmEdicao}
        spellCheck={false}
        aria-invalid={zona.erroDaCor !== null}
        aria-describedby={zona.erroDaCor === null ? undefined : idDoErro}
        onChange={(evento) => aoMudarCor(zona.zone_key, evento.target.value)}
      />
      {/* O valor digitado fica intacto — quem confirma a cor é a pessoa, não o painel. */}
      {zona.erroDaCor !== null && (
        <p className="painel-zonas__erro" id={idDoErro}>
          {zona.erroDaCor}
        </p>
      )}
    </li>
  );
}
