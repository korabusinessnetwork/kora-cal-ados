# Restrições Permanentes, Kora Calçados (codinome)

## Objetivo
- Documentar limites e restrições que guiam decisões
- Evitar caminhos bloqueados (custo, legal, ético, técnico)
- Força atualizações de restrições vencidas

## Contexto
- Restrição = barreira de entrada; exceção exige ADR
- Revisão: trimestral

## Regras Gerais
- Nenhuma restrição ignorada sem ADR formal de exceção
- Restrições legais/compliance têm prioridade máxima
- Restrição vencida é removida; não acumula dívida técnica

## Validações
- Restrição tem justificativa concreta?
- Data de revisão planejada está clara?

## Permissões
- Dono/compliance: aprova exceção de restrição legal
- Tech lead: aprova exceção técnica

## Exceções
- Restrição legal pode ser violada por decisão explícita do dono com ADR (raro)

## Auditoria
- Revisar todas as restrições contra realidade trimestralmente
- Exceções aprovadas vira ADR público

## Eventos
- `restriction.added`, `restriction.excepted`, `restriction.lifted`

## Casos de Uso
- "Posso usar biblioteca paga?"
- "Posso armazenar dados de PII sem encriptação?"
- "Temos limite de infraestrutura?"

## Critérios de Aceite
- [ ] Cada categoria tem mínimo 1 restrição preenchida
- [ ] Restrições com data de revisão clara
- [ ] Exceções aprovadas linkadas a ADR

---

## Restrições Técnicas

| Restrição | Detalhes | Revisão | Exceção |
|---|---|---|---|
| Sem worker sempre-ligado (Railway/Render) | **Continua valendo depois de ADR-007 e ADR-008**, e vale a pena dizer por quê, porque "3D" e "IA" soam como coisas que exigem worker e aqui não exigem. Recolorir glTF é escrever um número num JSON (ADR-007 D1); gerar calçado é uma chamada de texto que devolve algumas linhas de JSON (ADR-008 D2). Nenhum dos dois tem fila, processo longo ou binário nativo, função serverless comum continua bastando | 2026-11-01 | Reavalia se aparecer etapa que não cabe no tempo/memória da função: Fase 2 (segmentação de foto real) ou a rota de gerar malha por IA, que o ADR-008 descartou (Alternativa 1). Exige ADR novo |
| Sem Redis pago (bootstrap) | Cache de variante é a própria tabela `variants` + Storage, não terceiros | 2026-11-01 | Exceção por ADR se volume de geração crescer 10x |
| Sem webhook/automação paga | Funções serverless da Vercel + Supabase (grátis) cobrem o necessário | 2026-11-01 | Reavalia quando houver receita recorrente |
| Motor de render precisa caber em função serverless (sem GPU, sem processo longo) | **Preservada inteira pelos dois ADRs de 2026-09-09, de propósito, e isso é boa notícia que precisa estar escrita**, senão alguém "descobre" daqui a seis meses que 3D exige GPU e gasta dinheiro por engano. ADR-007 D1: **o servidor nunca renderiza**; quem desenha a cena é o navegador de quem olha (three.js, MIT, grátis), e o servidor só edita `baseColorFactor` no glTF. ADR-007 Alternativa 4 (renderizar PNG no servidor) foi descartada exatamente por reabrir GPU/binário nativo. ADR-008 D2: a IA fica numa chamada de texto, não em GPU. Limite de tempo/memória da Vercel segue sendo o teto de projeto do motor | 2026-11-01 | Fase 2 (foto real) e `?format=png` seguem sendo os candidatos a exceção formal, novo ADR. 3D **não** é candidato |
| IA não gera geometria, só escolhe e estiliza peça que já existe | ADR-008 D1. O modelo de linguagem recebe o catálogo do acervo e devolve ids; peça inventada é **recusa explícita**, nunca calçado com buraco no lugar da sola. Restrição técnica e de segurança ao mesmo tempo: a saída do modelo é entrada não confiável que vira escolha de arquivo (ADR-008, "superfície de ataque"), e é a validação contra o acervo que separa isso de uma vulnerabilidade | 2026-11-01 | Só por ADR novo, e só quando separação semântica de malha gerada for confiável em produção, o ADR-008 deixa a porta aberta (Alternativa 1) sem abri-la |

