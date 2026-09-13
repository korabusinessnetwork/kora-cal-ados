# src/palco3d, o calçado na tela

Duas telas sobre o mesmo palco:

- `?tela=palco3d`, **uma peça por vez** do acervo de prova, girando com o mouse, e um clique que
  devolve o nome da malha atingida. É o ADR-007 D1, D2 e D4 virando algo que se abre no navegador.
- `?tela=composicao`, o **calçado montado**: as peças de uma composição validada numa cena só,
  cada uma no seu lugar e na sua cor. É onde o ADR-008 aparece pela primeira vez, e é a tela em que
  a pergunta do princípio nº1 (a cor escolhida é a cor que aparece?) é respondida a olho.

O componente da cena é o mesmo nas duas, e não precisou mudar para a segunda existir: um calçado
montado é só um modelo com N zonas, que é o que ele já recebia.

Não fala com o banco e não pede conta. A peça vem de [`../lib/acervo/`](../lib/acervo/), que é
código e não arquivo baixado, então esta tela abre num clone recém-clonado sem `.env.local`.

## A fronteira que organiza a pasta: o que precisa de GPU e o que não precisa

jsdom não tem WebGL. Qualquer regra que more no componente do canvas é regra que **nenhum teste
alcança**, e nesta tarefa isso importa mais que de costume, porque o princípio nº1 já obriga uma
conferência a olho aqui. Então a divisão não é estética:

| Arquivo | Precisa de GPU? | O que faz |
|---|---|---|
| `orbita.ts` | não, e não importa `three` | Aritmética esférica pura: o arraste do ponteiro vira posição de câmera |
| `carregarPecaNaCena.ts` | não | Texto glTF vira `Object3D`, mais o enquadramento tirado da caixa envolvente |
| `nomeDaMalhaNoPonto.ts` | não | O ponteiro vira nome de nó, ou `null`. É o ADR-007 D4 como função |
| `PalcoDeModelo3d.tsx` | **sim** | O `<canvas>`, o laço de render, as escutas do ponteiro e a queda do contexto WebGL. Do caminho que FUNCIONA nada é alcançável por teste, e ele está preso por varredura de fonte; o caminho em que o contexto nem nasce tem teste de comportamento em `palcoSemWebgl.test.tsx`, porque jsdom sem WebGL é exatamente a máquina sem GPU |
| `CampoDeCorDaCategoria.tsx` | não | A cor de uma categoria, pelo seletor do sistema ou digitada em hex |
| `ControlesDeParametro.tsx` | não | Um controle deslizante por parâmetro que a peça declara, com a faixa escrita. Separado da tela para um teste montar peça de dois parâmetros, que o acervo de prova não tem |
| `composicaoDaTela.ts` | não | O estado da tela da composição vira calçado montado, ou vira mensagem legível |
| `useEscolhasDaComposicao.ts` | não | O estado das escolhas da tela: restaurar do F5, mudar, colar, voltar ao padrão e desfazer, e o aviso de troca de montagem que larga a peça clicada |
| `composicaoGuardada.ts` | não | A composição da tela no `localStorage`, para sobreviver ao F5. Lida de volta pelo mesmo guarda da colagem, e a gravação recusada é apagada |
| `ParametrosDaPeca.tsx` | não | Um controle por parâmetro na tela de uma peça, e os valores em vigor de todos eles para o glTF. Separado da tela pelo mesmo motivo de `ControlesDeParametro.tsx` |
| `TelaDoPalco3d.tsx` | não | A tela de uma peça: escolher peça, mexer no parâmetro, ver o nome do que foi clicado |
| `TelaDaComposicao.tsx` | não | A tela do calçado montado: peça, cor e parâmetro por categoria da forma |
| `ControleDaCategoria.tsx` | não | O bloco de uma categoria da tela do calçado montado: botões de peça, cor e parâmetros |
| `PainelDeRecomeco.tsx` | não | Voltar ao calçado de prova, com Desfazer em vez de confirmação, e o foco levado nos dois sentidos |
| `PainelDeSaida.tsx` | não | Copiar o JSON da composição, e o texto à vista quando o navegador nega a cópia |
| `PainelDeColar.tsx` | não | Colar um JSON e montá-lo pelo mesmo guarda da API, com a região viva do desfecho. Colagem recusada não sobe nada para a tela |
| `PainelDaPecaClicada.tsx` | não | O nó clicado, a zona dele e o atalho para a cor, mais a lista de zonas em cena |
| `palco3d.css` | | Estilo fora do JSX (regra de white-label do CLAUDE.md) |

