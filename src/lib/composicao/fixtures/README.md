# composicao/fixtures, o acervo escrito à mão

Um arquivo: [`acervoDeTeste.ts`](acervoDeTeste.ts), o catálogo que os testes de
[`validarComposicao`](../validarComposicao.ts) usam.

Ele existe porque a validação da composição **compara identificadores e nunca carrega geometria**.
Testá-la não exige as ~15 peças reais que o ADR-008 aponta como o gargalo do produto, e amarrar o
teste a um modelo faria a suíte depender de asset binário para provar regra de texto. Nenhuma peça
daqui aponta para arquivo nenhum, e não existe campo de caminho, de propósito.

O acervo tem **duas** formas, tênis e chinelo, e não uma. Com uma só seria impossível provar a
recusa `FORMAS_MISTURADAS`, que é a regra do ADR-008 D4: peças de formas diferentes não montam o
mesmo calçado.

Não confundir com [`../../acervo/`](../../acervo/), que é o acervo de prova de verdade e é código
de produção: é dele que as telas públicas montam o calçado sem banco nenhum.
