# Baseline do refino

Este arquivo responde uma pergunta só: **como se sabe que o sistema está verde?** Toda rodada de
refino começa com ele verde e termina com ele verde. Item que piora qualquer linha desta tabela é
revertido na hora, não consertado em cima.

Medido em 2026-09-12, na branch `refino/kora-calcados`. As colunas são, da esquerda para a direita:
a abertura do refino (`08e4d1d`), o fechamento da rodada 1 (`5e35551`), o da rodada 2 (`d091065`) e
o da rodada 3 (`37b96a6`).

## Como verificar

```bash
npm ci            # instalação limpa a partir do lockfile
npm run typecheck # tsc --noEmit
npm run build
npm test          # a suíte inteira
npm run test:banco   # precisa de .env.local; sem ele os 58 PULAM em vez de falhar
npm run test:navegador  # precisa de Chrome; sem ele os 25 PULAM
npm audit
```

E o fluxo principal, à mão, em `npm run dev`:

1. `?tela=composicao` mostra o calçado montado, sola embaixo, cabedal, cadarço em cima.
2. Trocar de peça troca na cena, sem apagar a tela, e traz o parâmetro próprio da peça nova.
3. Clicar numa peça devolve o id dela em "PEÇA CLICADA".
4. Mudar a cor de uma zona muda **só** aquela peça.
5. `?tela=esboco` abre e lista as 9 zonas do tênis de demonstração.
6. `/` sem parâmetro mostra o formulário de login, com "Entrar" desabilitado enquanto vazio.

## Medidas

| Medida | Abertura do refino | Fechamento da rodada 1 | Fechamento da rodada 2 | Fechamento da rodada 3 |
|---|---|---|---|---|
| Testes verdes | **1047** passando, 58 pulados, 70 arquivos | **1072** passando, 58 pulados, 71 arquivos | **1104** passando, 58 pulados, 74 arquivos | **1161** passando, 58 pulados, 80 arquivos |
| Testes contra o banco real | 58 de 58 | **58 de 58** | **58 de 58** | **58 de 58** |
| Testes em navegador | 25 | **25** | **25** | **25** |
| `tsc --noEmit` | limpo | limpo | limpo | limpo |
| `npm run build` | limpo, 695 ms | limpo, **419 ms** | limpo, **507 ms** | limpo, **564 ms** |
| `npm audit` | 0 vulnerabilidades | **0 vulnerabilidades** | **0 vulnerabilidades** | **0 vulnerabilidades** |
| Bundle: chunk principal | 455,03 kB (gzip 131,84 kB) | **455,58 kB** (gzip 132,03 kB) | **456,92 kB** (gzip 132,43 kB) | **457,00 kB** (gzip 132,51 kB) |
| Bundle: chunk do three.js, sob demanda | 618,87 kB (gzip 156,56 kB) | 618,87 kB (gzip 156,56 kB) | **618,91 kB** (gzip 156,58 kB) | **619,40 kB** (gzip 156,71 kB) |
| Bundle: CSS | 20,76 kB (gzip 3,90 kB) | **21,75 kB** (gzip 4,04 kB) | **22,26 kB** (gzip 4,12 kB) | **22,69 kB** (gzip 4,21 kB) |
| Arquivos `.ts`/`.tsx` em `src` + `api` + `supabase` | 169 | 170 | 174 | **182** |
| Linhas de TypeScript nesses arquivos | 25.598 | 26.218 | 26.844 | **27.889** |
| `any`, `@ts-ignore`, `catch` vazio em `src/` e `api/` | zero de cada | zero de cada | zero de cada | zero de cada |
| `console.log` fora de teste | 1, proposital | 1, proposital | 1, proposital | 1, proposital |
| Linter configurado | nenhum | nenhum (A13, no backlog) | nenhum (A13, no backlog) | nenhum (A13, no backlog) |
| CI | nenhum | nenhum (A14, no backlog) | nenhum (A14, no backlog) | nenhum (A14, no backlog) |

Sobre os números que pioraram na rodada 1: o chunk principal cresceu **0,55 kB** e o CSS **0,99 kB**,
que é o custo em bytes dos oito itens da rodada. O tempo de build não é vitória de ninguém, é ruído
de medição da mesma máquina, e só está aqui porque a medida é feita do mesmo jeito nas duas pontas.

E os da rodada 2: chunk principal **+1,34 kB**, CSS **+0,51 kB**, chunk do three.js **+0,04 kB**.
Os três são o peso do texto que passou a existir, que é literalmente o que oito itens de UX e
robustez compram: `aria-label`, mensagens escritas e a tela nova de falha de rede. Nenhum item foi
revertido, então nenhum destes bytes é desperdício de tentativa.

A contagem de arquivos de teste vai de 71 para 74 porque a rodada 2 criou três: `contarElementos`,
`listarZonasDoProduto` e o `PainelDeZonas` do esboço. As colunas contam o TOTAL de arquivos, pulados
inclusive, senão os 6 do banco entrariam e sairiam conforme a máquina tivesse `.env.local`.

E os da rodada 3: chunk principal **+0,08 kB**, CSS **+0,43 kB**, chunk do three.js **+0,49 kB**.
Os 57 testes novos (1104 para 1161) saem de seis arquivos, quatro deles criados na rodada. Nenhum
item foi revertido.

**Duas linhas desta tabela foram RECALCULADAS nesta rodada, e os números das colunas antigas
mudaram.** A contagem de arquivos e de linhas das rodadas anteriores não era reproduzível: nenhuma
combinação de diretórios que eu tentasse devolvia os 180 arquivos registrados no fechamento da
rodada 2. Em vez de emendar uma quarta coluna numa série que não dá para conferir, refiz as quatro
com a MESMA fórmula, dita agora no próprio nome da linha: arquivos `.ts` e `.tsx` versionados em
`src`, `api` e `supabase`, contados por `git ls-tree` no commit de cada marco. Os números caíram
porque a fórmula antiga contava algo a mais que não consegui identificar. A série passou a ser
comparável ponta a ponta, que é a única coisa que essas duas linhas servem para dizer.

## O que o baseline NÃO cobre, e vale saber

- **A suíte de navegador some em silêncio** numa máquina sem Chrome. Verde não prova que a cor foi
  medida; prova que nada do que rodou reprovou. Para a garantia, rodar `npm run test:navegador` e
  conferir que apareceram 25 testes, não 0. Mesma coisa para os 58 do banco.
- **`npm ci` não roda na cópia de trabalho desta máquina**: o projeto vive dentro do OneDrive e um
  binário nativo do rolldown fica travado, dando `EPERM`. A instalação limpa é verificada num clone
  no diretório temporário, que é onde ela roda sem briga.
- **Nada aqui foi publicado na Vercel.** Rodar local não prova empacotamento, e o `api/README.md`
  diz isso em letra. O baseline é do que existe, não de um deploy.

- **`npm run test:banco` é limitado pela cota de autenticação do Supabase no plano gratuito, não pelo
  código.** Cada `montarCenario` cria 3 usuários e faz 3 logins, e são 6 arquivos: **18 criações de
  usuário e 18 logins por execução**. Duas ou três execuções seguidas dentro da mesma hora derrubam a
  suíte inteira com `AuthApiError: Request rate limit reached`, e isso **não é regressão**, é a cota.
  O sintoma engana, porque chega como seis arquivos vermelhos de uma vez. Antes de investigar
  qualquer coisa, confira a mensagem: se for rate limit, espere e rode de novo. Ver D10.
