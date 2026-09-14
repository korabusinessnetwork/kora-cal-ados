# `api/_lib/`, a lógica da API, fora do handler

O `_` na frente do nome faz a Vercel **ignorar** este diretório no roteamento por sistema de
arquivos: nada daqui vira endpoint. É o que permite a lógica morar ao lado da rota sem
acidentalmente virar uma.

## A divisão que este diretório existe para manter

O handler (`api/v1/products/[productId]/variants.ts`) **orquestra e não decide**. Toda
decisão mora aqui, em módulo pequeno e testável sem rede. Se o handler crescer, é sinal de
que uma regra escapou para o lugar errado, o lugar onde ela não tem teste.

Os módulos que tocam Supabase **recebem o cliente por parâmetro**, nunca o constroem. É o
que permite testá-los com um cliente falso, como `src/features/zonas/gravarZonaNoBanco.test.ts`
já faz do lado do front.

## Índice

Todo módulo desta tabela existe e tem teste co-locado. O que ainda falta para a API
responder é o handler, `api/v1/products/[productId]/variants.ts`, que orquestra estes
módulos na ordem e não decide nada (ver `../README.md`).

| Arquivo | Responsabilidade | Estado |
|---|---|---|
| `tiposDaApi.ts` | `CodigoDeRespostaDaApi` (a união que **estende** `CodigoDeErro` sem editá-lo) e a classe `FalhaDaApi` | **Existe** |
| `traduzirParaFalhaDaApi.ts` | A tabela código → status → mensagem, num lugar só | **Existe** |
| `formatoDaChaveDeApi.ts` | Gerar e interpretar `kora_<ambiente>_<prefixo>_<segredo>`; o SHA-256 do segredo | **Existe** |
| `lerCorpoDoPedido.ts` | Corpo do `Request` → JSON, com **teto de bytes** conferido antes da leitura terminar | **Existe** |
| `lerCoresPedidas.ts` | Corpo cru → `Record<zone_key, cor>`, delegando a `validarCor`/`validarZoneKey` do motor | **Existe** |
| `respostaDaApi.ts` | Monta a `Response`: SVG cru no sucesso, envelope JSON no erro | **Existe** |
| `logDaRequisicao.ts` | A linha de log que conhece o **prefixo** e nunca a chave | **Existe** |
| `clienteDeServico.ts` | O `SupabaseClient` de `service_role`; recusa ambiente incompleto | **Existe** |
| `autenticarChaveDeApi.ts` | `Request` → `tenant_id`, ou 401. O ponto único do ADR-006 D3 | **Existe** |
| `carregarProdutoDoTenant.ts` | Produto por `(id, tenant_id da chave)`; ausente ou alheio = 404 | **Existe** |
| `listarZonasDoProdutoDoTenant.ts` | Zonas com filtro de tenant **explícito** | **Existe** |
| `baixarAssetBaseComServiceRole.ts` | `.download(base_asset_path)` direto do bucket privado | **Existe** |
| `registrarUsoDaChave.ts` | `last_used_at` em fire-and-forget, nunca aguardado | **Existe** |
| `autenticarSessaoDoUsuario.ts` | `Request` com a sessão Supabase da pessoa → usuário e papel no tenant, ou 401/403. A autenticação das rotas do modelo de linguagem, que não é a chave de API | **Existe** |
| `pedidoDoModeloDeLinguagem.ts` | Método, `?tenant=` e sessão das rotas do modelo de linguagem, na ordem, antes do corpo | **Existe** |
| `cifraDaChaveDoFornecedor.ts` | AES-256-GCM da chave do fornecedor com `CHAVE_DE_CIFRA_DOS_FORNECEDORES` | **Existe** |
| `configuracaoDoModeloDeLinguagem.ts` | Ler, gravar e remover a configuração do fornecedor do tenant, com filtro de tenant explícito | **Existe** |
| `chamarFornecedorDeModeloDeLinguagem.ts` | A chamada ao fornecedor (formato compatível com OpenAI), com tempo esgotado e erro traduzido sem repassar texto dele | **Existe** |
| `verificarEnderecoPublico.ts` | A guarda de SSRF da API própria: o nome não pode resolver para rede privada | **Existe** |
| `limitesDoModeloDeLinguagem.ts` | 10 por minuto, 300 por dia e teto mensal, contados no uso gravado | **Existe** |
| `registrarUsoDoModeloDeLinguagem.ts` | Uma linha de uso por chamada ao fornecedor, inclusive a que falhou | **Existe** |
| `apiNaoImportaOFront.test.ts` | Varredura: proíbe `api/` de importar `src/features/` e `src/lib/supabase/`, e exige que o motor continue sendo importado | **Existe** |

## Guarda que lê o próprio fonte: as duas regras

