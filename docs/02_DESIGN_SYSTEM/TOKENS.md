# Tokens — Kora Calçados (codinome)

> Implementação: `src/estilos/tokens.css`. Sobrescrita por tenant:
> `src/features/tenant/aplicarTemaDoTenant.ts`.

Os **valores** abaixo são neutros de propósito — a identidade visual do produto não
existe ainda (ver README desta pasta). O que já é definitivo são os **nomes**: token não
muda de nome quando a marca chega, só de valor. É isso que permite o white-label.

## Cor

| Token | Valor neutro | Uso |
|---|---|---|
| `--cor-superficie` | `#ffffff` | Fundo de página e de cartão |
| `--cor-superficie-elevada` | `#f6f7f8` | Painel sobre a página (formulário) |
| `--cor-borda` | `#d9dde1` | Contorno de campo, cartão e divisória |
| `--cor-texto` | `#1c2126` | Texto principal |
| `--cor-texto-suave` | `#5b6670` | Rótulo, metadado, estado vazio |
| `--cor-primaria` | `#2f3e4d` | Ação principal |
| `--cor-primaria-texto` | `#ffffff` | Texto sobre a ação principal |
| `--cor-erro` / `--cor-erro-superficie` | `#a4271c` / `#fdf1ef` | Falha, recusa de arquivo |
| `--cor-sucesso` / `--cor-sucesso-superficie` | `#1f6b45` / `#eff7f2` | Confirmação |
| `--cor-aviso` / `--cor-aviso-superficie` | `#8a6100` / `#fdf6e7` | Relatório de normalização |

## Espaçamento, tipografia e forma

| Token | Valor |
|---|---|
| `--espaco-1` … `--espaco-7` | `0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`, `3rem` |
| `--fonte-base` | pilha de fonte de sistema |
| `--fonte-tamanho-pequeno` / `-base` / `-titulo` | `0.8125rem` / `0.9375rem` / `1.25rem` |
| `--fonte-altura-linha` | `1.5` |
| `--raio-borda` | `6px` |
| `--sombra-elevada` | sombra de painel |

## Contrato de `tenants.tema`

`tema` é `jsonb` livre no banco, mas só estas chaves viram token — qualquer outra é
**ignorada**:

| Chave em `tema` | Token |
|---|---|
| `cor_primaria` | `--cor-primaria` |
| `cor_primaria_texto` | `--cor-primaria-texto` |
| `cor_superficie` | `--cor-superficie` |
| `cor_superficie_elevada` | `--cor-superficie-elevada` |
| `cor_borda` | `--cor-borda` |
| `cor_texto` | `--cor-texto` |
| `cor_texto_suave` | `--cor-texto-suave` |

```json
{ "cor_primaria": "#C0392B", "cor_texto": "#111111" }
```

Só cor hex (`#abc` ou `#aabbcc`) é aceita — mesma disciplina do motor de render
(ADR-004, q3). Valor inválido cai para o token neutro em vez de derrubar a interface.

**Por que a lista é fechada**: `tema` é editável pelo owner do tenant. Se qualquer chave
virasse custom property, um tenant poderia injetar CSS arbitrário na própria interface.
Chave nova entra aqui e em `TOKENS_DO_TENANT` no mesmo commit.

## A regra que vale acima de todas

Nenhum token daqui encosta na **cor de zona**. Cor de zona é dado do cliente e vira
calçado fabricado: nada de `filter`, `opacity`, `mix-blend-mode` ou overlay do tema sobre
a área que mostra a cor aplicada. É o princípio nº1 do `CLAUDE.md` em forma de CSS.
