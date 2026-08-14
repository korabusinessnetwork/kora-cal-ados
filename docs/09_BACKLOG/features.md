# Features Planejadas — Kora Calçados (codinome)

> Prioridade, esforço e dono entram conforme o backlog for revisado. Por ora, cada
> entrada tem o mínimo pra não perder a ideia: o que é, por que importa, o que falta
> decidir.
>
> Dívida técnica (`TD0XX`): `debito-tecnico.md`. Bugs: `memory/bugs.md`.
> O que cada rodada do loop entregou: `specs/_loop.md`.

## Índice de features

Origem: raio-x do repositório de **2026-08-14**, mesma varredura que gerou `TD001..TD019`.
O esquema `F0XX` nasceu aí — a ordem é de urgência, não cronológica.

| ID | Feature | Status |
|---|---|---|
| F001 | Leitura do asset-base por URL assinada (300s) + tela de produto | **entregue** na rodada 2 — `specs/f001-leitura-do-asset-base-e-tela-de-produto.md` |
| F002 | Editor de zonas (Fabric.js): marcar zona e gravar `product_zones` | aberto — próximo natural; F001 criou a superfície |
| F003 | Preview client-side de variante usando **o mesmo** motor da API | aberto — é o princípio nº1 virando tela |
| F004 | Relatório de zonas na tela (prevenção de erro do ADR-004 §5) | aberto |
| F005 | API de variante: `POST /products/:id/variants` (Vercel Function, pasta `api/`) | aberto — "rodada 3" citada no código |
| F006 | Autenticação máquina-a-máquina da API | aberto — sem ela a persona 2 (ERP/e-commerce) não consome nada |
| F007 | Contrato da API escrito em `docs/07_APIS` | aberto — as duas fontes existentes se contradizem |
| F008 | PNG sob demanda (`?format=png`) e cache na tabela `variants` | aberto — `sharp`/`resvg` são gratuitos; custo latente é volume |
| F009 | Administração de tenant: tema white-label, membros, seletor de tenant | aberto |
| F010 | Editar e excluir produto pela interface | aberto |
| F011 | Exportação sem lock-in (SVG + CSV/JSON) | aberto — restrição de prioridade máxima, zero código hoje |
| F012 | Recolor preservando gradiente (Fase 1.5) | capturada, não especificada — detalhe abaixo · **trava: decisão do dono** |
| F013 | "Material" é prometido como escopo de Fase 1 e não existe | **trava: decisão do dono** |
| F014 | Identidade visual e nome real do produto | **trava: decisão do dono** — design system vazio de propósito |
| F015 | Cadastro self-serve / signup público | aberto — hoje o provisionamento é por script |
| F016 | Domínio próprio | **trava: decisão do dono** — ~R$ 40-60/ano; sem alternativa gratuita real |
| F017 | Perfil de Marca — IA que aprende como a marca se comporta (Fase 4+) | capturada, não especificada — detalhe abaixo · depende de API de IA paga |
| F018 | Itens pagos represados aguardando decisão do dono | aberto — agrega o custo de F016/F017 e afins (`memory/restrictions.md`) |

## F012 — Recolor preservando gradiente

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

## F017 — Perfil de Marca: IA que aprende como a marca se comporta

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
