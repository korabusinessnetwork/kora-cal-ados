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
  upload ou o motor faz na geração? **Existe precedente, e ele não é decisão:** o ADR-007
  D5 resolveu o gêmeo tridimensional exato deste problema (material glTF compartilhado
  entre malhas de zonas diferentes) escolhendo **duplicar no provisionamento, nunca na
  geração**, com o argumento de que a alternativa pinta a zona errada com 200 na resposta.
  O argumento parece transferir inteiro para o SVG, mas nenhum ADR decidiu isso para
  gradiente — e decidir por analogia, sem escrever, é como uma regra vira folclore.
  Quem priorizar esta feature responde a pergunta de propósito, com o D5 na mão.

**Status**: capturada, não especificada.

## Perfil de Marca — IA que aprende como a marca se comporta

**Fase**: pós-validação do núcleo, ainda **não é escopo de Fase 1** — mas a justificativa
mudou em 2026-09-09, e é preciso dizer qual caiu.

**Atualização de 2026-09-09**: a razão registrada aqui era "ADR-001: MVP é motor mecânico
vetor-only, sem componente de IA". **Essa razão deixou de valer.** O ADR-008 supera em parte
o ADR-001 e coloca um modelo de linguagem no núcleo do modo generativo — o prompt do
designer vira escolha de peça e estilização sobre um acervo. O que sobra para segurar esta
entrada é ordem de prioridade (o núcleo gerado precisa existir antes de alguém ensiná-lo a
se comportar), não mais ausência de IA no produto.

E o efeito é o inverso do que a fase sugere: esta feature ficou **mais perto**, não menos.
Com a arquitetura do ADR-008, "perfil de marca" deixa de ser um subsistema novo e vira uma
**restrição sobre uma escolha que o sistema já faz** — a mesma chamada que hoje escolheria
qualquer peça do catálogo passa a escolher dentro do que a marca permite, e a validação que
já existe por obrigação (recusar id inexistente) é o lugar natural onde uma regra de marca
também é aplicada. A pergunta "como a IA sabe o que é on-brand" muda de "construir uma IA"
para "filtrar um catálogo e uma paleta". **Isto é leitura desta entrada, não decisão do
ADR-008** — nada disso está decidido em lugar nenhum.

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
- **Nova, de 2026-09-09**: o perfil de marca restringe só **cor e material**, ou também
  **quais peças do acervo** a marca pode usar? A segunda leitura aproxima o perfil do
  "acervo do tenant" do ADR-008 D6, que já é um recorte por marca sob RLS — e aí as duas
  coisas podem ser a mesma, ou podem ser duas que se confundem. Não resolver de improviso.

**Status**: capturada, não especificada. Retomar quando o núcleo generativo (ADR-008)
existir — a fase não mudou, a justificativa dela sim.

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

**O que mudou em 2026-09-09**: nada do que está escrito acima ficou falso — mas o escopo
ficou pequeno. Esta entrada pressupõe que o artefato da variante é sempre SVG, e desde os
ADRs 007 e 008 ele pode ser glTF (produto 3D trazido) ou uma composição (produto gerado). O
próprio ADR-007 registra a consequência: *"um cliente que hoje não consome SVG muito menos
consome glTF"* — ou seja, a pressão por um formato de saída universal **aumentou**, e o
"segundo renderizador" que segura a entrega passa a ter uma versão ainda mais cara em 3D,
com uma equação de iluminação no meio (motivo pelo qual o ADR-007 descartou renderizar no
servidor, Alternativa 4). Quando esta entrada for especificada, o recorte precisa dizer se
`?format=png` é só para produto SVG ou para todos os tipos — hoje ela responde só ao
primeiro.

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

**O que mudou em 2026-09-09**: o raciocínio acima continua válido inteiro, e ganhou um caso
pior. O ADR-008 introduz a **primeira dependência de serviço pago recorrente** do projeto —
cada geração por prompt é uma chamada a um modelo de linguagem. Ali, estourar o teto deixa
de custar cota de execução compartilhada e passa a custar **dinheiro por chamada**, o que
muda a urgência e possivelmente o desenho: um teto para a API de variante (barata, edição de
arquivo) e outro para a geração por prompt (paga, por chamada) podem não ser o mesmo
mecanismo. Quando a fatia 3 da entrada "Calçado gerado por prompt" for priorizada, esta
entrada deixa de ser 1.5 e vira pré-requisito dela.

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

