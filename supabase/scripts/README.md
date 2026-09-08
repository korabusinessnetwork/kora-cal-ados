# supabase/scripts — provisionamento (service_role)

O que vive aqui: operações que **exigem service_role** e por isso não podem existir em
`src/` — nada daqui vai para o bundle do navegador. Na Fase 1 a venda é manual e não há
tela de cadastro: a policy de INSERT em `tenants` é `service_role` de propósito
(`docs/11_SEGURANCA/proposta-correcao-rls.md`).

| Arquivo | Papel |
|---|---|
| `provisionarTenant.ts` | Cria tenant + owner + produto e sobe o asset-base **canônico** |
| `caminhoDoAssetBase.ts` | A única definição de `tenants/{tenant_id}/products/{product_id}/base.svg` |
| `semearZonasDeTeste.ts` | Semeia, num produto, os dois estados que o **editor se recusa a criar** e que o banco pode ter mesmo assim: zona de gradiente e zonas sobrepostas |
| `criarChaveDeApi.ts` | Cria uma **chave de API** para um tenant e a exibe **uma única vez** |
| `revogarChaveDeApi.ts` | Revoga uma chave de API pelo prefixo (preenche `revoked_at`; nunca apaga a linha) |
| `executar.mjs` | Carregador: roda um script `.ts` que importa o motor de render |

## Provisionar uma marca

```bash
node --env-file=.env.local supabase/scripts/executar.mjs \
  supabase/scripts/provisionarTenant.ts \
  --nome "Calçados Aurora" --slug aurora \
  --email dono@aurora.com.br --senha "senha-combinada" \
  --produto "Runner 2026" --svg caminho/do/arquivo.svg
```

`--svg` é opcional (usa o tênis de demo). A **senha é obrigatória e escolhida por quem
provisiona**: o script não inventa nem imprime credencial (CLAUDE.md — nunca logar dado
sensível). Combine-a com o cliente por fora.

## Semear os estados que o editor recusa

```bash
npm run semear-zonas -- --produto <uuid>            # semeia
npm run semear-zonas -- --produto <uuid> --limpar   # remove
```

Desde a Etapa 4 o editor recusa, no clique, tanto o elemento que não aceita cor chapa quanto
o que já pertence a outra zona. Ótimo para quem marca — e péssimo para verificar: os
caminhos de falha viram inalcançáveis **pela tela**, e continuam alcançáveis na vida real
(mapeamento gravado antes da regra, importação futura, correção manual no banco). Se a tela
reagir mal a isso, ninguém descobre, porque ninguém consegue produzir o estado clicando.

O SVG é lido do Storage, nunca remontado aqui: os ids que vão para o `svg_selector` precisam
ser os do arquivo que o navegador recebe, senão a semeadura testa outra coisa.

## Criar e revogar chave de API

> **Dependem da migration `20260908_chave_de_api_por_tenant.sql`, que ainda NÃO foi
> aplicada.** Enquanto a tabela `tenant_api_keys` não existir no banco, os dois scripts
> falham com erro de tabela inexistente. Aplique a migration antes de rodar.

```bash
npm run criar-chave -- --tenant aurora --ambiente test \
  --label "ERP da Aurora" --email dono@aurora.com.br

npm run revogar-chave -- --prefixo 7f3ab902
```

`--ambiente` é obrigatório e **não tem padrão**: emitir uma chave `live` por engano é o
acidente que a ausência de padrão previne. `--label` e `--email` são opcionais — o e-mail
vira `created_by` e, se não existir usuário com ele, o script falha em vez de gravar
`created_by` nulo em silêncio.

A chave é impressa **uma única vez**. O banco guarda só o `prefixo` (em claro) e o hash
SHA-256 do segredo, então "ver a chave de novo" é impossível por construção, não por falta
de tela (ADR-006, D1). Perdeu: revogue o prefixo e crie outra. O formato vem inteiro de
`api/_lib/formatoDaChaveDeApi.ts` — nenhum destes scripts relê o formato por conta própria.

Revogar **preenche `revoked_at`, nunca apaga a linha** (ADR-006, D4): chave apagada leva
embora a resposta para "quem estava usando isto quando aconteceu". Revogar duas vezes é
inofensivo — o script diz a data e sai sem erro. O argumento é o **prefixo**, não a chave,
porque o prefixo é o que sobra depois da exibição única e porque a chave inteira num
comando passearia pelo histórico do shell.

## Esta pasta passou a ser typechecada em 2026-09-08

Até então não era: o `include` do `tsconfig.json` listava `api`, `src`, `supabase/tests` e
`vite.config.ts`, e mais nada. `include` é uma allowlist — o que fica de fora não é
verificado, e ninguém percebe, porque o `npm run typecheck` continua verde exatamente como
ficaria se estivesse tudo certo. Scripts que rodam com `service_role` contra o banco de
produção eram a última pasta do projeto que deveria estar nessa situação.

A suposição registrada no plano era de que incluí-la acenderia uma pilha de erros antigos e
por isso mereceria commit separado. Conferido: acende **zero**. A pasta já estava correta;
o que faltava era alguém olhar. Custo de fechar a lacuna: uma palavra no `include`.

## Por que existe o `executar.mjs`

Os scripts importam `src/lib/render/normalizarSvg` — **têm** de importar, porque
normalizar com uma segunda implementação é exatamente o que o princípio nº1 proíbe. O
Node executa TypeScript, mas não resolve os imports sem extensão que o motor usa e falha
com `ERR_MODULE_NOT_FOUND`. A alternativa seria uma dependência nova (`tsx`, `vite-node`);
não se paga, porque o Vite já é dependência do projeto e resolve isso em quatro linhas.

## A ordem das operações não é arbitrária

1. **Normaliza antes de tocar no banco** — arquivo recusado não deixa tenant pela metade.
2. **Sobe o arquivo antes de inserir a linha** — produto cujo `base_asset_path` aponta
   para objeto inexistente foi exatamente o estado que quebrava `supabase/tests/`.
3. **Se o INSERT falhar, remove o objeto** — senão sobra órfão no bucket, cobrando espaço
   e confundindo quem for auditar o Storage.

O `product_id` é gerado no script (não pelo banco) porque o caminho do Storage precisa
dele **antes** de a linha existir.

## O que sobe é o canônico, e ele é imutável

O Storage guarda a saída de `normalizarSvg`, com os ids de elemento já cunhados — é deles
que sai o `svg_selector` de cada zona. O editor **nunca** normaliza nem regrava o arquivo
(ADR-005): asset imutável elimina a classe inteira de problemas de escrita concorrente,
já que o Storage não tem escrita condicional.
