# Spec — `recolorirModelo3d`, o motor de cor do calçado 3D

> Loop `/spec → /build → /review`. Aberto em 2026-09-10, logo depois de `normalizarModelo3d`
> (commit `784bf4c`).

## 0. Por que isto, e por que agora

`normalizarModelo3d` entregou o canônico: toda malha endereçável com nome único e material
próprio. Falta a outra metade — **pintar**. Sem ela o rumo 3D tem provisionamento e não tem
produto: nada consome o canônico, e o ADR-007 continua sendo promessa.

É a peça certa agora por eliminação, pelo mesmo argumento que escolheu a anterior: **não
depende de artista, não depende do acervo e não depende de three.js**. glTF é JSON, recolorir é
escrever num campo de objeto, e fixtures escritas à mão exercitam cada regra.

E ela carrega o que o ADR-007 chama, com todas as letras, de **detalhe de maior risco do ADR
inteiro** (D3): o hex que a pessoa digita é sRGB, o `baseColorFactor` do glTF é **linear**, e
escrever `0xC0/255` direto produz uma cor errada de um jeito plausível — alguns tons mais
clara, do tipo que passa numa conferência a olho e só aparece quando o cliente compara com o
Pantone. Num sistema cujo princípio nº1 é "cor no editor = cor na API", esse é o defeito mais
caro que existe: ele não quebra nada, ele fabrica o calçado errado.

## 1. Escopo

Dois módulos puros em `src/lib/render/`:

1. **`corSrgbLinear.ts`** — `hexParaLinear` / `linearParaHex`, o **único** lugar do projeto
   autorizado a converter entre o hex do usuário e o float linear do glTF (ADR-007 D3).
2. **`recolorirModelo3d.ts`** — o gêmeo de `gerarVarianteDeCor`: recebe o **modelo 3D
   canônico**, as zonas e `{zone_key: cor}`, devolve o glTF da variante, ou recusa com código.

Mais o `relatorioDeZonas3d`, gêmeo de `relatorioDeZonas`: quantas malhas cada zona resolve
**hoje**, para o mapeamento ser conferido antes de existir variante.

## 2. Fora de escopo

- **three.js, palco 3D, órbita, modo cor chapa.** D2 é o que torna o erro de D3 *visível* no
  navegador; esta rodada torna o erro *impossível* na origem. São entregas diferentes, e o
  palco depende de um modelo real que ainda não existe.
- **Onde a zona 3D é gravada.** `product_zones.svg_selector` é lista de ids CSS; a zona 3D é
  lista de nomes de malha (ADR-007 D4). Se é a mesma coluna, uma coluna nova ou uma tabela é
  **decisão de schema**, e schema não entra numa rodada de função pura. Aqui a zona chega como
  `{ zone_key, malhas: string[] }` e ponto. Registrar a pendência.
- **Rota HTTP, Storage, coluna de tipo em `products`.** O módulo é puro; quem o chama vem
  depois.
- **PNG, `.glb`, textura, acervo, composição, prompt, deploy.**
- Qualquer alteração no caminho SVG, que segue intocado.

## 3. Arquivos afetados

| Arquivo | O quê |
|---|---|
| `src/lib/render/corSrgbLinear.ts` | **novo** — a conversão, e só ela |
| `src/lib/render/corSrgbLinear.test.ts` | **novo** — ida e volta, a bateria de cores, o valor conhecido |
| `src/lib/render/recolorirModelo3d.ts` | **novo** — o motor |
| `src/lib/render/recolorirModelo3d.test.ts` | **novo** |
| `src/lib/render/soUmLugarEscreveCorNoGltf.test.ts` | **novo** — a guarda de fonte do critério 3 |
| `src/lib/render/fixtures/gltfDeTeste.ts` | ganha o que faltar para descrever um canônico já pronto |
| `src/lib/render/README.md` | índice do diretório ganha as linhas novas |
| `docs/03_REGRAS_DE_NEGOCIO/glossario.md` | conferir se **variante 3D** precisa de linha |

Nenhum código existente muda de comportamento.

## 4. Critérios de aceite

### A conversão (ADR-007 D3)

1. **Ida e volta exata.** `linearParaHex(hexParaLinear(hex)) === hex` para uma bateria que
   inclui `#000000`, `#FFFFFF`, `#C0392B`, cinzas, primárias e **a faixa baixa**
   (`#010101`…`#0A0A0A`), onde a curva do sRGB é linear e não exponencial — que é exatamente
   onde uma implementação apressada erra.
2. **A conversão não é ingênua, e o teste prova pelo valor.** `hexParaLinear('#808080')` devolve
   ≈ `0.2159`, **não** `0.502`. Um teste que só verificasse ida e volta passaria com
   `c/255` — porque `c/255` também volta. Este critério é o que mata essa mutação.