## Calçado manipulável — girar o modelo com o mouse, em qualquer ângulo

**Fase**: não atribuída. **Rota escolhida pelo dono em 2026-09-09: (A) 3D de verdade** — a
decisão e a arquitetura estão em `docs/08_DECISOES/adr-007-modelo-3d-manipulavel.md`, que
supera em parte o “MVP vetor-only” do ADR-001 e resolve a objeção do princípio nº1
que esta entrada levantou contra A.

**Atualização de 2026-09-09 (mesmo dia)**: o bloqueio "não existe um único glTF neste
projeto" **foi respondido**, e a resposta mudou o formato dele. O ADR-008 decidiu que o
insumo do modo generativo vem de um **acervo de peças** — a geometria não é um calçado
inteiro modelado, são peças que encaixam sobre uma mesma forma, e o calçado é montado a
partir de uma composição (ver a entrada "Calçado gerado por prompt" abaixo). Então:

- **para produto gerado**, o insumo tem nome e tamanho: as ~15 peças da forma de tênis de
  demonstração recomendadas pelo ADR-008. A entrega continua bloqueada, mas num item de
  conteúdo definido, não numa pergunta aberta;
- **para produto trazido em 3D** (a marca exporta o CAD dela para glTF), nada mudou: a
  tabela de origem e custo do ADR-007 continua sendo a resposta, e continua dependendo de
  a marca ter e entregar o arquivo.

Toda a arquitetura de D1–D5 do ADR-007 — glTF é JSON, recolorir é editar arquivo, modo cor
chapa, conversão sRGB→linear num lugar só, zona como lista de nomes de malha, material
separado na normalização — vale igual nos dois casos, e vale **inteira** para o modo gerado:
o ADR-008 depende dela, não a substitui.

**O que é**: hoje o editor mostra **uma vista fixa** do calçado. A pessoa clica nos
elementos e marca zonas (isso funciona, ADR-005 e `05_FLUXOS/fluxo-marcacao-de-zona.md`),
mas o modelo não se mexe: não dá para virar de ponta-cabeça, olhar a sola, ver o
contraforte, girar 15° para conferir como a cor cai na lateral. O pedido é que arrastar com
o mouse gire o calçado livremente, mantendo tudo o que já existe — clicar numa camada
(sola, cadarço, cabedal) continua marcando a zona, em qualquer ângulo em que ela esteja.

**Por que importa**: quem aprova uma cor não aprova um lado. O time de produto decide
olhando o calçado como olharia na mão, e uma vista única esconde exatamente as partes que
mais recebem cor de contraste — sola por baixo, traseira, entressola. Enquanto for uma
vista só, "ver a variante" e "ver o produto" continuam sendo coisas diferentes, e a
aprovação acontece fora do sistema.

**Estado na documentação em 2026-09-09**: **não estava anotado em lugar nenhum** — nem
aqui, nem nos ADRs, nem no intake (`respostas-intake.md`), nem como item fora de escopo.
A metade "clicar em cada camada" está feita e documentada; a metade "manipular o modelo"
nunca foi capturada. Esta entrada existe para corrigir isso.

**As duas rotas, e por que a diferença entre elas é o produto inteiro**:

- **(B) N vistas 2D** — o produto passa a ter várias SVGs (lateral, medial, topo, sola,
  traseira, ou os 24–36 quadros de um "spin" de e-commerce) e arrastar troca de quadro. O
  motor continua **exatamente o mesmo**: cada quadro é um SVG chapado que
  `gerarVarianteDeCor` recolore, e o princípio nº1 continua de pé sem nada novo para
  provar. O custo é de modelagem de dado, não de render: `products.base_asset_path` é uma
  coluna **singular**, e `product_zones.svg_selector` aponta ids **daquele um arquivo** —
  uma zona `sola` que precisa existir nas 24 vistas não cabe nesse schema. Exige tabela de
  vistas e uma decisão sobre o que a API devolve num POST (uma vista? todas? a vista vem na
  query string?).
