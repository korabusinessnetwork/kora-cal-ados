// Casca de estado do preview de cor. Toda a regra vive em `coresDoPreview.ts`, que é puro e
// testado; aqui só entra o que depende do React (useState/useMemo/useCallback).
//
// Motivo de a regra ficar fora: sem testing-library no projeto (restrição de custo,
// `memory/restrictions.md`), lógica escrita dentro de um hook seria lógica não testada.

import { useCallback, useMemo, useState } from 'react';
import { coresValidas, definirCor, errosDeCor } from '../coresDoPreview';
import type { CoresEmEdicao } from '../coresDoPreview';
import type { CoresPorZona } from '../../../lib/render/gerarVarianteDeCor';

/** Identidade estável para o estado zerado — devolver `{}` novo a cada render refaria os
 *  `useMemo` e mandaria o SVG inteiro de volta ao motor sem nada ter mudado. */
const SEM_CORES: CoresEmEdicao = {};

export interface PreviewDeCor {
  /** O texto cru de cada campo, como está sendo digitado. */
  emEdicao: CoresEmEdicao;
  /** Só as válidas — é o que o palco manda para `gerarVarianteDeCor`. */
  cores: CoresPorZona;
  erros: Record<string, string>;
  definir(zoneKey: string, valor: string): void;
  limpar(): void;
  /** true quando há pelo menos uma cor em edição (o painel usa para oferecer "limpar"). */
  temPreview: boolean;
}

/**
 * `productId` existe para o preview ser descartado ao trocar de modelo: cor de um calçado
 * sobrando na tela de outro é o tipo de erro que ninguém percebe — a `zone_key` `sola`
 * existe nos dois modelos, então a cor antiga pinta em silêncio o produto novo.
 */
export function usePreviewDeCor(productId: string): PreviewDeCor {
  const [emEdicao, setEmEdicao] = useState<CoresEmEdicao>(SEM_CORES);
  const [produtoDoPreview, setProdutoDoPreview] = useState(productId);

  // Reset no próprio render, não em `useEffect`: com efeito, existiria um render
  // intermediário mostrando a cor do produto anterior sobre o SVG do produto novo. O React
  // descarta a saída deste render e refaz com o estado já zerado.
  const trocouDeProduto = produtoDoPreview !== productId;
  if (trocouDeProduto) {
    setProdutoDoPreview(productId);
    setEmEdicao(SEM_CORES);
  }

  const emEdicaoAtual = trocouDeProduto ? SEM_CORES : emEdicao;

  // `cores` e `erros` são derivados, nunca um segundo `useState`: duas fontes da mesma
  // verdade divergem no primeiro caminho que esquece de atualizar as duas.
  const cores = useMemo(() => coresValidas(emEdicaoAtual), [emEdicaoAtual]);
  const erros = useMemo(() => errosDeCor(emEdicaoAtual), [emEdicaoAtual]);

  const definir = useCallback((zoneKey: string, valor: string) => {
    setEmEdicao((atuais) => definirCor(atuais, zoneKey, valor));
  }, []);

  const limpar = useCallback(() => setEmEdicao(SEM_CORES), []);

  return {
    emEdicao: emEdicaoAtual,
    cores,
    erros,
    definir,
    limpar,
    temPreview: Object.keys(emEdicaoAtual).length > 0,
  };
}
