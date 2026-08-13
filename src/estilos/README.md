# src/estilos — tokens de interface

O que vive aqui: os tokens de tema como custom properties CSS — a camada que o tenant
sobrescreve para o white-label. O que **não** vive aqui: estilo de componente (fica ao
lado do próprio componente, em `.css` separado do `.tsx`) e cor de zona (é dado do
cliente, não token de tema).

| Arquivo | Papel |
|---|---|
| `tokens.css` | Define todos os tokens com valores neutros e o reset mínimo do `body` |

Quem sobrescreve em runtime é `src/features/tenant/aplicarTemaDoTenant.ts`, a partir da
coluna `tenants.tema`. Documentação dos tokens e do contrato do `tema`:
`docs/02_DESIGN_SYSTEM/TOKENS.md`.

**Regra**: componente nunca escreve cor literal. Precisou de cor nova? Nasce como token
aqui primeiro.
