# src/esboco — esboço visual do editor

**Isto não é o editor de zonas.** É uma tela única, sem banco, sem login e sem upload,
feita para o dono do projeto **ver** o motor de render funcionando antes de existir
produto. O nome do diretório é literal de propósito (ADR-003): ninguém deve confundir
isto com a Fase 1 de verdade.

## Rodar sem conta

```bash
npm run dev:esboco     # abre o navegador já no esboço
```

Ou, à mão: `npm run dev` e acrescente `?tela=esboco` ao endereço —
<http://localhost:5173/?tela=esboco>. O botão no rodapé de qualquer tela leva ao mesmo
lugar; a query string existe para o endereço ser digitável e sobreviver a um F5.

**Não pede login e não precisa de `.env.local`.** Até 2026-09-08 precisava das duas
coisas, e nenhuma delas por um motivo real: a raiz do app é a área protegida, e a
checagem de configuração do Supabase rodava antes de o `App` sequer decidir que tela
abrir. Resultado — um clone recém-baixado não conseguia ver o motor funcionando, que é
exatamente para o que esta tela existe. Hoje o `App` decide a tela primeiro e só cobra
configuração de quem vai usar o banco (`src/telaInicial.ts`).

Isso **não** é um bypass de autenticação, e a diferença importa: `?tela=esboco` não abre
nada protegido, abre a única tela que não tem o que proteger — o SVG é commitado
(`tenis-demo-cru.svg`), o dado é falso (`produtoDemo.ts`) e a tela não faz uma requisição
sequer. Qualquer outro valor na query cai na área protegida, com o portão inteiro pela
frente; `src/telaInicial.test.ts` prende essa regra, inclusive o caso do valor
desconhecido.

| Arquivo | Papel |
|---|---|
| `EsbocoDoEditor.tsx` | Tela única. **O único lugar com estado** — os painéis são burros |
| `PainelDeZonas.tsx` | Lista de zonas, contagem de elementos por seletor, seleção de cor |
| `PreviewDaVariante.tsx` | Palco: a variante + contorno da zona selecionada + clique no calçado |
| `PainelDaApi.tsx` | A chamada HTTP equivalente — espelho de `docs/07_APIS/endpoints.md`, não proposta — e o relatório da normalização |
| `ComparativoDeNormalizacao.tsx` | Antes/depois: o mesmo pedido de cor no arquivo cru e no canônico |
| `produtoDemo.ts` | O que viria de `products` + `product_zones` — dado falso, não é tenant real. Os `svg_selector` saem de `montarSeletorDeZona`, nunca de string à mão |
| `tenis-demo-cru.svg` | Asset-base **cru**, sujo de propósito (ver abaixo) |
| `produtoDemo.test.ts` | Prende a premissa do esboço: o que a tela afirma é verdade |
| `PainelDaApi.test.tsx` | Prende cada string do contrato mostrado no painel (rota, corpo, envelope, status) |
| `PainelDaApi.copia.test.tsx` | Prende o botão de copiar o corpo: o que ele copia, e que a recusa da área de transferência aparece na tela. Separado do de cima porque precisa de jsdom, e aquele não |
| `ComparativoDeNormalizacao.test.tsx` | Prende o comparativo (BUG-011 e BUG-012) |
| `esboco.css` | Estilo separado do JSX (regra de white-label do CLAUDE.md) |

## O que o esboço demonstra (e por que cada peça está ali)

1. **Cor no editor = cor na API.** As duas colunas saem da mesma chamada de
   `gerarVarianteDeCor`. Não há caminho no código para elas divergirem — é o princípio
   nº1 virando estrutura, não promessa.
2. **Zona é conjunto de elementos.** O cadarço são 4 paths que nascem com o mesmo `id`;
   a normalização desambigua (`zona-cadarco`, `-2`, `-3`, `-4`) e a zona os endereça pela
   **lista de ids exatos** que `montarSeletorDeZona` monta — `#zona-cadarco, #zona-cadarco-2,
   #zona-cadarco-3, #zona-cadarco-4` (BUG-002). Prefixo (`[id^="zona-cadarco"]`) é proibido
   pelo ADR-005: pegaria de brinde uma zona futura `zona-cadarco-lateral`.
3. **Normalização não é firula.** O comparativo roda o mesmo pedido de cor nos dois
   arquivos. No cru, sola, cabedal, cadarço e logo **não mudam** — a regra `.st-*` do
   bloco `<style>` vence o atributo `fill` que o motor escreve. É o BUG-001 ao vivo.
