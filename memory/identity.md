# Identidade do Produto, Kora Calçados (codinome)

## Objetivo
- Documentar a identidade, visão e diferencial do produto
- Guiar decisões de produto, design e comunicação
- Manter coerência em todos os pontos de contato com o usuário

## Contexto
- Mercado/vertical: indústria calçadista (B2B), fabricantes e marcas de calçado, com rede inicial no cluster do Vale dos Sinos/RS
- Estágio: **produto trazido em pé** (editor de zonas e API de variante implementados e testados); **produto gerado decidido em 2026-09-09** (ADR-007 e ADR-008) e **bloqueado no acervo de peças**, que ainda não existe
- Competidores diretos: continuam sem equivalente direto no B2B calçadista, mas o mapa mudou com a criação generativa e vale escrever os dois lados. **No modo trazido** (marcar zona e escalar variante): configuradores tipo "Nike By You" são proprietários e fechados, não vendidos como ferramenta; Kittl/Canva não modelam "zona de produto"; Bannerbear/Placid são motores de imagem API-first genéricos, sem editor nem vocabulário do setor. **No modo gerado** (prompt vira calçado), o concorrente não é um SaaS de catálogo: é a prancheta, o Photoshop/Illustrator e o gerador de imagem por prompt (Midjourney e similares), que devolve um quadro bonito e **nenhuma peça editável**, sem sola separada, sem girar, sem cor que saia igual pela API. Serviços de text-to-3D atacam a mesma vontade e esbarram no mesmo problema (malha fundida, sem partes semânticas, ADR-008, Alternativa 1). O diferencial defensável é o mesmo dos dois lados: **o calçado sai em partes endereçáveis**.

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
- Testes de posicionamento com usuários reais (times de produto calçadista e designers de criação)
- Pesquisa de marca (awareness, recall) quando sair da fase B2B de venda manual

## Casos de Uso
- Briefar novo membro do time
- Validar novo recurso contra identidade
- Decidir se entra/sai roadmap

## Critérios de Aceite
- [ ] Propósito central claro e testado com 3+ usuários reais do setor calçadista
- [ ] Personas documentadas com dores reais (Ana e Rafa são hipóteses fundamentadas; nenhuma entrevista foi feita, e a de Rafa é a mais nova e a menos testada, porque o modo gerado nasceu em 2026-09-09)
- [x] Tom de voz com exemplos ✅ e ❌, cobrindo os dois modos
- [x] Roadmap definido até a Fase 2 (produto gerado), com o pré-requisito de acervo escrito na cara em vez de escondido dentro da fase
- [ ] Acervo mínimo existe, ~15 peças de **uma** forma de tênis. Enquanto não existir, a Fase 2 não começa (ADR-008, "O gargalo mudou de lugar")

---

## Propósito Central

### Visão
Ser onde um calçado nasce **e** vira catálogo. Duas portas para o mesmo lugar: o designer escreve um prompt e o sistema **gera** o calçado em peças separadas, que ele gira em 3D e edita uma a uma; ou a marca **traz** o modelo que já tem, marca as zonas uma vez e gera todas as variantes de cor por API. Em qualquer das duas, a cor que aparece na tela é a cor que sai pela API.

O gerado é o carro-chefe do que vem por aí. O trazido é o que já funciona hoje, está testado e continua vendável enquanto o outro amadurece (ADR-008 D5), nada do que existe é jogado fora.

### Propósito
O que Kora Calçados faz e por quê

- **Problema que resolve (modo gerado, o novo)**: entre a ideia de um modelo e a primeira imagem apresentável dele existe um vão de dias, desenho à mão, CAD, ou um gerador de imagem que devolve um quadro que não dá para editar. Ninguém consegue dizer "essa, com a sola mais robusta" e ver a sola mudar.
- **Como resolvemos**: o prompt não vira geometria, vira **escolha sobre um acervo de peças** mais estilização (ADR-008 D1). O calçado gerado é uma **composição**, a lista de peças escolhidas com cor, material e parâmetros de cada uma, montada em 3D no navegador, girável, com cada peça clicável e editável por prompt ou à mão.
- **Problema que resolve (modo trazido, o que já funciona)**: gerar cada variante de cor/material de um modelo que a marca já tem exige fotografia ou edição manual por unidade, caro, lento, e não escala com catálogo grande.
- **Como resolvemos**: editor visual para o time marcar zonas endereçáveis (sola, cabedal, cadarço, logo) uma única vez; API gera qualquer combinação de cor/material sobre essas zonas, em escala.
- **Impacto esperado**: um modelo novo sai de prompt a três direções giráveis em uma tarde; um catálogo inteiro sai de "modelo pronto" a "todas as variantes" em minutos, sem fotografia por variante. Base técnica pronta para integrar com as próximas ferramentas da suite Kora para o setor calçadista.

