# F001 — Leitura do asset-base por URL assinada e tela de produto

> Rodada 2 do loop. Ledger: `specs/_loop.md`.

## 1. Escopo

Ler de volta o SVG canônico que o upload gravou no Storage — validando que o caminho
pertence ao tenant do chamador — e exibi-lo na tela quando o time seleciona um modelo do
catálogo.

## 2. Fora de escopo

- **Marcação de zona / Fabric.js** — é F002. Nada de `product_zones` aqui.
- **Preview de variante / recolor na tela** — é F003.
- **`react-router-dom` e `vercel.json`.** O app é de tela única e `docs/01_ARQUITETURA/infra.md`
  registra que `vercel.json` só é necessário quando existir rota client-side — instalar roteador
  para uma tela é peso sem uso. Seleção de produto por estado local; roteamento entra com
  F009/F010, quando houver mais de uma tela para endereçar.
  *(TD003 deixou de pesar aqui: o dono decidiu em 2026-08-14 ficar no plano gratuito durante a
  construção e migrar para o pago quando a venda começar — `memory/decisions.md`. A exclusão
  se sustenta sozinha pelo argumento de tela única.)*
- **Editar/excluir produto** — é F010.
- **Re-normalização no servidor** — é TD001, depende da rodada 3 existir.
- **Trava de `file_size_limit`/`allowed_mime_types` no bucket** — parte de TD001; aqui a
  defesa é renderizar de forma script-inerte, não confiar no conteúdo.

## 3. Origem e decisões que este item honra

- **Backlog**: F001. **O identificador não existe no repositório** — o esquema `F0XX`/`TD0XX`
  nasceu no raio-x de 2026-08-14 e só está registrado em `specs/_loop.md`. O `/aprender`
  precisa cadastrá-lo em `docs/09_BACKLOG/` (parte de TD012).
- **`memory/decisions.md:120`** — "URL assinada 300s", decidido em 2026-08-12, aguardando
  execução. Esta rodada é a execução.
- **ADR-002** (multi-tenant white-label) — o isolamento do asset-base é requisito comercial.
- **`docs/11_SEGURANCA/multi-tenancy-rls.md`** — bucket privado, path particionado por tenant,
  acesso só por URL assinada.
- **CLAUDE.md, princípio nº1** — honrado de forma indireta: esta rodada **não** prova "cor no
  editor = cor na API"; constrói a superfície sem a qual essa prova não tem onde acontecer.
- **Critérios 8, 11 e 19 da rodada 1** (`specs/fase-1-rodada-1-fundacao-do-app.md`) foram dados
  como atendidos sem consumidor em código. Esta rodada os torna verdadeiros.

## 4. Arquivos afetados

**Novos**
- `src/features/produtos/hooks/leituraDeAssetBase.ts` — validador de caminho + URL assinada
- `src/features/produtos/hooks/leituraDeAssetBase.test.ts`
- `src/features/produtos/hooks/useAssetBase.ts` — os quatro estados da leitura
- `src/features/produtos/components/VisualizadorDeAssetBase.tsx` — apresentacional puro
- `src/features/produtos/components/VisualizadorDeAssetBase.css`
- `src/features/produtos/components/VisualizadorDeAssetBase.test.tsx`

**Modificados**
- `src/features/produtos/components/ListaDeProdutos.tsx` / `.css` — item vira selecionável
- `src/App.tsx` / `src/App.css` — estado de seleção e montagem do visualizador
- `src/features/produtos/README.md` — índice do diretório

### Desenho obrigatório (as três correções do painel adversarial)

**a) Validar o caminho gravado, nunca remontá-lo.** `products.base_asset_path` já guarda o
caminho canônico escrito por `enviarAssetBase` (`uploadDeAssetBase.ts:56`). Remontar na leitura
criaria duas fontes de verdade que divergem em silêncio. A leitura recebe o caminho do banco e
**valida** que ele começa com `tenants/{tenantId}/products/`. Isso cobre **TD002**: a coluna é
`text` livre, sem check no banco ligando o path ao `tenant_id` da própria linha — hoje quem
segura é só a policy de Storage, que a função serverless da rodada 3 vai ignorar ao usar
`service_role`.

