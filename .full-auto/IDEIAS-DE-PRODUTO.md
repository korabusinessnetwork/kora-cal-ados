# Ideias de produto

O que apareceu na auditoria e **não é refinamento**: exige decisão de produto sua, contraria um ADR,
ou abre área nova. Nada daqui é executado por conta própria. É uma lista para você decidir, não um
backlog meu.

Primeira passada em 2026-09-12.

## I01 | Guardar a composição do configurador

**O que é:** hoje a montagem existe só enquanto a aba está aberta. Uma tabela de composições
deixaria a marca salvar, nomear e reabrir um calçado montado.

**Por que não faço sozinho:** é área nova, com schema novo, RLS nova e tela de "meus calçados", e
isso é decisão de produto do dono, não refinamento. Nenhum ADR proíbe guardar composição, e nenhum
manda guardar: simplesmente não existe decisão sobre isso, e inventá-la sozinho seria decidir o
produto. O refino entrega o meio-termo barato (A02, copiar o JSON para o clipboard), que dá saída
sem inventar schema.

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

## I06 O editor real mostrar a chamada de API equivalente, como o esboço mostra

O esboço tem o painel "chamada equivalente", que é onde o princípio nº1 fica visível: o hex da tela
é o hex do corpo do pedido. O editor de verdade, que é onde as zonas do cliente são mapeadas, não
tem nada disso, então quem acabou de mapear não tem como entregar ao cliente o exemplo de chamada
com as chaves que acabou de criar.

Por que é ideia e não tarefa: o painel do esboço é a representação do contrato da API, e o
comentário dele registra que já exibiu, por semanas, um contrato que nunca existiu. Fazer uma
SEGUNDA cópia no editor é repetir esse erro de propósito. O caminho certo é extrair o montador do
exemplo para um módulo usado pelos dois, e isso é mexer no que representa o contrato, com o risco
que isso carrega. Score pelo critério do refino: valor 4, esforço 3, risco 3, o que dá -1, abaixo
do corte. Vale a decisão do dono, não a minha.
