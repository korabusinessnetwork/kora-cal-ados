# src/palco3d, o calçado na tela

A tela `?tela=palco3d`: uma peça do acervo de prova numa cena three.js, girando com o mouse, e
um clique que devolve o nome da malha atingida. É o ADR-007 D1 (o modelo aparece), D2 (gira com
o mouse) e D4 (cada malha é endereçável pelo nome) virando algo que se abre no navegador.

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
| `PalcoDaPeca.tsx` | **sim** | O `<canvas>`, o laço de render e as escutas do ponteiro. **O único sem teste** |
| `TelaDoPalco3d.tsx` | não | A tela: escolher peça, mexer no parâmetro, ver o nome do que foi clicado |
| `palco3d.css` | | Estilo fora do JSX (regra de white-label do CLAUDE.md) |

`PalcoDaPeca.tsx` não decide nada, de propósito. Se aparecer aritmética de câmera ou lógica de
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

- **Não monta as 5 peças numa cena só.** Aqui aparece uma peça por vez; a montagem é T14.
- **Não colore nada.** A peça aparece na cor que o material dá (branco padrão do glTF).
  Recolorir em 3D também é T14.
- **Não tem zoom nem pan.** A câmera enquadra sozinha pela caixa envolvente e o mouse só orbita.
- **Não guarda zona no banco.** No modo gerado, a zona vem da composição (ADR-008 D3).
- **Não prova que o three.js empacota na Vercel.** Deploy está fora de escopo por decisão do dono.

Spec completa, com os 23 critérios e a lista do que só o dono pode conferir em navegador de
verdade: [`../../specs/palco-3d.md`](../../specs/palco-3d.md).
