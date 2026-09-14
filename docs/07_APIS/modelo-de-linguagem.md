# Rotas do fornecedor de modelo de linguagem da marca

> **Estado: implementado** em `api/v1/modelo-de-linguagem/`, coberto por
> `api/v1/modelo-de-linguagem/_modeloDeLinguagem.test.ts` (sem rede e sem banco) e por
> `supabase/tests/modeloDeLinguagem.test.ts` (banco de verdade, pula sem ambiente).
> Decisão inteira: D13 de `.full-auto/DECISOES.md`. Termos: `docs/03_REGRAS_DE_NEGOCIO/glossario.md`.

**Estas rotas não são a API de variante** ([`endpoints.md`](endpoints.md)), que é o que o
produto vende. Quem chama estas é a tela do próprio produto, com a sessão da pessoa. Nenhum
servidor de marca integra com elas.

## Autenticação

- Cabeçalho `Authorization: Bearer <access_token da sessão Supabase>`.
- `?tenant=<uuid>` escolhe a marca. Ele **não é confiado**: a sessão precisa ter vínculo em
  `tenant_members` com aquele tenant e o papel exigido pela rota, antes de qualquer leitura.
- O corpo só é lido depois da sessão conferida.

## As rotas

| Rota | Papel | Corpo | `data` no sucesso |
|---|---|---|---|
| `GET configuracao?tenant=` | owner | | `{ configuracao: ConfiguracaoDoFornecedorVisivel \| null }` |
| `PUT configuracao?tenant=` | owner | `{ fornecedor, modelo, chave \| null, endereco \| null, preco_entrada_por_milhao \| null, preco_saida_por_milhao \| null, teto_mensal_usd \| null }` | `{ configuracao }` |
| `DELETE configuracao?tenant=` | owner | | `{ configuracao: null }` |
| `POST testar?tenant=` | owner | | `{ ok: true, modelo, milissegundos }` |
| `GET em-uso?tenant=` | membro e owner | | `{ fornecedor_em_uso: { fornecedor, nome_do_fornecedor, modelo } \| null }` |
| `POST gerar?tenant=` | membro e owner | `{ forma_id, prompt }` | `{ texto, fornecedor, nome_do_fornecedor, modelo, custo_estimado_usd }` |
| `GET uso?tenant=&mes=AAAA-MM` | owner | | resumo do mês: `totais`, `teto_mensal_usd`, `por_modelo`, `por_dia`, `recentes`, `completo` |

Todas sob `/api/v1/modelo-de-linguagem/`. Resposta sempre no envelope `{ data, error, meta }`.
Os tipos moram em `src/lib/modeloDeLinguagem/tiposDoModeloDeLinguagem.ts`.

### O que cada campo significa, e o que nunca volta

- **`chave`** é só de escrita. `null` no `PUT` mantém a gravada. Nenhuma resposta traz a chave,
  nem cifrada; volta só `final_da_chave` (os 4 últimos caracteres).
- **`endereco` e os preços** só valem para `api_propria`. Nos fornecedores grátis da lista o
  endereço é fixo no código e o preço é zero. O endereço passa pela guarda de DNS ao gravar e ao usar.
- **`gerar` não é um proxy.** Instrução e catálogo são montados no servidor a partir do acervo;
  o corpo não manda instrução, mensagens nem modelo. `texto` é a resposta crua, que a tela passa
  pelo guarda do ADR-008 antes de chegar ao palco.
- **`em-uso`** existe separado da configuração porque a configuração é do owner (preço, teto,
  final da chave), e o membro só precisa saber quem responde o prompt.
- **`custo_estimado_usd`** é estimativa: tokens informados pelo fornecedor vezes o preço
  configurado. A fatura de verdade é a do fornecedor.

## Limites

Contados na tabela `uso_do_modelo_de_linguagem`, onde toda chamada ao fornecedor vira linha,
inclusive a que falhou: **10 gerações por minuto** e **300 por dia** por marca, e o **teto
mensal** em dólar, se o owner configurou um.

## Códigos de erro

| Código | Status | Quando |
|---|---|---|
| `SESSAO_AUSENTE` | 401 | Sem `Authorization` |
| `SESSAO_INVALIDA` | 401 | Token expirado ou inválido |
| `SEM_PERMISSAO` | 403 | Sem vínculo com o tenant, papel insuficiente, ou `tenant` que não é uuid |
| `METODO_NAO_PERMITIDO` | 405 | Método fora da tabela acima, com `Allow` |
| `CORPO_INVALIDO` | 400 | Corpo ou `mes` fora do formato, com os motivos |
| `ENDERECO_NAO_PERMITIDO` | 400 | Endereço da API própria que não é público (rede interna, localhost) |
| `FORNECEDOR_NAO_CONFIGURADO` | 409 | `testar` ou `gerar` sem configuração gravada |
| `TETO_MENSAL_ATINGIDO` | 409 | O custo estimado do mês alcançou o teto |
| `LIMITE_DE_GERACOES` | 429 | Passou de 10 por minuto ou 300 por dia |
| `FORNECEDOR_NO_LIMITE` | 429 | O plano do fornecedor recusou por limite |
| `FORNECEDOR_RECUSOU_A_CHAVE` | 502 | Chave recusada pelo fornecedor |
| `FORNECEDOR_NAO_TEM_O_MODELO` | 502 | Nome de modelo que o fornecedor não reconhece |
| `FORNECEDOR_NAO_RESPONDEU` | 502 | Tempo esgotado ou resposta que não é do formato esperado |

A mensagem é sempre nossa, em português, da tabela de `api/_lib/traduzirParaFalhaDaApi.ts`.
Texto vindo do fornecedor nunca é repassado: pode trazer pedaço de chave ou de cabeçalho.

## O banco

`tenant_modelos_de_linguagem` (uma linha por marca, chave cifrada em AES-256-GCM com
`CHAVE_DE_CIFRA_DOS_FORNECEDORES`, que não está no banco) e `uso_do_modelo_de_linguagem` (uma
linha por chamada, sem prompt nem resposta). As duas com RLS ligada, **nenhuma política** e
`revoke` para `anon` e `authenticated`. Migration: `supabase/migrations/20260914_modelo_de_linguagem_por_tenant.sql`.

## Ligações

- `../../api/v1/modelo-de-linguagem/README.md`, os handlers e onde está a prova de cada garantia
- `../../src/features/modeloDeLinguagem/README.md`, as telas que chamam estas rotas
- [`endpoints.md`](endpoints.md), a API de variante, que é outra autenticação
