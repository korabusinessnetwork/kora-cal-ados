---
description: Audita o build contra o spec, corrige o que for seguro sozinho, e só declara feito quando limpo
---

Argumento opcional (caminho do spec, se não for o mais recente): $ARGUMENTS

1. Releia o spec (o indicado em $ARGUMENTS, ou o mais recente em `specs/`).
2. Releia todos os arquivos que o /build tocou.
3. Para cada critério de aceite do spec, responda explicitamente sim/não/parcial, com a evidência (linha ou trecho de código).
4. Para cada item marcado como não/parcial:
   - Se a correção for **segura e não-ambígua** (bug óbvio, campo faltando, edge case não tratado, aritmética float onde deveria ser inteiro, RLS ausente): corrija agora mesmo, sem perguntar.
   - Se a correção envolver **decisão de produto, mudança de schema em produção, ou ambiguidade de regra de negócio**: NÃO corrija sozinho. Pare e liste exatamente o que precisa de decisão do Matheus.
5. Depois de corrigir o que era seguro corrigir, refaça a auditoria do zero (não assuma que a correção funcionou — releia o resultado).
6. Repita o passo 3–5 até todos os critérios estarem "sim", ou até só restarem itens que exigem decisão humana.

## Saída final

Se tudo passou:
```
✅ feito — todos os critérios de aceite cobertos, sem ressalvas.
[lista dos critérios com evidência]
```

Se algo precisa de decisão humana:
```
⚠️ revisão parcial — X de Y critérios cobertos.
Corrigido automaticamente: [lista]
Precisa da sua decisão: [lista com a pergunta específica para cada item]
```

Nunca declare "feito" se houver qualquer critério do spec ainda como "não" — nesse caso, ou você corrigiu, ou está listado como pendência para decisão humana. Não existe terceira opção silenciosa.
