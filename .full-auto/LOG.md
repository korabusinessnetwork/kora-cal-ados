# Log de execução

<!-- uma linha por tarefa: data · id · resultado · commit -->
2026-09-10 · T01 · normalização de modelo 3D, nome próprio e material próprio por malha · 784bf4c
2026-09-10 · T02 · motor de cor do calçado 3D e a conversão sRGB→linear num lugar só · 5329d74
2026-09-10 · T03 · termos do ADR-008 no glossário (acervo, peça, categoria, composição, forma) · 5cebbe5
2026-09-10 · T04 · validação de composição, o guarda da saída do modelo de linguagem (ADR-008 D1) · 10e90dc
2026-09-10 · T10 · typecheck de supabase/scripts — já estava resolvida, pendência vencida · sem mudança
2026-09-10 · T11 · ADR-009, a politica de saida do cliente, antes de a pergunta ser feita · 93c356a
2026-09-10 · T12 · acervo de prova em glTF 2.0 valido, 5 pecas geradas por codigo · d63116f
2026-09-10 · T13 · palco 3D no navegador, peca na tela e identificada por clique · a4b644b
2026-09-10 · T14 · calcado montado em cena, cada peca no lugar e a cor na peca certa · 4b7f520
2026-09-12 · T15 · configurador sem IA nenhuma, o fallback gratuito do ADR-008 · 11f4e9d
2026-09-12 · T17 · o primeiro teste que olha a cor na TELA, e nao a cor no arquivo · e49bf84
2026-09-12 · R1-A01 · cena 3D ao lado dos controles entre 860 e 1100 px, o canvas volta para dentro da tela em 1024x768 · 14796e4
2026-09-12 · R1-A04 · ProvedorDeSessao ganhou teste, 15 casos com cliente falso, 6 estados e a guarda de escolherTenant · 12701c5
2026-09-12 · R1-A03 · asset-base vazio ou sem raiz <svg> vira erro nomeado, nunca mais painel em branco · 24e28ac
2026-09-12 · R1-A02 · a composição montada sai da tela em JSON, com função pura testada e caminho alternativo quando o navegador nega a área de transferência · bdcd6de
2026-09-12 · R1-A05 · cada tela escreve o próprio título de aba, o mapa cobre as quatro por tipo · 34d56a6
2026-09-12 · R1-A06 · a categoria dispensada diz "Nenhuma peça", a zone_key saiu da frase em português · 367539a
2026-09-12 · R1-A07 · o configurador escreve a faixa do parâmetro, mínimo e máximo em milímetros · 231fdb2
2026-09-12 · R1-A08 · os botões de peça anunciam a escolha por aria-pressed, nas duas telas do palco · 5e35551
2026-09-12 · R2-A22 · uma função só para "N elementos", e o quarto lugar parou de escrever "1 elementos marcáveis" · 5d5fc02
2026-09-12 · R2-A18 · gravar a zona passa a dizer o que foi gravado, nomeando a zona e se ela nasceu ou cresceu · 53078f8
2026-09-12 · R2-A19 · a contagem de marcados vira região viva educada, o par do contorno para quem não o enxerga · 06dc545
2026-09-12 · R2-A09 · listarZonasDoProduto sai de único módulo de zonas sem teste, 6 casos com cliente falso · 640234c
2026-09-12 · R2-A17 · o esboço cabe na tela abaixo de 1220 px, duas quebras e o painel da API descendo para a linha inteira · 01e8841
2026-09-12 · R2-A20 · o editor de cor do esboço diz o que está errado e de qual zona é cada campo · 77281f9
2026-09-12 · R2-A11 · o canvas do palco 3D ganha nome e a peça clicada vira região viva, nas duas telas · cf00aab
2026-09-12 · R2-A10 · falha de rede deixa de virar "conta não vinculada", com estado próprio e "Tentar de novo" · 433e8eb
2026-09-12 · R3-A27 · a regra do hex vira uma só nos três lugares, e o configurador ganha campo de texto · 995912c, acd3a97
2026-09-12 · R3-A26 · o descarte de estado ao trocar de produto sai do escuro, sonda lê TODAS as passagens · a5b713a
2026-09-12 · R3-A29 · a cascata do achatamento de CSS presa por teste, nove mutações rodadas · 4870294
2026-09-12 · R3-A33 · o baseline para de piscar vermelho sozinho, espera por condição e não por quadro · 1788a10
2026-09-12 · R3-A30 · em 375 px a cena vem antes dos controles e fica presa no topo enquanto eles rolam · a98a953
2026-09-12 · R3-A28 · contexto WebGL perdido deixa de ser "Peça na cena", estado e frase próprios · 37b96a6
2026-09-12 · R4-A39 · em 375 px o calcado do esboco vem antes da lista de zonas e fica preso no topo, 1000 para 199 px · 637cf15
2026-09-12 · R4-A40 · os tipos do three passam a ser os da versao que roda, com varredura de fonte que impede a volta · 5edce98, f5ee209
2026-09-12 · R4-A34 · quatro rodapes escritos a mao viram um modulo de dados e um componente burro, e o chunk encolheu · 2259266
2026-09-12 · R4-A36 · os oito atalhos de cor viram alvo de 24 px com o nome da cor junto do hex · 8798467
2026-09-12 · R4-A37 · corpo grande demais e recusado antes de ser lido inteiro, teto de 64 kB em duas conferencias · c8f65f1
2026-09-12 · R4-A38 · a regra da copia sobe para src/lib, a composicao migra e o esboco ganha o botao que copia o corpo · 9520052, a7caf05, edf3d40
2026-09-12 · R5-A46 · maquina sem WebGL deixa de apagar a pagina inteira: a falha de criacao vira o estado contexto-negado em vez de subir ate o React · 2077f0a
2026-09-12 · R5-A41 · tabela criada sem RLS vira teste vermelho, varredura de fonte sobre as migrations que roda sem banco · 88d273d
2026-09-12 · R5-A45 · seis citacoes de ADR-008 D6 passam a dizer a verdade, e uma varredura confere que todo ADR-XXX DN do codigo existe · 7738fc9, 5c25cdc
2026-09-12 · R5-A47 · o JSON da composicao volta para a tela pelo mesmo guarda que a API usa, e recusa nao encosta no calcado que esta na tela · 84279b6
2026-09-12 · R5-A44 · os tres hooks de rede do editor recebem o cliente por parametro, e a etiqueta de origem tira a lista do id anterior da tela do id novo no mesmo render · 04e890b, f699fb3
2026-09-12 · R5-A43 · o painel Peca para de prometer a montagem como tarefa futura e aponta para o calcado montado, com o nome que o rodape usa · d5c262f
2026-09-12 · R6-A51 · a raiz ganha rede de protecao: excecao de render deixa de apagar a pagina inteira, e o rodape fica fora da rede para a navegacao sobreviver · 40d28c2
2026-09-12 · R6-A50 · a peca clicada mostra o no E a zona, tirados da montagem em cena, e o botao leva o foco ao seletor de cor daquela categoria · df3e77c
2026-09-12 · R6-A49 · a TelaDaComposicao, arquivo mais tocado do projeto, ganha 6 testes de comportamento em jsdom · 44b2741
2026-09-12 · R6-A48 · a moldura preta vazia some no contexto-negado e a mensagem sobe de 365 para 143 px do topo, e continua de pe no contexto-perdido · 9a1a72d
2026-09-12 · R6-A42 · os nove diretorios sem indice ganham README, a raiz inclusive, e diretorio com codigo e sem README passa a reprovar em npm test · cc80ca4, ac2d3ae
2026-09-12 · R6-A52 · a area protegida entra por import() tardio e o chunk principal cai de 457,75 kB para 218,97 kB, com varredura que reprova se o App.tsx voltar a importar features/ · 55a91ca, cff0fe3
2026-09-12 · R7-A53 · tenant_members.user_id e tenant_api_keys.created_by ganham indice proprio, com varredura que reprova chave estrangeira sem indice que a lidere · e11f072
2026-09-12 · R7-A55 · o painel de colar deixa de ter regiao viva dentro de regiao viva, e o aceite passa a ser anunciado · 282626b
2026-09-12 · R7-A56 · o botao Voltar do navegador anda entre as telas, pushState mais ouvinte de popstate · ccae056
2026-09-12 · R7-A57 · a composicao sobrevive ao F5 pelo localStorage, lida de volta pelo mesmo guarda da colagem, e gravacao invalida cai no padrao · b982977, 3c4a921
2026-09-12 · R7-A58 · todos os parametros da peca ganham controle e mexer num soma aos outros em vez de substituir · a7c1975, 4d7033f
2026-09-12 · R7-A54 · a TelaDaComposicao cai de 457 para 195 linhas em tela mais quatro paineis, com os 14 testes da tela intocados e HTML identico antes e depois · 3671802
2026-09-12 · R8-A61 · o build sai sem aviso, com o limite de chunk logo acima do three.js, e a linha do baseline que dizia limpo foi corrigida · 3ed3e8e
2026-09-12 · R8-A59 · botão de voltar ao calçado de prova com Desfazer e foco levado nos dois sentidos, e o estado das escolhas num hook que devolve a tela a 160 linhas · e8f1ed7
2026-09-12 · R8-A60 · os botões do rodapé de telas passam de 18 para 24 px de altura, medidos a 375 px nas quatro telas, com guarda na folha · bbafd26
2026-09-12 · R8-A62 · 22 textos de tela, erro e terminal sem travessão, e uma varredura por parser que reprova literal e deixa comentário e teste de fora · 6259ae3
2026-09-12 · R8-A63 · a tela de uma peça desenha um controle por parâmetro e manda todos ao glTF, e o valor herdado entre peças de mesmo parâmetro virou achado · 33d8573
2026-09-13 · R9-A67 · trocar de peça na tela de uma peça volta os parâmetros ao padrão da peça nova · COMMIT
2026-09-13 · R9-A68 · milímetros e passo do controle de parâmetro definidos num lugar só, com HTML idêntico · COMMIT
2026-09-13 · R9-A70 · o campo de hex diz o que falta, igual nas duas telas, e hex sem # ganha frase própria · COMMIT
2026-09-13 · R9-A69 · os testes das duas telas selecionam uma peça de verdade antes de conferir a limpeza, com o palco real montado · COMMIT
