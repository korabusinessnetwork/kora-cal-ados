# 07 — APIS · Kora Calçados (codinome)

> Contrato da **API de variante** — a peça que a marca calçadista integra no sistema dela.
> Este diretório descreve o contrato; a implementação (função serverless na Vercel) ainda
> não existe.

## Índice

| Arquivo | O que responde | Estado |
|---|---|---|
| [`autenticacao.md`](autenticacao.md) | Como o sistema do cliente se autentica: chave de API por tenant, header, revogação, respostas 401/404 | **Decidido** (ADR-006), não implementado |

O contrato do endpoint em si (rota, corpo, resposta, `?format=png`) está em
`docs/01_ARQUITETURA/overview.md`, seção "Fluxo — API (geração)". Ele muda de lugar para cá
— como `endpoints.md` e `schemas.md` — quando a função existir e o texto puder ser conferido
contra código em vez de contra intenção.

## As duas autenticações do produto

Não são a mesma, e confundi-las é a falha que este diretório existe para evitar:

- **Editor de zonas** — pessoa no navegador, JWT de sessão do Supabase, isolamento pela
  **RLS** do Postgres. Documentado em `docs/11_SEGURANCA/multi-tenancy-rls.md`.
- **API de variante** — sistema do cliente num servidor, **chave de API do tenant**. A
  função valida a chave e consulta com `service_role`, que **bypassa a RLS**: o isolamento
  entre marcas passa a ser responsabilidade da função, num ponto único.
  Ver [`autenticacao.md`](autenticacao.md) e o ADR-006.

## Regras que valem para qualquer endpoint daqui

1. **`tenant_id` vem da credencial, nunca do chamador.** Vale para os dois modelos acima.
2. **Erro é erro.** Zona ausente, cor inválida, gradiente ou zonas sobrepostas devolvem
   falha com código estável de `src/lib/render/erros.ts` — nunca 200 com variante "quase
   certa" (ADR-004, e princípio nº1 do CLAUDE.md).
3. **Recurso de outro tenant responde 404**, não 403.
4. **Nada de credencial em URL** — só em header.
5. **Validar input server-side sempre**, mesmo que o editor já valide (CLAUDE.md).

## O que NÃO vive aqui

- Implementação → `supabase/functions/` e a função serverless da Vercel
- Motor de render e códigos de erro → `src/lib/render/`
- Banco de dados → `04_MODELAGEM/`
- Regras de negócio → `03_REGRAS_DE_NEGOCIO/`
- Fluxos de tela → `05_FLUXOS/`
- Por que a autenticação é assim → `08_DECISOES/adr-006-*`

## Ligações

- `08_DECISOES/adr-006-autenticacao-da-api-de-variante.md` — a decisão e as alternativas
  descartadas
- `08_DECISOES/adr-004-contrato-de-zona-e-normalizacao-de-svg.md` — o contrato de zona que
  a API aplica
- `01_ARQUITETURA/overview.md` — o fluxo de geração ponta a ponta
- `11_SEGURANCA/` — isolamento multi-tenant, que a API é obrigada a preservar sem RLS
