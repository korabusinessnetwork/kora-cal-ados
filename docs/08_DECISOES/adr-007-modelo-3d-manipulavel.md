# ADR-007, Calçado 3D manipulável, e onde o princípio nº1 passa a ser verificado

**Status**: Aceito, **implementação bloqueada no insumo** (ver "A pergunta que trava tudo")
**Data**: 2026-09-09
**Decisores**: Matheus Bonato
**Supersede**: ADR-001 **parcialmente**, só o "MVP vetor-only". Todo o resto do ADR-001
(React+Vite, Supabase, Vercel Functions) continua vigente. ADR-004 e ADR-005 continuam
vigentes **e intocados** para produtos SVG, que não deixam de existir.
**Supersedido por**: (nenhum)

---

## Contexto

Em 2026-09-09 o dono pediu que o calçado do editor fosse manipulável: girar em qualquer
ângulo arrastando com o mouse, virar de ponta-cabeça, olhar a sola, mantendo o que já
funciona, que é clicar numa camada (sola, cadarço, cabedal) para marcar a zona.

A verificação da documentação naquele dia achou **ausência total**: nem backlog, nem ADR,
nem intake, nem item fora de escopo. O pedido virou entrada em
`docs/09_BACKLOG/features.md` com duas rotas possíveis, **(B)** N vistas 2D, em que
arrastar troca de quadro e o motor não muda em nada, e **(A)** 3D de verdade, com órbita de
câmera sobre um modelo tridimensional.

**O dono escolheu A.** Este ADR existe para registrar a escolha e, principalmente, para
resolver a objeção que a própria entrada de backlog levantou contra ela, porque aceitar A
sem resolvê-la seria aceitar quebrar o princípio nº1 em silêncio, que é a única coisa que
este projeto declara inegociável.

### A objeção, dita inteira

O princípio nº1 do `CLAUDE.md` é *"o time marcar uma zona e ver exatamente a cor que vai
sair pela API, sem manual, sem surpresa entre o editor e a geração"*. Hoje ele é verdadeiro
**por construção**: o editor desenha a saída de `gerarVarianteDeCor` e a API devolve a saída
de `gerarVarianteDeCor`. É o mesmo módulo, sobre o mesmo arquivo. O pixel do editor é o
pixel do cliente porque são literalmente o mesmo documento.

Em 3D isso deixa de valer sozinho. Uma cena tem luz, sombra, reflexo e material; um pixel na
tela é o resultado de uma equação de iluminação, não a leitura de um atributo. A sola
`#C0392B` **não aparece** `#C0392B` em pixel nenhum de um render sombreado, aparece mais
clara onde a luz bate e mais escura na sombra. É a mesma objeção que segura o `?format=png`
no backlog, e em 3D ela é mais forte, porque lá é uma conversão e aqui é uma cena inteira.

Se a resposta a isso fosse "aceita-se a diferença", o produto perderia o que o distingue.
Não é. A resposta está em D2 e D3.

---

## Decisão

### D1, O artefato 3D é **glTF**, e recolorir continua sendo edição de arquivo, não render

O asset-base 3D é um **glTF** (`.gltf` JSON, ou `.glb` binário; a normalização produz o
canônico em JSON). A escolha não é de gosto: **glTF é JSON**, e a cor base de um material
mora em `materials[i].pbrMetallicRoughness.baseColorFactor`.

A consequência é a coisa mais importante deste ADR: **recolorir um glTF é estruturalmente a
mesma operação que recolorir um SVG.** Achar o nó pelo nome, achar o material dele, escrever
a cor. Nenhum render acontece do lado do servidor, nada de GPU, nada de headless GL, nada
de binário nativo, nada de custo. A função serverless continua fazendo o que já faz hoje:
ler um arquivo, trocar um valor, devolver o arquivo.

Então o contrato da API não muda de forma: **200 devolve o artefato**, como já foi decidido
para a API de variante. Muda o `Content-Type` (`model/gltf+json`), não o desenho do
endpoint. E o motor ganha um irmão em `src/lib/render/`, um só, importado pelo editor e
pela API, exatamente como manda a linha "motor de render" do glossário.

**O que isso preserva:** o princípio nº1 no nível do **artefato** continua verdadeiro por
construção e continua verificável por igualdade exata. O hex que a pessoa marcou é o valor
que está no arquivo que o cliente recebe. É a mesma prova que a passada de 2026-09-08 fez
por `diff`, uma linha diferente, um atributo diferente, e ela continua possível.

### D2, **Modo cor chapa** é o modo que carrega a garantia; o sombreado é para julgar o produto