- **(A) 3D de verdade** — modelo glTF/WebGL, arrastar orbita a câmera. Isto **não é uma
  feature, é outro produto**: um renderizador 3D com luz, sombra e material entra entre o
  hex que a pessoa marcou e o pixel que ela vê, que é a mesma objeção — mais forte — que
  segura o `?format=png` acima. Sob iluminação, a sola `#C0392B` **não aparece**
  `#C0392B` em pixel nenhum da tela, e o princípio nº1 do `CLAUDE.md` deixa de ser
  verificável por igualdade. Some-se a isso que o insumo muda: o ADR-001 decidiu MVP
  **vetor-only**, e o intake diz que os modelos-base são ilustração vetorial ou foto real —
  ninguém tem glTF de calçado à mão.

**Gatilho para priorizar**: o primeiro "não dá para aprovar assim" vindo de um time de
produto real, ou o primeiro cliente cujo catálogo já tem spin de e-commerce pronto (nesse
caso a rota B fica barata, porque o insumo já existe).

**Perguntas em aberto**:
- ~~Rota B ou A?~~ **Respondida em 2026-09-09: A** (ADR-007). As perguntas de B abaixo ficam
  registradas porque B continua sendo a rota mais barata, e é para onde voltar se o modelo
  3D de demonstração nunca aparecer.
- ~~De onde vem o modelo 3D?~~ **Respondida em 2026-09-09 pelo ADR-008**: no modo gerado,
  de um acervo de peças, e o insumo mínimo passa a ser ~15 peças de **uma** forma de tênis
  em vez de um calçado inteiro modelado. Continua sendo item de conteúdo, continua travando
  a entrega, e a decisão de como obtê-lo (modelar, licenciar, ou CAD de marca) continua
  sendo do dono, com a tabela de custo do ADR-007. Para produto **trazido** em 3D a pergunta
  segue de pé como estava.
- Em B, a zona é **por vista** (cada vista tem seus ids e seu mapeamento) ou **por produto**
  (uma `zone_key` que atravessa as vistas, e o editor marca em cada uma)? A segunda é o que
  a pessoa espera; a primeira é o que o schema de hoje comporta.
- Em B, marcar a mesma zona em 24 quadros à mão é trabalho de uma tarde por modelo. Existe
  correspondência automática de id entre quadros (mesma origem de exportação = mesmos ids),
  ou isso vira o gargalo que mata a rota?
- O arrastar e o clicar competem pelo mesmo gesto. Onde fica a fronteira entre "arrastei
  para girar" e "cliquei para marcar" — limiar de pixels, botão diferente, modo explícito?
  Errar isso marca zona sem querer, e marcação errada é o modo de falha que o princípio nº1
  proíbe.
- A API entra nisso ou fica de fora? Se o cliente pede a variante e recebe uma vista só, o
  editor manipulável passa a mostrar algo que a API não entrega.

**Status**: rota decidida (A, ADR-007), **não especificada**. Registrada em 2026-09-09 a
pedido do dono, depois de uma verificação que confirmou ausência total na documentação; a
rota foi escolhida no mesmo dia. Ainda no mesmo dia, o ADR-008 respondeu **de onde vem o
glTF** no modo gerado e transformou o bloqueio de "um modelo 3D qualquer" em "as ~15 peças
da forma de demonstração" — a spec continua não podendo ser escrita antes de esse insumo
existir, pelo mesmo motivo de sempre: seria construir um motor sem nunca ter visto o
combustível.

## Calçado gerado por prompt — o designer descreve e o sistema monta sobre o acervo

**Fase**: não atribuída, e é **a maior entrada deste backlog**. A decisão de arquitetura
**já existe**: `docs/08_DECISOES/adr-008-calcado-gerado-sobre-acervo-de-pecas.md`, aceito em
2026-09-09. Ele supera em parte o "MVP sem componente de IA" do ADR-001 (só no modo
generativo; nada muda para produto SVG) e **completa** o ADR-007, respondendo a pergunta que
tinha deixado o 3D travado. O que falta não é decisão: **a implementação está bloqueada num
acervo que não existe** — ver "O gargalo é conteúdo, não código" abaixo.

