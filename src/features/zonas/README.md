# src/features/zonas — marcar zona no calçado

O que vive aqui: **clicar numa parte do calçado, dar um nome a ela e gravar a linha em
`product_zones`** — o mapeamento que a API de variante consome depois. O que **não** vive
aqui: listar produtos e baixar o asset-base (isso é `src/features/produtos/`), e as regras
de SVG/cor em si (isso é `src/lib/render/`, importado, nunca reimplementado).

Esta feature não tem tela própria: `PalcoDeMarcacao` e `FormularioDeNovaZona` são
apresentacionais e são montados por `produtos/VisualizacaoDoProduto.tsx`, dentro de
`.produto__palco` e `.produto__lateral`. Quem tem estado é `produtos/TelaDeProdutos.tsx`.

| Arquivo | Papel |
|---|---|
| `tiposDeZona.ts` | `ZonaDoProduto` (a linha de `product_zones`) e `ZonaParaGravar` (a linha + **como** gravar). Definição única: uma zona atravessa banco, motor e tela |
| `marcarZona.ts` | **Puro.** (canônico, zonas atuais, `zone_key`, ids marcados) → `ZonaParaGravar`, ou `ErroDeVariante`. Recusa elemento inexistente, `fill="none"` e sobreposição com outra zona. Exporta também `idsDoSeletor` (`"#a, #b"` → `['a','b']`) |
| `resolverZonaDoElemento.ts` | **Puro.** Elemento → `zone_key` a que ele já pertence, pelo mesmo caminho que o motor usa para pintar. `mapaDeZonasPorElemento` faz a varredura de uma vez, para o palco não pagar uma por clique |
| `listarZonasDoProduto.ts` | As zonas gravadas do produto: campos explícitos, `.order('created_at')`. Erro sobe, nunca vira lista vazia |
| `gravarZonaNoBanco.ts` | INSERT **ou** UPDATE por `idExistente`, nunca `upsert`. Traduz `23505` e `PGRST116` para frase acionável; o objeto cru do Supabase não sai daqui |
| `marcacaoEmCurso.ts` | **Puro.** `alternarId` / `desfazerUltimo` sobre a lista de ids clicados. A regra mora fora do hook para ser testável sem testing-library |
| `hooks/useMarcacaoDeZona.ts` | Casca de `useState` da marcação em curso; zera ao trocar de produto, no próprio render |
| `hooks/useZonasDoProduto.ts` | Carrega e grava `product_zones`. `salvando`/`erroAoGravar` separados de `estado`/`erro`; relê a lista depois de gravar |
| `PalcoDeMarcacao.tsx` | O calçado na tela, clicável: markup de `gerarVarianteDeCor` + camada `<svg>` de contorno + `closest('[id]')` |
| `FormularioDeNovaZona.tsx` | `zone_key`, `label` e `cor_default` validados por `validarZoneKey`/`validarCor` **antes** do banco |
| `zonas.css` | Estilo do palco e do formulário, separado do JSX (white-label). Importado uma vez em `src/main.tsx` |

Os `*.test.ts` / `*.test.tsx` ficam co-locados, ao lado do arquivo que provam.

## O editor nunca normaliza nem regrava o asset-base (ADR-005)

O canônico do Storage é **imutável** e esta feature é somente-leitura sobre ele: marcar
zona escreve uma linha em `product_zones` e **nada** no SVG. Nenhum arquivo daqui importa
`normalizarSvg` — quem normaliza é o provisionamento, uma vez, no upload.

O motivo é concorrência, não elegância: o Storage não tem escrita condicional (sem
If-Match/ETag no `supabase-js`). Se o editor escrevesse `id` ao marcar, dois membros
marcando ao mesmo tempo se sobrescreveriam — o id de um sumiria do arquivo enquanto o
`svg_selector` dele continuaria no banco, resolvendo 0 elementos ou, pior, o errado.

Consequência: **o id nasce na normalização**. Todo pintável já chega ao editor
endereçável (`elemento-N` quando o arquivo do cliente não trouxe id). Elemento clicado sem
id não vira zona — `PalcoDeMarcacao` ignora o clique em vez de cunhar um id na hora.

## `svg_selector` é lista de ids exatos, nunca prefixo

