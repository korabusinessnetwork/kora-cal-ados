# src/features/produtos — catálogo e cadastro de modelo

O que vive aqui: listar os produtos do tenant e cadastrar um novo, subindo o SVG-base já
normalizado. O que **não** vive aqui: marcação de zona e preview de cor (rodada 2, feature
própria) e o motor de render em si (`src/lib/render/`, que é puro e não conhece Supabase).

| Arquivo | Papel |
|---|---|
| `hooks/useProdutos.ts` | Busca a lista e cria o produto |
| `hooks/uploadDeAssetBase.ts` | Analisa/normaliza o arquivo e sobe o canônico no Storage (funções puras de acesso, não é hook — daí o nome sem `use`) |
| `components/ListaDeProdutos.tsx` | Catálogo com os quatro estados obrigatórios |
| `components/FormularioDeProduto.tsx` | Escolha do arquivo → conferência → cadastro |
| `components/RelatorioDeNormalizacao.tsx` | O que a normalização mudou no arquivo |

## Duas ordens que não podem inverter

**Normalizar antes de gravar.** O que vai para o Storage é o canônico, nunca o arquivo cru
do cliente (ADR-004). Gerar variante a partir do arquivo cru é o BUG-001.

**Subir o arquivo antes de inserir a linha.** `products.base_asset_path` é NOT NULL: uma
linha apontando para arquivo inexistente quebra a API na rodada 3, enquanto um arquivo sem
linha é invisível e inofensivo. Se o insert falhar, sobra um arquivo órfão — nunca um
produto sem asset.

## Limite conhecido desta rodada

A normalização roda **no navegador**. A rodada 3 precisa re-normalizar no servidor antes de
servir qualquer variante, senão o BUG-004 (script embutido em SVG) volta por outra porta.
Registrado em `specs/fase-1-rodada-1-fundacao-do-app.md`, seção 7.