O tipo `EstadoDoPalco` e a função `ehFalha` moram em `PalcoDeModelo3d.tsx`, junto de quem os produz.
As frases que cada tela mostra têm nome próprio (`textoDoEstadoDaPeca` e
`textoDoEstadoDaComposicao`) e são exportadas para ter teste em `estadoDoPalco.test.ts`: o que a
pessoa lê para saber se pode confiar na tela merece teste tanto quanto a regra que escolhe a frase.
Os cinco estados são tratados por nome, sem `return` de fim servindo de coringa, porque foi o
coringa que fez a tela afirmar "Peça na cena" com o contexto WebGL morto (A28).

Os dois estados de contexto são separados de propósito. `contexto-perdido` é o contexto que
EXISTIA e caiu, e costuma voltar sozinho, então a frase manda esperar. `contexto-negado` é o
contexto que nunca nasceu, numa máquina sem GPU utilizável, e não vai nascer recarregando, então a
frase manda ir para o esboço, que desenha o mesmo tênis em SVG. Trocar as duas frases custa caro
nos dois sentidos: uma deixa a pessoa esperando o que não vem, a outra faz ela recarregar por uma
coisa que recarregar não resolve. A composição em si sobrevive ao recarregar desde o R7-A57, porque
fica guardada no navegador, mas o contexto negado continua negado.

`PalcoDeModelo3d.tsx` não decide nada, de propósito. Se aparecer aritmética de câmera ou lógica de
seleção lá dentro, ela escapou para o lugar onde nenhum teste olha. O critério 20 da spec existe
para prender essa linha.

## O `Raycaster` roda sem placa de vídeo

A descoberta que mudou o desenho desta entrega. O `Raycaster` do three trabalha sobre a
geometria **em memória**, não sobre o que foi desenhado, então "clicar numa peça a identifica
pelo nome" saiu da lista de conferências a olho e virou teste, para as 5 peças, de 7 ângulos
diferentes. Foi uma sonda descartável que provou isso, antes de a spec ser escrita.

## `ProgressEvent` não existe no Node

O `FileLoader` do three dispara um ao terminar de ler o `data:` URI do buffer. Sem
`// @vitest-environment jsdom` no topo, os testes que carregam glTF penduram e o vitest reporta
"unhandled rejection" sem dizer por quê. Descoberto pela mesma sonda, não no meio do build.

## O sinal do arraste, que é onde a intuição engana

Os dois eixos seguem "agarrar a peça", não "mover a câmera". Arrastar para a direita gira a peça
para a direita, ou seja, a câmera anda para a esquerda. **E arrastar para baixo LEVANTA a
câmera**, pela mesma lógica: puxar a peça para baixo inclina o topo dela na direção de quem
olha. É a convenção do `OrbitControls` do three. O que importa é que os dois eixos concordem;
inverter só um é o que faz um controle de órbita parecer quebrado.

Um teste desta pasta já nasceu afirmando o contrário, e era o teste que estava errado. Fica
registrado ali para ninguém "consertar" o sinal de volta.

## A elevação é travada perto dos polos

Exatamente no polo o vetor "para cima" da câmera fica indefinido e a imagem gira sozinha.
Passar do polo é pior: a cena aparece de cabeça para baixo e o arraste inverte de sentido. É o
defeito clássico de órbita escrita à mão, e a trava custa uma linha.

## O parâmetro é escala, e a peça cresce para cima

Vem do ADR-008 D7 e de [`../lib/acervo/`](../lib/acervo/): mexer no controle deslizante não
remodela malha nenhuma, muda o `scale` do nó. Como a peça é modelada com a base na origem, ela
cresce a partir de onde assenta, em vez de afundar no chão.

Este é o item que **nenhum teste enxerga de verdade**: os testes conferem a caixa envolvente, e
caixa envolvente não distingue uma peça que cresceu para cima de uma que cresceu para os dois
lados. É o item 5 da conferência a olho da spec.

## O que esta pasta NÃO faz

- **Não monta o calçado.** Quem monta é [`../lib/composicao/montarComposicao.ts`](../lib/composicao/);
  aqui a montagem só é chamada e desenhada. Palco que soubesse montar seria a montagem existindo
  em dois lugares, e o da API seria o outro.
- **Não colore nada por conta própria.** Quem escreve cor no glTF é `recolorirModelo3d`, e só ele.
- **Não tem zoom nem pan.** A câmera enquadra sozinha pela caixa envolvente e o mouse só orbita.
- **Não guarda zona no banco.** No modo gerado, a zona vem da composição (ADR-008 D3).
- **Não prova que o three.js empacota na Vercel.** Deploy está fora de escopo por decisão do dono.

Spec completa, com os 23 critérios e a lista do que só o dono pode conferir em navegador de
verdade: [`../../specs/palco-3d.md`](../../specs/palco-3d.md).
