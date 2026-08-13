// Analisador de SVG para ambiente Node (testes hoje; função serverless na rodada 3).
//
// Fica em arquivo separado de propósito: é o ÚNICO lugar do projeto que importa jsdom.
// Assim o bundle do navegador nunca alcança essa dependência — quem importa este arquivo
// é código de Node, e o editor importa só `parsearSvg`, que usa o DOM nativo.

import { JSDOM } from 'jsdom';
import { ErroDeVariante } from './erros';
import { registrarAnalisadorDeSvg } from './parsearSvg';

export function registrarAnalisadorDeNode(): void {
  registrarAnalisadorDeSvg({
    parsear: (texto) => new JSDOM(texto, { contentType: 'image/svg+xml' }).window.document,
    serializar: (documento) => {
      // O XMLSerializer vem da janela do próprio documento: usar o do jsdom garante a
      // mesma saída que o navegador produz com o serializador nativo.
      const janela = documento.defaultView;

      if (!janela) {
        throw new ErroDeVariante('SVG_INVALIDO', 'Documento SVG sem janela associada.');
      }

      return new janela.XMLSerializer().serializeToString(documento);
    },
  });
}
