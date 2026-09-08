# Features Planejadas — Kora Calçados (codinome)

> Prioridade, esforço e dono entram conforme o backlog for revisado. Por ora, cada
> entrada tem o mínimo pra não perder a ideia: o que é, por que importa, o que falta
> decidir.

## Recolor preservando gradiente

**Fase**: 1.5 — depende de dado real (ver "gatilho" abaixo), não de decisão nova.

**O que é**: hoje, zona pintada com gradiente ou pattern é **erro**
(`ZONA_NAO_RECOLORIVEL`, decisão 1 do ADR-004) — o motor se recusa a achatar em cor
chapa porque isso apagaria o volume/sombreado do modelo sem avisar. A evolução é
recolorir **mantendo** o gradiente: trocar as paradas de cor (`<stop>`) preservando a
variação de luminosidade entre elas.

**Por que importa**: ilustração de calçado usa gradiente justamente onde a marcação de
zona é mais valiosa — sola e cabedal, pra dar volume. Enquanto isso for erro, esses
modelos simplesmente não entram no catálogo.

**Gatilho para priorizar**: os primeiros arquivos reais de cliente. Se vierem cheios de
gradiente, isto deixa de ser evolução e vira barreira de adoção — repriorizar na hora.

**Perguntas em aberto**:
- A cor pedida vira a parada mais escura, a mais clara, ou a média das paradas?
- Gradiente compartilhado entre zonas diferentes (mesmo `<linearGradient>` referenciado
  por duas zonas) precisa ser duplicado antes de recolorir — o normalizador faz isso no
  upload ou o motor faz na geração?

**Status**: capturada, não especificada.

## Perfil de Marca — IA que aprende como a marca se comporta

**Fase**: 4+ (pós-MVP, pós-validação do núcleo mecânico) — **não é escopo de Fase 1**
(ver ADR-001: MVP é motor mecânico vetor-only, sem componente de IA).