## Restrições Legais / Compliance

| Restrição | Detalhes | Prioridade | Revisão |
|---|---|---|---|
| Isolamento entre tenants concorrentes | RLS obrigatória em toda tabela + storage particionado por tenant; marca concorrente nunca vê coleção de outra | CRÍTICA | 2026-11-01 (trimestral) |
| LGPD: minimização de dado | Só nome/e-mail/empresa do usuário do time cliente, nada além do necessário pra login e contato | CRÍTICA | 2027-08-12 (anual) |
| Dados de menores | Não aplicável na Fase 1 (B2B puro, sem consumidor final). Mantida como trava caso o produto ganhe camada B2C | CRÍTICA | 2027-08-12 (anual) |
| Retenção de dados | 90 dias máx logs, 2 anos máx operacionais, cliente pode exportar/excluir sempre | CRÍTICA | 2027-08-12 (anual) |
| Licença de cada peça do acervo é rastreada antes de a peça entrar | Peça comprada de banco 3D (Sketchfab/TurboSquid e afins) **vem com licença**, e licença de banco 3D costuma restringir redistribuição, que é exatamente o que o produto faz quando devolve o artefato ao cliente pela API. Peça de origem duvidosa contamina todo calçado composto com ela. Portanto: nenhuma peça entra no acervo base sem origem e licença registradas, e a checagem é antes da compra, não depois. **Peça que o tenant sobe é dele**, a Kora hospeda, não adquire direito sobre ela, e ela nunca vai para o acervo base nem para o catálogo de outro tenant (ADR-008 D6) | ALTA | 2026-11-01 |

## Restrições de Custo (Fase Bootstrap)

**Diretriz Geral**: Priorizar meios **gratuitos**. Toda implementação com custo relevante é **ADIADA por padrão**, salvo decisão explícita do dono.

### Implementações Pagas Encontradas
Ao esbarrar em algo pago, seguir este checklist:

- [ ] **Custo aproximado**: R$ X/mês ou Y% do MRR
- [ ] **Alternativa gratuita**: Qual? Por que não usável agora?
- [ ] **Importância/Impacto**: Crítica / Alta / Média / Baixa para produto
- [ ] **Recomendação**: Investir AGORA ou MAIS PRA FRENTE?
- [ ] **Decisão do dono**: [Reter até decisão explícita]

### Exemplos de Itens Pagos (Restringidos)

