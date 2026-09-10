# ADR-009: Saída do cliente, o que a marca leva embora, e o que fica

**Status**: Aceito
**Data**: 2026-09-10
**Decisores**: Matheus Bonato
**Supersede**: (nenhum)
**Supersedido por**: (nenhum)

> Nota de escrita: este arquivo segue a regra do dono de não usar travessão em português. Os
> ADRs anteriores usam, e a diferença é só de estilo, não de conteúdo.

---

## Contexto

O produto é B2B vendido por contrato, e marcas concorrentes convivem no mesmo sistema. Numa
venda assim, "o que eu levo embora se eu cancelar" é pergunta que o comprador faz **antes** de
assinar, não depois. Até hoje nenhum ADR respondia.

Havia só uma linha solta em `memory/restrictions.md`, na tabela de compliance: "Retenção de
dados: 90 dias máx logs, 2 anos máx operacionais, cliente pode exportar/excluir sempre". É
promessa de conformidade, não desenho de produto, e ninguém tinha escrito o que "exportar"
significa aqui: quais arquivos, em que formato, e sobretudo **o que não sai**.

A pergunta ficou madura agora porque o ADR-008 introduziu o **acervo**, e o acervo é a primeira
coisa deste sistema que **não é da marca**. Antes do acervo, tudo que existia num tenant tinha
sido subido por ele. Depois do acervo, um calçado gerado depende de peças que são da Kora, e
aí "levar embora" deixa de ser uma resposta óbvia.

### A arquitetura já tornou a resposta barata, e isso decidiu o tom

O sistema **guarda receita, nunca resultado**. Uma variante é `zone_colors` sobre um canônico,
não um SVG gravado (ADR-004). Um calçado gerado é uma composição sobre o acervo, não uma malha
gravada (ADR-008 D2). Consequência direta: o que existe para exportar é o arquivo que a própria
marca subiu mais alguns JSONs pequenos. Não há pipeline de exportação a construir, há um zip.

Quando a saída generosa custa quase nada e vale numa conversa de venda, ser mesquinho nela é
pagar caro por pouco.

---

## Decisão

### D1. Tudo que é da marca sai, em formato aberto

Um tenant que encerra leva:

| O que | Formato | Por quê |
|---|---|---|
| Asset-base canônico de cada produto | o próprio SVG ou glTF | É o arquivo dela, normalizado. O canônico e não o cru, porque é sobre ele que as zonas fazem sentido |
| Zonas de cada produto | JSON com `zone_key`, rótulo e seletor | É o trabalho de marcação do time dela, e é a parte cara de refazer |
| Composições dos produtos gerados | JSON | A receita completa: peças, cores, parâmetros |
| Histórico de variantes | JSON com as cores por `zone_key` | Receita, não arquivo renderizado. Ver D3 |
| Peças do acervo **do tenant** | glTF | Peças que a própria marca subiu são dela, sem discussão (ADR-008 D6) |

Nada de formato proprietário e nada que exija a Kora para ser lido. SVG, glTF e JSON abrem em
qualquer lugar.

### D2. O acervo base da Kora não sai, e isso é dito de frente

As peças que a Kora modelou ou licenciou continuam sendo da Kora. Uma composição exportada sai
referenciando ids de peça, e sem as peças ela não monta em lugar nenhum fora daqui.

Isto é lock-in real, e é precisamente por ser real que precisa estar escrito no ADR e no
contrato. Uma cláusula de "saída completa" que na prática entrega uma receita cujos
ingredientes ficam conosco seria promessa falsa, e o comprador descobre no pior momento.

O que suaviza, e que também vai por escrito: **produto trazido não tem essa dependência**. A
marca que subiu o próprio arquivo leva tudo e monta em qualquer lugar. A dependência do acervo
existe só no modo gerado, e é o preço de não ter precisado modelar nada.

### D3. Variante sai como receita, não como imagem

O histórico de variantes sai em JSON com as cores por zona, não como uma pasta de PNG ou SVG
renderizados. O motivo é o mesmo que fez a tabela `variants` não guardar resultado: gerar é
barato e determinístico, guardar é caro e envelhece.

A marca que quiser os arquivos prontos os gera pela API **antes** de encerrar, com a chave que
ela ainda tem. Isso fica na checklist de encerramento, não numa nota de rodapé, porque é a
única parte da saída que tem hora certa para acontecer.

### D4. Enquanto não houver tela, a saída é script

Exportação é operação rara e de dono, então segue o mesmo padrão do provisionamento de tenant e
da criação de chave de API: um script em `supabase/scripts/`, rodado por nós, não uma tela.
Construir UI para uma operação que acontece uma vez por cliente cancelado é investir no lugar
errado.

