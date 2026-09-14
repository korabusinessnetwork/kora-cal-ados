# Pendências do Matheus

Coisas que só você pode fazer. Ordem: da mais importante para a menos importante.

**Atualizado em 2026-09-10**: quatro pendências viraram decisão tomada e saíram desta lista. Ver
o rodapé, e o registro completo em `memory/restrictions.md`, `docs/08_DECISOES/adr-009-saida-do-cliente.md`
e `.full-auto/ESTADO.md`.

## P01 Instalar o hook de continuidade do Full Automático [RESOLVIDA em 2026-09-13]

- **Resolvida:** instalado a pedido seu com `instalar-hook.js . --com-protecoes`, a partir da cópia da skill que já estava no plugin. Um ajuste que o pacote não previa: o projeto é `"type": "module"`, e os scripts do hook usam `require`, então o Node recusava rodar. `.claude/hooks/package.json` com `"type": "commonjs"` resolve só para essa pasta, sem mexer nos scripts. Conferido: com `status: CONCLUIDO` o Stop hook libera, e numa cópia de rascunho com `EXECUTANDO` e uma tarefa `[ ]` ele bloqueia. Passa a valer depois de reiniciar a sessão.

O texto original fica abaixo, como histórico.


- **Por quê:** sem ele a execução não é de fato automática. O Stop hook é o que impede a sessão de encerrar enquanto houver tarefa pendente, e o vigia de limite é o que retoma sozinho quando o limite de uso volta. Sem os dois, cada retomada depende de você digitar.
- **Contorno atual:** a pasta de estado `.full-auto/` existe e é atualizada a cada tarefa. Se a sessão cair, a próxima lê `ESTADO.md` e continua do "próximo passo". O que se perde é a retomada sem você.
- **Passo a passo (PowerShell, na raiz do projeto):**
  1. `New-Item -ItemType Directory -Force .claude\skills | Out-Null`
  2. `tar -xf "$env:USERPROFILE\Downloads\full-automatico.skill" -C .claude\skills`
  3. `node .claude\skills\full-automatico\scripts\instalar-hook.js . --com-protecoes`
  4. Reiniciar a sessão, porque hook só carrega na abertura.
- **Por que eu não fiz:** três tentativas foram recusadas pelo classificador do modo automático. Escrever em `.claude/` instala um hook que impede a sessão de encerrar e um processo que relança `claude -p --permission-mode auto` a cada 10 minutos, ou seja, sem supervisão. Autorização no chat não passa por cima do classificador.
- **O que `--com-protecoes` faz:** nega `git push --force` e `git push -f`, e passa a pedir confirmação em `git push`, `supabase db push`, `vercel --prod` e `npm publish`. É a flag certa para rodar sem alguém olhando.
- **O que ler antes, se quiser conferir:** os quatro scripts do pacote foram lidos inteiros. Dois fatos que valem saber: o instalador escreve um `.worktreeinclude` que inclui `.env.local`, então a chave `service_role` passa a ser copiada para toda worktree criada (só local, nunca commitada); e `vigia-limite.js` relança o Claude com `--permission-mode auto`.
- **Como confirmar que funcionou:** `.claude/hooks/full-auto-stop.js` existe e `.claude/settings.json` tem o Stop hook.

## P02 Revogar a chave de API da passada dirigida [prioridade: alta]

- **Por quê:** a chave com prefixo `2aec9a55` no tenant `aurora-demo` continua **ativa**. Ela foi criada para a passada de `curl` da Fase 1 e não tem mais uso.
- **Passo a passo:** `npm run revogar-chave -- --prefixo 2aec9a55`
- **Como confirmar que funcionou:** a linha continua em `tenant_api_keys` com `revoked_at` preenchido, e um `curl` com ela passa a devolver 401.
- **Por que eu não fiz:** revogar é irreversível para quem estiver usando a chave, e o trabalho local ainda pode precisar dela. Quando você fechar o assunto, rode.