O palco 3D tem dois modos, e a diferença entre eles é regra de negócio, não opção de
exibição:

- **Modo cor chapa (unlit)**, sem luz, sem sombra, sem reflexo. O interior de cada zona é
  desenhado com a cor chapa exata. Neste modo, **o pixel do interior da zona é o hex**, e
  isso é verificável lendo o pixel de volta do canvas. É o modo em que "cor no editor = cor
  na API" continua sendo uma afirmação testável, e não uma esperança.
- **Modo sombreado**, a cena com luz, para julgar o **produto**: como a cor cai na lateral,
  se o contraste da entressola funciona, se a peça fica bonita. Serve para decidir; não
  serve para conferir cor, e a interface diz isso com todas as letras.

A regra escrita, que é o que impede um agente futuro de "melhorar" isto: **a aprovação de
cor acontece no modo cor chapa.** Sombreado é vista de produto. Trocar o padrão para
sombreado sem trocar esta regra transformaria o editor na fonte da divergência silenciosa
que o projeto existe para não ter.

### D3, A conversão sRGB → linear acontece em **exatamente um lugar**, com teste de ida e volta

Este é o detalhe de maior risco do ADR inteiro, e ele é invisível.

O hex que a pessoa digita é **sRGB**. O `baseColorFactor` do glTF é **linear**, em floats de
0 a 1. Escrever `0xC0/255` direto no `baseColorFactor` produz uma cor **errada**, e errada
de um jeito plausível, alguns tons mais clara, do tipo que passa despercebido numa
conferência a olho e só aparece quando o cliente compara com o Pantone.

Portanto: a conversão mora em **uma** função, no motor, e nasce com **teste de ida e volta**
`linearParaHex(hexParaLinear('#C0392B')) === '#C0392B'` para uma bateria de cores,
incluindo os extremos (`#000000`, `#FFFFFF`) e a faixa baixa, onde a curva do sRGB é linear
e não exponencial, que é exatamente onde uma implementação apressada erra. Nenhum outro
arquivo do projeto tem permissão de escrever em `baseColorFactor`.

O modo cor chapa de D2 é o que torna esse erro **visível**: se a conversão estiver errada, o
pixel lido de volta do canvas não bate com o hex, e o teste falha. Sem D2, D3 seria uma
promessa sem verificação.

### D4, Zona em 3D é **lista de nomes de malha exatos**, e os nomes nascem na normalização

O ADR-005 decidiu que `svg_selector` é lista de **ids exatos**, que o id nasce na
normalização e que o editor é somente-leitura sobre o canônico. **Essa arquitetura transfere
inteira**, e é o principal motivo de A ser tratável neste projeto e não em outro:

- o seletor de zona 3D é uma **lista de nomes de malha exatos**, nunca prefixo, pelo mesmo
  motivo de sempre: prefixo captura zona futura e pinta o lugar errado em silêncio;
- os nomes nascem em `normalizarModelo3d`, no **provisionamento**, em Node, análogo exato
  de `normalizarSvg`. Malha anônima ganha nome sintético (`malha-1`, `malha-2`, …), nome que
  o modelador escreveu é preservado, colisão é desambiguada;
- o canônico 3D é **imutável**; marcar zona escreve uma linha em `product_zones` e nada mais;
- o clique vira **raycast**: o raio do mouse acha a malha, e daí para frente é o mesmo
  caminho de hoje, `resolverZonaDoElemento` com nome de malha no lugar de id.

### D5, A normalização **separa material compartilhado**, ou a cor vaza entre zonas

Em glTF é comum e idiomático várias malhas apontarem para **o mesmo material**. Se duas
malhas de zonas diferentes compartilham um material, escrever a cor da zona `sola` pinta
também a malha do `cabedal`, sem erro, sem aviso, com 200 na resposta.

Isto é o análogo tridimensional de `ZONAS_SOBREPOSTAS`, e do gradiente compartilhado que o
backlog já registrou como pergunta em aberto para SVG. A decisão é a mesma que o projeto já
toma em todo lugar: **resolver no provisionamento, não na geração.** `normalizarModelo3d`
duplica o material para que **cada malha endereçável tenha material próprio**, e o
`relatorioDeZonas` ganha o equivalente 3D, quantas malhas cada seletor captura hoje.

### D6, Produto SVG e produto 3D **coexistem**; nenhum produto existente é migrado

`products` ganha uma coluna de tipo. Um produto é SVG **ou** 3D, nunca os dois, e o editor
escolhe o palco pelo tipo. Os produtos SVG de hoje continuam funcionando sem tocar em uma
linha do motor atual, e ADR-004/ADR-005 continuam sendo a lei deles.

