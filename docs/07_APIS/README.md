# 07, APIS · Kora Calçados (codinome)

> Contrato da **API de variante**, a peça que a marca calçadista integra no sistema dela.
> Este diretório descreve o contrato; a implementação (função serverless na Vercel) ainda
> não existe.

## Índice

| Arquivo | O que responde | Estado |
|---|---|---|
| [`endpoints.md`](endpoints.md) | O contrato do endpoint: rota, método, corpo, resposta 200 (SVG cru), envelope de erro, tabela de códigos e status, exemplos `curl` | **Contrato escrito**, endpoint não implementado |
| [`autenticacao.md`](autenticacao.md) | Como o sistema do cliente se autentica: chave de API por tenant, header, revogação, respostas 401/404 | **Decidido** (ADR-006), não implementado |

O contrato do endpoint (rota, corpo, resposta, códigos) **mudou de lugar**: até 2026-09-08 ele
morava em `docs/01_ARQUITETURA/overview.md`, seção "Fluxo, API (geração)", e agora está em
[`endpoints.md`](endpoints.md). O `overview.md` responde *como o sistema se encaixa*; o
contrato que o cliente da API lê é outra pergunta, e mantê-lo em dois lugares é o começo de
duas versões dele. A função serverless continua **não existindo**, o contrato entra antes do
código de propósito, porque rota e códigos de erro são a parte que não se troca depois do
primeiro cliente integrado.

`schemas.md` ainda não existe: enquanto o corpo do pedido for um objeto de `zone_key` para
hex, `endpoints.md` descreve tudo, e um arquivo só de schema seria repetição.

## As duas autenticações do produto

Não são a mesma, e confundi-las é a falha que este diretório existe para evitar:

- **Editor de zonas**, pessoa no navegador, JWT de sessão do Supabase, isolamento pela
  **RLS** do Postgres. Documentado em `docs/11_SEGURANCA/multi-tenancy-rls.md`.
- **API de variante**, sistema do cliente num servidor, **chave de API do tenant**. A
  função valida a chave e consulta com `service_role`, que **bypassa a RLS**: o isolamento
  entre marcas passa a ser responsabilidade da função, num ponto único.
  Ver [`autenticacao.md`](autenticacao.md) e o ADR-006.

## Regras que valem para qualquer endpoint daqui

1. **`tenant_id` vem da credencial, nunca do chamador.** Vale para os dois modelos acima.
2. **Erro é erro.** Zona ausente, cor inválida, gradiente ou zonas sobrepostas devolvem
   falha com código estável de `src/lib/render/erros.ts`, nunca 200 com variante "quase
   certa" (ADR-004, e princípio nº1 do CLAUDE.md).
3. **Recurso de outro tenant responde 404**, não 403.
4. **Nada de credencial em URL**, só em header.
5. **Validar input server-side sempre**, mesmo que o editor já valide (CLAUDE.md).

## O que NÃO vive aqui

- Implementação → `api/` na raiz do projeto (função serverless da Vercel, roteada por sistema
  de arquivos: `api/v1/products/[productId]/variants.ts`)
- Motor de render e códigos de erro → `src/lib/render/`
- Banco de dados → `04_MODELAGEM/`
- Regras de negócio → `03_REGRAS_DE_NEGOCIO/`
- Fluxos de tela → `05_FLUXOS/`
- Por que a autenticação é assim → `08_DECISOES/adr-006-*`

> Correção: a primeira linha desta lista já apontou a implementação para
> `supabase/functions/`. **Não é lá.** O diretório existe vazio, resquício do scaffold da fundação, e a API de variante não
> vai para dentro dele: o motor de geração roda em função serverless da **Vercel** (ADR-001),
> não em Edge Function do Supabase. Doc apontando para um diretório vazio manda o próximo
> agente escrever no lugar errado, que é o defeito que o CLAUDE.md chama de convenção
> implícita, só que pior, porque estava escrito.

## Ligações

- `08_DECISOES/adr-006-autenticacao-da-api-de-variante.md`, a decisão e as alternativas
  descartadas
- `08_DECISOES/adr-004-contrato-de-zona-e-normalizacao-de-svg.md`, o contrato de zona que
  a API aplica
- `01_ARQUITETURA/overview.md`, o fluxo de geração ponta a ponta
- `11_SEGURANCA/`, isolamento multi-tenant, que a API é obrigada a preservar sem RLS
