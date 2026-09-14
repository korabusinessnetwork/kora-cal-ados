# Spec: acervo de prova com cara de tênis (Fase G)

> Regra de escrita: sem travessão. Vírgula, dois pontos ou parênteses no lugar.

**Data**: 2026-09-14
**Origem**: pedido do dono, "continuar a criação do 3D", executado por uma frente paralela do
modo Full Automático (branch `full-auto/acervo-3d`).
**Depende de**: `specs/acervo-de-prova.md` (T12), `specs/composicao-em-cena.md` (T14).

## O problema

A esteira do produto gerado está provada de ponta a ponta com 5 peças em caixa. O calçado na tela
parece uma pilha de tijolos, e isso tem custo: o dono não consegue julgar se a composição, a cor
ou o parâmetro fizeram sentido, porque nada na tela lembra um tênis.

O próximo passo é o calçado **parecer um tênis**, ainda gerado por código, ainda glTF 2.0 válido
pelo validador da Khronos, sem Blender, sem dependência nova e sem mudar nada que a outra frente
consome.

## O que NÃO muda (contrato com o resto do projeto)

- Os 5 ids, os rótulos, as categorias, a ordem das peças por categoria, os nomes e as faixas de
  parâmetro.
- A assinatura de `catalogoDeProva`, `gltfDaPecaDeProva` e `composicaoDeProva`.
- Uma peça continua sendo **um nó, uma malha, uma primitiva e um material**, sem cor.
- O parâmetro continua sendo **escala no eixo Y do nó** (ADR-008 D7), e a geometria gravada
  continua idêntica byte a byte entre dois valores de parâmetro.
- Nenhum nó ganha `rotation` ou `matrix` (`medidaDoModelo3d` recusa os dois).

## Decisões

### D1. O contorno do pé é uma função, e a sola e o cabedal saem dela

`contornoDoPe.ts` descreve a pegada vista de cima: meia largura do lado de dentro e do lado de fora
do pé para cada ponto do comprimento, com calcanhar e bico arredondados e o arco do lado de dentro.
Sola e cabedal chamam a mesma função com medidas diferentes. Duas pegadas escritas à mão
divergiriam, e o cabedal passaria da borda da sola sem ninguém ver.

### D2. A geometria é montada por **estações** ao longo do comprimento

Cada peça é uma sequência de cortes transversais em X, do calcanhar ao bico. É a forma que um
modelador de calçado pensa (o corte da forma), e é o que deixa a malha com topologia de grade, em
que o sentido de todo triângulo sai de uma regra só, e não de 2 mil casos.

As estações são mais densas nas pontas (espaçamento em cosseno), porque é onde a curva do bico e do
calcanhar muda depressa.

### D3. As normais são calculadas da própria malha

Normal por vértice é a média das normais dos triângulos que usam aquele vértice, ponderada pela
área. Onde a peça tem quina de verdade (a borda da tampa da sola, o cravo), os vértices são
separados, para a luz não arredondar o que é quina. Normal digitada à mão erra em silêncio: a luz
do palco fica do lado errado e ninguém sabe dizer por quê.

### D4. O cabedal é aberto na boca, e por isso o material dele é de dupla face

A boca do pé (o colarinho) é um buraco de verdade. Olhando por ela se vê o lado de dentro da parede,
que o renderizador descartaria sem `doubleSided: true`, e o calçado pareceria oco e transparente.
Acabamento continua sendo propriedade física do material, e continua sem cor.

### D5. O cadarço **acompanha a superfície** do cabedal: nasce o conceito de **apoio**

Uma caixa assenta no topo da caixa de baixo, e a regra de T14 (`assenta_sobre`) resolve isso.
Um cadarço não assenta no topo do cabedal: ele deita sobre o peito do pé, bem abaixo do ponto mais
alto (que é a língua no cabedal baixo e o colarinho no cano alto). Com a regra antiga o cadarço
flutuaria na altura do colarinho.

`CategoriaDaForma` ganha `apoio?: 'topo' | 'superficie'`, com `'topo'` por padrão, o que deixa toda
forma existente montando exatamente como antes.