## P04 Apagar tenants de teste órfãos no Supabase real [RESOLVIDA em 2026-09-14]

- **Resolvida:** a listagem só de leitura achou mais do que o texto abaixo dizia: 20 tenants `marca-%` de 10 rodadas (as de 17:50, 18:09 e 18:17 UTC de 2026-09-12), 11 produtos em cascade, 26 usuários `@teste.kora` e 5 pastas em `assets-base/tenants/`. O Matheus confirmou no chat ("pode apagar") e eu apaguei exatamente essa lista, com ids e e-mails fixos: 5 de 5 arquivos, 26 de 26 usuários, 20 de 20 tenants. A 6ª pasta do bucket, que não é de teste, ficou.
- **Conferido:** a listagem de novo devolveu 0 tenants `marca-%` e 0 usuários `@teste.kora`; `npm run test:banco` passou 58 de 58, e depois dele a contagem continuou 0, então a limpeza dos testes está funcionando.

O texto original fica abaixo, como histórico.


- **Por quê:** uma rodada de `npm run test:banco` reprovou na limpeza (o `afterAll` de
  `exportarTenant.test.ts` estourava o teto de 10 s do vitest) e deixou o cenário dela no projeto
  real. O defeito do teste já está corrigido no commit `fix(teste): limpeza do teste de exportacao`,
  mas o lixo daquela rodada continua lá.
- **O que ficou:** 8 tenants com slug `marca-a-<8 hex>` e `marca-b-<8 hex>`, criados em
  2026-09-12 17:50 UTC: `c74282fe`, `e05f8690`, `4afaf21f`, `9383cb74` (um par de cada). Junto vão
  os produtos em cascade, os usuários `a-`, `b-` e `m-<hex>@teste.kora`, e os SVG que o cenário
  subiu em `assets-base/tenants/<id>/products/`.
- **Risco de deixar como está:** nenhum imediato. São fixtures com slug aleatório, isolados por RLS
  como qualquer tenant, e não aparecem em tela nenhuma do produto. O incômodo é acumular a cada
  rodada que reprovar no meio.
- **Por que eu não fiz:** apagar linha em banco real é ação irreversível e sobre dado real. Escrevi
  a faxina, e o classificador do modo automático recusou executá-la, que é o comportamento certo
  dele. Não contornei.
- **Passo a passo:** a limpeza é a mesma que `limpar()` faz em toda rodada verde, restrita ao padrão
  do slug. Se você quiser rodar, o caminho curto é pelo painel do Supabase: em **Table editor,
  tenants**, filtrar `slug` por `like marca-%`, conferir que são só os 8 acima e apagar; depois em
  **Authentication, Users**, buscar `@teste.kora` e apagar; e em **Storage, assets-base**, remover
  as pastas `tenants/<id>` dos 4 pares.
- **Como confirmar que funcionou:** `select count(*) from tenants where slug like 'marca-%'` devolve
  0, e `npm run test:banco` continua 58 de 58.

## P05 Aplicar a migration dos dois índices no Supabase real [prioridade: média]

- **Por quê:** `supabase/migrations/20260912_indice_em_chave_estrangeira.sql` está escrita e
  conferida, mas migration só vale quando roda. Enquanto ela não rodar,
  `auth_tenant_ids()` continua varrendo `tenant_members` inteira em toda leitura autenticada de
  toda tabela, que é o custo descrito no A53 em `AUDITORIA.md`.
- **Passo a passo:** abra o SQL Editor do projeto no painel do Supabase, cole o conteúdo do
  arquivo e rode. São duas linhas de `create index if not exists`, o resto é comentário.
- **Como confirmar que funcionou:** no mesmo SQL Editor,
  `select indexname from pg_indexes where tablename in ('tenant_members','tenant_api_keys');`
  precisa trazer `tenant_members_user_id_idx` e `tenant_api_keys_created_by_idx` na lista.
- **Risco de deixar como está:** nenhum de correção, só de custo, e hoje o custo é invisível
  porque a base é pequena. Ele cresce com o total de usuários de TODOS os tenants somados, não com
  o tamanho de cada um, então é o tipo de conta que só aparece quando já está cara.
