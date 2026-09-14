# `api/_local/`, servidor local para dirigir a função sem deploy

O `_` na frente do nome faz a Vercel **ignorar** este diretório no roteamento por sistema de
arquivos: nada daqui vira endpoint (mesma razão de `api/_lib/`, ver `../README.md`).

Um arquivo só: `servidorLocal.mjs`. Ele abre uma porta HTTP, deriva as rotas de `api/v1/**`
e entrega ao `curl` **o mesmo handler** que a Vercel executaria, sem uma segunda
implementação do handler para desenvolvimento, que seria a coisa que divergiria da que roda
em produção.

## O que este servidor NÃO prova

A parte mais importante deste README. Ele existe para dirigir o handler, não para dar
veredito sobre a plataforma. Verde aqui **não** é verde lá.

1. **Não é o roteador da Vercel.** É uma imitação nossa, derivada da mesma convenção
   (arquivo = rota, `[param]` = segmento dinâmico, `_`/`.` ignorados), mas escrita neste
   repositório, em outro código. Duas implementações da mesma convenção concordam até o dia
   em que discordam, e a nossa é a que **não** decide nada em produção. Casos conhecidos em
   que a correspondência aqui é palpite, não convenção verificada: segmento catch-all
   (`[...algo]`), que este servidor casa com `(.+)` e sinaliza ao subir, hoje não existe
   nenhum no projeto.

   Um caso relacionado **não** é palpite e vale o aviso: **arquivo de teste co-locado dentro
   de `api/v1/**` viraria rota**. Não seria engano deste servidor, seria fiel à Vercel, onde
   `_` na frente do nome é o único jeito de um arquivo em `api/` não virar endpoint publicado.
   Foi este servidor que tornou o problema visível, e a resposta do projeto é o **`_` no nome
   do arquivo de teste**: o teste do handler é `_variants.test.ts`, co-locado ao lado do
   fonte que ele testa e invisível para o roteamento, aqui e no deploy. O servidor continua
   listando e avisando sobre arquivo de teste que vire rota, como rede para o dia em que
   alguém criar um sem o `_`: esconder aqui esconderia o endpoint que apareceria na Vercel.
2. **Não prova o empacotamento, e esse era o maior risco da entrega.** Aqui os módulos são
   carregados pelo **Vite**, que resolve import sem extensão, TypeScript e CommonJS sem
   reclamar. Na Vercel, `api/` é compilado por **esbuild + node-file-trace**, e é lá que o
   `jsdom` do motor de render pode quebrar. Esse risco foi sondado à parte, com resultado e
   uma armadilha nomeada (`--packages=external`): leia a seção **"O empacotamento com jsdom
   foi provado, e tem uma armadilha nomeada"** em [`../README.md`](../README.md). Este
   servidor não repete essa prova e não substitui.
3. **Não prova limite nenhum de plataforma.** Tempo máximo de execução, tamanho máximo de
   resposta, memória, cold start, comportamento de streaming: nada disso existe aqui. Uma
   resposta que sai em 900 ms na sua máquina, com o Supabase respondendo rápido, não diz o
   que acontece numa função com limite de duração.