Formato: `#zona-cadarco, #zona-cadarco-2`. Quem monta essa string é **só**
`montarSeletorDeZona` (`src/lib/render/`), e quem a desmonta para acrescentar elemento é
`idsDoSeletor`. Nunca concatene à mão.

Prefixo (`[id^="zona-cadarco"]`) é proibido: capturaria uma zona futura
`zona-cadarco-lateral` e pintaria o lugar errado **em silêncio** — o modo de falha que o
princípio nº1 existe para impedir. Seletor gravado que não seja lista de ids exatos faz
`idsDoSeletor` recusar alto, pedindo remarcação, em vez de adivinhar o que ele captura.

## `unique (product_id, zone_key)`: acrescentar elemento é UPDATE

A restrição do banco é o que manda no desenho desta feature.

- Acrescentar mais um elemento à zona `sola` é **UPDATE do `svg_selector` da linha
  existente**, nunca um segundo INSERT. Por isso `marcarZona` devolve `idExistente`, e
  `gravarZonaNoBanco` tem dois caminhos separados.
- **`upsert` cego é proibido.** Ele é mais curto e apagaria em silêncio o mapeamento que
  um colega acabou de gravar — INSERT e UPDATE significam coisas diferentes, e a diferença
  é *quem some*. `gravarZonaNoBanco.test.ts` lê o próprio fonte e falha se essa chamada
  única voltar numa refatoração; comentário sozinho não segura a regra.
- Duas pessoas criando a mesma `zone_key` esbarram na unique e voltam com Postgres
  **`23505`**. Isso é o comportamento **certo** (a segunda gravação seria destrutiva), então
  ele é traduzido, não contornado: *"essa zona já foi marcada — recarregue"*.
- O UPDATE nunca mexe em `zone_key` nem em `product_id`: `zone_key` é chave pública da
  API, e renomeá-la quebraria a integração de um cliente que já a usa.

## O palco desenha a saída de `gerarVarianteDeCor`, nunca cor por CSS

`PalcoDeMarcacao` passa o canônico pelo **mesmo motor da API**, inclusive quando não há cor
pedida. Pintar por `fill` de classe seria mais simples e mostraria uma cor que a API não
produz — e a divergência apareceria com o calçado já fabricado. É o princípio nº1 inteiro:
*cor no editor = cor na API*. `PalcoDeMarcacao.test.tsx` compara o markup do palco, byte a
byte, com a saída de `gerarVarianteDeCor`.

Daí decorrem as regras de `zonas.css` (itens 6 e 7 do design system): o desenho **não**
recebe filtro, sombra, `opacity` nem overlay; o realce da seleção é uma camada `<svg>` por
cima, com `fill: none` e `pointer-events: none`; e "desabilitado" se anuncia por cursor e
borda, nunca clareando o calçado.

Quando o motor recusa o pedido (zona sobreposta, gradiente, cor inválida), o palco mostra
o canônico **cru** e o alerta com o código do erro. Nunca "quase certo".

## Fora de escopo desta entrega (registrado, não esquecido)

Do plano aprovado — decisões conscientes, não pendências esquecidas:

- **Upload de SVG pelo navegador**, UI de recusa e re-upload. Re-upload é o caso que quebra
  o modelo de asset imutável (exige remapear zonas) e merece decisão própria.
- **DELETE de zona.** A RLS dá DELETE só ao owner e ainda não há UI de papel.
- **Lock otimista em `product_zones`.** Não há `updated_at`; exigiria migration. UPDATE
  concorrente da mesma zona continua last-write-wins, mitigado por reler depois de gravar.
- **Coluna de ordem de zona.** A lista ordena por `created_at`; a "ordem de leitura do
  calçado" não sobrevive sem coluna nova.
- **Marcar `<g>` inteiro num clique.** Em SVG o alvo do evento é sempre a folha; 8 cliques
  para 8 ilhoses é aceitável agora.

## Regra de dependência

Feature importa de `src/lib/`, **nunca** de outra feature. Por isso `useZonasDoProduto`
recebe `tenantId` por parâmetro em vez de ler `sessao/`: além da seta proibida, o hook
passaria a exigir `<ProvedorDeSessao>` montado para ser testado.
