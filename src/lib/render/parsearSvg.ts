// Adaptador de DOM do motor de render. Existe porque o motor roda nos DOIS ambientes:
// no navegador (editor) e em Node (função serverless, testes).
//
// Por que não importar jsdom direto, como era antes: jsdom é biblioteca de Node e não
// existe no navegador — o `import { JSDOM }` que morava em normalizarSvg.ts e
// gerarVarianteDeCor.ts tornava o motor impossível de carregar no editor. Como o
// princípio nº1 do CLAUDE.md exige UMA implementação do recolor nos dois lados, quem
// muda é o parser, nunca o motor.
//
// No navegador não há nada a registrar: DOMParser e XMLSerializer são nativos. Em Node,
// o consumidor chama `registrarAnalisadorDeSvg` uma vez (ver analisadorDeNode.ts).

import { ErroDeVariante } from './erros';

export interface AnalisadorDeSvg {
  parsear(texto: string): Document;
  serializar(documento: Document): string;
}

let registrado: AnalisadorDeSvg | null = null;

/** Registra o analisador de ambiente sem DOM nativo (Node). Idempotente. */
export function registrarAnalisadorDeSvg(analisador: AnalisadorDeSvg): void {
  registrado = analisador;
}

/**
 * Escolhe o analisador. O DOM nativo vence quando existe — é ele que renderiza a cor que
 * o usuário vê no editor, então é ele que precisa ter a última palavra sobre o parse.
 */
function analisadorAtivo(): AnalisadorDeSvg {
  const DomParserNativo = globalThis.DOMParser;
  const SerializadorNativo = globalThis.XMLSerializer;

  if (DomParserNativo && SerializadorNativo) {
    return {
      parsear: (texto) => new DomParserNativo().parseFromString(texto, 'image/svg+xml'),
      serializar: (documento) => new SerializadorNativo().serializeToString(documento),
    };
  }

  if (registrado) return registrado;

  throw new ErroDeVariante(
    'SVG_INVALIDO',
    'Nenhum analisador de SVG disponível: ambiente sem DOMParser nativo precisa chamar registrarAnalisadorDeSvg (ver src/lib/render/analisadorDeNode.ts).',
  );
}

export function parsearSvg(texto: string): Document {
  return analisadorAtivo().parsear(texto);
}

export function serializarSvg(documento: Document): string {
  return analisadorAtivo().serializar(documento);
}
