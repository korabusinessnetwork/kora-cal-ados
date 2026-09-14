# src/features/modeloDeLinguagem, o fornecedor de modelo de linguagem da marca

A tela em que o **owner** escolhe o fornecedor de modelo de linguagem da marca (D13 de
`.full-auto/DECISOES.md`), cola a chave, testa a conexão e acompanha o gasto do mês.

| Arquivo | O que é |
|---|---|
| [`TelaDoFornecedor.tsx`](TelaDoFornecedor.tsx) | A tela inteira. Confere o papel, cria o chamador da API e junta formulário e painel |
| [`FormularioDoFornecedor.tsx`](FormularioDoFornecedor.tsx) | Escolher fornecedor, modelo, chave (só escrita), endereço e preços da API própria, teto mensal. Salvar, testar, remover |
| [`PainelDeGasto.tsx`](PainelDeGasto.tsx) | O painel de gasto do mês: totais, teto, por dia, por modelo, chamadas recentes |
| [`montarCorpoDaConfiguracao.ts`](montarCorpoDaConfiguracao.ts) | Do formulário ao corpo do `PUT`, conferido com a MESMA regra do servidor antes do clique sair |
| [`chamarApiDoModeloDeLinguagem.ts`](chamarApiDoModeloDeLinguagem.ts) | A única porta para `/api/v1/modelo-de-linguagem/*`: token da sessão, envelope, erro em português |
| [`hooks/`](hooks/README.md) | Leitura da configuração e do uso do mês, com os estados obrigatórios |
| `modeloDeLinguagem.css` | Estilo, separado do JSX, só com tokens do tema |

## Por que esta feature fala com a API e não com o banco

As duas tabelas da D13 têm RLS ligada e **nenhuma política**: `authenticated` não lê nada. A
chave cifrada mora ali e o gasto é dado financeiro do owner. Quem lê é a função serverless,
com `service_role`, depois de conferir sessão e papel. Uma consulta direta daqui voltaria
vazia e pareceria "nada configurado".

## O que não pode ser desfeito

- **A chave é só de escrita.** O campo começa vazio sempre; com chave gravada, a tela mostra o
  final dela. Depois de salvar, o campo é limpo e o formulário remonta.
- **"Testar conexão" testa o que está gravado.** Com o formulário alterado, o botão desliga e diz
  por quê, para não aprovar uma configuração diferente da que a pessoa está vendo.
- **Membro não vê esta tela.** A navegação não mostra a entrada e a tela confere o papel de novo.
  A permissão de verdade é o 403 do servidor.
- **"Remover" pede confirmação** em dois cliques no mesmo lugar.

Em desenvolvimento a tela precisa de `npm run api:local` rodando junto de `npm run dev`: o Vite
repassa `/api` para ele (`vite.config.ts`). Sem ele, a tela diz exatamente isso.