*Referência do padrão Kora: Kora democratiza gestão de PDV/operação para bares e restaurantes indie, substituindo sistemas caros e lentos por uma ferramenta intuitiva, rápida e sem lock-in, Kora Calçados aplica o mesmo princípio à criação e à variante de produto.*

## Público-Alvo

| Segmento | Perfil | Contexto | Necessidade |
|---|---|---|---|
| Designer de calçado (criação) | Designer de linha/coleção, 25–45 anos | Começa um modelo do zero; hoje sai da ideia para a prancheta, o Illustrator ou o CAD, e a primeira imagem apresentável demora dias | Escrever o que quer, ver o calçado, girar, e refinar parte por parte ("sola mais robusta") sem abrir CAD |
| Time de produto/design calçadista | Designer ou PM de marca, 25–45 anos | Gera variante de cor/material por coleção hoje via Photoshop manual ou fotografia | Gerar variantes em escala sem repetir trabalho manual por unidade |
| Time técnico/e-commerce da marca | Dev ou gestor de catálogo | Precisa das variantes dentro do site/ERP, não só como arquivo solto | Consumir a geração por API, sem passo manual no meio |

## Valores
- Criação sem vão: menos tempo entre "tive a ideia" e "vejo o calçado girando"
- Velocidade de catálogo: menos tempo entre "modelo pronto" e "catálogo com todas as variantes"
- Isolamento entre tenants: coleção não lançada de uma marca nunca é visível para outra, mesmo que concorrente direta no mesmo sistema, vale também para o acervo de peças que a marca sobe (ADR-008 D6)
- Fidelidade de cor: o que o editor mostra é o que a API entrega, divergência é defeito, não detalhe
- Herdados do padrão Kora: intuitividade, transparência, sem lock-in

## Posicionamento

**Para** designers e times de produto de marcas calçadistas / **que** hoje param duas vezes, entre a ideia do modelo e a primeira imagem dele, e entre o modelo pronto e o catálogo de variantes / **Kora Calçados** é uma ferramenta de criação e customização de calçado / **que** gera o modelo por prompt sobre um acervo de peças reais, deixa girar em 3D e editar cada parte, e escala as variantes de cor por API / **Diferente de** configuradores fechados de marca (Nike By You), ferramentas de design genéricas (Kittl, Canva), motores de imagem genéricos (Bannerbear, Placid) e geradores de imagem por prompt (Midjourney e similares, que devolvem um quadro e nenhuma peça editável) / **entrega** o calçado em partes separadas, cada peça é uma zona endereçável, com o vocabulário do setor pronto de fábrica e a cor da tela igual à da API.

## Tom de Voz

**Princípios**: Direto, técnico sem ser burocrático

**Exemplos**:
- ✅ "Marca a sola, o cabedal e o cadarço uma vez. Gera 40 variantes em segundos."
- ✅ "Escreve 'tênis de corrida, sola alta, cabedal em malha'. Gira, olha a sola por baixo. Não gostou da sola? Escreve só a sola."
- ❌ "Plataforma de customização de produto com motor de renderização integrado end-to-end."
- ❌ "Experiência generativa de design de calçado potencializada por IA."

**Tom**: Fala como alguém que já lidou com catálogo de calçado e conhece a dor, não como um vendedor de software genérico.

## Manifesto (versão 1.1, 2026-09-09)
1. Zona é o conceito central, não layer solto, não foto inteira: é a parte específica do produto. O ADR-008 deixou isso mais verdadeiro, não menos: no produto gerado o calçado **nasce zoneado**, porque cada peça do acervo já é uma parte nomeada, com material próprio (ADR-008 D3)
2. Marcar zona é custo, não valor, no produto trazido alguém marca clicando porque o arquivo veio sem partes; no gerado essa etapa deixa de existir. A melhor marcação de zona é a que não precisa acontecer
3. Editor define, API escala, humano configura uma vez, a máquina gera o resto
4. Tenant nunca vê tenant, isolamento entre marcas concorrentes é inegociável, inclusive no acervo de peças