3. **Exatamente um lugar escreve cor no glTF.** Uma guarda de fonte varre `src/` e `api/` e
   falha se `baseColorFactor` for escrito fora de `recolorirModelo3d.ts`, ou se a fórmula do
   sRGB (`1.055`, `0.04045`, `2.4`) aparecer fora de `corSrgbLinear.ts`. A guarda lê **código**,
   não prosa: tira os comentários antes de comparar (aprendizado de 2026-09-08).
4. **Alfa preservado.** `baseColorFactor` é RGBA. Recolorir troca os três primeiros e **mantém
   o quarto** — forçar `1` tornaria opaca uma peça translúcida sem ninguém pedir.

### O motor

5. **Pinta pelo nome da malha.** `{ "sola": "#C0392B" }` com a zona `sola` → `["sola"]` escreve
   em `baseColorFactor` de **todas as primitivas** daquela malha, e em nenhuma outra.
6. **Zona com várias malhas.** `["sola", "solado-lateral"]` pinta as duas com a mesma cor.
7. **`zone_key` que o produto não tem** → `ZONA_NAO_ENCONTRADA`. Mesmo código do SVG: é o mesmo
   conceito, e o glossário proíbe dois nomes para a mesma coisa.
8. **Nome de malha que o modelo não tem** → `ZONA_NAO_ENCONTRADA`, com o nome na mensagem. É o
   gêmeo de "o seletor resolveu zero elementos": mapeamento quebrado, não zona vazia.
9. **Cor inválida** → `COR_INVALIDA`, **delegando** a `validarCor` — sem reimplementar hex.
10. **Malha com `baseColorTexture`** → `ZONA_NAO_RECOLORIVEL`. É aqui que a observação que
    `normalizarModelo3d` deixou em `malhasNaoRecoloriveis` vira recusa, exatamente como o
    gradiente do SVG: o normalizador anota, o motor recusa (ADR-004 D1).
11. **Duas zonas que caem no mesmo material** → `ZONAS_SOBREPOSTAS`. Não basta comparar nomes de
    malha: num canônico cada malha tem material próprio, mas um modelo **não** normalizado pode
    ter duas malhas de nomes diferentes no mesmo material — e aí a última chave do JSON
    decidiria a cor das duas (BUG-013 outra vez, por outro caminho). A comparação é por
    **índice de material**, que é o que de fato recebe a cor.
12. **Valida tudo antes de pintar.** Variante sai inteira ou não sai — nenhum documento
    meio-pintado é devolvido, nem em caso de erro na terceira das quatro zonas.
13. **Só `baseColorFactor` muda.** O resto do documento sai byte a byte igual ao que entrou,
    incluindo campos que o motor não entende. Verificável: zerar a diferença dos dois JSON
    exceto pelos `baseColorFactor` tocados.
14. **`relatorioDeZonas3d`** devolve `{ zone_key, malhas: number }` por zona — quantas malhas o
    mapeamento resolve hoje. Zero é mapeamento quebrado e precisa aparecer como zero, não
    lançar.

### Processo

15. **Verificado por mutação.** No mínimo três, cada uma matando teste e restaurada — e a
    restauração conferida por `md5sum`, não por lembrança (aprendizado de 2026-09-10, arquivo
    novo é untracked e `git checkout --` não serve). Obrigatórias: (a) trocar a conversão sRGB
    por `c/255`; (b) forçar alfa `1`; (c) comparar sobreposição por nome de malha em vez de
    índice de material.
16. `npx tsc --noEmit` limpo, `npx vitest run` sem regressão, `npm run test:banco` verde.

## 5. Edge cases conhecidos

- **Primitiva sem material.** Não acontece em canônico (a normalização cria um), mas o motor
  recebe texto e não pode confiar. Decidir e escrever: recusa ou cria? Recusar é coerente com
  "o motor assume canônico" (a mesma regra que `gerarVarianteDeCor` já tem para o SVG).
- **`baseColorFactor` ausente** no material: o glTF permite, e o padrão é `[1,1,1,1]`. Escrever
  o campo do zero é correto — mas o alfa a preservar é o `1` do padrão, não `undefined`.
- **Duas zonas pedindo a mesma malha** com cores diferentes — caso direto do critério 11.
- **Pedido vazio** (`{}`): devolve o modelo inalterado, sem erro. É o mesmo que o SVG faz, e
  recusar seria transformar "nada a pintar" em falha.
- **Zona no banco cuja malha sumiu** porque o modelo foi renormalizado — o critério 8 é
  justamente a rede para isso, e é por isso que a mensagem precisa dizer **qual** nome faltou.