4. **Falha alto.** A zona "Detalhe" tem gradiente. Pedir cor chapa nela devolve
   `ZONA_NAO_RECOLORIVEL` e **nenhuma** cor é aplicada — a variante sai inteira ou não sai.

## O arquivo cru é sujo de propósito

`tenis-demo-cru.svg` imita export real de Illustrator/Figma: cor em `<style>`, `style`
inline, `id` repetido, `<script>`, handler `onclick` e referência externa. O esboço nunca
o renderiza inline — só o asset-base canônico entra no DOM. O cru aparece apenas dentro
de um `<img>` com data URL no comparativo, onde não executa script nem busca rede.

### A mesma lista de ids exatos captura os 4 cadarços nos dois lados

Pergunta que volta ao ler `produtoDemo.ts`: se no arquivo cru os 4 cadarços ainda dividem
`id="zona-cadarco"`, como a lista `#zona-cadarco, #zona-cadarco-2, #zona-cadarco-3,
#zona-cadarco-4` não fica capturando só um path do lado "Sem normalizar"?

Porque `#id` em CSS é **igualdade de atributo**, não `getElementById`: `querySelectorAll`
devolve *todos* os elementos com aquele id, e é isso que o motor usa. No cru, o termo
`#zona-cadarco` casa os 4 sozinho e os termos `-2`, `-3` e `-4` não casam nada; no
canônico, cada termo casa o seu. Resultado idêntico dos dois lados: **4 elementos**.

Isso importa para o comparativo continuar provando o que promete. Os dois lados recebem o
mesmo pedido de cor; se a zona alcançasse conjuntos diferentes, a diferença na tela seria
"faltou cadarço de um lado", e não o BUG-001 — o `<style>` do arquivo vencendo o atributo
que o motor escreveu. `produtoDemo.test.ts` prende as duas contagens exatamente por isso.

## O que o esboço NÃO tem

- **Login, banco e upload**: nada de Supabase aqui. A tela não faz uma requisição sequer.
- **Marcação de zona**: as zonas já vêm marcadas em `produtoDemo.ts`. Marcar zona
  clicando no calçado (SVG no DOM, ADR-005) é a próxima peça e ainda não existe.
- **Estado de carregando**: tudo é síncrono e local. Preferi não simular spinner —
  estado falso em esboço vira expectativa errada de performance.
- **Identidade visual**: `docs/02_DESIGN_SYSTEM/` está vazio até o nome do produto
  existir. Os tokens em `esboco.css` são provisórios; os nomes ficam, os valores mudam.

## Verificado

`npm test` cobre a premissa do esboço (`produtoDemo.test.ts`) e o caminho do navegador do
motor (`../lib/render/dom.test.ts`, com `DOMParser` global em vez de jsdom).

`ComparativoDeNormalizacao.test.tsx` prende o comparativo: os dois lados recebem o mesmo
pedido de cor e um pedido recusado nunca vira `<img src="">` (BUG-011 e BUG-012).

`PainelDaApi.test.tsx` prende o contrato que o painel exibe. Ele existe porque o painel
mostrou por semanas uma rota, um corpo e uma resposta que **deixaram de valer** na Etapa 1 da
API, com a suíte inteira verde: nada, em teste nenhum, comparava a tela com
`docs/07_APIS/endpoints.md`. O esboço é a peça que este projeto usa para conferir o princípio
nº1 a olho — mostrando contrato morto, ele ensinava errado exatamente onde deveria ensinar.

A Etapa 6 trocou o seletor do cadarço, de prefixo para lista de ids exatos. A equivalência
está provada na suíte (contagem 4 no cru e 4 no canônico, e os 4 paths recebendo o atributo
no cru), mas a passada de Chrome abaixo é anterior à troca — vale reconferir "cadarço = 4"
na próxima vez que a tela for aberta.

**Aberto no Chrome em 2026-09-05** — não só em jsdom. Verificado na página: as 9 zonas com
a contagem de elementos certa (cadarço = 4), o preview mudando de cor, o comparativo
mostrando o cru bege ao lado do canônico azul, e `ZONA_NAO_RECOLORIVEL` congelando a
variante com o botão Desfazer funcionando. Foi essa passada que achou BUG-011/012 — a
suíte estava verde com os dois presentes.