Quando houver self-serve (Fase 3), a exportação vira botão junto com o resto.

### D5. Exclusão é separada da exportação, e é irreversível

Exportar e apagar são duas operações, nunca uma. O cliente exporta, confere o que recebeu, e só
então pede a exclusão. Juntar as duas num passo só criaria o caso em que o zip saiu corrompido
e o dado já não existe.

A exclusão apaga o tenant e tudo sob ele, inclusive as peças do acervo próprio dele. Não apaga
o acervo base, que não é dele.

---

## Alternativas Consideradas

### 1. Saída mínima: devolver só o arquivo que a marca subiu

- **Prós**: retenção maior, e é defensável ("o trabalho de marcação foi feito na nossa
  ferramenta")
- **Contras**: as zonas são a parte cara de refazer, e reter exatamente a parte cara é o tipo de
  cláusula que um comprador atento percebe na leitura do contrato e usa para pedir desconto, ou
  para não assinar
- **Descartado porque**: economiza quase nada de implementação, já que os JSONs são minúsculos,
  e custa caro em confiança num mercado onde concorrentes convivem no mesmo sistema

### 2. Lock-in deliberado: sem exportação

- **Prós**: estratégia real e usada; aumenta o custo de troca
- **Contras**: contradiz a linha de retenção que já está em `memory/restrictions.md`, e
  contradiz o tom do resto da documentação. Pior: num sistema em que marcas concorrentes
  coabitam, o comprador desconfiado é o comportamento **esperado**, não a exceção
- **Descartado porque**: empurra o cliente cauteloso para o concorrente antes de ele testar o
  produto

### 3. Adiar até o primeiro contrato pedir

- **Prós**: economiza uma tarde hoje
- **Contras**: obriga a decidir política de saída no meio de uma negociação, com o cliente
  esperando, que é o pior momento possível. E a resposta improvisada vira precedente
- **Descartado porque**: a decisão é barata agora e cara depois, que é a definição de decisão
  que se toma cedo

---

## Consequências

### Positivas

- **Vira argumento de venda**, e um que o concorrente médio não tem: "você leva o seu arquivo,
  as suas zonas e o seu histórico, em formato aberto"
- **Custa quase nada** porque a arquitetura já guarda receita. É um script de zip, não um
  projeto
- **Fecha a lacuna de compliance** que estava aberta: a linha de retenção de
  `restrictions.md` agora tem um documento dizendo o que ela significa na prática
- **O limite do lock-in fica explícito**, então ninguém promete em venda o que o sistema não faz

### Negativas / Trade-offs

- **O acervo base é lock-in de verdade** no modo gerado, e assumi-lo por escrito significa que
  ele aparece na mesa de negociação. Preferível a ele aparecer depois
- **Variante não sai renderizada** (D3), então existe um passo com hora certa no encerramento.
  Se o cliente perder esse passo, ele fica com as receitas e sem as imagens
- **Um script a manter** que roda raramente, e código que roda raramente é código que
  apodrece sem ninguém notar. Precisa de teste, como o resto

---

## Notas de Implementação

- O script vive em `supabase/scripts/exportarTenant.ts`, junto com `provisionarTenant.ts`, e
  usa `service_role` pelo mesmo caminho que os outros
- Nada de `select *`: campos explícitos, como manda o CLAUDE.md, e a lista de campos exportados
  é decisão consciente, não "tudo que a tabela tiver"
- O teste que importa não é "o zip foi gerado": é **o zip contém uma zona que foi marcada**, ou
  seja, semear, exportar, e conferir que a `zone_key` está lá
- A checklist de encerramento (inclusive o passo de gerar as variantes antes) vira documento em
  `docs/05_FLUXOS/`, porque é fluxo operacional e não arquitetura
- Este ADR não é implementado ainda. Ele existe para a resposta estar pronta antes da pergunta

---

## Referências

- `memory/restrictions.md`, a linha de retenção de dados que este ADR passa a explicar
- `docs/08_DECISOES/adr-008-calcado-gerado-sobre-acervo-de-pecas.md`, D6 (acervo do tenant é
  privado) e D2 (composição é receita), que são o que torna esta decisão barata e o que cria o
  único lock-in real
- `docs/08_DECISOES/adr-004-contrato-de-zona-e-normalizacao-de-svg.md`, a decisão de guardar
  receita e não resultado
- `docs/08_DECISOES/adr-002-multi-tenant-white-label.md`, o isolamento entre concorrentes que
  torna a desconfiança do comprador esperada