Quatro módulos daqui têm um teste que abre o próprio `.ts` e exige (ou proíbe) um trecho.
Não é preciosismo: sob `service_role` não há RLS, então a linha `.eq('tenant_id', …)` é a
única coisa entre uma marca e o dado da concorrente. Um teste de comportamento com cliente
falso **não** pega a remoção dela, porque quem refatora ajusta o cliente falso junto.

Duas regras, e as duas saíram de defeito real encontrado nesta pasta:

1. **A guarda lê o código, não a prosa.** Tire os comentários antes de comparar. Uma guarda
   escrita como `expect(fonte).toContain(".eq('tenant_id'")` fica verde quando alguém apaga a
   linha e deixa a menção num comentário explicando o que ela fazia, que é exatamente o que
   se escreve ao remover código. E para identificador **importado**, presença não basta:
   exija ao menos duas ocorrências no código, porque o `import` sobrevive intacto à remoção
   da chamada que ele servia.
2. **Guarda não mutada é guarda não verificada.** Antes de considerá-la pronta, apague a linha
   que ela protege, rode e veja vermelho; depois restaure. Uma guarda que passa em falso é
   pior que guarda nenhuma: ela ocupa o lugar da proteção e ainda dá a sensação de que existe.

## O separador do formato da chave está dentro do alfabeto do segredo

Fica escrito aqui porque é o tipo de detalhe que alguém "simplifica" seis meses depois, e a
simplificação parece correta.

A chave é `kora_<ambiente>_<prefixo>_<segredo>` e o segredo são 32 bytes em **base64url**,
alfabeto que inclui `-` e `_`. O separador do formato é o `_`. Ou seja: cerca de metade das
chaves geradas contém pelo menos um `_` **dentro do segredo**.

A leitura óbvia, `chave.split('_')` e exigir quatro pedaços, recusaria essas chaves. O
modo de falha é o pior que existe: não é determinístico, é sorteado no momento da geração.
Passa em qualquer teste escrito com uma chave de exemplo, e depois um cliente em cada dois
não consegue autenticar, sem padrão visível e sem nada ter mudado.

Por isso `interpretarChaveDeApi` lê **posicionalmente**: os três primeiros separadores
delimitam produto, ambiente e prefixo, e todo o resto é o segredo. A ambiguidade some porque
o segredo tem alfabeto e comprimento exatos (43 caracteres), então a estrutura fica
determinada mesmo com `_` no meio. `formatoDaChaveDeApi.test.ts` prende isso de duas formas:
uma chave montada à mão com `_` no segredo, e um lote de 200 chaves geradas, com um canário
que falha se nenhuma delas tiver `_`, para o teste avisar quando parar de exercitar o caso
difícil em vez de seguir verde sem testar nada.

Corolário: **não existe segunda leitura do formato**. O script que cria a chave e a função
que a valida importam este mesmo módulo. Se divergissem num caractere, toda chave já emitida
deixaria de autenticar de uma vez.

## Por que existe `listarZonasDoProdutoDoTenant.ts` se o front já lista zonas

Porque `src/features/zonas/listarZonasDoProduto.ts` **não filtra por `tenant_id`, de
propósito**, o comentário dele explica que quem recusa é a RLS. Aqui não há RLS: a função
consulta com `service_role`. Reusar aquele arquivo seria entregar a zona de uma marca ao
sistema de outra, e o código pareceria correto.

Essa é a diferença mais fácil de esquecer do projeto inteiro, então ela não é confiada à
memória: `apiNaoImportaOFront.test.ts` **proíbe** `api/` de importar `src/features/` e
`src/lib/supabase/`. Proibir sai mais barato que lembrar.

O que `api/` **pode** e **deve** importar de `src/` é o motor (`src/lib/render/`), a mesma
função de recolor que o editor usa. Duas implementações divergiriam, e a cor do editor
deixaria de ser a cor da API: é o princípio nº1 quebrado por construção.

## Erro: quem lança o quê

- O **motor** lança `ErroDeVariante` com um dos 7 `CodigoDeErro`. Ele não sabe o que é HTTP.
- O **transporte** lança `FalhaDaApi`, que já carrega `status` e cabeçalhos.
- `traduzirParaFalhaDaApi` é a **única** ponte entre os dois, e por isso a única dona da
  tabela de status. Espalhar a tradução faria o mesmo código sair como 409 num lugar e 500
  noutro, e `docs/07_APIS/endpoints.md` deixaria de ser verdade sem ninguém perceber.

Tabela completa em `docs/07_APIS/endpoints.md`. Aqui não se duplica, duplicata diverge.

## Ligações

- `../README.md`, por que a `service_role` mora em `api/` e não em `src/`
- `../../src/lib/render/README.md`, o motor
- `../../docs/08_DECISOES/adr-006-autenticacao-da-api-de-variante.md`, a autenticação
