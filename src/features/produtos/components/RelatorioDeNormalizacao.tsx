// Mostra o que o normalizador mexeu no arquivo antes de o produto existir.
//
// Por que aparece sempre, e não só quando "dá problema": o time precisa reconhecer o
// próprio modelo no que subiu. Descobrir depois que um id foi renomeado — e que por isso
// o seletor de zona aponta para outro lugar — é o erro caro que este painel previne.

import type { RelatorioDeNormalizacao as Relatorio } from '../../../lib/render/normalizarSvg';

const NADA_MUDOU = 'O arquivo já estava no formato canônico — nada foi alterado.';

export function RelatorioDeNormalizacao({ relatorio }: { relatorio: Relatorio }) {
  const linhas: string[] = [];

  if (relatorio.declaracoesAchatadas > 0) {
    linhas.push(
      `${relatorio.declaracoesAchatadas} declaração(ões) de CSS viraram atributo de apresentação.`,
    );
  }

  if (relatorio.scriptsRemovidos > 0) {
    linhas.push(`${relatorio.scriptsRemovidos} bloco(s) de script/foreignObject removido(s).`);
  }

  if (relatorio.handlersRemovidos > 0) {
    linhas.push(`${relatorio.handlersRemovidos} handler(s) inline removido(s).`);
  }

  if (relatorio.referenciasExternasRemovidas > 0) {
    linhas.push(
      `${relatorio.referenciasExternasRemovidas} referência(s) externa(s) removida(s).`,
    );
  }

  return (
    <section className="relatorio" aria-label="O que mudou no arquivo">
      {linhas.length === 0 && relatorio.idsRenomeados.length === 0 ? (
        <p className="relatorio__linha">{NADA_MUDOU}</p>
      ) : (
        <ul className="relatorio__lista">
          {linhas.map((linha) => (
            <li key={linha}>{linha}</li>
          ))}
          {relatorio.idsRenomeados.map(({ de, para }) => (
            <li key={`${de}-${para}`}>
              <strong>id duplicado</strong>: <code>{de}</code> virou <code>{para}</code> — confira
              se a zona certa vai ser marcada.
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