| Item | Custo Aprox | Alt Grátis | Impacto | Status |
|---|---|---|---|---|
| **Acervo de peças 3D**, ~15 peças de **uma** forma de tênis (3 solas, 3 cabedais, 3 cadarços, 3 línguas, resto fixo), cada uma com nome próprio e material próprio | **Não é software, é conteúdo**: tempo de modelagem ou freelancer. Ordem de grandeza **centenas a poucos milhares de reais** pelo conjunto, ou algumas semanas de trabalho próprio, **estimativa, sem cotação; nenhum fornecedor foi consultado**. Cada **forma** nova (chinelo, bota, social) multiplica isso: são acervos diferentes, não peças a mais (ADR-008 D4) | Sim, três, todas com preço em tempo e não em dinheiro: (a) CAD da própria marca cliente exportado para glTF, a saída ideal, ADR-007; (b) modelar internamente; (c) modelo pronto de banco 3D com licença comercial (mais rápido, exige conferir licença e renomear malhas) | **CRÍTICA e bloqueante.** É o gargalo real do projeto hoje: ADR-007 e ADR-008 estão ambos "aceito, implementação bloqueada no acervo". Sem essas peças, nenhuma linha do modo gerado pode ser escrita com honestidade, seria motor sem combustível | **DECIDIDO em 2026-09-10: acervo de prova primeiro.** Cerca de 5 peças em geometria grosseira, só para provar a esteira de ponta a ponta (encaixe, zona, recolor). Custo zero em dinheiro. Modelagem de verdade fica para depois de a esteira funcionar, quando já se saberá exatamente o que se está comprando. É o mesmo papel que `gltfDeTeste.ts` cumpre nos testes: combustível grosseiro ainda é combustível, e um motor que nunca viu combustível nenhum não pode ser verificado. As opções (a), (b) e (c) da coluna ao lado seguem válidas para o acervo definitivo] |
| **Chamada de modelo de linguagem para gerar composição** (prompt do designer → escolha de peças do acervo + cor/material) | Ordem de grandeza **fração de centavo a poucos centavos de real por geração**, é uma chamada de texto que devolve algumas linhas de JSON (ADR-008 D2), sem GPU, sem fila, sem serviço de geração 3D. Em desenvolvimento e piloto, plausivelmente **dezenas de reais/mês**. **Estimativa por ordem de grandeza; preço real depende do fornecedor e do modelo escolhidos, e nenhum foi escolhido ainda.** Escala com número de gerações, não com número de tenants | Sim: o **configurador manual**, ADR-008, Alternativa 3. A composição é JSON pequeno e editável à mão, então escolher peça por menu entrega o mesmo calçado com custo zero de IA. É também o fallback quando a chamada falhar ou ficar cara: a composição continua editável e o sistema não para | ALTA, não crítica. O prompt é a porta de entrada que o dono pediu, mas o produto **funciona sem ele** pela alternativa grátis. Por isso a ordem de construção do ADR-008 é acervo → composição → prompt: o item pago é a última camada e a mais fácil de trocar | **DECIDIDO em 2026-09-10: ADIADO, e o configurador vem primeiro.** Não aprovado e não contratado, por escolha e não por omissão. Com o acervo de prova, a composição editável à mão já é produto, então a esteira inteira pode ser verificada sem gastar nada, que é literalmente a ordem que o ADR-008 manda seguir (acervo → composição → prompt). O prompt entra por cima depois. Se a esteira não funcionar, isso é descoberto sem ter havido despesa. Revisitar quando o configurador estiver rodando sobre o acervo de prova] |
| Segmentação de foto real (IA/SAM ou equivalente) | A definir na Fase 2 | Não, Fase 1 é vetor-only | ALTA (só na Fase 2) | [ADIADO até Fase 2 ser priorizada] |
| Stripe/Asaas (gateway) | 2.99% + R$ 0.30/tx (Stripe) | Venda manual/contrato, PIX/TED | CRÍTICA (fase billing) | [ADIADO, venda manual na Fase 1, ver ADR quando Fase 3 chegar] |
| Supabase tier pago (storage de SVG/PNG **e agora de glTF**) | ~US$ 25/mês (preço público de tabela, conferir antes de contratar) | Free tier até estourar | **MÉDIA → ALTA depois do ADR-007/008.** SVG é KB; peça em glTF é **MB**, ordem de grandeza mil vezes maior por arquivo (estimativa; depende de densidade de malha e de haver textura, e nada foi medido porque ainda não existe glTF no projeto). Dois atenuantes reais: o **acervo base é único e compartilhado** por todos os tenants (não multiplica por cliente), e o calçado gerado é uma **composição** de algumas linhas de JSON, não uma malha guardada (ADR-008 D2). O que multiplica por tenant é o **acervo privado** dele (ADR-008 D6) | [ADIADO, mas **medir o tamanho real das primeiras peças assim que o acervo existir**, antes de assumir que o free tier aguenta] |
| Analytics pago (Mixpanel) | R$ 200+/mês | PostHog open-source, Plausible | BAIXA (B2B, poucos usuários por tenant) | [ADIADO, usar alternativa grátis] |

**Processo**: Dono revisa lista trimestralmente, aprova investimentos conforme receita cresce.

## Restrições de Produto