- **Por que eu não fiz:** aplicar DDL no banco real é mudança em dado real, e isso é decisão sua
  pelo filtro de escalação. Vale dizer que esta é aditiva e reversível (`drop index` desfaz, e
  nenhuma linha é tocada), diferente das outras pendências desta lista. O `if not exists` deixa
  rodar duas vezes sem erro.

## P06 Escolher o fornecedor do modelo de linguagem de verdade para o prompt [prioridade: média, decisão paga]

- **Por quê:** o prompt da tela da composição funciona de ponta a ponta, mas quem responde hoje é o gerador de prova, que não é IA e só reconhece palavras-chave (D12). A tela diz isso com todas as letras. Para o prompt entender frase livre, precisa de um modelo de linguagem de verdade, e todo fornecedor cobra por uso.
- **Contorno atual:** `src/lib/composicao/modeloDeLinguagemDeProva.ts`, ativo por padrão, custo zero. A tela recebe o modelo por parâmetro (`TelaDaComposicao.tsx`, no `<PainelDePrompt modelo=... descricao=...>`), então trocar é mudar essa linha.
- **O que você decide:** qual fornecedor, e o teto de gasto por mês.
- **O que precisa ser construído depois da decisão (eu faço):** uma função serverless na Vercel que recebe o prompt, exige sessão autenticada, limita pedidos por tenant, e chama o fornecedor com a chave guardada em variável de ambiente do servidor, SEM prefixo `VITE_`, porque chave com `VITE_` vai parar no navegador de qualquer visitante. No front, um adaptador que implementa `ModeloDeLinguagem` chamando essa função, e a descrição `{ ehIa: true, nome: '...' }` para o aviso de transparência passar a dizer que é IA.
- **Onde colar o resultado:** a chave no painel da Vercel, em Settings, Environment Variables, com um nome sem `VITE_` (sugestão: `CHAVE_DO_MODELO_DE_LINGUAGEM`). Nunca no `.env` versionado nem no chat.
- **Como confirmar que funcionou:** em `?tela=composicao`, a ajuda do painel diz "um modelo de linguagem (IA)", e uma frase sem nenhuma palavra-chave ("um tênis para correr no frio") monta um calçado diferente do padrão. No DevTools, aba Network, nenhuma resposta nem pedido do navegador contém a chave.

## P03 Normalizar o travessão no repositório inteiro [prioridade: baixa]

- **Por quê:** sua regra é não usar travessão em português. O repositório inteiro usa, porque foi escrito antes de a regra entrar. Aplicá-la só em arquivo novo cria inconsistência num projeto cuja tese é justamente consistência para agentes.
- **Contorno atual:** todo texto novo sai sem travessão a partir de 2026-09-10 (o ADR-009 é o primeiro). O acervo antigo fica como está.
- **Decisão sua:** normalizar tudo num commit de estilo, ou deixar o antigo em paz e seguir só daqui para frente. É mudança mecânica em muitos arquivos, então merece commit próprio e nenhuma mudança de conteúdo junto.

---

## Resolvidas em 2026-09-10

| Era | Decisão | Onde ficou registrada |
|---|---|---|
| O acervo, as ~15 peças | Acervo de prova em geometria grosseira primeiro, para provar a esteira antes de investir em modelagem | `memory/restrictions.md`, tabela de itens pagos |
| A dependência paga recorrente | Adiada. O configurador vem primeiro e custa zero, que é a ordem do próprio ADR-008 | `memory/restrictions.md`, tabela de itens pagos |
| Onde a zona 3D é guardada | Não guardar. No modo gerado a zona vem da composição, cada peça é uma zona | `.full-auto/TAREFAS.md`, sem tarefa por decisão |
| O que o cliente leva ao sair | Saída completa em formato aberto, com o limite do acervo base dito de frente | `docs/08_DECISOES/adr-009-saida-do-cliente.md` |
