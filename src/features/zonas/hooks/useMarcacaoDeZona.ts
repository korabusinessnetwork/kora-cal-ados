// Casca de estado da marcação em curso. Toda a regra vive em `marcacaoEmCurso.ts`, que é
// puro e testado; aqui só entra o que depende do React (useState/useCallback).
//
// Motivo de a regra ficar fora: sem testing-library no projeto (restrição de custo,
// `memory/restrictions.md`), lógica escrita dentro de um hook seria lógica não testada.

import { useCallback, useState } from 'react';
import { alternarId, desfazerUltimo } from '../marcacaoEmCurso';

/** Identidade estável para o estado zerado — devolver `[]` novo a cada render faria os
 *  filhos que dependem de `idsMarcados` remontarem sem nada ter mudado. */
const SEM_MARCACAO: string[] = [];

export interface MarcacaoDeZona {
  /** Ids clicados, na ordem de clique — é essa ordem que vai para `montarSeletorDeZona`. */
  idsMarcados: string[];
  alternar(id: string): void;
  desfazer(): void;
  limpar(): void;
}

/**
 * `productId` existe para a marcação em curso ser descartada ao trocar de produto: ids do
 * modelo anterior gravados no modelo novo apontariam para elementos inexistentes — zona
 * que não pinta nada, sem ninguém perceber na hora de marcar.
 */
export function useMarcacaoDeZona(productId: string): MarcacaoDeZona {
  const [idsMarcados, setIdsMarcados] = useState<string[]>(SEM_MARCACAO);
  const [produtoDaMarcacao, setProdutoDaMarcacao] = useState(productId);

  // Reset no próprio render, não em `useEffect`: com efeito, existiria um render
  // intermediário mostrando a marcação do produto anterior sobre o SVG do produto novo —
  // e um clique nesse intervalo gravaria id de outro modelo. O React descarta a saída
  // deste render e refaz com o estado já zerado.
  const trocouDeProduto = produtoDaMarcacao !== productId;
  if (trocouDeProduto) {
    setProdutoDaMarcacao(productId);
    setIdsMarcados(SEM_MARCACAO);
  }

  const alternar = useCallback((id: string) => {
    setIdsMarcados((atuais) => alternarId(atuais, id));
  }, []);

  const desfazer = useCallback(() => {
    setIdsMarcados((atuais) => desfazerUltimo(atuais));
  }, []);

  const limpar = useCallback(() => setIdsMarcados(SEM_MARCACAO), []);

  return {
    idsMarcados: trocouDeProduto ? SEM_MARCACAO : idsMarcados,
    alternar,
    desfazer,
    limpar,
  };
}
