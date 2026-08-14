# src/features/produtos — catálogo e cadastro de modelo

O que vive aqui: listar os produtos do tenant, cadastrar um novo subindo o SVG-base já
normalizado, e abrir o desenho base do modelo selecionado. O que **não** vive aqui: marcação
de zona e preview de cor (F002/F003, feature própria) e o motor de render em si
(`src/lib/render/`, que é puro e não conhece Supabase).

| Arquivo | Papel |
|---|---|
| `hooks/useProdutos.ts` | Busca a lista e cria o produto |
| `hooks/uploadDeAssetBase.ts` | Analisa/normaliza o arquivo e sobe o canônico no Storage (funções puras de acesso, não é hook — daí o nome sem `use`) |
| `hooks/bucketDeAssets.ts` | Só o nome do bucket. Módulo folha de propósito: sem ele, a leitura importava o cliente do navegador por via transitiva e deixava de carregar em Node |
| `hooks/leituraDeAssetBase.ts` | Valida o caminho contra o tenant e devolve a URL assinada (mesmo motivo do nome sem `use`; recebe o cliente por parâmetro) |
| `hooks/useAssetBase.ts` | Os quatro estados da leitura na tela; é onde o cliente concreto é injetado |
| `components/ListaDeProdutos.tsx` | Catálogo com os quatro estados obrigatórios; item selecionável |
| `components/FormularioDeProduto.tsx` | Escolha do arquivo → conferência → cadastro |
| `components/RelatorioDeNormalizacao.tsx` | O que a normalização mudou no arquivo |
| `components/VisualizadorDeAssetBase.tsx` | Mostra o desenho base do modelo selecionado |

## Duas ordens que não podem inverter

**Normalizar antes de gravar.** O que vai para o Storage é o canônico, nunca o arquivo cru
do cliente (ADR-004). Gerar variante a partir do arquivo cru é o BUG-001.

**Subir o arquivo antes de inserir a linha.** `products.base_asset_path` é NOT NULL: uma
linha apontando para arquivo inexistente quebra a API na rodada 3, enquanto um arquivo sem
linha é invisível e inofensivo. Se o insert falhar, sobra um arquivo órfão — nunca um
produto sem asset.

**Validar o caminho, nunca remontá-lo.** `products.base_asset_path` é a fonte de verdade do
caminho; a leitura confere que ele pertence ao tenant do chamador. Remontar criaria uma
segunda fonte capaz de divergir em silêncio — e a validação é a única barreira que sobrevive
à rodada 3, onde o `service_role` ignora a policy de Storage.

## Limite conhecido desta rodada

A normalização roda **no navegador**. A rodada 3 precisa re-normalizar no servidor antes de
servir qualquer variante, senão o BUG-004 (script embutido em SVG) volta por outra porta.
Registrado em `specs/fase-1-rodada-1-fundacao-do-app.md`, seção 7.

Por isso o desenho é exibido dentro de `<img src>`, onde script embutido não executa. Trocar
por `dangerouslySetInnerHTML` — que F002 vai querer, para selecionar path — exige resolver
TD001 (re-normalização no servidor) antes, não depois.
