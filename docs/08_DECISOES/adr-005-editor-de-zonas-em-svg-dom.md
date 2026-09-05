# ADR-005 — Editor de zonas em SVG DOM, e quem cunha o `id`

**Status**: Aceito
**Data**: 2026-09-05
**Decisores**: Matheus Bonato
**Supersede**: ADR-001 **parcialmente** — só a escolha de Fabric.js para o editor. Todo o
resto do ADR-001 (React+Vite, Supabase, Vercel Functions, MVP vetor-only) continua vigente.
**Supersedido por**: (nenhum)

---

## Contexto

O ADR-001 escolheu Fabric.js para o editor em 2026-08-12, **antes de o motor de render
existir**. A justificativa escrita é comparativa e tem duas pernas (linhas 47 e 70 do
ADR-001): "serialização JSON" e "reaproveitar o mesmo grafo de objetos no editor e num
render espelhado no servidor".

O ADR-004, aceito no mesmo dia mas depois, decidiu que o servidor **não tem grafo nenhum**:
`gerarVarianteDeCor` opera sobre o SVG canônico, e é o **mesmo módulo** no editor e na
função serverless. Isso esvaziou as duas pernas da justificativa. Nenhum dos dois ADRs
registra a tensão — este registra.

Enquanto isso, o esboço (`src/esboco/`, 2026-09-05) já resolveu seleção de zona e contorno
com **SVG DOM puro**: `event.target.closest(svg_selector)` para o clique e uma camada
`<svg>` sobreposta com clones `fill="none"` para o contorno. Foi aberto num Chrome de
verdade e funciona.

Ao especificar a marcação de zona, apareceu um segundo problema, mais fundo:
**`normalizarSvg` só renomeia `id` duplicado — nunca cria `id`**. O cliente-alvo declarado
no próprio ADR-004 (export padrão de Illustrator) manda paths sem id semântico. No SVG de
demo do projeto, os 8 ilhoses e a sombra não têm id e são **immarcáveis**. Sem resolver
isso, o editor não marca zona no arquivo real de nenhum cliente.

---

## Decisão

### D1 — O editor manipula SVG no DOM. Fabric.js não entra no projeto

O asset-base canônico é inserido inline no DOM e o editor trabalha nele: hit-test com
`closest()`, contorno em camada `<svg>` sobreposta, preview com `gerarVarianteDeCor`.

O motivo é o princípio nº1, não preferência técnica. Importar o SVG para objetos Fabric e
re-serializar cria uma **segunda representação do mesmo desenho** ao lado do canônico —
"duas implementações que podem divergir" é literalmente o que o `CLAUDE.md` proíbe. E o
preview passaria a ser um canvas rasterizado, enquanto a API devolve SVG: o pixel do editor
deixaria de ser o pixel da API por construção.

### D2 — O `id` é cunhado na normalização, e `svg_selector` é lista de ids exatos

`normalizarSvg` passa a atribuir `id` a todo elemento pintável anônimo (`elemento-1`,
`elemento-2`, … em ordem de documento), cunhando só nomes que não colidem com os ids já
presentes. Id que o designer escreveu é preservado; só o anônimo ganha nome sintético.

Consequência que é o ponto da decisão: **o asset-base canônico é imutável e o editor é
somente-leitura sobre ele.** Marcar zona escreve uma linha em `product_zones` e nada mais.

`svg_selector` passa a ser uma **lista de ids exatos** — `#zona-cadarco, #zona-cadarco-2` —
nunca um seletor de prefixo.

---

## Alternativas Consideradas

### 1. Manter Fabric.js, como o ADR-001 decidiu

- **Prós**: cumpre o ADR vigente sem escrever ADR novo; traz seleção, handles, zoom e pan prontos
- **Contras**: segunda representação do desenho; preview vira canvas rasterizado; dependência
  nova de peso considerável; a justificativa original já não vale
- **Descartado porque**: viola o princípio nº1 na estrutura, não na execução — e o que ele
  entregava de graça (zoom/pan/handles) é ~80 linhas neste caso de uso

### 2. O editor cunha o `id` ao marcar, gravando o SVG de volta no Storage

- **Prós**: normalização fica intocada; só cunha id no que é realmente usado
- **Contras**: torna o asset-base **mutável**, e o Storage não tem escrita condicional (sem
  If-Match/ETag no `supabase-js`)
