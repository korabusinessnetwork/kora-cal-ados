# Relatório final do Full Automático

**Projeto:** Kora Calçados (codinome)
**Período:** 2026-09-10 a 2026-09-12
**Plano de origem:** ADR-007 + ADR-008 + `docs/09_BACKLOG/features.md` (ver D01 em `DECISOES.md`)
**Branch:** `main`, 4 commits nesta execução, todos verificados antes de entrar

---

## 1. Em uma frase

A esteira do ADR-008 está provada de ponta a ponta: **dá para montar um calçado escolhendo peça,
cor e medida numa tela, ver o resultado em 3D, e a cor que aparece é a cor que foi pedida**, com um
teste automático que mede isso no pixel e não no arquivo. E a marca que quiser sair leva o que é
dela num zip que qualquer programa abre.

## 2. Como rodar

```bash
npm install && npm run dev
```

Depois abrir <http://localhost:5173/?tela=composicao>. Nenhuma chave, nenhuma conta, nenhum banco:
essa tela roda sozinha.

As outras portas de entrada:

| Endereço | O que é |
|---|---|
| `?tela=composicao` | O configurador 3D, o produto desta fase |
| `?tela=palco3d` | Uma peça só, para inspecionar geometria |
| `?tela=esboco` | O motor 2D e a chamada equivalente da API |
| `/` sem parâmetro | O editor de zonas, pede login |

Comandos de verificação:

```bash
npm test            # 1047 testes, ~50 s
npm run test:banco  # 58 testes contra o Supabase real, precisa de .env.local
npm run typecheck   # limpo
npm run build       # limpo
```

## 3. O que ficou pronto nesta execução

| # | Entrega | Prova |
|---|---|---|
| T01 | Normalização de modelo 3D: nome e material próprios por malha | 576 testes, 3 mutações |
| T02 | Motor de cor 3D, a conversão sRGB para linear num lugar só | 638 testes |
| T03 | Termos do ADR-008 no glossário, antes do código | commit `5cebbe5` |
| T04 | `validarComposicao`, o guarda da saída do modelo de linguagem | 699 testes, 5 mutações |
| T10 | Typecheck de `supabase/scripts/` | já estava resolvida, pendência vencida |
| T11 | ADR-009, a política de saída do cliente | commit `93c356a` |
| T12 | Acervo de prova: 5 peças em glTF 2.0 gerado por código | validador da Khronos, 0 erro e 0 aviso |
| T13 | Palco 3D no navegador, peça identificada por clique | conferência a olho aprovada pelo dono |
| T14 | Calçado montado em cena, cada peça no lugar | 47 mutações, 46 mortas, 3 sondas independentes |
| T15 | O configurador, sem IA nenhuma | conferido em navegador nos dois sentidos da troca |
| T16 | A saída do cliente em zip, e o teste da zona marcada | 10 testes de banco, 2 leitores de terceiro |
| T17 | A conferência a olho virando teste permanente | 25 testes, mede a cor no framebuffer |

### O número que importa

**1047 testes na suíte** (eram 576 no começo desta execução), **58 contra o banco real**, typecheck
limpo, build limpo, **zero dependência nova em todo o período**.

## 4. As três coisas que valem mais do que a lista

### O princípio nº1 deixou de ser vigiado por fé

Até 2026-09-11 este projeto tinha centenas de testes sobre cor, e **nenhum deles olhava para um
pixel**. Todos conferiam o número escrito no glTF, e entre esse número e o que uma pessoa enxerga
ainda estavam a conversão de sRGB para linear e o renderizador. "Não dá para testar 3D" era verdade
sobre o jsdom, não sobre a máquina: há Chrome instalado, ele roda WebGL por software em modo
headless, e o Node 24 fala o protocolo de DevTools sem dependência nenhuma. Agora a cor é medida.

### Uma mutação sobrevivente valeu mais do que cinco testes verdes

A primeira régua de cor comparava só o matiz. Quebrar de propósito a conversão de sRGB para linear,
que é literalmente o defeito que o princípio nº1 existe para vigiar, **passou pelos cinco testes**:
o matiz do cabedal andou 8°, exatamente a folga. A saturação, no mesmo par de rodadas, caiu de
0,769 para 0,537. O eixo novo entrou por causa disso, e a folga dele é só para baixo, porque luz
difusa multiplica os canais e erro de gama aplica uma curva. Está em D06 e em `specs/cor-na-tela.md`.

O mesmo aconteceu em T16, em escala menor: devolver `rendered_path` no `select` passava por tudo,
porque a montagem do pacote reescolhe os campos depois. A defesa estava lá, mas não estava onde o
comentário do arquivo prometia que estava.

### A resposta para "e se eu quiser sair?" existe e roda

`npm run exportar-tenant -- --slug <slug>` produz o pacote do ADR-009. Rodado contra o projeto real:
4,0 kB, 1 produto, 6 zonas, aberto por dois leitores de ZIP que não são nossos. Numa venda B2B essa
pergunta é feita antes da assinatura, e agora ela tem demonstração em vez de cláusula.

## 5. O que está mockado ou simulado, dito de frente