- **Cor no limite da faixa baixa** (`#010101`, cujo canal cai abaixo de `0.04045`): a curva ali
  é divisão por 12.92, não potência. É o critério 1.

## 6. Definição de "aprovado sem ressalvas"

Os 16 critérios em "sim"; `npx tsc --noEmit` limpo; `npx vitest run` e `npm run test:banco`
verdes; as três mutações do critério 15 executadas, cada uma matando teste, todas restauradas
com hash conferido; nenhum `console.log` esquecido; nenhum TODO sem justificativa escrita; e as
decisões dos edge cases "primitiva sem material" e "`baseColorFactor` ausente" **escritas no
código com o porquê**.

Se a rodada achar defeito de produto, ele vira linha em `memory/bugs.md` e correção no mesmo
commit — e o loop recomeça do `/review`.

---

## 7. Resultado da revisão — 2026-09-10

**Aprovado sem ressalvas.** Os 16 critérios em "sim"; `npx tsc --noEmit` limpo; `npx vitest run`
638/638 (eram 576 antes da entrega, 62 casos novos); `npm run test:banco` 48/48.

### A mutação que justifica o spec inteiro

O critério 2 previu, em palavras, que ida e volta sozinha não prova a conversão. A mutação
confirmou, em número:

| Mutação | O que quebrou |
|---|---|
| (a) as **duas** direções trocadas por `c / 255` | **2 testes**, e só eles. Os outros **55 passaram**, incluindo a varredura completa dos 256 cinzas e o recolor ponta a ponta |
| (b) forçar alfa `1` em vez de preservar | **1 teste**: a peça translúcida |
| (c) medir sobreposição por nome de malha em vez de índice de material | **1 teste**: duas zonas de nomes diferentes no mesmo material |

O resultado de (a) é o achado da rodada e merece ficar escrito: uma suíte de 57 casos, com
varredura exaustiva de um canal e teste de ponta a ponta, entregaria a cor errada. As duas únicas
asserções que percebem são as do bloco "o valor no meio", que afirmam que `#808080` vira `0.2159`
e que a faixa baixa usa a reta. Sem elas, o defeito mais caro do projeto passa verde.

Uma nota sobre a primeira tentativa de (a): mutei só a ida, e aí **16 testes** morreram, inclusive
os de ida e volta. É um resultado enganoso, porque o erro assimétrico é fácil de pegar. A mutação
que vale é a simétrica, que é também a que um humano escreveria de verdade ao "simplificar" a
conversão.

### Três desvios do spec

1. **`lerGltf.ts` não estava previsto.** A normalização já tinha o parser, e o motor precisava do
   mesmo. Duas cópias de "parse, e recuse se não for objeto" divergem em silêncio, e quando
   divergissem o normalizador aceitaria arquivo que o motor recusa. Extraí para um módulo, com
   `escreverGltf` junto, para o formato de saída dos dois ser o mesmo. `normalizarModelo3d.ts` foi
   religado a ele, sem mudança de comportamento (os 29 testes dele seguem verdes).
2. **A guarda de fonte me corrigiu no primeiro run.** `fixtures/gltfDeTeste.ts` escreve
   `baseColorFactor`, e eu o classificara como produção. É apoio de teste, existe justamente para
   isso, e nunca é importado por produção. A regra passou a excluir `fixtures/`, com o porquê
   escrito. Foi a guarda funcionando antes de existir defeito.
3. **`hexParaLinear` não aceita hex curto** (`#F00`). Quem expande é `validarCor`, e um lugar só.
   O spec não disse, e a alternativa (aceitar nos dois) criaria a segunda expansão.

### Decisões escritas no código, como o critério 6 exige

- **Primitiva sem material** → recusa `MODELO_3D_NAO_NORMALIZAVEL`. Criar o material aqui seria o
  motor normalizando por baixo do pano, o mesmo erro que o ADR-005 proíbe no editor.
- **`baseColorFactor` ausente** → cria com alfa `1`, que é o padrão do glTF 2.0, nunca `undefined`.
- **Sobreposição medida por índice de material**, não por nome de malha, porque num modelo não
  normalizado duas malhas de nomes diferentes dividem material e comparar nomes não veria nada.

### Pendência registrada, não esquecida

Onde a zona 3D é **gravada** continua em aberto: `product_zones.svg_selector` guarda lista de ids
CSS, e a zona 3D é lista de nomes de malha. Mesma coluna, coluna nova ou tabela nova é decisão de
schema, fora do escopo de uma rodada de função pura. Enquanto isso o motor recebe
`{ zone_key, malhas }` e não sabe de onde veio, que é como deve ser.
