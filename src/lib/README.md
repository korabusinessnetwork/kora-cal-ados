# src/lib, camada de serviços

Todo acesso ao backend e toda lógica de domínio pura passam por aqui, nunca dentro de
componente. O que não vive aqui: JSX, estado de UI, roteamento.

| Pasta | O que vive lá |
|---|---|
| `render/` | Motor de render: normalização do asset-base e geração de variante de cor. Módulo puro (texto SVG entra, texto SVG sai), importado pelo editor e pela função serverless |
| `composicao/` | O modo gerado (ADR-008): a composição sobre o acervo, e o guarda que a valida antes de qualquer peça virar caminho de arquivo. Módulo puro, não conhece glTF |
| `acervo/` | Peças de calçado em glTF 2.0 geradas por código, em geometria grosseira, para provar a esteira do produto gerado (ADR-008) sem depender de modelagem em Blender |
| `texto/` | Frases de interface que mais de uma tela precisa escrever igual, como a contagem de elementos |
| `copia/` | Levar texto da tela para a área de transferência, com a falha visível. Usado pelo botão da composição e pelo do esboço |
| `supabase/` | Conexão com o Supabase pelo navegador: configuração e o cliente único (anon key, nunca service_role) |

Pasta nova aqui nasce com README próprio (regra do ADR-003).