| Restrição | Detalhes | Por quê | Exceção |
|---|---|---|---|
| Foto real como imagem-base | MVP só aceita vetor/ilustração; foto real fica pra Fase 2 | Segmentação de foto exige IA/custo/complexidade que o MVP não precisa pra provar o valor central | Reavaliar quando Fase 2 for decidida (novo ADR) |
| Sem lock-in | **Formalizado no ADR-009 em 2026-09-10.** Sai tudo que é da marca, em formato aberto: asset-base canônico, zonas, composições, histórico de variantes como receita, e as peças do acervo próprio dela. O que **não** sai é o acervo base da Kora, e esse limite está escrito de frente no ADR em vez de descoberto pelo cliente depois | Diferencial + confiança, e barato porque o sistema guarda receita e nunca resultado | Nunca. Prioridade máxima |
| Multi-tenancy obrigatório | Novo código assume N tenants, não hardcoda marca/cores | Roadmap de escala + isolamento entre concorrentes | Refatorar antes de mergear (ver ADR-002) |
| Sem hardcode de identidade | Tema, cores, logo, regras vêm da config do tenant | White-label | Usar contexto de tenant em runtime, nunca constante no componente |
| Sem promessa de cor sem falha visível | Zona pedida que não foi aplicada é erro na resposta, nunca 200 silencioso | Cor errada vira calçado errado, princípio nº1 | Nenhuma |

## Restrições Éticas

| Restrição | Detalhes | Revisão |
|---|---|---|
| Sem promessa de fidelidade de cor sem calibração | Nunca comunicar "cor exata de fábrica" sem testar contra padrão físico (Pantone/RAL), cor de tela ≠ cor de produção | 2026-11-01 |
| Transparência de IA | **Deixou de ser hipótese em 2026-09-09** (ADR-008): IA generativa está no núcleo do modo gerado, não numa função opcional de canto. Então a regra endurece, a interface diz, no lugar em que o calçado aparece, que ele foi **composto automaticamente a partir de um prompt**, e diz também o que a IA fez e o que ela não fez: ela **escolheu e estilizou peças que já existiam no acervo**, não desenhou um calçado (ADR-008 D1). Essa segunda metade não é firula jurídica, um designer que acredita que a máquina esculpiu a sola tem uma expectativa errada do teto do produto, e descobre isso da pior forma, na terceira tentativa | 2026-11-01 |
| Propriedade do que é gerado | Um calçado gerado é uma **composição** (ADR-008 D2), dado do tenant, como qualquer variante: ele exporta e leva embora, e vale a regra "sem lock-in". Mas composição **aponta para peças**, e a peça continua sob a licença dela (ver Legais). Ou seja: a composição é do tenant; a peça do acervo base, não. Enquanto o modo gerado não for vendido, isto fica escrito aqui; **antes da primeira venda com modo gerado, vira cláusula de contrato**, quem é dono do calçado composto, o que o tenant pode fabricar e comercializar, e o que acontece com as composições dele se sair | 2026-11-01 |
| Sem dark patterns | Nada de default sneaky (auto-renovação, confirmação dupla para cancelar) | Contínuo |

---

## Plano de Revisão

- **Última revisão**: 2026-09-09, provocada por ADR-007 (calçado 3D manipulável) e ADR-008
  (calçado gerado sobre acervo de peças), que mexeram em restrição técnica, de custo, legal e
  ética no mesmo dia
- **Próxima revisão legal/compliance**: 2026-11-01, pauta já definida: licença das peças do
  acervo e a cláusula de propriedade do calçado gerado, ambas antes da primeira venda com modo
  gerado
- **Próxima revisão técnica**: 2026-11-01
- **Próxima revisão de custo**: **agora, não trimestral.** Duas linhas novas entraram
  aguardando decisão explícita do dono e nenhuma foi aprovada, o **acervo de peças** (que é
  bloqueante: ADR-007 e ADR-008 estão parados nele) e a **chamada de modelo de linguagem**
  (primeira dependência paga recorrente do projeto). A revisão de Fase 2 (segmentação de foto
  real) continua no lugar de sempre, quando for priorizada
- **Proprietário de cada seção**: Matheus Bonato

## Exceções Aprovadas (ADRs)

| Restrição | ADR | Data Exceção | Contexto |
|---|---|---|---|
| (nenhuma exceção aprovada até 2026-09-09) | - | - | - |