**O que é**: hoje o produto pressupõe que a marca **traz** o calçado — sobe o SVG dela, o
time marca as zonas, a API escala a variação de cor. O que o dono descreveu em 2026-09-09 é
o inverso: o designer entra **sem nada na mão**, escreve um prompt e o sistema **gera** um
calçado — tênis, chinelo, o que for. Não gostou de uma parte, escreve prompt **por parte**
("sola mais robusta", "cadarço encerado preto"), gira o modelo com o mouse, vê todas as
partes e edita cada uma individualmente.

**O que o ADR-008 já decidiu** (resumo; o raciocínio inteiro está lá, inclusive por que a
rota de gerar a malha por IA foi descartada):

- **Existe um acervo de peças** em glTF — solas, entressolas, cabedais, cadarços, línguas,
  ilhoses, contrafortes, biqueiras, logos — e a IA **escolhe e estiliza; nunca esculpe**. O
  modelo de linguagem recebe o catálogo do que existe e devolve o que usar, e **não inventa
  peça**. A saída dele é **validada contra o acervo**: id que não existe é recusa explícita,
  nunca um calçado com um buraco no lugar da sola. É a regra "zona não aplicada é erro,
  nunca aviso" (ADR-004) aplicada ao único componente do sistema em que não se pode confiar
  por construção.
- **O calçado gerado é uma composição**, não geometria: a lista de peças escolhidas mais
  cor, material e parâmetros de cada uma, em JSON de algumas linhas. É o análogo exato do
  que o projeto já faz — hoje uma variante é `zone_colors` sobre um canônico, não um SVG
  guardado. Daí vem gerar barato (uma chamada de texto, sem GPU e sem fila), reprodutível,
  diffável e leve.
- **Cada peça é uma zona**, e a etapa de marcar zona **desaparece** no produto gerado: a
  peça já nasce nomeada e com material próprio. Sem marcação, sem seletor, sem sobreposição
  de zonas possível. O editor de marcação continua existindo inteiro para produto trazido —
  ele deixa de ser obrigatório, não deixa de existir.
- **O acervo é organizado por forma** (o molde do pé) e peça só combina com peça da mesma
  forma. Misturar formas é estado inválido, recusado na validação.
- **Os dois modos convivem**: produto trazido pela marca × produto gerado. Nenhum produto
  existente é migrado e nenhuma linha do motor atual é tocada.
- **Acervo base da Kora × acervo do tenant**, este último privado sob RLS — sem essa segunda
  camada, a marca que subisse sua sola proprietária a estaria entregando ao concorrente que
  usa o mesmo sistema.
- **Variação paramétrica** (altura da entressola, espessura da sola) é o que impede o acervo
  de parecer LEGO: "sola mais robusta" pode ser a mesma peça com outro parâmetro, não outra
  peça.

**Por que importa**: muda a porta de entrada do produto de "traga seu SVG" para "descreva o
que você quer", e com ela o público — designer explorando forma, não só quem escala catálogo
(que é a persona Ana descrita hoje em `memory/identity.md`). E, de quebra, paga o passo mais
caro do produto atual: no modo gerado a zona nasce pronta, e sobreposição de zonas — um
estado de erro inteiro que hoje precisa ser detectado e recusado — fica **inalcançável por
construção**.

**O gargalo é conteúdo, não código** — e é a mudança mais importante que o ADR-008 causa:
nenhuma linha de código aqui é difícil. O difícil é **ter as peças**. A recomendação do ADR,
que é a menor coisa capaz de provar o produto inteiro, é **uma forma de tênis com cerca de 3
opções por categoria** — 3 solas, 3 cabedais, 3 cadarços, 3 línguas, o resto fixo. São ~15
peças, cada uma com nome próprio, material próprio e um punhado de parâmetros, todas
encaixando entre si. Isso já dá centenas de combinações com a variação paramétrica, e é o
análogo exato do papel que o `tenis-demo.svg` cumpre hoje. Enquanto essas peças não
existirem, o modo gerado não pode ser construído com honestidade.

**A ordem de construção é acervo → composição → prompt, nunca o contrário** — o ADR fixa
isso, e é o que torna esta entrega fatiável, com **valor em cada fatia sozinha**:

1. **Acervo + montagem em cena** — as peças existem, são validadas, encaixam, e o palco 3D
   do ADR-007 as monta e desenha. Sem isso não há nada em cima do que construir.
