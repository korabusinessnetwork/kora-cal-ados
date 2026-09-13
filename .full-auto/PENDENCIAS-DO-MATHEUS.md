# Pendências do Matheus

Coisas que só você pode fazer. Ordem: da mais importante para a menos importante.

**Atualizado em 2026-09-10**: quatro pendências viraram decisão tomada e saíram desta lista. Ver
o rodapé, e o registro completo em `memory/restrictions.md`, `docs/08_DECISOES/adr-009-saida-do-cliente.md`
e `.full-auto/ESTADO.md`.

## P01 Instalar o hook de continuidade do Full Automático [prioridade: alta]

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

## P04 Apagar 8 tenants de teste órfãos no Supabase real [prioridade: média]

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