**b) Cliente Supabase por parâmetro, nunca `import` do singleton.**
`src/lib/supabase/cliente.ts` é anon-key e dá `throw` no carregamento sem `VITE_*` — a função
serverless da rodada 3 roda em Node com `service_role` e não pode importá-lo. Se este módulo
importar o singleton, a rodada 3 escreve a própria leitura e o TTL e a validação de path
divergem entre editor e API: a mesma divergência que o princípio nº1 proíbe, na camada de
leitura em vez da de cor. O módulo declara a interface mínima de que precisa e recebe o cliente.

**c) Render script-inerte.** É o primeiro código do projeto a exibir SVG de terceiro no
navegador. `normalizarSvg` roda só no cliente de quem sobe, e o bucket foi criado sem
`file_size_limit`/`allowed_mime_types` (`20260812_correcao_rls_e_storage.sql:134`), então SVG
não sanitizado pode já estar gravado. `<img src={urlAssinada}>` não executa script embutido;
`dangerouslySetInnerHTML` traria **BUG-004** de volta antes da rodada 3 (**TD001**, **TD017**).

## 5. Critérios de aceite

1. `leituraDeAssetBase.ts` **não** importa `src/lib/supabase/cliente` — o cliente chega por
   parâmetro, tipado por uma interface mínima declarada no próprio módulo.
2. `validarCaminhoDeAssetBase` **recusa** caminho cujo segmento de tenant não é o tenant do
   chamador, com erro de mensagem estável em português.
3. Recusa também caminho malformado: sem o prefixo `tenants/`, com `..`, com segmento vazio,
   ou com profundidade diferente da canônica.
4. O TTL de 300s vive em **uma** constante exportada; nenhum literal `300` solto no módulo.
5. Nenhum `dangerouslySetInnerHTML` em todo o `src/` — o SVG é exibido por `<img src>`.
6. O visualizador renderiza explicitamente os quatro estados (`carregando`, `erro`, `vazio`/
   nenhum selecionado, `pronto`), nenhum deles como tela em branco.
7. O CSS novo fica em arquivo próprio, usa só token de tema (`var(--…)`), sem cor hardcodada.
8. Nenhuma consulta nova com `select *`; nenhum segredo hardcodado.
9. Erro de leitura vira mensagem em português com botão de tentar de novo — nunca `console` e
   nunca tela branca.
10. Testes novos cobrem: validador de caminho (caso feliz + 4 recusas), tradução de erro do
    Storage, e render dos quatro estados do visualizador.
11. O teste de render prova a inércia: a saída contém `<img` e **não** contém `<svg` inline.
12. `npm test` verde com os 47 casos existentes mais os novos; `npm run build` e
    `npm run typecheck` sem erro.
13. `react-router-dom` ausente do `package.json` e `vercel.json` inexistente.
14. Sem `TODO` pendente e sem `console.log` esquecido.
15. Nenhum nome, cor ou regra de cliente específico no código (white-label).
16. `src/features/produtos/README.md` atualizado com os arquivos novos.

## 6. Edge cases conhecidos

- **Nenhum produto selecionado** — estado próprio com instrução ("selecione um modelo"), não
  espaço vazio.
- **URL expirada (300s)** — a URL é gerada na seleção; reselecionar gera outra. Não há cache de
  URL entre sessões.
- **Arquivo removido do Storage** — `createSignedUrl` devolve erro; vira mensagem específica.
- **Caminho legado fora do formato canônico** — validador recusa e explica, em vez de pedir uma
  URL que a policy negaria de qualquer jeito.
- **Troca de tenant no meio da sessão** — a validação usa o tenant corrente, então caminho do
  tenant anterior é recusado.
