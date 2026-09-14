# modeloDeLinguagem/hooks, a leitura da configuração e do gasto

Dois hooks. O que mora aqui é o **carregamento e as ações**, não a tela: formulário e painel
são componentes que recebem o que estes devolvem.

| Hook | O que resolve |
|---|---|
| [`useConfiguracaoDoFornecedor.ts`](useConfiguracaoDoFornecedor.ts) | Lê a configuração (`carregando`, `erro`, `pronta`) e expõe `salvar`, `testar` e `remover`, com a ação em curso e o aviso do resultado |
| [`useUsoDoMes.ts`](useUsoDoMes.ts) | Lê o painel de gasto de um mês (`carregando`, `erro`, `vazio`, `pronto`) |

Leitura e ação são estados separados: uma falha ao testar não apaga a configuração da tela, e
"nada configurado" nunca é mostrado quando a verdade é "não consegui ler".

Os dois recebem o chamador da API por parâmetro, e ele fica fora das dependências do efeito,
pelo mesmo motivo do cliente em `produtos/hooks/useProdutos.ts`: um chamador criado na própria
linha teria identidade nova a cada render e a leitura se repetiria para sempre.
