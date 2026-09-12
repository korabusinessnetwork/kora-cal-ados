# `testes-de-navegador/`

Os testes que medem **a cor na tela**, e não a cor no arquivo.

O resto da suíte roda em jsdom, que não tem WebGL: nenhum teste dela desenha um pixel. Esta pasta
existe porque o princípio nº1 do projeto é uma frase sobre pixel, e vigiar o número escrito no glTF
deixa de fora exatamente o trecho que ele quer vigiar, que é a conversão de sRGB para linear mais o
renderizador.

A spec completa, com as decisões e o registro das mutações, está em `../specs/cor-na-tela.md`.

## Os arquivos

| Arquivo | O que é | Precisa de Chrome? |
|---|---|---|
| `matiz.ts` | A régua: matiz, saturação e o veredito de "estas duas cores são a mesma" | não |
| `matiz.test.ts` | 20 testes da régua | não |
| `chrome.ts` | Acha o Chrome, sobe em headless, fala o protocolo de DevTools | é ele quem acha |
| `sonda.ts` | O servidor de teste, e as expressões que rodam dentro da página | não |
| `corNaTela.test.ts` | Os 5 testes que abrem o calçado e medem | sim |

## Como rodar

```bash
npm run test:navegador
```

Eles também entram no `npm test` normal, que é o padrão certo: o teste que guarda o princípio nº1
não devia ser opcional.

## Sem Chrome na máquina

Os testes são **pulados, não reprovados**, no mesmo molde de `skipIf(!temAmbiente)` de
`supabase/tests/`. Reprovar puniria a máquina de quem não tem navegador por um defeito que não é
dela, e um teste que reprova por ambiente vira um teste que todo mundo aprende a ignorar.

O efeito colateral a conhecer: **uma suíte verde não prova que a cor foi medida.** Prova que nada
do que rodou reprovou. Para ter a garantia, rode `npm run test:navegador` e confira que apareceram
5 testes, e não 0.

Para apontar para outro navegador, ou para um Chrome instalado em lugar incomum:

```bash
CHROME_PATH="/caminho/do/chrome" npm run test:navegador
```

## Zero dependências

Nada aqui entrou no `package.json`. O Chrome é o que já está instalado na máquina, e quem dirige
ele é o `WebSocket` global que o Node 24 traz de fábrica. Foi condição da tarefa: o projeto é
bootstrap gratuito (`CLAUDE.md`, seção Custo), e um teste de navegador que custasse uma dependência
pesada teria sido adiado, como tudo que custa.