## Personas (2-4)

### Ana, Design de Produto (persona hipotética, validar com usuário real)
- **Contexto**: marca calçadista de porte médio, catálogo de 200+ modelos por coleção, hoje gera variante de cor manualmente no Photoshop
- **Dores**: cada variante nova é retrabalho manual; prazo de catálogo aperta a cada coleção; risco de inconsistência entre variantes feitas por pessoas diferentes
- **Objetivos**: fechar catálogo da coleção mais rápido; garantir que toda variante saia consistente
- **Sucesso**: gerar as variantes de cor/material de um modelo em minutos, não em dias
- **Modo que usa**: produto trazido, ela já tem o modelo

### Rafa, Designer de Calçado (persona hipotética, validar com usuário real; mais nova e menos testada que a Ana)
- **Contexto**: cria linhas novas numa marca ou como freela para fábrica; começa do zero, com referência e cabeça. Ferramentas de CAD calçadista (Rhino, Modo, Clo3D) existem no processo da empresa, mas partir delas é lento demais para explorar, **hipótese a validar**
- **Dores**: a distância entre a ideia e a primeira imagem que dá para mostrar é de dias; mudar a forma de uma parte significa refazer o desenho; o que a diretoria aprova é imagem, e imagem boa demora; gerador de imagem por prompt dá quadro bonito e nada editável, não dá para dizer "essa, mas com a sola mais robusta"
- **Objetivos**: sair de uma conversa com várias direções de modelo para mostrar; ver o calçado por baixo e por trás, não só de perfil; mexer numa parte sem refazer o resto
- **Sucesso**: numa tarde, três propostas de tênis geradas por prompt, giradas e ajustadas peça por peça, e a mesma peça já pronta para virar variante de cor depois
- **Modo que usa**: produto gerado, ela não tem nada na mão

## Princípios do Produto
- Zona antes de pixel, toda decisão de produto parte do conceito de zona endereçável
- Peça é zona, no produto gerado, a unidade de edição é a peça do acervo, e ela já vem separada; não se cria zona por cima do que um modelo generativo devolveu
- Sem lock-in de asset, o cliente sai com arquivo aberto: **SVG** no produto trazido, **glTF** no produto 3D, e a **composição** do produto gerado é JSON de poucas linhas, legível e diffável (ADR-008 D2). Uma ressalva honesta: a composição aponta para peças do **acervo base da Kora**, então portabilidade total do produto gerado é pergunta em aberto, não prometer o que ninguém especificou
- Isolamento de tenant acima de conveniência técnica
- Saída de modelo generativo é validada, nunca aceita, id de peça que não existe é recusa explícita, no mesmo espírito de "zona não aplicada é erro, nunca aviso" (ADR-008 D1)

## Identidade Visual (marca)
- **Cores primárias**: TBD, sem identidade visual definida ainda
- **Tom visual**: TBD
- **Logo/símbolo**: TBD
- *Pendente, Bloco 7 do intake (Design) não foi conduzido; revisar quando o nome real do produto for definido.*

## Roadmap

Reordenado em 2026-09-09 pelos ADR-007 e ADR-008. A regra que organiza a ordem é a do ADR-008: **acervo → composição → prompt**, nunca o contrário.

