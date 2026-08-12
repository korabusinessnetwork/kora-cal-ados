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
