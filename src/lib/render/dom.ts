// Adaptador de DOM do motor de render.
//
// Por que existe: o princípio nº1 do CLAUDE.md exige o MESMO motor no editor e na API,
// "nunca duas implementações que podem divergir". Só que `jsdom` não roda no navegador e
// `DOMParser` não existe no Node. Sem este adaptador, a única saída seria reescrever o
// motor para o front, que é exatamente o que o princípio proíbe.
//
// Navegador: usa o DOMParser/XMLSerializer nativos, sem dependência nenhuma, o `jsdom`
// não entra no bundle porque nada no front importa `./domNode`.
// Node (testes, função serverless): quem roda lá importa `./domNode` uma vez.

export interface AdaptadorDeDom {
  analisar(svgTexto: string): Document;
  serializar(documento: Document): string;
}

let registrado: AdaptadorDeDom | null = null;

/** Node registra o jsdom por aqui (ver `domNode.ts`). No navegador, ninguém chama. */
export function definirAdaptadorDeDom(adaptador: AdaptadorDeDom): void {
  registrado = adaptador;
}

export function analisarSvg(svgTexto: string): Document {
  return adaptador().analisar(svgTexto);
}

export function serializarSvg(documento: Document): string {
  return adaptador().serializar(documento);
}

function adaptador(): AdaptadorDeDom {
  if (registrado) return registrado;

  if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
    const leitor = new DOMParser();
    const escritor = new XMLSerializer();

    registrado = {
      analisar: (svgTexto) => leitor.parseFromString(svgTexto, 'image/svg+xml'),
      serializar: (documento) => escritor.serializeToString(documento),
    };

    return registrado;
  }

  // Falha alto: motor rodando sem DOM devolveria SVG intacto, e "variante que não mudou
  // de cor mas voltou 200" é o BUG-001 de novo, por outro caminho.
  throw new Error(
    'Motor de render sem DOM disponível. Em Node, importe "./domNode" antes de chamar o motor.',
  );
}