- **`base_asset_path` vazio** — a coluna é `NOT NULL`, mas string vazia passa; validador recusa.
- **Seleção trocada durante o carregamento** — a resposta que chega atrasada não pode sobrescrever
  a seleção nova.

## 7. Definição de "aprovado sem ressalvas"

Todos os critérios de aceite em sim, suíte de testes verde, sem TODO pendente, sem `console.log`
esquecido e sem regressão nos fluxos existentes (login, cadastro de produto, upload, tema).

## 8. Resultado da review (2026-08-14)

**Aprovado.** Veredito final do painel: **24 sim / 3 parcial / 0 não**. Dos 5 negativos da
primeira passada, 4 foram refutados na verificação adversarial e **1 confirmado por mutação**.

Prova de fechamento: `npm test` **66 casos em 7 arquivos, verde**; `npm run typecheck` sem erro;
`npm run build` sem erro (427,80 kB / 123,82 kB gzip).

### Defeitos encontrados e corrigidos dentro da rodada

1. **Import transitivo do cliente do navegador.** `leituraDeAssetBase.ts` importava
   `BUCKET_DE_ASSETS` de `uploadDeAssetBase.ts`, que importa o singleton anon-key: o módulo
   ficava impossível de carregar em Node (`TypeError: … reading 'VITE_SUPABASE_URL'`) — ou seja,
   o critério 1 estava atendido na letra e violado no efeito. Corrigido com o módulo folha
   `bucketDeAssets.ts` e travado por teste estático do grafo de imports. Provado fora do vitest,
   com as `VITE_*` desligadas.
2. **Travessia percent-encoded aceita** (BUG-011). `%2e%2e%2f` passava: sem `..` literal, sem
   barra, 5 segmentos, prefixos certos. Corrigido trocando a blacklist por whitelist de forma
   por segmento (`/^[A-Za-z0-9._-]+$/`), que absorve também a checagem de segmento vazio.
3. **`base_asset_path` vazio caía no estado errado.** O guarda falsy mandava para `nenhum`, então
   quem clicava no modelo lia "Selecione um modelo" — edge case 6.6 do spec, invertido. Corrigido
   com `caminho === null` e com mensagens distintas para arquivo ausente × marca ausente.
4. **Teste de guarda que passava sem exercer a guarda.** "recusa travessia de diretório" usava
   caminho de 7 segmentos: a profundidade reprovava sozinha, e apagar a guarda de `..` deixava a
   suíte verde. Corrigido com um caso de profundidade canônica (`tenants/{t}/products/../base.svg`),
   verificado por mutação.

### Os 3 "parcial" — limites conhecidos, aceitos nesta rodada

- **Edge case 6.2 (URL expirada)** — a URL é gerada na seleção e reselecionar gera outra, mas não
  há re-assinatura automática nem `onError` no `<img>`: com a tela aberta além dos 5 minutos, uma
  nova requisição da imagem falha sem cair no estado de erro. Mitigação atual é a legenda que
  avisa o prazo. Re-assinar sob demanda entra com F002, que vai manter o desenho na tela por mais
  tempo.
- **Edge case 6.3 (arquivo removido do Storage)** — vira mensagem de erro com botão de tentar de
  novo, mas **não** uma mensagem específica: toda falha do Storage é traduzida para o mesmo texto.
  É deliberado — a mensagem crua pode carregar caminho de outro tenant, e repassá-la é vazamento
  (TD015). Distinguir "arquivo sumiu" de "falha temporária" exige código de erro estável do
  Supabase, o que fica para quando F005 definir o envelope.
- **Disciplina de escopo** — `src/features/produtos/hooks/bucketDeAssets.ts` não estava na seção 4:
  nasceu da correção do defeito 1. Fora isso, nenhum arquivo além da lista foi tocado e nada da
  seção "fora de escopo" foi implementado (`react-router-dom` e `vercel.json` seguem inexistentes).
