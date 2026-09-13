// As frases que dizem QUEM compôs o calçado a partir do prompt, e o que foi feito.
//
// Existe por uma regra de `memory/restrictions.md` (Transparência de IA): a interface diz, no lugar
// em que o calçado aparece, que ele foi composto automaticamente a partir de um prompt, e diz o que
// foi feito e o que não foi: peças que já existiam no acervo foram escolhidas e estilizadas, nenhum
// calçado foi desenhado. A segunda metade importa porque o designer que acredita que a máquina
// esculpiu a sola descobre o teto do produto da pior forma.
//
// E existe a regra inversa, que é a razão de a frase depender de quem respondeu: o gerador de prova
// NÃO é IA (D12). Uma frase fixa dizendo "a IA escolheu" mentiria hoje, e uma frase fixa dizendo
// "palavras-chave" mentiria no dia em que um fornecedor de verdade entrar.

/** Quem responde o prompt, do jeito que a tela precisa saber. */
export interface DescricaoDoModelo {
  /** `false` para o gerador de prova, que entende palavras-chave e não é modelo de IA. */
  ehIa: boolean;
  /** Como ele é chamado na frase: "o gerador de prova", ou o nome do fornecedor. */
  nome: string;
}

/** O aviso que fica perto do calçado enquanto o que está em cena é o que o prompt compôs. */
export function avisoDaComposicaoGerada({ ehIa, nome }: DescricaoDoModelo): string {
  const quem = ehIa ? `${nome}, um modelo de linguagem (IA)` : `${nome}, que não é IA e reconhece palavras-chave`;

  return (
    `Composto automaticamente a partir do seu prompt. Quem compôs: ${quem}. ` +
    'Foram escolhidas peças que já existiam no acervo, com a cor e as medidas delas; nenhuma peça foi desenhada.'
  );
}

/** A ajuda fixa do painel de prompt, lida ANTES de gerar: quem vai responder e o que ele entende. */
export function quemRespondeOPrompt({ ehIa, nome }: DescricaoDoModelo): string {
  if (ehIa) {
    return `Quem responde é ${nome}, um modelo de linguagem (IA). A resposta passa pelo mesmo guarda da colagem.`;
  }

  return (
    `Quem responde é ${nome}, que não é IA: ele reconhece o nome da categoria, palavras do nome da ` +
    'peça, cor por nome ou hex, "sem" antes de uma categoria opcional, "grossa" e "fina". ' +
    'A resposta passa pelo mesmo guarda da colagem.'
  );
}
