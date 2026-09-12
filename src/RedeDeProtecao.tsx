// A rede por baixo das telas: é o `ErrorBoundary` deste projeto, e o nome técnico está escrito
// aqui de propósito, para quem grepar por ele chegar neste arquivo (ADR-003, "um termo, um nome").
//
// Por que existe, medido e não deduzido: até o R5-A46, com o `getContext` devolvendo `null`, uma
// exceção durante o render derrubava a árvore INTEIRA e `document.body.innerText` ficava vazio.
// Sumia junto o rodapé que levaria ao esboço, que não precisa de WebGL nenhum. Aquele item fechou
// UMA porta, a criação do contexto WebGL, dentro do componente que sabia o que fazer com aquela
// falha específica. Esta é a rede por baixo das portas que ninguém listou, e o palco carrega glTF,
// faz raycast e conversa com o three, que é o tipo de código de onde sai a próxima.
//
// Página em branco é o pior desfecho possível para o princípio nº1: não diz o que houve, não diz o
// que fazer, e tira da pessoa até o caminho para a tela que funcionaria. A rede troca isso por uma
// frase e pelas saídas para as outras telas.
//
// As saídas aqui são `<a href>`, e não os botões do `RodapeDeTelas`. O motivo é a situação: quando
// esta rede aparece, o que quebrou pode ter sido o próprio `App`, e aí não existe mais estado de
// navegação para um `onClick` mexer. Endereço funciona com a árvore morta; botão, não.
//
// E elas são OPCIONAIS, o que foi aprendido no navegador e não no teste: dentro do `App` o rodapé
// fica fora da rede e sobrevive à falha, então a rede desenhando as próprias saídas deixava a mesma
// lista de três destinos duas vezes seguidas na tela, uma em links e outra em botões. Duas listas
// idênticas uma embaixo da outra fazem a pessoa parar para descobrir se são diferentes. Quem já tem
// rodapé pede `comSaidas={false}`; quem não tem (a rede de `main.tsx`, onde o `App` inteiro é que
// pode ter caído) fica com o padrão, porque rede sem saída nenhuma é beco sem saída.

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ROTULO_DA_SAIDA, saidasDe } from './saidasDaTela';
import { urlDaTela, type Tela } from './telaInicial';

interface Props {
  /** A tela protegida. É ela que NÃO aparece entre as saídas, porque é a que acabou de quebrar. */
  atual: Tela;
  /** Desenhar as saídas. `false` para quem já tem um `RodapeDeTelas` vivo fora da rede. */
  comSaidas?: boolean;
  children: ReactNode;
}

interface Estado {
  /** A falha que derrubou a tela, ou `null` enquanto está tudo de pé. */
  falha: Error | null;
}

export class RedeDeProtecao extends Component<Props, Estado> {
  // Classe, e não hook, porque React não oferece outro jeito: `getDerivedStateFromError` e
  // `componentDidCatch` só existem em componente de classe. É a única do projeto, e é por isso.
  override state: Estado = { falha: null };

  static getDerivedStateFromError(falha: unknown): Estado {
    return { falha: falha instanceof Error ? falha : new Error(String(falha)) };
  }

  override componentDidCatch(falha: Error, info: ErrorInfo): void {
    // O console é o único destino que existe hoje: o projeto não tem coletor de erro, e contratar
    // um é custo, que é decisão do dono (CLAUDE.md, "bootstrap gratuito"). Sai a mensagem e a pilha
    // de componentes, não o estado da tela, que é onde dado de pessoa estaria.
    console.error('Falha não tratada na tela:', falha.message, info.componentStack);
  }

  override render(): ReactNode {
    const { falha } = this.state;
    if (falha === null) return this.props.children;

    return (
      <main className="sessao-aviso rede-de-protecao">
        <div>
          <h1>Esta tela parou de funcionar</h1>
          {/* A mensagem da falha aparece para a pessoa ter o que contar a quem vai consertar.
              Uma tela que só diz "algo deu errado" transforma um relato de bug em adivinhação. */}
          <p className="rede-de-protecao__motivo">
            <code>{falha.message === '' ? 'Erro sem mensagem.' : falha.message}</code>
          </p>
          {/* "As saídas" e não "os endereços abaixo": com `comSaidas={false}` o que está abaixo
              são os botões do rodapé, e a frase tem de valer nos dois casos. */}
          <p>
            O erro é desta tela, não das outras. Recarregar tenta de novo do zero, e as saídas para
            as outras telas continuam valendo.
          </p>
          {this.props.comSaidas === false ? null : (
            <p className="rodape-telas">
              {saidasDe(this.props.atual).map((destino) => (
                <a key={destino} href={urlDaTela(destino, window.location.pathname)}>
                  {ROTULO_DA_SAIDA[destino]}
                </a>
              ))}
            </p>
          )}
        </div>
      </main>
    );
  }
}