| O quê | Situação real |
|---|---|
| **O acervo de peças 3D** | São 5 peças de **geometria grosseira geradas por código**, não modelos de calçado. Servem para provar a esteira, não para vender. O acervo de verdade é trabalho de modelagem e continua adiado por decisão (T12 e `memory/restrictions.md`) |
| **O prompt em linguagem natural** | Não existe. Foi trocado pelo configurador, que faz o mesmo trabalho sem custo de IA (T09, adiada por decisão sua de 2026-09-10) |
| **A composição 3D no banco** | Não é gravada. A tela monta e a API recebe; não há tabela, por decisão (ADR-008 D6) |
| **A migration de chaves de API** | `20260908_chave_de_api_por_tenant.sql` está escrita e revisada, **não aplicada em banco nenhum**. Os scripts de chave falham até ela rodar |
| **O hook de continuidade** | Não instalado. Ver P01 |

Nada aqui é mock escondido: os três primeiros são decisões registradas, e os dois últimos são
pendências suas.

## 6. Suas pendências, em ordem

1. **P02, revogar a chave `2aec9a55` do `aurora-demo`** — `npm run revogar-chave -- --prefixo 2aec9a55`.
   Continua ativa. Não fiz porque revogar é irreversível.
2. **P01, instalar o hook de continuidade** — recusado três vezes pelo classificador do modo
   automático, e vale você saber por quê antes de instalar: o instalador escreve um
   `.worktreeinclude` que copia `.env.local` (com a `service_role`) para toda worktree, e o vigia
   relança o Claude com `--permission-mode auto`. A leitura completa está em P01.
3. **Aplicar a migration `20260908`** quando for usar chave de API, e atualizar `schema.sql` no
   mesmo commit.
4. **P03, o travessão no acervo antigo** — decisão de estilo, sem pressa.

Detalhes e passo a passo em `.full-auto/PENDENCIAS-DO-MATHEUS.md`.

## 7. O que NÃO foi feito, e por quê

- **T05, T06 e T09 continuam `[!]`**, adiadas por decisão sua, não por bloqueio técnico. T09 (o
  prompt) tem custo recorrente de IA; T05 formata catálogo para um leitor que foi adiado; T06 é
  schema para dado que ainda não existe.
- **A exclusão de dados do ADR-009 não foi construída** (D09). Exportar e excluir são separados de
  propósito, e um script que apaga tenant, num repositório tocado por agentes, é um gatilho no chão.
  Ele nasce quando houver um cliente cancelado de verdade.
- **A geometria em pixel não é testada.** "A sola está embaixo do cabedal" tem prova melhor no nível
  do glTF, e medir encaixe num render em perspectiva confundiria sobreposição com peça enterrada.

## 8. Fragilidade conhecida da suíte

O teste de navegador é o mais lento e o mais frágil, e some em silêncio numa máquina sem Chrome.
**Uma suíte verde não prova que a cor foi medida**; prova que nada do que rodou reprovou. Quem
quiser a garantia roda `npm run test:navegador` e confere que apareceram 5 testes, não 0.

Se um dia ele reprovar sem ninguém ter mexido em cor, o primeiro suspeito é uma atualização do
Chrome mudando o renderizador por software. A resposta certa é **remedir as duas versões**, nunca
afrouxar a folga no escuro.

## 9. Verificação final, feita hoje

| Passo | Resultado |
|---|---|
| Instalação limpa a partir do lockfile (`npm ci` num clone novo) | 9 s, sem erro |
| `npm audit` | tinha 2 avisos moderados no vitest; corrigido para 4.1.11 e reconferido, **0 avisos** |
| `npx tsc --noEmit` | limpo |
| `npm run build` | limpo (aviso de chunk > 500 kB é o three.js, conhecido) |
| `npm test` | 1047 passando, 58 pulados (os de banco, sem `.env.local`) |
| `npm run test:banco` | 58 de 58 contra o Supabase real |
| App rodando, fluxo principal | percorrido em navegador de verdade, ver abaixo |

O fluxo percorrido à mão, em `?tela=composicao`: o calçado apareceu montado (sola branca embaixo,
cabedal azul, cadarço amarelo em cima); trocar "Cabedal baixo" por "Cabedal cano alto" trocou a peça
na cena **sem apagar a tela** e trouxe o parâmetro próprio da peça nova, 140,0 mm no lugar de 75,0
(o conserto do BUG-019 de pé); clicar na peça devolveu `prova-cabedal-cano-alto`; e pintar o cabedal
de `#C0392B` deixou **a sola branca e o cadarço amarelo intactos**. A tela `?tela=esboco` também
abre e mostra as 9 zonas do tênis de demonstração.

---

## 10. Sugestão de próximo passo

O configurador é produto vendável hoje, sobre um acervo que não é vendável. **O gargalo virou
modelagem, não código.** A decisão que destrava a próxima fase é sua e é de investimento: 15 peças
de uma forma de calçado real, feitas por alguém que modela. Enquanto isso não existir, qualquer
código novo no rumo 3D é refinamento de uma esteira que já está provada.

O caminho barato, se quiser adiar a modelagem mais um pouco, é o outro lado do produto: aplicar a
migration de chaves de API e fechar a Fase 1 comercial, que roda sobre o acervo 2D que já existe e
não depende de artista nenhum.
