# Infra — ambientes, deploy e variáveis de ambiente

> Como este projeto sai da máquina e vai para o ar. Fonte de verdade do deploy.
> Stack e justificativa em `adr-001-stack-e-motor-de-render.md`; isolamento de dados em
> `docs/11_SEGURANCA/multi-tenancy-rls.md`.

## Topologia

| Camada | Onde roda | O que é |
|---|---|---|
| App (editor de zonas) | Vercel — build estático | React + Vite, saída em `dist/` |
| Motor de geração de variante | Vercel Serverless Functions (`api/`) | **ainda não existe** — rodada 3 |
| Dados, auth, storage dos SVGs base | Supabase | Postgres + RLS + bucket `assets-base` |

Projeto Supabase: ref `fvasiruguggpxliprjpg` → `https://fvasiruguggpxliprjpg.supabase.co`.

## Deploy do app no Vercel

O repositório é `github.com/korabusinessnetwork/kora-cal-ados`. O Vercel detecta Vite
sozinho — **não existe `vercel.json` e não é preciso um** enquanto o app for SPA sem
rota client-side. Os valores auto-detectados são os corretos:

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Node: o default do Vercel (22.x) atende Vite 7 e TypeScript 7

`dist/` está no `.gitignore` — o Vercel builda do fonte, nunca de artefato commitado.

Depois do import, todo push em `main` publica em produção e todo push em outra branch
gera um Preview com URL própria.

## Variáveis de ambiente no Vercel

Só estas duas, e só elas, por enquanto:

| Variável | Valor | Environments |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://fvasiruguggpxliprjpg.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | a anon key do projeto | Production, Preview, Development |

### Armadilha: `VITE_*` é resolvido no build, não no runtime

O Vite **substitui `import.meta.env.VITE_*` por texto literal durante o build**. Duas
consequências que já custaram tempo:

1. **Sem as variáveis, o build passa e o site quebra.** `src/lib/supabase/cliente.ts`
   dá `throw` no carregamento do módulo quando falta URL ou anon key. Isso acontece no
   navegador, não no build — o resultado é deploy verde com tela branca e o erro só no
   console. Cadastre as variáveis **antes do primeiro deploy**.
2. **Mudar variável exige redeploy.** Editar o valor no painel não afeta o bundle já
   publicado; é preciso um novo deploy para o valor entrar.

### O que NUNCA vai para as variáveis do Vercel agora

`SUPABASE_SERVICE_ROLE_KEY` — ela ignora RLS por completo. Hoje nada em produção
precisa dela: o motor serverless que vai usá-la ainda não existe. Ela vive apenas no
`.env.local` da máquina do dono (scripts e teste de isolamento). Quando a rodada 3
criar `api/`, ela entra no Vercel **sem o prefixo `VITE_`** — com o prefixo, ela iria
para o bundle do navegador e qualquer visitante teria acesso total ao banco de todos
os tenants.

As três variáveis sem prefixo (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) também alimentam `supabase/tests/isolamento.test.ts`.
Sem elas o teste **pula em vez de passar em falso** — conferir sempre que o resumo do
vitest reportar `skipped`.

## Ainda não configurado (consciente)

- **Domínio próprio** — usando a URL `*.vercel.app` até existir domínio definido.
- **`api/` (motor de geração)** — rodada 3; até lá não há função serverless publicada.
- **Monitoramento/alertas** — nada além do log nativo do Vercel. Custo zero é
  requisito da fase (ver `memory/restrictions.md`).
