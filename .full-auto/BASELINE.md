# Baseline do refino

Este arquivo responde uma pergunta só: **como se sabe que o sistema está verde?** Toda rodada de
refino começa com ele verde e termina com ele verde. Item que piora qualquer linha desta tabela é
revertido na hora, não consertado em cima.

Medido em 2026-09-12, na branch `refino/kora-calcados`. A coluna da esquerda é a abertura do refino,
no commit `08e4d1d`; a da direita é o fechamento da rodada 1, no commit `5e35551`.

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

| Medida | Abertura do refino | Fechamento da rodada 1 |
|---|---|---|
| Testes verdes | **1047** passando, 58 pulados, 70 arquivos | **1072** passando, 58 pulados, 71 arquivos |
| Testes contra o banco real | 58 de 58 | **58 de 58** |
| Testes em navegador | 25 | **25** |
| `tsc --noEmit` | limpo | limpo |
| `npm run build` | limpo, 695 ms | limpo, **419 ms** |
| `npm audit` | 0 vulnerabilidades | **0 vulnerabilidades** |
| Bundle: chunk principal | 455,03 kB (gzip 131,84 kB) | **455,58 kB** (gzip 132,03 kB) |
| Bundle: chunk do three.js, sob demanda | 618,87 kB (gzip 156,56 kB) | 618,87 kB (gzip 156,56 kB) |
| Bundle: CSS | 20,76 kB (gzip 3,90 kB) | **21,75 kB** (gzip 4,04 kB) |
| Arquivos `.ts`/`.tsx` | 174 | 176 |
| Linhas de TypeScript | 26.626 | 27.264 |
| `any`, `@ts-ignore`, `catch` vazio em `src/` e `api/` | zero de cada | zero de cada |
| `console.log` fora de teste | 1, proposital | 1, proposital |
| Linter configurado | nenhum | nenhum (A13, no backlog) |
| CI | nenhum | nenhum (A14, no backlog) |

Sobre os dois números que pioraram: o chunk principal cresceu **0,55 kB** e o CSS **0,99 kB**, que é
o custo em bytes dos oito itens da rodada. O tempo de build não é vitória de ninguém, é ruído de
medição da mesma máquina, e só está aqui porque a medida é feita do mesmo jeito nas duas pontas.

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
