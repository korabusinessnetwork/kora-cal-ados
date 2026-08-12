# scripts/ — protótipo do motor de render

O que vive aqui: o **protótipo executável** do motor de geração de variante, antes de o
projeto Vite existir. O que não vive aqui: código de produção (vai pra `src/`), migration
(vai pra `supabase/migrations/`).

| Arquivo | Papel |
|---|---|
| `prototipo-recolor-svg.mjs` | O motor (`gerarVarianteDeCor`) — sem efeito colateral, importável |
| `prototipo-recolor-demo.mjs` | Demonstração: `npm run prototipo:recolor` gera `variante-teste.svg` |
| `prototipo-recolor-svg.test.mjs` | Contrato do motor — `npm test` |
| `teste-zona.svg` | SVG de teste feito à mão (zonas `sola`, `cabedal`, `cadarco`) |

## Estado

⚠️ O motor atual **só funciona em SVG feito à mão**. Em export de Illustrator/Figma a cor
falha em silêncio — ver `memory/bugs.md` BUG-001..005. O contrato corrigido está proposto
em `docs/08_DECISOES/adr-004-contrato-de-zona-e-normalizacao-de-svg.md` e **ainda não foi
implementado**.

Os 9 defeitos estão travados no teste como `it.fails`: quando o motor for corrigido, o
vitest acusa "expected to fail but passed" e força a atualização — a correção não some.

## Destino

`gerarVarianteDeCor` vira `src/lib/render/gerarVarianteDeCor.ts` quando o projeto Vite for
inicializado — mesmo nome, sem sinônimo (`docs/03_REGRAS_DE_NEGOCIO/glossario.md`). O
teste vai junto. Editor e API importam **o mesmo módulo**: duas implementações é
exatamente o que o princípio nº1 do `CLAUDE.md` proíbe.
