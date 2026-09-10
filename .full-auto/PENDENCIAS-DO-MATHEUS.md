# Pendências do Matheus

Coisas que só você pode fazer. O app já funciona com contornos, estas tarefas trocam o contorno
pelo real. Ordem: da mais importante para a menos importante.

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

## P03 Aprovar (ou não) a primeira dependência paga recorrente [prioridade: alta, destrava T09]
- **Por quê:** o modo gerado do ADR-008 termina numa chamada a um modelo de linguagem. É a primeira despesa recorrente do projeto, e `memory/restrictions.md` manda toda despesa passar por você.
- **Contorno atual:** o ADR-008 registra o fallback grátis na Alternativa 3 — a composição é editável à mão, ou seja, um configurador com menus funciona sem IA nenhuma. O produto não trava sem sua resposta, só entra sem a porta de entrada por prompt.
- **Como confirmar:** uma linha em `memory/restrictions.md` com sua decisão explícita.

## P04 O acervo: ~15 peças de uma forma de tênis [prioridade: alta, destrava T07/T08/T09]
- **Por quê:** é o gargalo que o próprio ADR-008 nomeia. Sem peças que encaixam, o modo gerado não pode ser construído com honestidade, seria um motor que nunca viu combustível.
- **O que exatamente:** uma forma de tênis com cerca de 3 opções por categoria (3 solas, 3 cabedais, 3 cadarços, 3 línguas, o resto fixo). Cada peça em glTF 2.0 puro, sem Draco, buffers embutidos.
- **Contorno atual:** nada do palco 3D foi construído. As tarefas estão marcadas `[!]` em `TAREFAS.md`, não escondidas.
- **Decisão sua:** modelar, licenciar ou comprar. Nenhuma das três é decisão minha.

## P05 Onde a zona 3D é guardada [prioridade: média]
- **Por quê:** `product_zones.svg_selector` guarda uma lista de ids CSS. Uma zona 3D é uma lista de nomes de malha. Mesma coluna, coluna nova ou tabela nova é decisão de schema, e schema em banco real é seu.
- **Contorno atual:** `recolorirModelo3d` recebe as zonas como parâmetro e não conhece o banco. Nada está travado, só indefinido.
- **Onde está escrito o detalhe:** seção 7 de `specs/recolorir-modelo-3d.md`.

## P06 Uma ADR sobre saída do cliente [prioridade: baixa]
- **Por quê:** nem o ADR-007 nem o ADR-008 dizem o que a marca leva embora se cancelar. Num B2B com contrato, é pergunta que o cliente faz antes de assinar, não depois.
- **Contorno atual:** nenhum. É lacuna de documentação, não de código.
