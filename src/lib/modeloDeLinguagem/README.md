# src/lib/modeloDeLinguagem, os fornecedores de modelo de linguagem por marca (D13)

O que vive aqui: as regras puras que a tela e a função serverless precisam dividir. A lista de
fornecedores grátis, a guarda do endereço da API própria, a validação do que o owner envia, o
custo estimado e o resumo do gasto do mês.

O que **não** vive aqui: chamada de rede ao fornecedor, cifra da chave, DNS, banco e sessão. Isso é
servidor e mora em `api/_lib/`. A chamada ao modelo de linguagem pela tela mora em
`src/features/modeloDeLinguagem/`, e o contrato `ModeloDeLinguagem` continua em `src/lib/composicao/`.

`api/` pode importar este módulo (`api/_lib/apiNaoImportaOFront.test.ts`) porque ele não assume RLS
nem sessão de usuário: recebe dado e devolve dado.

| Arquivo | Papel |
|---|---|
| `fornecedoresDeModeloDeLinguagem.ts` | A lista: id, nome, endereço fixo, link para criar a chave, modelos sugeridos e o que o plano grátis permite |
| `validarEnderecoDaApiPropria.ts` | A metade da guarda de SSRF que não precisa de rede: https, sem IP, sem nome interno, sem porta |
| `validarConfiguracaoDoFornecedor.ts` | O corpo que o owner envia, conferido inteiro, com todos os motivos de recusa |
| `calcularCustoEstimado.ts` | Tokens vezes preço por milhão, e o formato em dólar da tela |
| `resumirUsoDoMes.ts` | As chamadas do mês viram o painel de gasto, com o mês cortado em UTC |
| `tiposDoModeloDeLinguagem.ts` | O JSON que atravessa a rede entre a tela e a API. Nenhum comportamento |

## Por que cada marca usa a própria chave

Os planos grátis proíbem, na maioria, repassar a cota por outro serviço, e uma chave da Kora
dividida entre marcas faria a primeira marca a esgotar a cota derrubar todas. A marca cria a chave
grátis dela no site do fornecedor, e a Kora nunca devolve essa chave ao navegador. Decisão inteira em
`.full-auto/DECISOES.md`, D13.
