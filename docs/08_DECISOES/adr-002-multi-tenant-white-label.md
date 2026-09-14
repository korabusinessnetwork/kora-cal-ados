# ADR-002, Estratégia multi-tenant e white-label

**Status**: Aceito
**Data**: 2026-08-12
**Decisores**: Matheus Bonato
**Supersede**: (nenhum)
**Supersedido por**: (nenhum ainda)

---

## Contexto

Kora Calçados atende times internos de marcas e fabricantes calçadistas. Diferente da
maioria dos SaaS B2B, o público-alvo inclui **marcas concorrentes diretas** dividindo o
mesmo sistema, o que eleva o custo de um vazamento entre tenants de "incidente de
dado pessoal" para "vazamento de coleção não lançada pra concorrência". Isso exige
tratar isolamento como requisito de produto desde a modelagem, não como detalhe de
implementação a ajustar depois.

Segue o padrão Kora: todo projeto novo nasce multi-tenant e white-label, mesmo que o
primeiro cliente seja único (ver `references/multi-tenant-white-label.md` da skill
`fundacao-de-projeto`).

---

## Decisão

Modelar **multi-tenant desde o schema inicial**, com `tenant_id` em toda tabela de
negócio (`products`, `product_zones`, `variants`) e política de RLS correspondente sem
exceção. White-label **sim**: identidade visual (nome, logo, cor) do editor por tenant
vem de configuração, nunca hardcoded. Planos/feature flags ficam **modelados como
conceito** (atributo do tenant) mas **não aplicados** na Fase 1, venda é manual, sem
enforcement automático de limite de plano ainda.

---

## Alternativas Consideradas

### 1. Single-tenant por instância (uma instância = um cliente)

- **Prós**: isolamento trivial (é outro banco/deploy inteiro), zero risco de RLS mal configurada
- **Contras**: custo operacional multiplica por cliente; contradiz o modelo de negócio (SaaS, não projeto sob encomenda); "outras ferramentas da suite" (mencionadas na visão do produto) ficariam mais difíceis de integrar entre clientes
- **Descartado porque**: o próprio produto foi concebido como SaaS multi-cliente desde a origem, e o padrão Kora já tem esse retrofit mapeado como uma das piores refatorações possíveis

### 2. Multi-tenant, mas sem white-label (marca única do produto pra todos os clientes)

- **Prós**: menos trabalho de tokenização de tema
- **Contras**: cliente enterprise calçadista tende a esperar a ferramenta com a cara da própria marca, especialmente se for embutida em processo interno
- **Descartado porque**: custo de modelar white-label desde o início é baixo (mesma lógica de config-por-tenant que o isolamento já exige); mantém opcionalidade sem custo real

### 3. Planos/feature flags aplicados (enforcement automático) já na Fase 1

- **Prós**: pronto pra self-serve quando chegar
- **Contras**: venda é manual/contrato na Fase 1 (ver `respostas-intake.md`, Bloco 6), não há necessidade de enforcement automático de limite ainda
- **Descartado por ora**: modelar o atributo de plano no tenant (sem enforcement) já evita retrabalho; enforcement de fato entra na Fase 3

---

## Consequências

### Positivas

- Nenhum retrofit de multi-tenancy necessário conforme a base de clientes cresce
- Isolamento entre marcas concorrentes é garantido estruturalmente (RLS + storage
  particionado), não depende de disciplina manual em cada nova feature
- White-label modelado desde já facilita venda B2B enterprise (cada marca vê a
  ferramenta com sua identidade)

### Negativas / Trade-offs

- Todo código novo carrega a obrigação de nunca hardcodar identidade nem esquecer RLS
  mais rigor exigido desde a primeira tabela, mesmo com poucos clientes
- Overhead pequeno de indireção (resolver tema/config do tenant em runtime) mesmo
  quando há um único cliente ativo

---

## Referências

- `references/multi-tenant-white-label.md` (skill fundacao-de-projeto), checklist completo aplicado aqui
- `docs/11_SEGURANCA/multi-tenancy-rls.md`, modelo de ameaças e controles de isolamento
- `docs/01_ARQUITETURA/overview.md`, modelo de dados (`tenants`, `products`, `product_zones`, `variants`)
- ADR-001, stack que hospeda essa estratégia (Supabase RLS como mecanismo de isolamento)

---

## Notas de Implementação

- Toda tabela nova: `tenant_id` + RLS, sem exceção, aviso explícito obrigatório ao criar tabela
- Nenhuma `service_role` (ou equivalente) em código que roda no navegador
- Teste de isolamento (dois tenants, garantir que um não vê produto/zona do outro) antes
  de considerar qualquer feature sensível pronta
- Config de tema/identidade do tenant carregada em runtime (`useTenant()` ou equivalente),
  nunca constante no componente
