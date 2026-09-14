# `/api/v1/modelo-de-linguagem/*`, o fornecedor de modelo de linguagem da marca

As rotas da D13 (`.full-auto/DECISOES.md`): a marca configura o fornecedor dela, com a chave
dela, e o time compõe calçado por prompt usando esse fornecedor. Contrato em
`docs/07_APIS/modelo-de-linguagem.md`.

**Estas rotas não são a API que o produto vende.** Quem chama é a TELA do próprio produto, com a
sessão Supabase da pessoa (`Authorization: Bearer <access_token>`), e não o servidor da marca com
chave de API (ADR-006). Por isso a autenticação é outra: `_lib/autenticarSessaoDoUsuario.ts`.

| Arquivo | Rota | Quem pode |
|---|---|---|
| [`configuracao.ts`](configuracao.ts) | `GET`, `PUT`, `DELETE ?tenant=<uuid>` | owner |
| [`testar.ts`](testar.ts) | `POST ?tenant=<uuid>`, testa a configuração GRAVADA | owner |
| [`em-uso.ts`](em-uso.ts) | `GET ?tenant=<uuid>`, só fornecedor, nome e modelo (sem teto, preço ou final da chave) | membro e owner |
| [`gerar.ts`](gerar.ts) | `POST ?tenant=<uuid>`, corpo `{ forma_id, prompt }` | membro e owner |
| [`uso.ts`](uso.ts) | `GET ?tenant=<uuid>&mes=AAAA-MM`, o painel de gasto | owner |
| [`_modeloDeLinguagem.test.ts`](_modeloDeLinguagem.test.ts) | teste dos quatro handlers, sem rede e sem banco | |
| [`_bancoFalso.ts`](_bancoFalso.ts) | cliente Supabase falso que filtra de verdade | |

O `_` dos dois últimos é o que impede a Vercel de publicá-los como rota (`api/README.md`).

## O que os quatro handlers garantem, e onde está a prova

- **A chave do fornecedor não volta ao navegador.** Nem no `PUT` que acabou de gravá-la. Volta só
  `final_da_chave`. No banco ela fica cifrada (`_lib/cifraDaChaveDoFornecedor.ts`).
- **O `tenant` da URL não é confiado.** Ele só escolhe QUAL vínculo conferir: a sessão tem de
  pertencer a um `tenant_members` daquele tenant, com o papel exigido, antes de qualquer leitura.
- **O corpo só é lido depois da sessão.** Uma recusa de corpo antes da autenticação contaria a um
  estranho que o pedido foi processado.
- **`gerar` não é um proxy de modelo de linguagem.** A instrução e o catálogo são montados aqui, a
  partir do acervo; o corpo não consegue mandar instrução, mensagens ou modelo próprios.
- **Toda chamada ao fornecedor vira linha de uso, inclusive a que falhou.** É o que os limites
  (10 por minuto, 300 por dia, teto mensal) contam.
- **API própria passa pela guarda de DNS duas vezes:** ao gravar, para a pessoa corrigir na hora, e
  ao usar, porque o DNS pode mudar depois (`_lib/verificarEnderecoPublico.ts`).

As duas tabelas (`tenant_modelos_de_linguagem`, `uso_do_modelo_de_linguagem`) têm RLS ligada e
**nenhuma política**: `anon` e `authenticated` não leem nada, e só estas rotas, com `service_role`
depois da conferência de sessão e papel, alcançam os dados.

## Toda regra mora em `api/_lib/` e em `src/lib/modeloDeLinguagem/`

Como em `products/[productId]/`, os handlers orquestram e não decidem. Se um deles crescer, a
regra que escapou vai para `_lib/` com teste próprio.
