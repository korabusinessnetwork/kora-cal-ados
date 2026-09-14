// A cor de uma categoria, pelo seletor do sistema OU digitada.
//
// Por que digitada importa: o configurador é a tela que o ADR-008 chama de produto vendável por si
// só, e até aqui a única forma de escolher cor era o seletor do sistema operacional. A marca chega
// com o hex do manual dela na mão, e perseguir `#C0392B` no conta-gotas é aproximar, não acertar.
// É o princípio nº1 pelo avesso: a cor que sai é exatamente a que entrou, mas não havia como fazer
// entrar a cor certa.
//
// Arquivo próprio, e não mais um bloco dentro de `TelaDaComposicao.tsx`, por duas razões: o ADR-003
// pede arquivo pequeno de responsabilidade única, e um componente com estado próprio dentro de uma
// tela de 333 linhas é lógica que ninguém consegue testar sem montar o palco 3D inteiro, que exige
// WebGL.
//
// O que NÃO foi compartilhado com o editor de cor do esboço, de propósito: o widget. Os dois
// desenham coisas diferentes (o do esboço tem paleta de atalho, este não) e moram em áreas
// diferentes da árvore. O que os dois precisavam mesmo ter em comum é a REGRA de quando o hex está
// completo, e essa está em `lib/render/estadoDoHexDigitado.ts`, usada pelos dois. Compartilhar a
// regra e não a marcação é o que impede as duas telas de divergirem sobre o que é uma cor sem
// impedi-las de serem telas diferentes.

import { useState } from 'react';

import { estadoDoHexDigitado } from '../lib/render/estadoDoHexDigitado';
import { mensagemDoHexDigitado } from '../lib/render/mensagemDoHexDigitado';
import { validarCor } from '../lib/render/validarCor';

export interface CampoDeCorDaCategoriaProps {
  /** A `zone_key` da categoria. Entra no nome acessível dos dois campos e no id do erro. */
  categoria: string;
  /** A cor em vigor, em `#RRGGBB`. É ela que está pintada na peça agora. */
  cor: string;
  /** Chamado SÓ com hex completo: o preview nunca vê texto pela metade. */
  aoTrocar: (cor: string) => void;
}

/**
 * O id do seletor de cor de uma categoria, no DOM.
 *
 * Existe como função, e não como texto escrito em dois lugares, porque quem precisa dele é OUTRA
 * parte da tela: o painel "Peça clicada" leva o foco até o controle da zona que a pessoa acabou de
 * clicar. O mesmo texto escrito à mão em dois lugares diverge no dia em que um dos dois mudar, e
 * o sintoma seria um botão que não faz nada (ADR-003, "um termo, um nome, sempre").
 */
export function idDoCampoDeCor(categoria: string): string {
  return `composicao-cor-${categoria}`;
}

export function CampoDeCorDaCategoria({ categoria, cor, aoTrocar }: CampoDeCorDaCategoriaProps) {
  // O texto cru do campo, separado da cor em vigor. Sem essa separação, cada tecla mandaria um
  // valor pela metade para o motor e o calçado piscaria durante a digitação.
  const [texto, setTexto] = useState(cor);
  const [corVista, setCorVista] = useState(cor);

  const estado = estadoDoHexDigitado(texto);
  const completo = estado === 'completo';

  // A cor também muda de FORA: gerar pelo prompt, colar uma composição, trocar a peça. Sem isto o
  // texto ficava na cor do primeiro render, com o seletor ao lado e a peça já em outra, e a tela
  // mostrava duas cores para a mesma zona (princípio nº1). O ajuste é durante o render, e não num
  // efeito, para não haver um quadro com as duas cores. A volta da própria digitação (`#f00` que
  // sobe como `#FF0000`) não reescreve o texto de quem ainda está no campo.
  if (cor !== corVista) {
    setCorVista(cor);
    if (!(completo && validarCor(texto, categoria) === cor)) setTexto(cor);
  }
  const idDoErro = `composicao-hex-erro-${categoria}`;

  function digitar(valor: string) {
    setTexto(valor);
    // Sobe a forma que `validarCor` devolve, `#RRGGBB`, e não o texto como veio. A forma curta
    // (`#F00`) é cor, mas vira o `value` do seletor ao lado, e o `<input type="color">` só aceita
    // `#rrggbb`: fora disso ele mostra preto, com a peça vermelha do lado (R10-A73).
    if (estadoDoHexDigitado(valor) === 'completo') aoTrocar(validarCor(valor, categoria));
  }

  function escolherNoSeletor(valor: string) {
    const escolhida = valor.toUpperCase();
    // Os dois campos editam a MESMA cor: mexer na roda precisa atualizar o texto junto, senão os
    // dois passam a mostrar cores diferentes e a tela deixa de dizer qual vai sair.
    setTexto(escolhida);
    aoTrocar(escolhida);
  }

  return (
    <div className="palco3d__cor">
      <input
        type="color"
        id={idDoCampoDeCor(categoria)}
        value={cor}
        aria-label={`cor da zona ${categoria}`}
        onChange={(evento) => escolherNoSeletor(evento.target.value)}
      />
      <input
        type="text"
        className={completo ? 'palco3d__hex' : 'palco3d__hex palco3d__hex--invalido'}
        aria-label={`hex da zona ${categoria}`}
        aria-invalid={!completo}
        aria-describedby={completo ? undefined : idDoErro}
        value={texto}
        spellCheck={false}
        onChange={(evento) => digitar(evento.target.value)}
      />
      {/* Sem `role="alert"`, pela mesma razão registrada no editor do esboço: anunciar a cada tecla
          enquanto a pessoa ainda digita "#C" ensina o time a ignorar aviso justo onde ele custa
          caro. O texto fica à vista e ligado ao campo por `aria-describedby`, que é lido quando o
          foco chega nele. */}
      {!completo && (
        <p className="palco3d__hex-erro" id={idDoErro}>
          {mensagemDoHexDigitado(texto, 'a peça')}
        </p>
      )}
    </div>
  );
}
