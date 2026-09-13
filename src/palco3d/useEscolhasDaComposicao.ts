// O estado da composição na tela do calçado montado: as escolhas, o texto delas, e todo caminho
// que as troca.
//
// Saiu de `TelaDaComposicao.tsx` no R8-A59, quando o recomeço com desfazer faria a tela voltar a
// passar de 200 linhas logo depois de o R7-A54 tê-la trazido para baixo disso. Mora junto porque é
// UM estado com cinco portas de entrada (restaurar do F5, mudar uma categoria, colar, voltar ao
// padrão, desfazer), e cada porta tem uma regra sobre as outras: mudar qualquer coisa apaga o
// desfazer, e toda troca de montagem avisa a tela para largar a peça clicada.
//
// Não decide O QUE uma mudança faz. A transição é `mudarEscolhaDaTela` e a leitura do F5 é
// `lerComposicaoGuardada`, as duas puras e com teste. Este hook só decide QUANDO.

import { useEffect, useMemo, useState } from 'react';

import type { CatalogoDoAcervo, ComposicaoValidada, Forma } from '../lib/composicao/tiposDaComposicao';
import {
  composicaoDasEscolhas,
  escolhasDaComposicao,
  mudarEscolhaDaTela,
  type EscolhaDaTela,
} from './composicaoDaTela';
import { armazenamentoDoNavegador, guardarComposicao, lerComposicaoGuardada } from './composicaoGuardada';

type Escolhas = Map<string, EscolhaDaTela>;

export function useEscolhasDaComposicao(
  forma: Forma | undefined,
  catalogo: CatalogoDoAcervo,
  padrao: ComposicaoValidada,
  aoTrocarMontagem: () => void,
) {
  // A montagem guardada vem primeiro, e o calçado de prova é o que sobra quando não há o que
  // restaurar. Ler dentro do inicializador, e não num efeito, é o que evita a tela desenhar o
  // calçado de prova por um quadro e trocar em seguida: o palco recarregaria o glTF duas vezes.
  const [escolhas, setEscolhas] = useState(
    () =>
      (forma ? lerComposicaoGuardada(armazenamentoDoNavegador(), forma, catalogo) : null) ??
      escolhasDaComposicao(padrao),
  );
  // A montagem de antes do "Voltar ao calçado de prova", guardada só até a próxima mudança. Depois
  // de mexer em qualquer coisa, desfazer apagaria o que acabou de ser feito, então ela some.
  const [antesDoRecomeco, setAntesDoRecomeco] = useState<Escolhas | null>(null);
  // O calçado em cena é o que o prompt compôs (T09c). Qualquer outra porta de troca desliga, porque
  // depois de mexer à mão o aviso de "composto automaticamente" passaria a falar de outro calçado.
  // Não sobrevive ao F5 de propósito: a gravação guarda a composição, e não quem a escreveu.
  const [geradaPorPrompt, setGeradaPorPrompt] = useState(false);

  // O mesmo objeto que a API recebe, e que o modelo de linguagem vai escrever. Fica ao lado das
  // escolhas, e não dentro do botão de copiar, porque ele também é o texto que aparece quando copiar
  // falha, o texto que é guardado para o F5, e o que diz se a montagem já é o padrão.
  const texto = useMemo(
    () => (forma ? JSON.stringify(composicaoDasEscolhas(forma, escolhas), null, 2) : ''),
    [forma, escolhas],
  );
  const textoDoPadrao = useMemo(
    () => (forma ? JSON.stringify(composicaoDasEscolhas(forma, escolhasDaComposicao(padrao)), null, 2) : ''),
    [forma, padrao],
  );

  // Grava o mesmo texto do botão de copiar, e só quando ele muda. Amarrado ao texto, e não a cada
  // `setEscolhas`: um caminho novo que mude a composição não tem como esquecer de gravar.
  useEffect(() => {
    if (texto !== '') guardarComposicao(armazenamentoDoNavegador(), texto);
  }, [texto]);

  function trocar(
    novas: Escolhas | ((atual: Escolhas) => Escolhas),
    guardarDesfazer: Escolhas | null,
    doPrompt = false,
  ) {
    setAntesDoRecomeco(guardarDesfazer);
    setGeradaPorPrompt(doPrompt);
    setEscolhas(novas);
    // A peça clicada é do calçado que saiu de cena. Mantê-la faria a tela seguir apontando para um
    // nó que talvez nem exista mais na montagem nova.
    aoTrocarMontagem();
  }

  return {
    escolhas,
    texto,
    ehPadrao: texto === textoDoPadrao,
    podeDesfazer: antesDoRecomeco !== null,
    geradaPorPrompt,
    mudar: (categoria: string, mudanca: Partial<EscolhaDaTela>) =>
      // A transição em si mora em `composicaoDaTela`, com teste. Ela já esteve dentro da tela, e
      // foi lá que o BUG-019 nasceu.
      trocar((atual) => mudarEscolhaDaTela(atual, categoria, mudanca), null),
    aceitarOColado: (novas: Escolhas) => trocar(novas, null),
    aceitarOGerado: (novas: Escolhas) => trocar(novas, null, true),
    voltarAoPadrao: () => trocar(escolhasDaComposicao(padrao), escolhas),
    desfazerORecomeco: () => {
      if (antesDoRecomeco !== null) trocar(antesDoRecomeco, null);
    },
  };
}
