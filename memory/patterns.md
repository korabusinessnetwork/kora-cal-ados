# Padrões Consolidados — Kora Calçados (codinome)

## Objetivo
- Registrar padrões validados em produção (não especulação)
- Evitar variação e inconsistência no código
- Acelerar onboarding com guias de implementação

## Contexto
- Stack: React + Vite + Supabase + Vercel Serverless Functions (ver ADR-001); editor de
  zonas manipula SVG no DOM, sem canvas (ver ADR-005)
- Padrões evoluem com a base de código; deprecados ganham tag [DEPRECADO]

## Regras Gerais
- Padrão só entra após validado em uso real ou por teste que o prove — não por opinião.
  (O projeto não tem time de dev humano: a validação vem de teste/execução, não de
  "≥ 2 aprovações" — ver ADR-003)
- Padrão obsoleto = tag [DEPRECADO] + data + sucessor
- Padrão quebrado repetidamente = vira ADR ou entra em `memory/bugs.md`

## Validações
- Padrão tem exemplos de código real (não pseudocódigo)?
- Contraexemplo está marcado como anti-padrão?

## Permissões
- Dono (Matheus): aprova/depreca padrões
- Agente: propõe padrão junto com o teste/execução que o valida

## Exceções
- Padrão de segurança/isolamento: entra imediatamente, sem esperar validação em uso

## Auditoria
- Code review checa conformidade com padrões
- Linter configurable para policing automático

## Eventos
- `pattern.validated`, `pattern.deprecated`, `pattern.superseded`

## Casos de Uso
- Revisar código de feature nova
- Decidir como estruturar novo módulo
- Treinar dev novo

## Critérios de Aceite
- [ ] Padrão tem mínimo 1 exemplo de uso real
- [ ] Contraexemplos claros (anti-padrão)
- [ ] Exceções documentadas

---

## Padrões de Código

### Organização para agente de IA (ver ADR-003)

Este projeto não tem desenvolvedor humano navegando o código por hábito — todo padrão
abaixo é otimizado pra busca/leitura de agente primeiro, ergonomia humana depois.

- **Nomenclatura de domínio bate 100% com `docs/03_REGRAS_DE_NEGOCIO/glossario.md`** —
  sem exceção, sem sinônimo "só nesse arquivo"
- **Arquivo alvo: ~80-150 linhas.** Módulo crescendo além disso é sinal de quebrar em
  responsabilidade menor, não de "arquivo grande mas organizado"
- **Toda pasta nova em `src/` ou `supabase/functions/` nasce com um README.md** de
  1 parágrafo: o que vive aqui, o que não vive aqui, arquivo de entrada

✅ `src/lib/render/gerarVarianteDeCor.ts` — nome literal, busca por "variante" acha o arquivo
❌ `src/lib/render/engine.ts` com função `process()` — nome não diz o que faz, exige abrir pra descobrir

### Nomenclatura

Termos de domínio vêm do glossário (`docs/03_REGRAS_DE_NEGOCIO/glossario.md`), sem
sinônimo — zona é zona em todo lugar.

- **Domínio (português)**: `marcarZona`, `gerarVarianteDeCor`, `aplicarCorNaZona`
- **Técnico (inglês)**: `useEffect`, `handleSubmit`, `fetchData`
- **Constantes**: `ZONAS_PADRAO_CALCADO`, `MAX_ZONAS_POR_PRODUTO`
- **Booleans**: `isDone`, `canEdit`, `hasError`

✅ `const gerarVarianteDeCor = (svg, zoneColors) => { ... }` (ação em português, termo do glossário)
❌ `const processColorMapping = () => { ... }` (jargão técnico + termo fora do glossário)

### Estrutura de Arquivos (por-feature)
```
src/features/
├── zonas/
│   ├── components/
│   │   ├── EditorDeZonas.jsx
│   │   └── EditorDeZonas.test.jsx
│   ├── hooks/
│   │   └── useZonas.js
│   ├── types.js (ou .ts)
│   ├── constants.js
│   └── index.js (barrel export)
```

