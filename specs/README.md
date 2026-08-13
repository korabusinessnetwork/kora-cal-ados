# specs — especificações de rodada

O que vive aqui: a especificação verificável de **uma rodada** do ciclo
(`/spec` → `/build` → `/review` → `/aprender`), escrita antes de qualquer código.
O que **não** vive aqui: decisão de arquitetura (vai para `docs/08_DECISOES/` como ADR),
regra de negócio (`docs/03_REGRAS_DE_NEGOCIO/`) e ideia ainda não escopada
(`docs/09_BACKLOG/`).

Um spec é fechado por construção: tem escopo de uma frase, uma lista explícita de **fora
de escopo** — que é o que impede o `/build` de crescer sozinho — e critérios de aceite
que se respondem com sim/não olhando o código depois.

| Arquivo | Rodada | Estado |
|---|---|---|
| `fase-1-rodada-1-fundacao-do-app.md` | Fase 1 · rodada 1 — app Vite/React, auth, tenant/tema, catálogo, upload normalizado | especificado, não construído |

O mapa completo da Fase 1 (as quatro rodadas) está na seção 0 do spec da rodada 1.