2. **Composição editável à mão** — escolher peça por categoria, cor, material e parâmetros
   por menu. **Isto já é um produto sozinho**: um configurador (a Alternativa 3 do ADR-008,
   descartada como porta de entrada porque o dono foi explícito que o prompt é o produto —
   mas registrada lá como o **fallback grátis** desta arquitetura). Se a chamada ao modelo
   falhar ou ficar cara demais, a composição continua editável à mão e o sistema não para.
3. **Prompt** — a última camada, e a mais fácil de trocar: traduzir linguagem em escolha
   sobre um catálogo que já existe e já sabe se recusar.

Fatiar assim também é o que evita a armadilha óbvia: começar pelo prompt significa ter um
tradutor sem nada para traduzir e sem validação possível.

**Gatilho para priorizar**: a existência das ~15 peças da forma de demonstração — é o
gatilho literal, e ele não é de engenharia. E, antes dele, uma decisão do dono que o
`CLAUDE.md` exige explicitamente: o modo gerado traz a **primeira dependência de serviço
pago recorrente** do projeto (a chamada ao modelo de linguagem). Modesta, mas recorrente, e
`memory/restrictions.md` precisa da linha nova antes de a fatia 3 começar. As fatias 1 e 2
não dependem dessa decisão — mais um motivo para a ordem ser essa.

**Perguntas em aberto** (derivadas do ADR-008; nenhuma delas é decidível aqui):

- **A validação da saída do modelo mora onde?** O ADR decide que ela existe, que é módulo
  próprio, que nasce com teste e o que ela recusa (id inexistente, categoria faltando, peças
  de formas diferentes, parâmetro fora de faixa). Não decide se ela roda na função
  serverless, no navegador, ou nos dois — e "nos dois" reabre a regra de nunca ter duas
  implementações do mesmo julgamento.
- **Quantas formas, e por qual família de calçado se começa depois de tênis?** "Qualquer
  sapato" custa **uma forma por família** — tênis, chinelo, bota, sapatilha e social são
  cinco acervos, não cinco peças. A primeira é tênis, por recomendação do ADR; quando a
  segunda entra, e com base em qual sinal, está em aberto.
- **O que a API de variante devolve para produto gerado?** O ADR diz que ela "opera sobre a
  composição", e não mais que isso. As saídas possíveis não são equivalentes: devolver o
  glTF montado obrigaria o servidor a montar geometria, o que o ADR-007 D1 recusa; devolver
  a composição em JSON exige que o cliente tenha o acervo para montar; devolver alguma
  terceira coisa é contrato novo. Isto precisa ser decidido antes da fatia 2, não depois.
- **Como a composição versiona quando o acervo muda por baixo?** A composição é reprodutível
  — "o mesmo JSON monta o mesmo calçado" — mas essa promessa vale enquanto as peças
  referenciadas não mudarem. Peça corrigida, reexportada ou removida do acervo quebra
  silenciosamente um produto gerado que já foi aprovado por um cliente. **Hipótese**, não
  decisão: a composição guardaria id **e** versão da peça, e o acervo seria append-only para
  peça já usada. Nenhuma das duas coisas está decidida.
- **A coluna de tipo em `products`** passa a distinguir três coisas (SVG, 3D trazido, 3D
  gerado) onde o ADR-007 D6 previa duas. Decisão de schema, explicitamente empurrada para a
  spec pelos dois ADRs.
- **Os termos novos ainda não estão no glossário.** Acervo, peça, categoria de peça,
  composição e forma não aparecem hoje em `docs/03_REGRAS_DE_NEGOCIO/glossario.md`, e o
  ADR-008 exige que entrem **antes** do código. É a primeira tarefa desta entrada, e ela não
  depende do acervo existir.
- **A documentação de identidade descreve outro produto.** O próprio ADR-008 registra que
  `memory/identity.md` precisa ser reescrito: ele descreve o time marcando zona num modelo
  que a marca já tem. Enquanto não for, um agente novo que ler a documentação constrói o
  produto de ontem.

**Status**: arquitetura decidida (ADR-008), **não especificada**, **bloqueada no acervo**.
Registrada em 2026-09-09, no mesmo dia da decisão.
