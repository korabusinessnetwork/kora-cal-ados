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
