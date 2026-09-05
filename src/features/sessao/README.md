# src/features/sessao — quem entrou e em qual marca

O que vive aqui: autenticação e **tenant ativo**. O que **não** vive aqui: produto, zona,
variante — cada uma tem a própria feature.

Entrada: `<ProvedorDeSessao>` no topo da árvore e `<RotaProtegida>` em volta de tudo que
toca o banco.

| Arquivo | Papel |
|---|---|
| `ContextoDeSessao.tsx` | O estado da sessão e as ações (`entrar`, `sair`, `escolherTenant`, `trocarDeTenant`) |
| `useSessao.ts` | Único jeito de ler a sessão — componente nenhum importa o contexto direto |
| `carregarTenantsDoUsuario.ts` | A que tenants o usuário pertence e com que papel (campos explícitos) |
| `tenantLembrado.ts` | Preferência de interface: qual marca ele escolheu por último, por `user_id` |
| `TelaDeLogin.tsx` | Formulário, puramente apresentacional (recebe estado e callback) |
| `SeletorDeTenant.tsx` | Escolha de marca quando há 2+ |
| `RotaProtegida.tsx` | O portão: decide qual das telas acima aparece |
| `BarraDaSessao.tsx` | Marca ativa sempre visível + sair |

## Sessão = usuário **e** tenant

Os dois, sempre. Um usuário autenticado sem tenant escolhido não pode ver tela nenhuma:
toda linha do banco pertence a um tenant, e uma consulta disparada antes de a marca estar
decidida é como um app multi-tenant acaba mostrando dado do concorrente.

Por isso `RotaProtegida` recebe `children` como **função** (`(tenant) => ReactNode`) — o
tenant chega tipado e não existe caminho em que a tela renderize com `tenantAtivo` nulo.

## "Pega o primeiro tenant" é proibido

Com 2+ marcas, o app **pergunta** e espera. Escolher sozinho faria o time abrir o produto
da marca errada sem perceber e publicar variante no catálogo de um concorrente. Com uma
marca só, entra direto — não há escolha a fazer.

A escolha é lembrada por `user_id` no `localStorage` para o F5 não custar uma decisão. É
só preferência de interface: quem decide o que aquele tenant pode ler é a RLS, e o
contexto ainda confere se o id lembrado está na lista que o banco devolveu.

## Estados

`carregando` · `anonimo` · `entrando` · `escolhendo-tenant` · `sem-tenant` · `pronta`

`entrando` existe separado de `carregando` porque a tela desenhada é outra: mantém o
formulário montado, então senha errada não custa redigitar o e-mail.

`sem-tenant` é estado vazio **com saída** — na Fase 1 o vínculo é criado por script
(venda manual), então a ação certa é falar com quem provisiona.

## Mensagem de login é genérica de propósito

"E-mail ou senha inválidos", nunca "esse e-mail não existe": a segunda conta a um estranho
quem tem conta aqui. Quem é legítimo sabe qual dos dois errou.
