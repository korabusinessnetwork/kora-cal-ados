# Ideias de produto

O que apareceu na auditoria e **não é refinamento**: exige decisão de produto sua, contraria um ADR,
ou abre área nova. Nada daqui é executado por conta própria. É uma lista para você decidir, não um
backlog meu.

Primeira passada em 2026-09-12.

## I01 | Guardar a composição do configurador

**O que é:** hoje a montagem existe só enquanto a aba está aberta. Uma tabela de composições
deixaria a marca salvar, nomear e reabrir um calçado montado.

**Por que não faço sozinho:** o ADR-008 D6 decidiu, em letra, que a composição **não é gravada**.
Criar a tabela é contrariar um ADR, e isso não é refinamento. O refino entrega o meio-termo barato
(A02, copiar o JSON para o clipboard), que dá saída sem inventar schema.

## I02 | Apagar e remarcar zona pelo painel

**O que é:** o `PainelDeZonas` diz em comentário que apagar zona "não existe nesta entrega, botão
ambíguo aqui destruiria mapeamento". Quem marca a zona errada hoje não tem como desfazer pela tela.

**Por que não faço sozinho:** é ação destrutiva sobre o dado mais caro de refazer do sistema,
segundo o próprio ADR-009. Quem decide se ela existe, e com qual confirmação, é você.

## I03 | Busca e filtro na lista de modelos

**O que é:** a lista de modelos não tem busca, ordenação nem contagem no cabeçalho.

**Por que não faço sozinho:** não tem evidência ainda. Com três modelos por marca, busca é ruído na
tela. Isso vira refinamento no dia em que existir um tenant com dezenas de modelos, e aí entra na
auditoria com número em vez de suposição.

## I04 | Escolher cor por seletor visual no editor de zonas

**O que é:** no `PainelDeZonas`, a cor de teste só entra digitada em hex, e hex inválido vira
mensagem de erro. O `CLAUDE.md` prefere prevenção de erro a mensagem de erro, e o configurador 3D já
usa `input type="color"`.

**Por que não faço sozinho ainda:** não vi essa tela rodando, ela fica atrás do login de um tenant
real, e mexer no caminho onde a cor é escolhida sem ter olhado a tela é justamente o que o princípio
nº1 proíbe. Vira achado de auditoria assim que houver como abri-la.

## I05 | Ligar integração contínua no repositório

**O que é:** escrever `.github/workflows/` com typecheck, build e a suíte.

**Por que não faço sozinho:** escrever o arquivo cabe no projeto, mas ligar o Actions e cadastrar os
segredos (`.env.local` do banco, e uma imagem com Chrome para os testes de navegador não sumirem em
silêncio) é ação sua, na sua conta. Está como A14 no backlog da auditoria, e como pendência sua.