Isto não é conservadorismo: o insumo dos dois é diferente (ilustração vetorial × modelo
tridimensional), e obrigar 3D excluiria todo cliente que só tem ilustração, que é a maioria
hoje, e é a premissa do intake.

---

## Alternativas Consideradas

### 1. Rota B, N vistas 2D (o "spin" de e-commerce)

- **Prós**: o motor **não muda em nada**; cada quadro é um SVG chapado que
  `gerarVarianteDeCor` recolore, e o princípio nº1 continua de pé sem nada novo para provar.
  Insumo já existe em qualquer marca com foto de catálogo. Custo de dependência: zero
- **Contras**: não é manipulação de verdade, é um carrossel com inércia; a pessoa não
  escolhe o ângulo, escolhe o quadro mais próximo. Marcar a mesma zona em 24 quadros é
  trabalho manual por modelo, a menos que exista correspondência automática de nome entre
  quadros. E `products.base_asset_path` é coluna singular: exigiria tabela de vistas e uma
  decisão nova sobre o que a API devolve
- **Descartado porque**: **o dono escolheu A.** Registrado aqui inteiro porque continua sendo
  a rota mais barata, e é para onde voltar se o insumo nunca aparecer

### 2. Manter uma vista fixa e resolver com zoom e pan

- **Prós**: custo quase zero, ~80 linhas, sem dependência nova
- **Contras**: não responde ao pedido. Zoom não mostra a sola
- **Descartado porque**: o pedido é ver as partes que a vista única esconde, e nenhuma
  quantidade de zoom revela um lado que não está no arquivo

### 3. Pseudo-3D, extrudar o SVG existente em volume

- **Prós**: reaproveita o insumo que já existe; nenhum modelo novo precisa ser feito
- **Contras**: uma ilustração de calçado de perfil não contém a informação do outro lado.
  Extrudar produz um adesivo com espessura, não um calçado
- **Descartado porque**: entregaria uma manipulação que expõe, a cada giro, o quanto o
  modelo não existe, pior que não girar

### 4. Renderizar a imagem 3D no servidor e devolver PNG

- **Prós**: o cliente recebe bitmap pronto, sem precisar de visualizador
- **Contras**: exige GPU ou raster em software na função serverless, com binário nativo,
  cold start e custo, e reabre inteira a objeção do `?format=png`, agora com uma equação de
  iluminação no meio
- **Descartado porque**: D1 torna isto desnecessário. O servidor edita JSON; quem renderiza é
  o navegador de quem olha

---

## Consequências

### Positivas

- O time passa a aprovar cor olhando o calçado como olharia na mão, as partes que mais
  recebem cor de contraste (sola por baixo, traseira, entressola) deixam de ser invisíveis
- O princípio nº1 fica **mais** explícito, não menos: hoje ele é verdadeiro por acidente
  feliz (editor e API desenham o mesmo arquivo); depois de D2/D3 ele é regra escrita, com um
  modo de conferência declarado e um teste que lê pixel de volta
- Nenhum custo de infraestrutura novo. three.js é MIT; glTF é aberto; a geração continua
  sendo edição de JSON numa função serverless. O bootstrap gratuito não é afetado **pelo
  software**
- O caminho é reversível: produtos SVG continuam intocados (D6), então errar em 3D não
  derruba o que já funciona

### Negativas / Trade-offs

- **Dependência pesada.** three.js é a maior dependência que o projeto já teve. Vale
  registrar por que isto **não** contradiz o ADR-005, que recusou Fabric.js: aquela recusa
  foi por Fabric criar uma **segunda representação do desenho** ao lado do canônico, não por
  peso. Aqui o glTF é a única representação e o three.js só o desenha, não guarda estado do
  modelo, não serializa de volta, não é fonte de verdade de nada
- **A verificação a olho fica mais difícil, não mais fácil.** Um SVG errado se lê com `diff`.
  Uma cena 3D errada precisa de olho humano num ângulo específico. `memory/learnings.md` já
  diz três vezes que suíte verde não prova o que a interface entrega; em 3D isso vira ainda
  mais verdade, e o roteiro de passada dirigida cresce
- **O gesto de arrastar disputa com o gesto de clicar.** Errar essa fronteira marca zona sem
  querer, o modo de falha que o princípio nº1 proíbe. Precisa de limiar de movimento
  explícito ("arrastou mais que N pixels = órbita, não clique"), e precisa de teste
- **A pergunta do PNG volta com força.** Um cliente que hoje não consome SVG muito menos
  consome glTF. A rota A empurra `?format=` para mais perto de barreira de adoção
