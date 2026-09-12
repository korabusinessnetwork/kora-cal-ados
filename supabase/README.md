# supabase, o banco e o que fala com ele fora do navegador

| O quê | Onde |
|---|---|
| Schema consolidado, a fonte de verdade das tabelas | [`schema.sql`](schema.sql) |
| Migrations aplicadas, em ordem de data, mais a varredura de RLS | [`migrations/`](migrations/) |
| Scripts de operação (provisionar tenant, chave de API, exportar) | [`scripts/`](scripts/) |
| Testes contra o Supabase de verdade, inclusive o de isolamento | [`tests/`](tests/) |

Tudo aqui roda **fora** do navegador e usa `SUPABASE_SERVICE_ROLE_KEY`, que ignora a RLS. Por isso
nada deste diretório pode ser importado por `src/`, e existe varredura que reprova em `npm test` se
alguém tentar.

## Como rodar o que depende do banco

Os comandos leem `.env.local`, que não é versionado (`.env.example` lista as variáveis):

```bash
npm run test:banco        # a suíte contra o Supabase real
npm run provisionar       # cria um tenant
npm run criar-chave       # emite chave de API de um tenant
npm run revogar-chave     # revoga por prefixo
npm run exportar-tenant   # a saída completa do ADR-009
```

Sem `.env.local` os testes de banco **pulam** em vez de falhar, e é de propósito: teste que falha
por falta de credencial ensina o time a ignorar vermelho. O preço é o inverso, um verde que não
provou nada, e é por isso que a contagem "58 de 58" aparece separada no `BASELINE.md`.

## RLS não é opcional

Toda tabela nasce com `enable row level security` e pelo menos uma policy. Não é lembrete: é
varredura, em [`migrations/rlsEmTodaTabela.test.ts`](migrations/rlsEmTodaTabela.test.ts), que roda
em `npm test` sem banco e sem credencial. O porquê está em
[`../docs/11_SEGURANCA/multi-tenancy-rls.md`](../docs/11_SEGURANCA/multi-tenancy-rls.md): tenants
concorrentes coexistem no mesmo banco, e isolamento aqui é requisito comercial, não só técnico.