- **`topo`**: a base da peça vai para o topo da peça de baixo. É a sola e o cabedal.
- **`superficie`**: a peça foi modelada deitada sobre a peça de baixo no tamanho padrão dela, e
  acompanha a transformação vertical dela. Se a peça de baixo subiu, sobe junto; se ela foi esticada
  em Y (o parâmetro altura do cano), o ponto de apoio sobe na mesma proporção.

Para saber a proporção, `montarComposicao` mede cada peça duas vezes: com os parâmetros pedidos e
com os padrão. É uma geração a mais por peça, de alguns milissegundos, e é o que mantém a regra
derivada da geometria, e não de um campo que pode divergir dela (a lição do BUG-013).

Se a categoria declarada como base não estiver na composição e o empilhamento subir até outra, o
apoio volta a ser `topo`: a superfície em que a peça foi modelada não existe naquele calçado, e
assentar no topo do que existe é o que já acontecia antes.

### D6. Os dois cabedais têm o **mesmo peito do pé**

O cano alto é o cabedal baixo com o colarinho e a língua mais altos, e o trecho onde o cadarço deita
é idêntico nos dois. É o que acontece numa forma de verdade (a forma é a mesma, o cano é que muda), e
é o que faz um cadarço só servir nos dois cabedais sem se mexer.

## Limite conhecido, escrito para não ser redescoberto

Uma peça rígida inclinada não acompanha com exatidão uma escala em Y. O cadarço inclinado sobre o
peito do pé, quando o cano é esticado, fica certo no ponto de apoio e desencontra nas pontas, na
ordem de milímetros nos extremos da faixa. O mesmo vale para a espessura do cadarço, porque escala
em Y também estica a inclinação. Isto não tem conserto dentro de "parâmetro é escala do nó, sem
rotação": o conserto é parâmetro que remodela malha, que o ADR-008 D7 recusa, ou peças separadas
por espessura. Fica registrado como pendência, com o desencontro medido em teste.

## Critérios de aceite

1. Todas as peças passam no validador da Khronos sem erro e sem aviso, no padrão e nos extremos da
   faixa do parâmetro.
2. `normalizarModelo3d` sobre qualquer peça é no-op (relatório zerado, documento igual).
3. `min`/`max` do POSITION saem das posições gravadas, em float32.
4. Todo triângulo está virado para o mesmo lado das normais dos seus vértices.
5. Toda normal é unitária.
6. A sola tem pegada de pé: mais larga na planta que no calcanhar, arco do lado de dentro, bico e
   calcanhar arredondados (largura tende a zero nas pontas).
7. A sola tratorada tem cravos: há vértices abaixo da laje, e a altura total continua sendo a do
   parâmetro.
8. Sola e cabedal: altura modelada igual ao padrão do parâmetro (o teste de dimensão existente
   continua valendo para as quatro).
9. A pegada do cabedal cabe inteira dentro do topo da sola plana, em toda estação.
10. O cabedal não tem vão nem interpenetração com a sola: a base dele está no plano do topo da sola.
11. O cabedal tem boca: o ponto mais alto do cabedal baixo é a língua; não existe teto sobre o
    calcanhar.
12. Cabedal baixo e cano alto coincidem no trecho do peito do pé onde o cadarço deita.
13. O cadarço deita sobre o cabedal: todo ponto de apoio do cadarço fica a menos de 1 mm da
    superfície do cabedal baixo, e nenhum ponto do cadarço fica mais de 1 cm acima dela.
14. O cadarço tem passadores em sequência: pelo menos 4 fileiras, cruzando de um lado ao outro.
15. `apoio: 'superficie'` com tudo no padrão desloca zero; sola mais grossa desloca o cadarço o
    mesmo que o cabedal; cano esticado desloca proporcionalmente à altura de apoio.
16. `apoio` ausente é `topo`, e toda forma existente monta igual.
17. Os 25 testes de navegador continuam verdes, e o calçado é conferido a olho em imagem.
