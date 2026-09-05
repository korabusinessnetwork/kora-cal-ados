// Lista de zonas do produto. Mostra quantos elementos cada seletor captura HOJE, antes
// de existir variante — conferir o mapeamento é prevenção de erro, que o CLAUDE.md põe
// acima de mensagem de erro. É `relatorioDeZonas` do motor, não uma contagem paralela.

import { useState } from 'react';
import type { ZonaDoProduto } from './produtoDemo';
import { paletaDeAtalho } from './produtoDemo';

interface Props {
  zonas: ZonaDoProduto[];
  elementosPorZona: Record<string, number>;
  cores: Record<string, string>;
  zonaSelecionada: string | null;
  aoSelecionar: (zoneKey: string) => void;
  aoTrocarCor: (zoneKey: string, cor: string) => void;
}

const HEX_COMPLETO = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

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
      <p className="painel__ajuda">Clique numa zona — na lista ou no calçado — para trocar a cor.</p>

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
                onClick={() => aoSelecionar(zona.zone_key)}
              >
                <span
                  className={`zona__amostra ${cor ? '' : 'zona__amostra--gradiente'}`}
                  style={cor ? { background: cor } : undefined}
                />
                <span className="zona__nome">{zona.rotulo}</span>
                <span className="zona__meta">
                  {elementos} {elementos === 1 ? 'elemento' : 'elementos'}
                </span>
                <code className="zona__hex">{cor ?? 'gradiente'}</code>
              </button>

              {selecionada && (
                <EditorDeCor
                  cor={cor ?? '#808080'}
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

function EditorDeCor({ cor, aoTrocar }: { cor: string; aoTrocar: (cor: string) => void }) {
  const [texto, setTexto] = useState(cor);

  // Só sobe cor completa: reagir a cada tecla faria "#F" virar erro de cor inválida na
  // cara do usuário enquanto ele ainda digita.
  function digitar(valor: string) {
    setTexto(valor);
    if (HEX_COMPLETO.test(valor.trim())) aoTrocar(valor.trim());
  }

  const valido = HEX_COMPLETO.test(texto.trim());

  return (
    <div className="editor">
      <input
        type="color"
        className="editor__roda"
        value={cor}
        onChange={(evento) => {
          setTexto(evento.target.value);
          aoTrocar(evento.target.value);
        }}
      />
      <input
        type="text"
        className={`editor__hex ${valido ? '' : 'editor__hex--invalido'}`}
        value={texto}
        spellCheck={false}
        onChange={(evento) => digitar(evento.target.value)}
      />
      <div className="editor__paleta">
        {paletaDeAtalho.map((atalho) => (
          <button
            key={atalho}
            type="button"
            className="editor__atalho"
            style={{ background: atalho }}
            title={atalho}
            onClick={() => {
              setTexto(atalho);
              aoTrocar(atalho);
            }}
          />
        ))}
      </div>
    </div>
  );
}