- **Fase 0, Fundação** (feita): documentação, arquitetura e ADRs registrados
- **Fase 1, Produto trazido** (é o que existe e está testado hoje): editor de zonas sobre modelo vetorial/ilustrado + API de geração de variante de cor/material; multi-tenant; venda manual/contrato (sem billing automatizado). Continua vendável e não é tocada pelo modo gerado (ADR-008 D5)
- **Pré-requisito da Fase 2, o acervo mínimo** (bloqueio duro, não detalhe): **~15 peças de UMA forma de tênis**, cerca de 3 solas, 3 cabedais, 3 cadarços, 3 línguas e o resto fixo, modeladas ou licenciadas, cada uma com nome próprio e material próprio. Está aqui como fase porque o gargalo deste produto deixou de ser código e passou a ser conteúdo: nenhuma linha do modo gerado é difícil, e nenhuma pode ser escrita com honestidade antes dessas peças existirem (ADR-008, "O gargalo mudou de lugar"). É o análogo exato do papel que o `tenis-demo.svg` cumpre hoje
- **Fase 2, Produto gerado**: palco 3D com órbita e modo cor chapa (ADR-007), composição sobre o acervo e edição peça por peça. A ordem interna é a do ADR-008: primeiro o acervo, depois a composição editável à mão (que já é produto, o configurador), e o **prompt por último**, porque é a camada mais fácil de trocar e a única que depende de serviço pago
- **Fase 3, Self-serve + billing automatizado** (Stripe/Asaas, padrão Kora); planos e feature flags por tenant
- **Fase 4, Suite Kora**: integração com as próximas ferramentas para o setor calçadista

### Saiu do roadmap (registrado, não apagado)

- **Segmentação de foto real via IA**, era a Fase 2 até 2026-09-09. Entrou quando o gargalo parecia ser "a marca só tem foto, não tem vetor", e a resposta era ensinar a máquina a achar a sola dentro da fotografia. Sai da numeração por dois motivos. O primeiro é de direção: o ADR-008 resolve o mesmo problema pelo outro lado, no produto gerado a peça **já vem separada**, então não há o que segmentar. O segundo é o de sempre neste projeto: segmentar foto entrega justamente o modo de falha que o princípio nº1 proíbe, uma borda quase certa que erra em silêncio e pinta o lugar errado sem avisar. **Não está morta**, continua fazendo sentido para a marca que só tem foto, mas está atrás do acervo e sem data
- **"Perfil de Marca"** (IA que aprende identidade/comportamento da marca), era a segunda metade da Fase 4. Deixa de ser fase e volta a ser item de backlog em `docs/09_BACKLOG/features.md`, onde já está descrito. Motivo: nunca foi especificado, e agora disputaria atenção com uma fase que tem pré-requisito físico e prazo desconhecido. Promover a fase o que ainda é ideia atrapalha a leitura do roadmap

---

## Atualizações deste documento

- **2026-09-09**, **a virada do produto gerado.** Até hoje este arquivo dizia que o cliente era um time de produto que **já tem o modelo** e quer escalar catálogo de variantes; a única persona era a Ana, e o roadmap tratava "zonas sobre foto real" como o próximo salto. O dono descreveu o produto que ele realmente quer: o designer entra **sem nada na mão**, escreve um prompt, o sistema **gera** o calçado, e ele refina por parte ("sola mais robusta") girando o modelo em 3D. Isso não corrigiu um detalhe da identidade, trocou quem é o usuário no momento em que o produto começa.

  O que mudou aqui, e por quê: **Visão e Propósito** passam a descrever dois modos, porque o dono decidiu explicitamente que eles **convivem** (ADR-008 D5), o trazido é o que está em pé e testado, o gerado é o que vem por aí; **Público-Alvo** ganha o designer que cria, que simplesmente não existia na tabela; entra a persona **Rafa**, marcada hipotética como a Ana, porque nenhuma das duas foi entrevistada e este arquivo não finge validação; o **posicionamento** deixa de prometer só customização, que não cobre criação; o **manifesto** ganha o item 2, porque a consequência mais forte do ADR-008 é que a etapa de marcar zona **desaparece** no modo gerado (D3), a zona nasce pronta, já que cada peça é uma zona; **competidores** passam a incluir o gerador de imagem por prompt, que é contra quem o modo gerado disputa de verdade, e a resposta a ele é a mesma frase de sempre: o calçado sai em partes.

  E o **roadmap** foi reordenado com o pré-requisito na cara: o modo gerado está bloqueado num acervo de ~15 peças de uma forma de tênis que **não existe**. Escrever isso como fase própria é deliberado, o gargalo deste produto deixou de ser técnico e virou de conteúdo, e essa é a parte mais fácil de subestimar hoje.

  Superado: "editor visual para o time de produto marcar zonas num modelo que a marca já tem" como descrição **única** do produto, vira a descrição de **um** dos dois modos. Nada foi apagado; o modo trazido continua sendo o que funciona hoje.
- **2026-08-12**, versão inicial, escrita a partir do intake de fundação
