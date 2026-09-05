# supabase/scripts — provisionamento (service_role)

O que vive aqui: operações que **exigem service_role** e por isso não podem existir em
`src/` — nada daqui vai para o bundle do navegador. Na Fase 1 a venda é manual e não há
tela de cadastro: a policy de INSERT em `tenants` é `service_role` de propósito
(`docs/11_SEGURANCA/proposta-correcao-rls.md`).

| Arquivo | Papel |
|---|---|
| `provisionarTenant.ts` | Cria tenant + owner + produto e sobe o asset-base **canônico** |
| `caminhoDoAssetBase.ts` | A única definição de `tenants/{tenant_id}/products/{product_id}/base.svg` |
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
