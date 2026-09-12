# Kora Calçados

Motor de customização de calçados para marcas: o time da marca marca as zonas de um modelo, e a
API devolve a variante recolorida. SaaS B2B multi-tenant white-label.

O **princípio nº1** é curto e manda em tudo o que está aqui: **cor no editor = cor na API**. Mesmo
motor de recolor nos dois lados, zona errada falhando alto em vez de pintar o lugar errado em
silêncio, e prevenção de erro antes de mensagem de erro. Está escrito por extenso em
[`CLAUDE.md`](CLAUDE.md), que é a constituição do projeto.

## Rodar em um comando

```bash
npm install && npm run dev
```

Abre em `?tela=esboco`. **As três telas públicas não precisam de conta, nem de banco, nem de
`.env.local`**: o calçado que elas montam vem de código, não do Supabase. Só o editor de zonas
logado exige credencial.

| Tela | Endereço | O que é |
|---|---|---|
| Esboço | `?tela=esboco` | O editor 2D sobre um SVG commitado, o caminho mais curto para ver o motor de cor funcionando |
| Palco 3D | `?tela=palco3d` | Uma peça por vez, com os parâmetros dela |
| Calçado montado | `?tela=composicao` | A composição inteira, com a área de colar JSON |
| Editor de zonas | `/` | A área logada, a única que fala com o Supabase |

## Os comandos que importam

```bash
npm test              # a suíte inteira, sem rede e sem credencial
npm run typecheck     # tsc --noEmit, com strict e noUncheckedIndexedAccess
npm run build         # o build de produção
npm run test:navegador  # os testes que rodam em Chrome de verdade
npm run api:local     # sobe a API localmente, sem Vercel
npm run test:banco    # a suíte contra o Supabase real, precisa de .env.local
```

`npm test` roda numa máquina recém-clonada, sem `.env.local`, sem banco e sem chave. Isso é
requisito, não coincidência: uma suíte que exige credencial ensina o time a ignorar vermelho.

## Onde as coisas moram

| Diretório | O que tem |
|---|---|
| [`src/`](src/) | O que roda no navegador: as quatro telas e as regras que elas usam |
| [`src/lib/`](src/lib/) | O motor de recolor e as regras puras. É o código compartilhado entre o editor e a API |
| [`api/`](api/) | A API pública, uma rota, em Vercel Serverless |
| [`supabase/`](supabase/) | Schema, migrations, scripts de operação e os testes com banco de verdade |
| [`docs/`](docs/) | Regras de negócio, design system, fluxos, ADRs e o plano de segurança |
| [`memory/`](memory/) | Identidade, decisões, padrões e restrições do projeto |
| [`testes-de-navegador/`](testes-de-navegador/) | O que só dá para provar num navegador de verdade |
| [`specs/`](specs/) | Especificações fechadas antes de virarem código |

**Todo diretório com código tem um `README.md`**, e isso é varrido por teste, não lembrado por
disciplina: a guarda está em
[`docs/08_DECISOES/readmePorDiretorio.test.ts`](docs/08_DECISOES/readmePorDiretorio.test.ts), e o
comentário no topo dela conta as duas vezes em que a regra foi furada antes de ganhar guarda.

## Configuração

Copie [`.env.example`](.env.example) para `.env.local`. Nada além disso é necessário para as telas
públicas. A chave de serviço do Supabase **só** existe fora do navegador, em `supabase/` e `api/`,
e existe varredura reprovando em `npm test` se alguém a trouxer para `src/`.

## Stack

React 19 + Vite + TypeScript estrito, Supabase (auth, Postgres, RLS, storage), Vercel Serverless
para o motor de geração, three.js no palco 3D. Sem roteador, sem Redux, sem framework de teste de
componente: o idioma do projeto é jsdom mais `react-dom/client`. As razões de cada uma dessas
escolhas estão nos ADRs, em [`docs/08_DECISOES/`](docs/08_DECISOES/).