4. **Não prova deploy.** Não há deploy neste projeto (`../README.md`, "Estado: em
   construção"). Nenhuma frase do tipo "funciona na Vercel" pode nascer de um `curl` daqui.

O que ele **prova**: que o handler existe, casa a rota esperada, recebe um `Request`
montado a partir de HTTP real e devolve status, headers e bytes de corpo que o `curl`
consegue gravar em disco.

## Como rodar

```bash
npm run api:local
```

Equivale a `node api/_local/servidorLocal.mjs`. Ao subir ele imprime a porta, as rotas que
achou em `api/v1/**`, se as variáveis de ambiente estão presentes e um `curl` de exemplo já
com a porta certa.

- Porta padrão **3210**, configurável por `PORTA_API_LOCAL`
  (`PORTA_API_LOCAL=3211 npm run api:local`). As portas 5173/5174 são do `npm run dev`.
- Porta ocupada falha com uma linha explicando, não com stack.
- **Não precisa reiniciar** ao editar o handler: o watcher do Vite recarrega o módulo na
  chamada seguinte.
- Erro ao carregar o handler (erro de sintaxe, import quebrado) responde **500 com
  `"erro": "FALHA_AO_CARREGAR_O_HANDLER"`** e imprime o stack **no terminal do servidor**,
  o processo não morre.
- Rota inexistente responde 404 com `"erro": "ROTA_NAO_ENCONTRADA_NO_SERVIDOR_LOCAL"` e a
  lista das rotas que existem. Esse 404 é **do roteador daqui**, e não tem relação com o
  `PRODUTO_NAO_ENCONTRADO` da API, o corpo é diferente de propósito para que ninguém vá
  depurar o handler por causa de um erro de digitação na URL.

## O que precisa estar no `.env.local`

O servidor carrega `.env.local` da raiz do projeto sozinho (equivalente ao
`--env-file=.env.local` que os scripts de `supabase/scripts/` usam). As duas variáveis que a
API lê:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Modelo comentado em `.env.example`. **Sem elas o servidor sobe assim mesmo**, e avisa,
mas toda chamada que chegue a consultar o banco responde **500**, porque
`api/_lib/clienteDeServico.ts` recusa ambiente incompleto. Os erros que não dependem do
banco (405, 401 de chave ausente, 404 de rota) continuam respondendo certo.

O servidor imprime apenas **presente** ou **ausente** para cada variável, nunca o valor,
nem truncado. Chave em terminal vira chave em histórico de shell.

## Roteiro de `curl`

O roteiro completo, 18 passos, com o que cada um prova, está em
[`roteiroDePassada.md`](roteiroDePassada.md). Aqui ficam só os três que rodam **hoje**, sem
chave válida. Substitua `<productId>` pelo id de um produto do tenant.

### 1. Método errado, 405

```bash
curl -i "http://localhost:3210/api/v1/products/<productId>/variants"
```

Esperado: `405`, header `Allow: POST`, `"code": "METODO_NAO_PERMITIDO"`. Se em vez disso vier
o 404 com `ROTA_NAO_ENCONTRADA_NO_SERVIDOR_LOCAL`, o problema é a URL, não o handler.

### 2. Sem chave, 401

```bash
curl -i -X POST "http://localhost:3210/api/v1/products/<productId>/variants" \
  -H "Content-Type: application/json" \
  -d '{"sola": "#C0392B"}'
```

Esperado: `401`, `"code": "CHAVE_AUSENTE"` e `Cache-Control: no-store`.

### 3. Com chave, o SVG

```bash
curl -X POST "http://localhost:3210/api/v1/products/<productId>/variants" \
  -H "Authorization: Bearer <a chave inteira>" \
  -H "Content-Type: application/json" \
  -d '{"sola": "#C0392B"}' \
  -o modelo-vermelho.svg
```

Esperado: `200`, `Content-Type: image/svg+xml; charset=utf-8`, e um arquivo que abre no
navegador. O corpo é byte a byte a saída do motor, é o uso que motivou o corpo nu
(`docs/07_APIS/endpoints.md`). **Abrir o arquivo e olhar** é o passo 17 do roteiro completo,
e é o único que nenhum teste substitui.

## De onde vem a chave

**Não invente a chave.** Ela é gerada por script, e o segredo em claro só aparece uma vez:

```bash
npm run criar-chave -- --tenant <slug> --ambiente test --label "para que serve"
npm run revogar-chave -- --prefixo <8 caracteres>
```

(`supabase/scripts/criarChaveDeApi.ts` e `revogarChaveDeApi.ts`.) O `--tenant` é o **slug**,
não o nome comercial.

Guarde a chave numa variável de shell, nunca num arquivo do repositório. O jeito de manter o
segredo fora do terminal, e fora de qualquer transcript, é redirecionar a saída do script
para um arquivo temporário e ler dele:

```bash
npm run criar-chave -- --tenant aurora-demo --ambiente test --label local > /tmp/k.txt
CHAVE=$(grep -o 'kora_test_[A-Za-z0-9_-]*' /tmp/k.txt | tail -1)
```

**A migration `20260908_chave_de_api_por_tenant.sql` foi aplicada ao projeto real em
2026-09-08**, e desde então os três passos acima rodam de verdade, o passo 3 devolveu
`200` com o SVG. Antes disso, uma chave de formato válido respondia `500 FALHA_INTERNA` (o
erro de tabela ausente subindo como falha interna) em vez de `401 CHAVE_INVALIDA`; fica
registrado porque é o sintoma de "a migration não rodou neste banco", e vai aparecer de novo
em qualquer projeto Supabase novo.

## Ligações

- [`roteiroDePassada.md`](roteiroDePassada.md), a passada dirigida inteira, e o que dela
  já foi observado de fato
- [`../README.md`](../README.md), a assinatura Web do handler, a sonda de empacotamento e
  o que já foi verificado de fato
- [`../_lib/README.md`](../_lib/README.md), os módulos que o handler orquestra
- `../../docs/07_APIS/endpoints.md`, o contrato: rota, corpo, envelope e a tabela de status
- `../../supabase/scripts/executar.mjs`, o mesmo truque de carregar TypeScript pelo Vite,
  do lado dos scripts
