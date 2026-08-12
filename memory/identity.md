# Identidade do Produto — Kora Calçados (codinome)

## Objetivo
- Documentar a identidade, visão e diferencial do produto
- Guiar decisões de produto, design e comunicação
- Manter coerência em todos os pontos de contato com o usuário

## Contexto
- Mercado/vertical: indústria calçadista (B2B) — fabricantes e marcas de calçado, com rede inicial no cluster do Vale dos Sinos/RS
- Estágio: ideação / pré-MVP (fundação recém-criada)
- Competidores diretos: nenhum equivalente direto no B2B calçadista. Configuradores tipo "Nike By You" são proprietários e fechados, não vendidos como ferramenta. Kittl/Canva não modelam "zona de produto". Bannerbear/Placid são motores de imagem API-first genéricos, sem editor nem vocabulário do setor.

## Regras Gerais
- Identidade é fonte de verdade para mensagens, tone of voice, visual
- Personas e públicos-alvo devem guiar todo novo recurso
- Posicionamento não muda sem revisão de mercado

## Validações
- Cada mensagem público alinha com a fórmula de posicionamento?
- Personas refletem pesquisa real de usuário?

## Permissões
- Dono do produto: Matheus Bonato (ajusta propósito, persona, roadmap)
- Design/marketing: (aplica tom e identidade visual)

## Exceções
- Decisões de posicionamento overnight exigem ADR

## Auditoria
- Revisar identidade trimestralmente contra mercado

## Eventos
- `product.identity_defined`, `product.positioning_updated`, `persona.identified`

## Configurações Futuras
- Testes de posicionamento com usuários reais (times de produto calçadista)
- Pesquisa de marca (awareness, recall) quando sair da fase B2B de venda manual

## Casos de Uso
- Briefar novo membro do time
- Validar novo recurso contra identidade
- Decidir se entra/sai roadmap

## Critérios de Aceite
- [ ] Propósito central claro e testado com 3+ usuários reais do setor calçadista
- [ ] Personas documentadas com dores reais (validar com entrevista, hoje é hipótese fundamentada)
- [x] Tom de voz com exemplos ✅ e ❌
- [x] Roadmap definido até Fase 2

---

## Propósito Central

### Visão
Ser o motor padrão de geração de variantes visuais para a indústria calçadista brasileira — todo modelo de calçado tem suas cores e materiais gerados em segundos, não em sessões de fotografia ou edição manual repetida.

### Propósito
O que Kora Calçados faz e por quê
- Problema que resolve: gerar cada variante de cor/material de um modelo hoje exige fotografia ou edição manual por unidade — caro, lento, e não escala com catálogos grandes.
- Como resolvemos: editor visual para o time de produto marcar zonas endereçáveis num modelo (sola, cabedal, cadarço, logo) uma única vez; API gera qualquer combinação de cor/material sobre essas zonas, em escala.
- Impacto esperado: catálogos completos gerados em minutos sem fotografia repetida por variante; base técnica pronta para integrar com as próximas ferramentas da suite Kora para o setor calçadista.

*Referência do padrão Kora: Kora democratiza gestão de PDV/operação para bares e restaurantes indie, substituindo sistemas caros e lentos por uma ferramenta intuitiva, rápida e sem lock-in — Kora Calçados aplica o mesmo princípio à geração de variante de produto.*

## Público-Alvo

| Segmento | Perfil | Contexto | Necessidade |
|---|---|---|---|
| Time de produto/design calçadista | Designer ou PM de marca, 25–45 anos | Gera variante de cor/material por coleção hoje via Photoshop manual ou fotografia | Gerar variantes em escala sem repetir trabalho manual por unidade |
| Time técnico/e-commerce da marca | Dev ou gestor de catálogo | Precisa das variantes dentro do site/ERP, não só como arquivo solto | Consumir a geração por API, sem passo manual no meio |

## Valores
- Velocidade de catálogo: menos tempo entre "modelo pronto" e "catálogo com todas as variantes"
- Isolamento entre tenants: coleção não lançada de uma marca nunca é visível para outra, mesmo que concorrente direta no mesmo sistema
- Fidelidade de cor: o que o editor mostra é o que a API entrega — divergência é defeito, não detalhe
- Herdados do padrão Kora: intuitividade, transparência, sem lock-in

## Posicionamento

**Para** times de produto de marcas calçadistas / **que** perdem tempo e dinheiro gerando cada variante de cor manualmente / **Kora Calçados** é um motor de customização de produto / **que** combina editor visual de zonas com API de geração em escala / **Diferente de** ferramentas de design genéricas (Kittl, Canva) ou motores de imagem genéricos (Bannerbear, Placid) / **entrega** o vocabulário e o fluxo do setor calçadista prontos de fábrica.

## Tom de Voz

**Princípios**: Direto, técnico sem ser burocrático

**Exemplos**:
- ✅ "Marca a sola, o cabedal e o cadarço uma vez. Gera 40 variantes em segundos."
- ❌ "Plataforma de customização de produto com motor de renderização integrado end-to-end."

**Tom**: Fala como alguém que já lidou com catálogo de calçado e conhece a dor — não como um vendedor de software genérico.

## Manifesto (versão 1.0)
1. Zona é o conceito central — não layer solto, não foto inteira: é a parte específica do produto
2. Editor define, API escala — humano configura uma vez, a máquina gera o resto
3. Tenant nunca vê tenant — isolamento entre marcas concorrentes é inegociável

## Personas (2-4)

### Ana, Design de Produto (persona hipotética — validar com usuário real)
- **Contexto**: marca calçadista de porte médio, catálogo de 200+ modelos por coleção, hoje gera variante de cor manualmente no Photoshop
- **Dores**: cada variante nova é retrabalho manual; prazo de catálogo aperta a cada coleção; risco de inconsistência entre variantes feitas por pessoas diferentes
- **Objetivos**: fechar catálogo da coleção mais rápido; garantir que toda variante saia consistente
- **Sucesso**: gerar as variantes de cor/material de um modelo em minutos, não em dias

## Princípios do Produto
- Zona antes de pixel — toda decisão de produto parte do conceito de zona endereçável
- Sem lock-in de asset — SVG/vetor exportável, cliente não fica preso
- Isolamento de tenant acima de conveniência técnica

## Identidade Visual (marca)
- **Cores primárias**: TBD — sem identidade visual definida ainda
- **Tom visual**: TBD
- **Logo/símbolo**: TBD
- *Pendente — Bloco 7 do intake (Design) não foi conduzido; revisar quando o nome real do produto for definido.*

## Roadmap

- **Fase 0 (atual)**: Fundação documentada (esta), arquitetura definida, ADR-001 registrado
- **Fase 1 (MVP)**: Editor de zonas sobre modelo vetorial/ilustrado + API de geração de variante de cor/material; multi-tenant; venda manual/contrato (sem billing automatizado)
- **Fase 2**: Segmentação de foto real via IA (zonas sobre fotografia de produto)
- **Fase 3**: Self-serve + billing automatizado (Stripe/Asaas, padrão Kora); planos e feature flags por tenant
- **Fase 4**: Integração com as próximas ferramentas da suite Kora para o setor calçadista; explorar "Perfil de Marca" (IA que aprende identidade/comportamento da marca — capturado em `docs/09_BACKLOG/features.md`, ainda não especificado)
