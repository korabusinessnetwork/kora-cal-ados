// O bloco de uma categoria na tela da composição: qual peça, em que cor, com que parâmetro.
//
// Saiu de `TelaDaComposicao.tsx` no R7-A54, quando a tela passou de 450 linhas. Não guarda estado
// nenhum: a escolha chega pronta e cada gesto sobe como uma mudança parcial, que a tela entrega a
// `mudarEscolhaDaTela`. É isso que deixa a regra de transição fora do `.tsx` (BUG-019).

import type { PecaDoAcervo } from '../lib/composicao/tiposDaComposicao';
import { CampoDeCorDaCategoria } from './CampoDeCorDaCategoria';
import { ControlesDeParametro } from './ControlesDeParametro';
import type { EscolhaDaTela } from './composicaoDaTela';

interface ControleDaCategoriaProps {
  categoria: string;
  obrigatoria: boolean;
  pecas: PecaDoAcervo[];
  escolha: EscolhaDaTela;
  aoMudar: (mudanca: Partial<EscolhaDaTela>) => void;
}

/** O bloco de uma categoria: qual peça, em que cor, com que parâmetro. */
export function ControleDaCategoria({
  categoria,
  obrigatoria,
  pecas,
  escolha,
  aoMudar,
}: ControleDaCategoriaProps) {
  const peca = pecas.find(({ id }) => id === escolha.pecaId);

  return (
    <div className="palco3d__categoria">
      <h3 className="palco3d__categoria-titulo">
        <code>{categoria}</code>
        {obrigatoria ? null : <span className="palco3d__opcional">opcional</span>}
      </h3>

      <div className="palco3d__lista">
        {pecas.map((candidata) => (
          <button
            key={candidata.id}
            type="button"
            className={
              candidata.id === escolha.pecaId ? 'palco3d__peca palco3d__peca--ativa' : 'palco3d__peca'
            }
            // A escolha existia só na borda colorida, e cor não é anúncio: para um leitor de tela
            // os botões da categoria eram todos iguais, e não havia como saber qual está valendo
            // sem sair da lista e conferir o resultado. `aria-pressed` diz "este está apertado"
            // sem depender de enxergar.
            aria-pressed={candidata.id === escolha.pecaId}
            onClick={() => aoMudar({ pecaId: candidata.id })}
          >
            <span className="palco3d__peca-rotulo">{candidata.rotulo}</span>
          </button>
        ))}
        {obrigatoria ? null : (
          <button
            type="button"
            className={escolha.pecaId === null ? 'palco3d__peca palco3d__peca--ativa' : 'palco3d__peca'}
            // Dispensar a categoria é uma escolha como qualquer outra, e o botão dela entra na
            // mesma lista, então ele anuncia do mesmo jeito. Sem isto, "nenhuma peça" seria o
            // único estado da tela que só existe para quem enxerga a borda.
            aria-pressed={escolha.pecaId === null}
            onClick={() => aoMudar({ pecaId: null })}
          >
            {/* Era `sem {categoria}`, e a tela escrevia "sem cadarco": a `categoria` é chave de
                dado, não palavra de frase, e chegava sem cedilha no meio do português. A forma não
                declara rótulo legível para categoria (só a PEÇA tem `rotulo`), então o caminho
                honesto é não costurar a chave na prosa. Qual categoria é esta já está no título do
                bloco, logo acima, com a marca de "opcional" ao lado. */}
            <span className="palco3d__peca-rotulo">Nenhuma peça</span>
          </button>
        )}
      </div>

      {peca ? (
        <div className="palco3d__ajustes">
          {/* O `<code>` que mostrava o hex saiu: era texto morto ao lado de um seletor que só o
              conta-gotas alcançava. Agora o mesmo hex é editável, que é o que faz a cor do manual da
              marca conseguir entrar na tela (R3-A27). */}
          <CampoDeCorDaCategoria
            categoria={categoria}
            cor={escolha.cor ?? '#FFFFFF'}
            aoTrocar={(cor) => aoMudar({ cor })}
          />

          <ControlesDeParametro
            categoria={categoria}
            parametros={peca.parametros}
            valores={escolha.parametros}
            aoMudar={(nome, valor) => aoMudar({ parametros: { [nome]: valor } })}
          />
        </div>
      ) : null}
    </div>
  );
}