**O que é**: um espaço onde o tenant "ensina" a IA da aplicação a identidade da marca —
paleta de cor permitida, combinações proibidas, materiais típicos, tom/estilo visual.
Uma vez ensinada, a IA passa a:
- Sugerir variantes on-brand automaticamente ("gera 20 variantes que combinam com a
  marca X"), não só executar a combinação exata pedida
- Validar/alertar quando uma variante pedida foge do padrão aprendido
- Potencialmente gerar catálogo inteiro a partir de uma direção geral, não cor por cor

**Por que importa**: eleva o produto de "motor mecânico de recolor" pra "assistente
que entende a marca" — diferencial real frente a motores puramente mecânicos
(Bannerbear/Placid) e frente a IA genérica não treinada em marca específica
(Kittl/Canva). É o tipo de camada que justifica o produto virar plataforma, não só
ferramenta.

**Perguntas em aberto** (resolver quando esta fase for priorizada, não antes):
- "Projeto" da ideia original é o próprio tenant, ou uma unidade nova **abaixo** do
  tenant — para fabricante com múltiplas sub-marcas? Se for a segunda opção,
  `glossario.md` precisa de um termo novo (hoje "marca" e "tenant" são tratados como
  equivalentes — isso pode deixar de ser verdade aqui)
- Ensinar = formulário estruturado (paleta, regras explícitas) ou upload de
  brandbook/referências visuais pra IA extrair sozinha?
- IA sugere e humano aprova sempre, ou pode gerar direto sem revisão em algum fluxo?
- Onde mora o "conhecimento aprendido" — linha nova em `tenants.tema` (jsonb já
  existe pra isso) ou tabela dedicada?

**Status**: capturada, não especificada. Retomar no planejamento de Fase 4.

**Nota adicional**: a interface de treino precisa de um tutorial acessível (tipo botão
de ajuda) explicando como retreinar a IA sempre que o time da marca precisar — não só
um onboarding único. Detalhar junto com o resto desta feature na Fase 4.

## `?format=png` — variante rasterizada

**Fase**: 1.5 — fora do escopo da primeira versão da API por decisão registrada, não por
esquecimento. Hoje, `?format=` diferente de `svg` é **400 explícito**
(`FORMATO_NAO_SUPORTADO`), nunca parâmetro ignorado em silêncio: ignorar devolveria 200 com
um artefato que não é o que o cliente pediu. Contrato em `docs/07_APIS/endpoints.md`.

**O que é**: rasterizar o SVG da variante em PNG sob demanda, na própria função serverless,
com `sharp` ou `resvg` (ambos citados como stack alvo no `CLAUDE.md`; nenhum dos dois está
instalado — não aparecem em `package.json`).

**Por que importa**: catálogo, marketplace e material de venda pedem bitmap. Um cliente que
só sabe consumir PNG hoje não integra, ou integra e rasteriza do lado dele — e aí o pixel
final deixa de ser responsabilidade nossa justamente na etapa em que a cor pode mudar.

**O problema mais fundo — e é ele que segura a entrega**: PNG não é um formato de saída a
mais, é um **segundo renderizador**. O SVG que a API devolve hoje é a saída literal de
`gerarVarianteDeCor`: o hex que a pessoa marcou no editor é o hex do atributo `fill`, e
nenhuma etapa entre os dois pode mudá-lo. Rasterizar insere um motor gráfico inteiro nesse
caminho — anti-aliasing, perfil de cor, `opacity` composta, fonte substituída em `<text>` —
e cada um deles pode entregar um pixel que **não é** o hex pedido. Sob o princípio nº1
(cor no editor = cor na API), vender PNG antes de provar essa igualdade é vender exatamente
a divergência silenciosa que o projeto existe para não ter. A prova é entrega própria: um
teste que rasteriza e lê o pixel de volta, não uma inspeção a olho.

**Custo de infra**: `sharp`/`resvg` carregam **binário nativo**, com o peso e o tempo de
cold start que isso implica numa função serverless do free tier — ver `memory/restrictions.md`.

**Gatilho para priorizar**: o primeiro cliente cujo sistema não consome SVG. Enquanto todos
consumirem, PNG é conveniência; quando um não consumir, vira barreira de adoção.

**Perguntas em aberto**:
- Qual a tolerância aceita entre o hex do SVG e o pixel do PNG — zero (igualdade exata no
  interior da zona, ignorando a borda com anti-aliasing) ou uma margem declarada?
- Dimensão de saída vem de onde: `?width=`, do `viewBox` do canônico, ou fixa por tenant?
- Rasterizar cabe no tempo e na memória da função, ou obriga um passo assíncrono (que muda
  o contrato de "200 com o artefato" para "202 com um link")?
- PNG cacheado em `variants` faz sentido mesmo com SVG não cacheado, já que o custo de
  gerar é outra ordem de grandeza? Reabre a decisão de 2026-09-08 só para este formato.

**Status**: capturada, não especificada. O 400 explícito de hoje é a versão correta
enquanto não houver a prova.

## UI de gerenciamento de chaves de API

**Fase**: 1.5 — a decisão já existe (ADR-006); o que falta é tela. Hoje chave de API se cria
por **script** em `supabase/scripts/`, do mesmo jeito que o provisionamento de tenant na
Fase 1 (`provisionarTenant.ts`) — o que é coerente com uma venda manual por contrato, em que
quem opera somos nós, não o cliente.

**O que é**: a tela onde o **owner** do tenant cria, confere e revoga as chaves de API da
marca — lista com `prefixo`, `label` e `last_used_at`, botão de revogar, e a criação.

**Por que importa**: enquanto for script, criar chave exige `service_role` na mão de quem
opera, e revogar uma chave vazada às três da manhã depende de alguém com acesso ao ambiente.
Revogação é a operação urgente do modelo do ADR-006 — ter só o caminho de script transforma
uma emergência de segurança em uma tarefa de infraestrutura.

**O que merece desenho de tela próprio**: o momento **"exibida uma vez"**. O segredo aparece
uma única vez, na criação, e depois deixa de existir para nós — o banco tem só o SHA-256.
Uma tela que mostra esse valor como se fosse mais um campo produz a pessoa que fecha o modal
antes de copiar, e o custo disso é gerar outra chave e trocar a integração do cliente. Esse
passo precisa de tratamento explícito (copiar, confirmar que copiou, e dizer com todas as
letras que não haverá segunda chance) — é prevenção de erro, não mensagem de erro.

**Cuidado que a tela herda do ADR-006**: RLS filtra **linha, não coluna**. A leitura do
front é por lista de campos explícitos, sem o `hash`, e nunca `select *`.

**Gatilho para priorizar**: o segundo tenant integrado, ou o primeiro pedido de rotação de
chave. Com um cliente só, o script atende; com dois, a operação manual passa a ser o gargalo.

**Perguntas em aberto**:
- Onde a tela mora: dentro do editor (uma aba de configurações do tenant) ou numa área de
  administração separada, que membro nem enxerga?
- Owner é o único papel que vê a lista, ou membro vê sem poder criar/revogar?
- Revogar pede confirmação por digitação do `prefixo`, como operação destrutiva costuma
  pedir, ou basta um confirmar?
- A tela mostra `last_used_at` como data crua ou como "há X dias" — e o que ela mostra numa
  chave que nunca foi usada, que é o caso mais informativo antes de revogar?

**Status**: capturada, não especificada. O script continua sendo o caminho oficial até lá.

## Rate limiting da API de variante

**Fase**: 1.5 — o ADR-006 o coloca **fora de escopo por escrito**, como dívida registrada, e
não como esquecimento: chave por tenant é o que torna limite por tenant possível, mas o
limite em si não está decidido.

**O que é**: um teto de chamadas por tenant (ou por chave) na API de variante, com resposta
própria quando o teto estoura, em vez de simplesmente gerar tudo o que for pedido.

**Por que importa**: o gatilho não é abuso, é **a cota gratuita da Vercel**. A conta é
compartilhada entre todos os tenants, então um cliente com um laço mal escrito — chave
válida, requisições legítimas, nenhuma intenção má — consome a cota de execução de todo
mundo, e as outras marcas ficam sem API sem ter feito nada. Custo é restrição declarada do
projeto enquanto ele for pré-receita (`memory/restrictions.md`), e aqui a restrição de custo
vira, na prática, um problema de isolamento entre tenants.

**Gatilho para priorizar**: a primeira integração real em produção, ou o primeiro alerta de
consumo de cota. Com zero integrações, não há o que limitar; com uma, o laço mal escrito
passa a ser possível a qualquer momento.

**Perguntas em aberto**:
- O limite é por tenant ou por chave? Por chave permite dar teto diferente a uma integração
  de teste; por tenant é o que protege a cota de verdade.
- Onde mora a contagem, se não há Redis nem serviço pago no bootstrap gratuito — linha em
  Postgres (que custa uma escrita por chamada) ou algo em memória da função (que não
  sobrevive entre invocações)?
- Estourar responde 429 com `Retry-After`, ou degrada (fila, resposta mais lenta)? 429 é
  honesto; degradar esconde o problema do cliente.
- O código do erro entra na união de transporte de `api/_lib/tiposDaApi.ts` — e, se entra,
  ele é contrato desde já ou só quando a feature existir?

**Status**: capturada, não especificada. Dívida registrada no ADR-006, seção Consequências.