- **O insumo pode custar dinheiro**, a primeira coisa neste projeto que plausivelmente
  custa. Ver abaixo

---

## A pergunta que trava tudo: de onde vem o modelo 3D?

A decisão está tomada e a arquitetura está desenhada, mas **não existe um único glTF neste
projeto**. O asset de demonstração é `src/esboco/tenis-demo-cru.svg`, uma ilustração. O
`respostas-intake.md` diz que os modelos-base dos clientes são ilustração vetorial ou foto
real. Ninguém tem glTF de calçado à mão.

As saídas, com o custo honesto de cada uma, na forma que o `CLAUDE.md` exige (custo,
alternativa gratuita, impacto, recomendação, o dono decide):

| Origem | Custo | O que muda |
|---|---|---|
| **CAD da própria marca** (Rhino, Modo, Clo3D, comuns em calçado) exportado para glTF | zero em software; depende de a marca ter e entregar | É a saída ideal. O modelo já existe no processo de desenvolvimento do produto; falta um passo de exportação. Torna 3D um recurso de quem tem, não uma barreira |
| **Modelar um só**, para demo e desenvolvimento | tempo, ou algumas centenas de reais em freelancer | Desbloqueia todo o desenvolvimento sem depender de cliente nenhum. É o mínimo para escrever a primeira linha de código |
| **Modelo pronto de banco 3D** (Sketchfab/TurboSquid), licença comercial | dezenas a centenas de reais | Mais rápido que modelar; exige conferir licença e provavelmente renomear malhas |
| **Foto → 3D por IA** (fotogrametria, Gaussian splatting) | serviço pago, e qualidade de malha ruim para nomear zona | Descartar por ora. Malha gerada por IA não tem separação semântica, não dá para dizer "esta é a sola" |

**Recomendação:** modelar **um** tênis de demonstração com as malhas já separadas e nomeadas
por parte (sola, entressola, cabedal, cadarço, ilhós, língua, contraforte, logo). Com ele,
tudo em D1–D5 é construível e testável sem depender de cliente nenhum, e ele vira o
`tenis-demo` 3D, o análogo exato do papel que o SVG de demo já cumpre hoje.

Enquanto esse arquivo não existir, **nenhuma linha de código desta decisão pode ser escrita
com honestidade**, seria construir um motor sem nunca ter visto o combustível.

---

## Referências

- `docs/09_BACKLOG/features.md`, a entrada "Calçado manipulável", que registrou as rotas A e B
- `docs/08_DECISOES/adr-001-stack-e-motor-de-render.md`, o "MVP vetor-only" que este ADR supera em parte
- `docs/08_DECISOES/adr-004-contrato-de-zona-e-normalizacao-de-svg.md`, o contrato de zona que D4/D5 espelham
- `docs/08_DECISOES/adr-005-editor-de-zonas-em-svg-dom.md`, id na normalização, canônico imutável, seletor de ids exatos: a arquitetura que D4 transfere
- `CLAUDE.md`, princípio nº1, e a regra de custo que a tabela de insumo obedece
- [glTF 2.0, Materials](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials), `pbrMetallicRoughness.baseColorFactor` é **linear**, não sRGB (D3)

---

## Notas de Implementação

- Nada disto começa antes de existir o glTF de demonstração. A primeira entrega é o
  **provisionamento** (`normalizarModelo3d` + coluna de tipo em `products`), não o palco:
  sem canônico nomeado e com material separado, o editor não tem o que clicar
- `normalizarModelo3d` roda em **Node**, no provisionamento, como `normalizarSvg`. Ele não
  precisa de three.js, glTF é JSON, e nomear malha e duplicar material é manipulação de
  objeto. three.js entra **só no navegador**, para desenhar
- O motor 3D vive em `src/lib/render/`, ao lado do de SVG, e é importado pelo editor e pela
  API, a linha "motor de render" do glossário vale para os dois: um só, nunca duas
  implementações
- Coluna de tipo em `products`: nome e valores ficam para a spec da entrega. Vale a regra de
  sempre, RLS precisa continuar valendo, e migration nova é `YYYYMMDD_descricao.sql`
- A pergunta em aberto que a spec terá de responder: `product_zones.svg_selector` guarda
  lista de nomes de malha para produto 3D (coluna com nome que mente sobre o conteúdo), ou
  ganha coluna irmã? "Um termo, um nome" empurra para a segunda, e é decisão de schema, não
  decidir aqui de improviso
- Limiar de arrastar × clicar: escolher em pixels, escrever no fluxo, e testar. Não deixar
  emergir do comportamento padrão do controle de órbita
