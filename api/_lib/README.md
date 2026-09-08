# `api/_lib/` — a lógica da API, fora do handler

O `_` na frente do nome faz a Vercel **ignorar** este diretório no roteamento por sistema de
arquivos: nada daqui vira endpoint. É o que permite a lógica morar ao lado da rota sem
acidentalmente virar uma.

## A divisão que este diretório existe para manter

O handler (`api/v1/products/[productId]/variants.ts`) **orquestra e não decide**. Toda
decisão mora aqui, em módulo pequeno e testável sem rede. Se o handler crescer, é sinal de
que uma regra escapou para o lugar errado — o lugar onde ela não tem teste.

Os módulos que tocam Supabase **recebem o cliente por parâmetro**, nunca o constroem. É o
que permite testá-los com um cliente falso, como `src/features/zonas/gravarZonaNoBanco.test.ts`
já faz do lado do front.

## Índice

Só existe o que está marcado como tal. O resto é a entrega em curso — a lista está aqui
para que a divisão de responsabilidade seja lida antes de ser escrita, não para descrever
código que não existe.

| Arquivo | Responsabilidade | Estado |
|---|---|---|
| `tiposDaApi.ts` | `CodigoDeRespostaDaApi` (a união que **estende** `CodigoDeErro` sem editá-lo) e a classe `FalhaDaApi` | **Existe** |
| `traduzirParaFalhaDaApi.ts` | A tabela código → status → mensagem, num lugar só | a escrever |
| `formatoDaChaveDeApi.ts` | Gerar e interpretar `kora_<ambiente>_<prefixo>_<segredo>`; o SHA-256 do segredo | **Existe** |
| `lerCoresPedidas.ts` | Corpo cru → `Record<zone_key, cor>`, delegando a `validarCor`/`validarZoneKey` do motor | a escrever |
| `respostaDaApi.ts` | Monta a `Response`: SVG cru no sucesso, envelope JSON no erro | a escrever |
| `logDaRequisicao.ts` | A linha de log que conhece o **prefixo** e nunca a chave | a escrever |
| `clienteDeServico.ts` | O `SupabaseClient` de `service_role`; recusa ambiente incompleto | a escrever |
| `autenticarChaveDeApi.ts` | `Request` → `tenant_id`, ou 401. O ponto único do ADR-006 D3 | a escrever |
| `carregarProdutoDoTenant.ts` | Produto por `(id, tenant_id da chave)`; ausente ou alheio = 404 | a escrever |
| `listarZonasDoProdutoDoTenant.ts` | Zonas com filtro de tenant **explícito** | a escrever |
| `baixarAssetBaseComServiceRole.ts` | `.download(base_asset_path)` direto do bucket privado | a escrever |
| `registrarUsoDaChave.ts` | `last_used_at` em fire-and-forget, nunca aguardado | a escrever |

## O separador do formato da chave está dentro do alfabeto do segredo

Fica escrito aqui porque é o tipo de detalhe que alguém "simplifica" seis meses depois, e a
simplificação parece correta.

A chave é `kora_<ambiente>_<prefixo>_<segredo>` e o segredo são 32 bytes em **base64url** —
alfabeto que inclui `-` e `_`. O separador do formato é o `_`. Ou seja: cerca de metade das
chaves geradas contém pelo menos um `_` **dentro do segredo**.

A leitura óbvia — `chave.split('_')` e exigir quatro pedaços — recusaria essas chaves. O
modo de falha é o pior que existe: não é determinístico, é sorteado no momento da geração.
Passa em qualquer teste escrito com uma chave de exemplo, e depois um cliente em cada dois
não consegue autenticar, sem padrão visível e sem nada ter mudado.

Por isso `interpretarChaveDeApi` lê **posicionalmente**: os três primeiros separadores
delimitam produto, ambiente e prefixo, e todo o resto é o segredo. A ambiguidade some porque
o segredo tem alfabeto e comprimento exatos (43 caracteres), então a estrutura fica
determinada mesmo com `_` no meio. `formatoDaChaveDeApi.test.ts` prende isso de duas formas:
uma chave montada à mão com `_` no segredo, e um lote de 200 chaves geradas — com um canário
que falha se nenhuma delas tiver `_`, para o teste avisar quando parar de exercitar o caso
difícil em vez de seguir verde sem testar nada.

Corolário: **não existe segunda leitura do formato**. O script que cria a chave e a função
que a valida importam este mesmo módulo. Se divergissem num caractere, toda chave já emitida
deixaria de autenticar de uma vez.

## Por que existe `listarZonasDoProdutoDoTenant.ts` se o front já lista zonas

Porque `src/features/zonas/listarZonasDoProduto.ts` **não filtra por `tenant_id`, de
propósito** — o comentário dele explica que quem recusa é a RLS. Aqui não há RLS: a função
consulta com `service_role`. Reusar aquele arquivo seria entregar a zona de uma marca ao
sistema de outra, e o código pareceria correto.

Essa é a diferença mais fácil de esquecer do projeto inteiro, então ela não é confiada à
memória: `apiNaoImportaOFront.test.ts` **proíbe** `api/` de importar `src/features/` e
`src/lib/supabase/`. Proibir sai mais barato que lembrar.

O que `api/` **pode** e **deve** importar de `src/` é o motor (`src/lib/render/`) — a mesma
função de recolor que o editor usa. Duas implementações divergiriam, e a cor do editor
deixaria de ser a cor da API: é o princípio nº1 quebrado por construção.

## Erro: quem lança o quê

- O **motor** lança `ErroDeVariante` com um dos 7 `CodigoDeErro`. Ele não sabe o que é HTTP.
- O **transporte** lança `FalhaDaApi`, que já carrega `status` e cabeçalhos.
- `traduzirParaFalhaDaApi` é a **única** ponte entre os dois, e por isso a única dona da
  tabela de status. Espalhar a tradução faria o mesmo código sair como 409 num lugar e 500
  noutro, e `docs/07_APIS/endpoints.md` deixaria de ser verdade sem ninguém perceber.

Tabela completa em `docs/07_APIS/endpoints.md`. Aqui não se duplica — duplicata diverge.

## Ligações

- `../README.md` — por que a `service_role` mora em `api/` e não em `src/`
- `../../src/lib/render/README.md` — o motor
- `../../docs/08_DECISOES/adr-006-autenticacao-da-api-de-variante.md` — a autenticação