- **Descartado porque**: concorrência silenciosa. Membro A marca `sola` e grava; membro B,
  com a versão anterior em memória, marca `cabedal` e grava por cima — o `zona-sola` de A
  some do arquivo, a linha de A em `product_zones` continua apontando pra ele e resolve 0
  elementos. Se B tiver cunhado o mesmo sufixo pra outro elemento, resolve pro **elemento
  errado** e a cor sai no lugar errado, calada. Além disso obrigaria a reimplementar
  `desambiguarIds` no navegador — a segunda implementação de novo

### 3. Seletor posicional (`svg > g:nth-of-type(2) > path:nth-of-type(5)`)

- **Prós**: nunca toca no asset
- **Contras**: ilegível, e quebra em silêncio se qualquer coisa mudar de posição no arquivo
- **Descartado porque**: o modo de falha é justamente "pinta o elemento errado sem avisar"

### 4. Seletor de prefixo (`[id^="zona-cadarco"]`, como o esboço usa hoje)

- **Prós**: uma string curta cobre N elementos, e já funciona
- **Contras**: uma zona futura `zona-cadarco-lateral` seria capturada pelo prefixo de
  `zona-cadarco` — duas zonas dividindo elemento sem ninguém pedir
- **Descartado porque**: mesmo modo de falha da alternativa 3, e o CLAUDE.md é explícito —
  "zona errada falha alto e visível, nunca aplica a cor silenciosamente no lugar errado"

---

## Consequências

### Positivas

- O pixel do editor é o pixel da API por construção, não por disciplina
- Zero dependência nova; o esboço já provou a mecânica num navegador real
- A classe inteira de corrida de escrita no asset-base **deixa de existir**, em vez de ser mitigada
- Elemento anônimo vira marcável: no SVG de demo, 9 dos 11 elementos sem id passam a poder
  virar zona (os 2 restantes são costura com `fill="none"`, que não aceita cor chapa de qualquer forma)
- A hora certa é agora: existem 0 assets reais no Storage. Depois, isso obrigaria a
  re-normalizar arquivo de cliente que já tem `svg_selector` gravado

### Negativas / Trade-offs

- **Os ids cunhados viram contrato implícito.** Se uma versão futura do normalizador mudar
  a ordem de cunhagem, todo `svg_selector` gravado repointa em silêncio. Mitigação
  obrigatória: o teste de integração baixa o asset do Storage e afirma
  `normalizarSvg(baixado).svg === baixado` — normalizador incompatível fica vermelho antes
  de qualquer variante ser gerada
- Zoom, pan e histórico de edição passam a ser código nosso
- `svg_selector` fica mais longo e precisa ser reescrito quando a zona ganha elemento — o
  editor é o dono dessa string, ninguém a digita à mão
- Re-upload de asset-base (fora do escopo desta entrega) fica **mais** delicado, não menos:
  ids cunhados podem mudar entre dois uploads do mesmo arquivo se o desenho mudou. Precisa
  de decisão própria quando o upload pelo navegador for construído

---

## Referências

- ADR-001 — a decisão parcialmente supersedida por esta
- ADR-004 — contrato de zona e normalização; é o que esvaziou a justificativa do Fabric
- `src/esboco/PreviewDaVariante.tsx` — o hit-test e o contorno que provaram a mecânica
- `src/lib/render/normalizarSvg.ts` — onde a cunhagem de id passa a morar
- `CLAUDE.md` — princípio nº1

---

## Notas de Implementação

- A política de id vive em **um** arquivo (`src/lib/render/idDeElemento.ts`): desambiguar
  duplicado, renomear id que não é seletor CSS seguro (SVG aceita `.` e `:` em id) e cunhar
  `elemento-N`. `normalizarSvg` delega
- `montarSeletorDeZona` é a **única** fonte do formato de `svg_selector` — nada de montar a
  string à mão em outro lugar
- Antes de gravar em `product_zones`, o editor confere com `relatorioDeZonas` que o seletor
  resolve exatamente os elementos marcados, e recusa a gravação se divergir
- `respostas-intake.md` cita Fabric.js e **não deve ser corrigido**: é registro histórico
  do intake, não documentação vigente
