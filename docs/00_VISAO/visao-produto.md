# Visão de Produto — Kora Calçados (codinome)

> Versão condensada para consulta rápida. Profundidade completa (personas, tom de voz,
> manifesto) vive em `memory/identity.md` — este arquivo é o resumo "1 página".

## O que é

Motor de customização de produto para a indústria calçadista: um editor visual onde o
time de produto marca **zonas endereçáveis** num modelo de calçado (sola, cabedal,
cadarço, logo) e uma **API** que gera qualquer combinação de cor/material sobre essas
zonas, em escala.

## Problema

Gerar cada variante de cor/material de um modelo hoje exige fotografia ou edição manual
por unidade. Um catálogo de 200 modelos × 5 cores = 1000 edições manuais por coleção.
Não escala, atrasa o catálogo, e cada edição manual é um ponto de inconsistência.

## Proposta de valor

Marca a zona uma vez, gera quantas variantes precisar via API. Editor visual (setup) +
motor de geração (escala) desde o dia 1 — não é só uma ferramenta de design, é um
pipeline de produção de catálogo.

## North Star

Métrica proposta (a validar com os primeiros clientes):
**Variantes geradas por API / mês**, segmentado por marca (tenant) ativa.

- Mede o valor real entregue (menos fotografia/edição manual = mais variantes via API)
- Métrica secundária de saúde: marcas ativas gerando variante em uma janela de 30 dias
  (retenção, não só adoção inicial)

## Público-alvo

Times internos de produto/design de marcas e fabricantes calçadistas (B2B puro, sem
camada consumidor-final nesta fase). Ver personas completas em `memory/identity.md`.

## Situação atual vs. futuro

| Hoje | MVP (Fase 1) | Futuro |
|---|---|---|
| Fundação documentada, sem código | Editor de zonas (vetor/ilustração) + API de variante de cor/material, multi-tenant, venda manual | Segmentação de foto real (IA), self-serve + billing, integração com a suite Kora calçadista |

## Atualizações

- Registrar aqui a data e o motivo sempre que a proposta de valor mudar de rumo.
- **2026-08-12** — versão inicial, gerada na fundação do projeto (intake conduzido via chat).
