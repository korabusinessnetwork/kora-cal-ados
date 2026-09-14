# 02, DESIGN SYSTEM · Kora Calçados (codinome)

> Fonte única de verdade visual: tokens, cores, tipografia, componentes, animações.

## O que vive aqui

- **Design tokens**: escala de cores, tipografia, espaçamento, shadows, bordas
- **Paleta de cores**: cores base, semântica (sucesso/erro/aviso), acessibilidade
- **Tipografia**: fontes, escalas de tamanho, line-height, weights por contexto
- **Espacimentos**: grid, padding, margin, gap, a "régua" do layout
- **Iconografia**: conjunto único de ícones (SVG), convenção de nomes, tamanhos
- **Componentes**: catálogo de componentes visuais (atoms → molecules → organisms)
- **Animações**: transições, eases, durations, movimento consistente

## O que NÃO vive aqui

- Código dos componentes → `src/components/`
- Regras de negócio de UI → `03_REGRAS_DE_NEGOCIO/`
- Fluxos de interação → `05_FLUXOS/`
- Documentação de APIs → `07_APIS/`

## Arquivos sugeridos

- `TOKENS.md`, tabela estruturada: categoria, token name, valor, escopo
- `CORES.md`, paleta com hex/RGB, uso recomendado, contrast ratios
- `TIPOGRAFIA.md`, fontes, escalas (mobile/desktop), line-heights
- `ESPACAMENTOS.md`, grid, unidade base, escalas de spacing
- `ICONOGRAFIA.md`, conjunto de ícones SVG, nomeação, tamanhos
- `COMPONENTES.md`, atomic design: atoms, molecules, organisms
- `ANIMACOES.md`, transições, eases, durations, movimentos padrão

## Como preencher

1. **Crie uma paleta de cores primeiro**: escolha 3–5 cores base + variações (light/dark)
2. **Defina 1 única fonte para textos, 1 para display**: consistência visual
3. **Tokens devem ser parametrizáveis**: o tenant muda cor/logo, o token não muda de nome
4. **Componentes nascem aqui, código em src/**: design first, depois implementa
5. **White-label**: nada de marca ou cor hardcodada, tudo token parametrizável por tenant
6. **Cor de zona ≠ cor de interface**: a paleta do design system nunca se mistura com a
   cor que o usuário aplica numa zona. Cor de zona é dado do cliente, não token de tema,
   e o preview dela não pode sofrer nenhum filtro/overlay do tema (princípio nº1)
7. **Contexto é desktop**: o editor é ferramenta de precisão. Escalas mobile são
   secundárias aqui (ver `respostas-intake.md`, Bloco 7)

## Estado atual

⚠️ **Vazio de propósito**: a identidade visual ainda não existe (nome real do produto
pendente, ver `memory/identity.md` → Identidade Visual). Nenhum arquivo desta pasta
foi escrito ainda; escrever antes de o nome/marca serem definidos é retrabalho garantido.

## Ligações

- `06_COMPONENTES/`, implementação dos componentes em React
- `memory/identity.md` → seção "Identidade Visual", marca, tom e restrições
- CLAUDE.md → "Padrões de código", regra de separar CSS do JSX (white-label)
