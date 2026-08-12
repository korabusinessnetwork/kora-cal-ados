# ADR-003 — Organização do projeto para agente de IA, não para leitura humana casual

**Status**: Aceito
**Data**: 2026-08-12
**Decisores**: Matheus Bonato
**Supersede**: (nenhum)
**Supersedido por**: (nenhum ainda)

---

## Contexto

Kora Calçados será **desenvolvido exclusivamente por agente de IA** (Claude Code) —
não há desenvolvedor humano navegando o repositório por hábito, memória de time ou
contexto de reunião. Toda convenção padrão Kora até aqui (document-first, ADRs,
`memory/`) já ajuda um agente, mas foi desenhada pensando também em onboarding
humano. Este ADR declara explicitamente: quando uma convenção humana tradicional e
uma convenção mais buscável/verificável por agente divergem, **a segunda vence**.

Isso importa porque um agente de código reconstrói o contexto do projeto do zero (ou
quase) a cada sessão nova — ele não "lembra" de ontem do jeito que um dev humano
lembra, e não absorve convenção tácita por osmose de corredor. O que não está escrito
e nomeado de forma consistente, para fins práticos, não existe para o agente.

---

## Decisão

Adotar como regra de organização, documentada em `CLAUDE.md`:

1. **Glossário como fonte única de nomenclatura** — todo termo de domínio (zona,
   tenant, variante, produto) tem exatamente um nome, aplicado sem exceção em código,
   schema, docs e commits. Ver `docs/03_REGRAS_DE_NEGOCIO/glossario.md`.
2. **Arquivos pequenos e single-responsibility** — alvo de ~80-150 linhas por
   arquivo, para caber inteiro no contexto de edição do agente sem truncamento.
3. **README.md de índice em todo diretório**, não só em `docs/`.
4. **Nomenclatura literal** — nome de arquivo/função descreve o que faz, nunca um
   apelido criativo que exige contexto pra decodificar.
5. **Comentário justifica o "por quê"**, nunca só repete o "o quê" que já está no
   código.

---

## Alternativas Consideradas

### 1. Convenção humana tradicional (idiomática, enxuta, contexto tácito de time)

- **Prós**: nomes mais curtos, arquivos maiores agrupando lógica relacionada de forma
  mais "natural" para quem já conhece o projeto
- **Contras**: assume um time com memória compartilhada acumulada — que não existe
  aqui; termo com sinônimo variando por arquivo quebra busca por grep/semantic search
- **Descartado porque**: não há tribal knowledge a acumular; o "time" é uma sequência
  de sessões de agente sem memória entre si além do que está escrito

### 2. Documentação externa ao repositório (Notion, Confluence)

- **Prós**: separa "o que muda rápido" (código) de "o que muda devagar" (processo)
- **Contras**: agente de código não necessariamente tem acesso a ferramentas externas
  por padrão; contexto fica fragmentado entre repo e ferramenta externa
- **Descartado porque**: manter tudo dentro do repositório garante que o contexto
  está sempre disponível junto com o código que ele descreve, sem dependência de
  integração externa

### 3. Manter o padrão Kora como está, sem adaptação explícita

- **Prós**: menos esforço, reaproveita o que já existe
- **Contras**: o padrão Kora já é bom (document-first, ADRs, `memory/`) mas nunca
  declarou explicitamente "otimize para agente, não para humano" — sem essa
  declaração, decisões futuras (nome de arquivo, tamanho de módulo) tendem a
  regressar pra convenção humana por hábito
- **Descartado porque**: este é o primeiro projeto Kora 100% código-por-IA; vale
  registrar a diferença explicitamente em vez de assumir que fica implícito

---

## Consequências

### Positivas

- Busca (grep, semantic search do agente) funciona melhor com terminologia 100%
  consistente — menos chance do agente "não encontrar" algo que existe só porque
  está com outro nome
- Arquivo pequeno reduz risco de edição às cegas (agente não precisa truncar leitura)
- README de índice em cada pasta acelera o "onboarding" de uma sessão nova do agente

### Negativas / Trade-offs

- Mais arquivos pequenos = mais índices pra manter atualizados conforme o projeto
  cresce (mitigado: README de índice é rápido de atualizar, e o custo de não ter é
  maior — agente perdido explorando árvore às cegas)
- Nomenclatura literal pode ficar mais verbosa do que a convenção idiomática enxuta
  que um dev humano preferiria — aceito como trade-off consciente

---

## Referências

- `CLAUDE.md` — seção "Organização para busca por IA", onde a regra prática vive
- `docs/03_REGRAS_DE_NEGOCIO/glossario.md` — glossário de domínio, fonte única de nomenclatura
- `memory/patterns.md` — padrões de código concretos (nomenclatura, estrutura de arquivos)

---

## Notas de Implementação

- Todo termo de domínio novo entra no glossário **antes** de ser usado em código
- Ao criar uma pasta nova em `src/` ou `supabase/`, criar o README.md de índice no
  mesmo commit — nunca depois
- Code review (mesmo que feito por outro agente) checa: nome bate com o glossário?
  Arquivo está dentro do alvo de tamanho? Comentário explica o "por quê"?
