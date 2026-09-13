// Lista de zonas do produto. Mostra quantos elementos cada seletor captura HOJE, antes
// de existir variante — conferir o mapeamento é prevenção de erro, que o CLAUDE.md põe
// acima de mensagem de erro. É `relatorioDeZonas` do motor, não uma contagem paralela.

import { useState } from 'react';
import type { ZonaDoProduto } from './produtoDemo';
import { paletaDeAtalho } from './produtoDemo';
import { contarElementos } from '../lib/texto/contarElementos';
import { estadoDoHexDigitado } from '../lib/render/estadoDoHexDigitado';
import { mensagemDoHexDigitado } from '../lib/render/mensagemDoHexDigitado';

interface Props {
  zonas: ZonaDoProduto[];
  elementosPorZona: Record<string, number>;
  cores: Record<string, string>;
  zonaSelecionada: string | null;
  aoSelecionar: (zoneKey: string) => void;
  aoTrocarCor: (zoneKey: string, cor: string) => void;
}


export function PainelDeZonas({
  zonas,
  elementosPorZona,
  cores,
  zonaSelecionada,
  aoSelecionar,
  aoTrocarCor,
}: Props) {
  return (
    <section className="painel">
      <h2 className="painel__titulo">Zonas</h2>
      <p className="painel__ajuda">Clique numa zona, na lista ou no calçado, para trocar a cor.</p>

      <ul className="zonas">
        {zonas.map((zona) => {
          const cor = cores[zona.zone_key];
          const elementos = elementosPorZona[zona.zone_key] ?? 0;
          const selecionada = zona.zone_key === zonaSelecionada;

          return (
            <li key={zona.zone_key}>
              <button
                type="button"
                className={`zona ${selecionada ? 'zona--ativa' : ''}`}
                // A zona escolhida existia só na classe `zona--ativa`, ou seja, só na cor da
                // borda, e cor não é anúncio. Mesmo conserto que A08 fez nas telas do palco.
                aria-pressed={selecionada}
                onClick={() => aoSelecionar(zona.zone_key)}
              >
                <span
                  className={`zona__amostra ${cor ? '' : 'zona__amostra--gradiente'}`}
                  style={cor ? { background: cor } : undefined}
                />
                <span className="zona__nome">{zona.rotulo}</span>
                <span className="zona__meta">
                  {contarElementos(elementos)}
                </span>
                <code className="zona__hex">{cor ?? 'gradiente'}</code>
              </button>

              {selecionada && (
                <EditorDeCor
                  cor={cor ?? '#808080'}
                  zoneKey={zona.zone_key}
                  aoTrocar={(nova) => aoTrocarCor(zona.zone_key, nova)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EditorDeCor({
  cor,
  aoTrocar,
  zoneKey,
}: {
  cor: string;
  aoTrocar: (cor: string) => void;
  zoneKey: string;
}) {
  const [texto, setTexto] = useState(cor);
  const idDoErro = `esboco-hex-erro-${zoneKey}`;

  // Só sobe cor completa: reagir a cada tecla faria "#F" virar erro de cor inválida na
  // cara do usuário enquanto ele ainda digita.
  function digitar(valor: string) {
    setTexto(valor);
    if (estadoDoHexDigitado(valor) === 'completo') aoTrocar(valor.trim());
  }

  const valido = estadoDoHexDigitado(texto) === 'completo';

  return (
    <div className="editor">
      {/* Os dois campos editam a MESMA cor e precisavam dizer qual é a zona: sem rótulo, a árvore de
          acessibilidade mostrava dois campos cujo nome era o próprio valor ("#E9E4DA"), e com nove
          zonas na tela nada distinguia um do outro. */}
      <input
        type="color"
        className="editor__roda"
        aria-label={`cor da zona ${zoneKey}`}
        value={cor}
        onChange={(evento) => {
          setTexto(evento.target.value);
          aoTrocar(evento.target.value);
        }}
      />
      <input
        type="text"
        className={`editor__hex ${valido ? '' : 'editor__hex--invalido'}`}
        aria-label={`hex da zona ${zoneKey}`}
        aria-invalid={!valido}
        aria-describedby={valido ? undefined : idDoErro}
        value={texto}
        spellCheck={false}
        onChange={(evento) => digitar(evento.target.value)}
      />
      {/* Hex incompleto mudava SÓ a classe CSS: borda vermelha, sem uma palavra dizendo o que ela
          quer. Quem não enxerga a borda não recebia nada. Não é `role="alert"` de propósito, e a
          razão é a mesma que o editor de verdade registra: anunciar cada tecla enquanto a pessoa
          ainda digita "#F" ensina a ignorar alerta justo onde ele custa caro. O texto fica visível e
          ligado ao campo por `aria-describedby`, que é lido quando o foco chega nele. */}
      {!valido && (
        <p className="editor__erro" id={idDoErro}>
          {mensagemDoHexDigitado(texto, 'o preview')}
        </p>
      )}
      <div className="editor__paleta">
        {paletaDeAtalho.map((atalho) => (
          <button
            key={atalho.hex}
            type="button"
            className="editor__atalho"
            style={{ background: atalho.hex }}
            // O mesmo texto nos dois: `aria-label` é o nome acessível e `title` é a legenda do
            // mouse. Antes só havia `title` com o hex cru, que vira nome acessível de último
            // recurso — ou seja, o leitor de tela soletrava o hex e o mouse não via legenda alguma.
            aria-label={`${atalho.nome} (${atalho.hex})`}
            title={`${atalho.nome} (${atalho.hex})`}
            onClick={() => {
              setTexto(atalho.hex);
              aoTrocar(atalho.hex);
            }}
          />
        ))}
      </div>
    </div>
  );
}