✅ `src/features/zonas/components/EditorDeZonas.jsx`
❌ `src/components/zonas/EditorDeZonas.jsx` + `src/hooks/zonas.js` espalhados

### Gerenciamento de Estado
- **Local**: useState (componente é dono dos dados)
- **Contexto**: autenticação e tenant/tema (white-label — nunca constante no componente)
- **Supabase Realtime**: subscriptions em useEffect (cleanup ao desmontar)

✅ Estado crítico + compartilhado = Supabase + Context
❌ Redux; ❌ useState em component pai para passpropping profundo

## Padrões de API / Backend

### Envelope de Resposta
```json
{
  "data": { "variante_id": "...", "svg_url": "..." },
  "meta": { "timestamp": "2026-08-12T10:30:00Z", "version": "1" },
  "error": null
}
```

**Em caso de erro:**
```json
{
  "data": null,
  "error": { "code": "ZONA_NAO_ENCONTRADA", "message": "Zona 'sola' não existe no produto" },
  "meta": { "timestamp": "..." }
}
```

✅ Sempre envelope, mesmo em sucesso
❌ Array nu ou objeto nu sem metadata
❌ Devolver 200 com a variante "quase certa" quando uma zona pedida não foi aplicada —
   fidelidade de cor é o princípio nº1; zona não aplicada é erro, não aviso

### Validação
- Input validation antes de tocar no banco **e antes de tocar no SVG** (Zod ou equivalente):
  `zone_key` existe no produto, cor é hex válido
- Mensagens de erro em português, código de erro em enum estável

### Tratamento de Erros
- Código de erro estável (não muda entre versões)
- Retry automático em 5xx (com backoff exponencial)
- Log estruturado sem dados sensíveis (senhas, tokens)

## Padrões de UI/UX

### Feedback Temporal
- **Sucesso**: toast confirmação, <2s
- **Erro**: banner vermelho + botão retry, permanece até ação
- **Carregando**: skeleton ou spinner, ≤ 100ms de latência antes de aparecer

✅ Gerar variante: spinner no preview, sucesso com toast "Variante gerada"
❌ Pop-up de erro que some em 3s

### Estados Obrigatórios
Toda tela tem renderização para:
- `loading`: buscando dados
- `empty`: nenhum resultado
- `error`: algo quebrou
- `success`: renderização normal

## Padrões de Processo

### Fluxo de PR
1. Branch `feature/xxx` ou `fix/xxx` de `main`
2. Commit `message em inglês, corpo em pt-BR opcionalmente`
3. PR com checklist (testes passam, design review, casos edge)
4. ≥ 1 aprovação + CI green = merge
5. Delete branch remota

### Code Review
- Verificar se novo padrão? Documentar em `memory/patterns.md`
- Quebra padrão existente? Tag `[DEPRECADO]` o padrão velho
- Segurança? Escalar ao tech lead imediatamente

### Documentação
- Comentário explica o **porquê**, não o quê (ver ADR-003) — o quê já está no código
- Função > 3 linhas = JSDoc (tipos, exemplos)
- Feature relevante = ADR; termo de domínio novo = linha no glossário no mesmo commit

---

## Padrões [DEPRECADO]

| Padrão | Razão | Data | Sucessor |
|---|---|---|---|
| Recolor por `getElementById` + `setAttribute('fill')` | Falha em silêncio em SVG real (style inline/CSS vencem o atributo) — ver BUG-001/002 | 2026-08-12 | `normalizarSvg` + seletor de zona (ADR-004, aceito) |

## Checklist de Novo Padrão

- [ ] Testado em 2+ contextos reais
- [ ] Documentado aqui com exemplo ✅ e contraexemplo ❌
- [ ] Code review aprovada
- [ ] Linter/automação em lugar? (opcional)
