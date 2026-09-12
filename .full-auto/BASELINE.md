# Baseline do refino

Este arquivo responde uma pergunta só: **como se sabe que o sistema está verde?** Toda rodada de
refino começa com ele verde e termina com ele verde. Item que piora qualquer linha desta tabela é
revertido na hora, não consertado em cima.

Medido em 2026-09-12, na branch `refino/kora-calcados`, a partir do commit `08e4d1d`.

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

## Medidas de hoje

| Medida | Valor em 2026-09-12 |
|---|---|
| Testes verdes | **1047** passando, 58 pulados (banco, sem `.env.local`), 70 arquivos |
| Testes contra o banco real | **58 de 58** |
| Testes em navegador | **25** (5 medem a cor na tela, 20 são a régua) |
| `tsc --noEmit` | limpo |
| `npm run build` | limpo, **695 ms** |
| `npm audit` | **0 vulnerabilidades** |
| Bundle: chunk principal | **455,03 kB** (gzip 131,84 kB) |
| Bundle: chunk do three.js, carregado sob demanda | 618,87 kB (gzip 156,56 kB) |
| Bundle: CSS | 20,76 kB (gzip 3,90 kB) |
| Bundle: total entregue na primeira tela | 455,03 + 20,76 kB |
| Arquivos `.ts`/`.tsx` | 174 |
| Linhas de TypeScript | 26.626 |
| `any`, `@ts-ignore`, `catch` vazio em `src/` e `api/` | **zero de cada** |
| `console.log` fora de teste | 1, proposital, em `api/_lib/logDaRequisicao.ts:63` |
| Linter configurado | **nenhum** (sem eslint, sem prettier) |
| CI | **nenhum** (sem `.github/`) |

## O que o baseline NÃO cobre, e vale saber

- **A suíte de navegador some em silêncio** numa máquina sem Chrome. Verde não prova que a cor foi
  medida; prova que nada do que rodou reprovou. Para a garantia, rodar `npm run test:navegador` e
  conferir que apareceram 25 testes, não 0. Mesma coisa para os 58 do banco.
- **`npm ci` não roda na cópia de trabalho desta máquina**: o projeto vive dentro do OneDrive e um
  binário nativo do rolldown fica travado, dando `EPERM`. A instalação limpa é verificada num clone
  no diretório temporário, que é onde ela roda sem briga.
- **Nada aqui foi publicado na Vercel.** Rodar local não prova empacotamento, e o `api/README.md`
  diz isso em letra. O baseline é do que existe, não de um deploy.
