// Corpo cru do POST → o `Record<zone_key, cor>` que `gerarVarianteDeCor` recebe.
//
// POR QUE ESTE MÓDULO PODE ASSUMIR QUE **TUDO** NO TOPO DO CORPO É ZONA:
// `docs/07_APIS/endpoints.md` decide que todo campo que não é cor vai para a query string
// (`?format=`), nunca para o topo do corpo. O motivo não é estética: o topo do corpo é um
// espaço de nomes que o TENANT controla — é ele quem cria as `zone_key` no editor. Um campo
// `format` no corpo colidiria no dia em que alguém criasse uma zona chamada `format`, e a
// colisão apareceria como cor não aplicada, não como erro. Por isso aqui não existe lista de
// campos reservados a pular: chave que não é zona válida é recusada, não ignorada.
//
// POR QUE NÃO HÁ VALIDAÇÃO DE COR AQUI: `validarCor` e `validarZoneKey` são do motor
// (`src/lib/render/`), o mesmo que o editor usa. Uma segunda validação neste arquivo é
// exatamente o que o princípio nº1 do CLAUDE.md proíbe — a API passaria a aceitar uma cor que
// o editor recusa (ou o contrário) no primeiro dia em que uma das duas cópias mudasse.
// Consequência de projeto: `COR_INVALIDA` e `ZONE_KEY_INVALIDA` saem daqui como
// `ErroDeVariante`, sem status HTTP. Quem os traduz para status é `traduzirParaFalhaDaApi`,
// dono único da tabela. Este módulo só lança `FalhaDaApi` para o que é falha de TRANSPORTE
// (a forma do corpo), que o motor não tem vocabulário para descrever.

import { validarCor } from '../../src/lib/render/validarCor';
import { validarZoneKey } from '../../src/lib/render/validarZoneKey';
import { criarFalhaDeTransporte } from './traduzirParaFalhaDaApi';

/**
 * Teto de zonas por pedido — a mitigação de custo zero contra cliente com laço mal escrito.
 *
 * De onde saiu o número: o produto de demonstração (`src/esboco/produtoDemo.ts`), o modelo
 * mais detalhado que o projeto tem, mapeia **9 zonas** (sola, entressola, cabedal, biqueira,
 * logo, cadarço, língua, colarinho, detalhe). 90 é uma ordem de grandeza acima disso — cobre
 * um calçado com dez vezes o detalhe do demo sem nunca exigir mudança de código, e ainda
 * assim recusa o pedido gerado por engano, que não chega perto de 90: chega a milhares.
 *
 * O teto é sobre o NÚMERO DE ZONAS, e não sobre bytes, porque as outras duas dimensões do
 * corpo já são limitadas pelo motor: `validarZoneKey` recusa chave acima de 40 caracteres e
 * `validarCor` recusa qualquer valor que não seja hex de 4 ou 7 caracteres. A quantidade de
 * pares é a única dimensão que ninguém mais limita.
 */
const TETO_DE_ZONAS_POR_PEDIDO = 90;

/**
 * Lê o corpo já parseado e devolve as cores prontas para o motor, normalizadas por ele
 * (`#f00` sai `#FF0000`).
 *
 * Lança `FalhaDaApi` `CORPO_INVALIDO` 400 quando a **forma** do corpo está errada, e propaga
 * o `ErroDeVariante` do motor quando o conteúdo está errado. O par código/status usado aqui é
 * o da tabela de `docs/07_APIS/endpoints.md` — este arquivo não decide status de erro do
 * motor, só o do seu próprio código de transporte.
 */
// POR QUE O STATUS NÃO É ESCRITO AQUI: `criarFalhaDeTransporte` vem de
// `traduzirParaFalhaDaApi.ts`, que é o dono único da tabela código → status. Escrever
// `new FalhaDaApi('CORPO_INVALIDO', 400, ...)` neste arquivo funcionaria hoje e seria uma
// segunda cópia da tabela — o dia em que `CORPO_INVALIDO` deixasse de ser 400 num lugar e
// continuasse 400 no outro, `docs/07_APIS/endpoints.md` deixaria de ser verdade sem ninguém
// perceber. A mensagem, sim, é daqui: ela nomeia o que ESTE módulo recusou.
export function lerCoresPedidas(corpo: unknown): Record<string, string> {
  // `typeof [] === 'object'` e `typeof null === 'object'`: sem estas duas exclusões um array
  // passaria por objeto e sairia daqui como mapa vazio — corpo recusado virando pedido válido.
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
    throw criarFalhaDeTransporte(
      'CORPO_INVALIDO',
      'O corpo precisa ser um objeto JSON de zona para cor, como {"sola": "#C0392B"}.',
    );
  }

  const pares = Object.entries(corpo);

  // Corpo `{}` é RECUSADO, e a decisão é a de `docs/07_APIS/endpoints.md` ("corpo vazio →
  // CORPO_INVALIDO 400"). O porquê: aceitar devolveria 200 com o asset-base intocado, ou
  // seja, uma "variante" idêntica ao modelo original. Isso é indistinguível do caso real —
  // campo de cores não preenchido no ERP do cliente — e o cliente gravaria o arquivo achando
  // que pediu a variante certa. Erro silencioso que vira calçado errado é o que o princípio
  // nº1 proíbe; e quem quer o modelo original não precisa de um endpoint de variante.
  if (pares.length === 0) {
    throw criarFalhaDeTransporte(
      'CORPO_INVALIDO',
      'Envie ao menos uma zona com cor, como {"sola": "#C0392B"}.',
    );
  }

  // Antes de validar par por par: recusar cedo é o ponto do teto. Validar 100 mil zonas para
  // só então dizer que passou do limite gastaria justamente o que o limite existe para poupar.
  if (pares.length > TETO_DE_ZONAS_POR_PEDIDO) {
    throw criarFalhaDeTransporte(
      'CORPO_INVALIDO',
      `O pedido traz ${pares.length} zonas e o limite é ${TETO_DE_ZONAS_POR_PEDIDO}.`,
    );
  }

  const cores: Record<string, string> = {};

  for (const [chaveCrua, valor] of pares) {
    // `validarZoneKey` já recusa maiúscula, acento, espaço e `__proto__` (regex
    // `^[a-z][a-z0-9-]*$`). Logo `{"SOLA":…, "sola":…}` não vira duas entradas: o pedido
    // inteiro cai em ZONE_KEY_INVALIDA. Nada disso é reimplementado aqui.
    const zoneKey = validarZoneKey(chaveCrua);

    // O que `validarZoneKey` NÃO impede: ele apara espaço em volta, então `" sola"` e `"sola"`
    // são duas chaves distintas no JSON que viram a mesma `zone_key` — e a segunda
    // sobrescreveria a cor da primeira em silêncio. Cor perdida sem erro é o modo de falha do
    // princípio nº1, então o pedido é recusado por forma.
    if (Object.prototype.hasOwnProperty.call(cores, zoneKey)) {
      throw criarFalhaDeTransporte(
        'CORPO_INVALIDO',
        `A zona "${zoneKey}" aparece duas vezes no corpo, com cores que se anulariam.`,
      );
    }

    cores[zoneKey] = validarCor(valor, zoneKey);
  }

  return cores;
}
