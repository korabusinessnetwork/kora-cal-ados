# src/lib — camada de serviços

Todo acesso ao backend e toda lógica de domínio pura passam por aqui — nunca dentro de
componente. O que não vive aqui: JSX, estado de UI, roteamento.

| Pasta | O que vive lá |
|---|---|
| `render/` | Motor de render: normalização do asset-base e geração de variante de cor. Módulo puro (texto SVG entra, texto SVG sai), importado pelo editor e pela função serverless |
| `supabase/` | Conexão com o Supabase pelo navegador: configuração e o cliente único (anon key, nunca service_role) |

Pasta nova aqui nasce com README próprio (regra do ADR-003).
